import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_SIGN,
  BANK_SIZE,
} from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import {
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_CARRY,
  FLAG_OVERFLOW,
} from '../../src/constants/cpu-flags.mjs';
import {
  VMADDL,
  MDMAEN,
  A1T4L,
  DAS4L,
  CGADD,
  A1B4,
} from '../../src/constants/hardware-registers.mjs';
import { PORTRAIT_DMA_REQUEST, PORTRAIT_PALETTE_START } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;
const STATUS_NVZC = STATUS_NZ | FLAG_OVERFLOW | FLAG_CARRY;
const OVERFLOW_FLAG_SHIFT = 6;
const DP_PORTRAIT_POINTER = 0xf6;
const DP_PORTRAIT_BANK = 0xf8;
const PALETTE_SOURCE_OFFSET = 3;
const PALETTE_TRANSFER_BYTES = 0x1e;
const PALETTE_DMA_CHANNEL_MASK = 0x10;

// ROM-derived local request algorithm. Device execution and setup/wait
// owners are separate boundaries; DP reads always use bank 00.
export function prepareRender8FBA({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  ioMode = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests')
  )
    throw Error('Invalid render transfer palette context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    2,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(render8FBA(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Inner operation shares the outer owner's overlay and budget; it cannot
// create a separately applicable commit payload.
export function render8FBA(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gate',
    gate = null,
    pointer = null,
    pointerOffset = null,
    paletteIndex = null,
    sourceBank = null;
  const base = bank * BANK_SIZE,
    operations = [],
    ioWrites = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, space, address, value, bytes) => {
    const event = Object.freeze({ kind, space, phase, address, value, bytes });
    operations.push(event);
    if (space === 'io') ioWrites.push(event);
    return value;
  };
  const read = (address, bytes = 2) => {
    tick();
    const value = view.read(address) | (bytes === 2 ? view.read(address + 1) << BYTE_BITS : 0);
    return record('read', 'data', address, value, bytes);
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    const address = base + offset;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', 'data', address, value, bytes);
  };
  const register = (offset, value, bytes = 2) => {
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) write(offset, value, bytes);
    else if (!(bank & BANK_WITHOUT_IO)) {
      tick();
      const address = base + offset;
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      record('write', 'io', address, value, bytes);
    } else
      throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
  };
  const result = (outcome, a, finalStatus) => ({
    handled: true,
    outcome,
    a,
    x,
    y,
    bank,
    status: finalStatus,
    carry: finalStatus & 1,
    overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
    gate,
    pointer,
    pointerOffset,
    paletteIndex,
    sourceBank,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    gate = read(base + PORTRAIT_DMA_REQUEST);
    if (gate & WORD_SIGN)
      return result('gate_0140_negative', gate, (status & ~STATUS_NZ) | FLAG_NEGATIVE);
    phase = 'request';
    register(VMADDL, gate);
    register(MDMAEN, 1, 1);
    pointer = read(DP_PORTRAIT_POINTER);
    const sum = pointer + PALETTE_SOURCE_OFFSET;
    pointerOffset = sum & WORD_MASK;
    const carry = Number(sum > WORD_MASK),
      overflow =
        ~(pointer ^ PALETTE_SOURCE_OFFSET) & (pointer ^ sum) & WORD_SIGN ? FLAG_OVERFLOW : 0;
    register(A1T4L, pointerOffset);
    register(DAS4L, PALETTE_TRANSFER_BYTES);
    paletteIndex = read(base + PORTRAIT_PALETTE_START, 1);
    register(CGADD, paletteIndex, 1);
    sourceBank = read(DP_PORTRAIT_BANK, 1);
    register(A1B4, sourceBank, 1);
    register(MDMAEN, PALETTE_DMA_CHANNEL_MASK, 1);
    phase = 'marker';
    write(PORTRAIT_DMA_REQUEST, WORD_MASK);
    return result(
      'request_prepared',
      WORD_MASK,
      (status & ~STATUS_NVZC) | FLAG_NEGATIVE | carry | overflow,
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
