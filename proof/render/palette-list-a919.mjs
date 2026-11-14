import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  BYTE_BITS,
  BYTE_MASK,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  NMI_JOB_LISTS,
  PALETTE_UPLOAD_LIST_BYTES,
  PALETTE_UPLOAD_LIST,
} from '../../src/task/wram.mjs';
import { A1T4L, DAS4L, CGADD, A1B4, MDMAEN } from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const TRANSFER_STACK_BYTES = 3;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = 0x82;
const PALETTE_POINTER_SHIFT = 4;
const PALETTE_SOURCE_BIAS = 0xf1ba;
const PALETTE_POINTER_CARRY_SHIFT = 12;
const PALETTE_BYTES = 0x1e;
const CGRAM_INDEX_SCALE = 8;
const CGRAM_BASE = 0x81;
const CGRAM_CARRY_SHIFT = 5;
const BYTE_VALUES = 256;
const BYTE_SIGN_BIT = 0x80;
const OVERFLOW_BIT = 0x40;
const PALETTE_SOURCE_BANK = 0x8d;
const DMA_CHANNEL_MASK = 0x10;
const STATUS_NZCV = 0xc3;

// Full localA919 data/request algorithm. No CPU, DMA, palette latch or
// interrupt execution. Signed postvisit counter and ordered aliases retained.
export function prepareRenderA919({
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
    throw Error('Invalid render palette list context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    TRANSFER_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(renderA919(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Shared-view operation for an explicit outer owner. Only an outer
// finish may create a commit payload; later boundaries discard all requests.
export function renderA919(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gates',
    gate,
    count = null,
    initialY = null,
    iterations = 0;
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
  const readWord = (address) => {
    tick();
    // Native contiguous data space: odd words can cross FFFF into the
    // next bank. Both actual addresses need explicit bytes and ownership.
    return record(
      'read',
      'data',
      address,
      view.read(address) | (view.read(address + 1) << BYTE_BITS),
      2,
    );
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
    count,
    initialY,
    iterations,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    gate = readWord(base + NMI_JOB_LISTS);
    if (gate === 0) return result('gate_1562_zero', 0, (status & ~STATUS_NZ) | 2);
    count = y = readWord(base + PALETTE_UPLOAD_LIST_BYTES);
    if (count === 0) return result('gate_17D4_zero', gate, (status & ~STATUS_NZ) | 2);
    initialY = y = (y - 2) & WORD_MASK;
    phase = 'records';
    let carry, overflow;
    do {
      const value = readWord(base + PALETTE_UPLOAD_LIST + y);
      const pointer =
        (((value << PALETTE_POINTER_SHIFT) & WORD_MASK) +
          PALETTE_SOURCE_BIAS +
          ((value >>> PALETTE_POINTER_CARRY_SHIFT) & 1)) &
        WORD_MASK;
      register(A1T4L, pointer);
      register(DAS4L, PALETTE_BYTES);
      // BYTE ADC81 receives the third BYTEshift carry (Ybit5), replacing
      // both flags of the preceding WORD pointer addition.
      const shifted = (y * CGRAM_INDEX_SCALE) & BYTE_MASK,
        sum = shifted + CGRAM_BASE + ((y >>> CGRAM_CARRY_SHIFT) & 1);
      carry = Number(sum >= BYTE_VALUES);
      overflow = ~(shifted ^ CGRAM_BASE) & (shifted ^ sum) & BYTE_SIGN_BIT ? OVERFLOW_BIT : 0;
      register(CGADD, sum & BYTE_MASK, 1);
      register(A1B4, PALETTE_SOURCE_BANK, 1);
      register(MDMAEN, DMA_CHANNEL_MASK, 1);
      iterations++;
      y = (y - 2) & WORD_MASK;
    } while (y < WORD_SIGN);
    // Final WORDDEY supplies N1/Z0, while A0010 still comes from the
    // last BYTE LDA10 with highA0 retained from LDAWORD001E.
    return result(
      'requests_prepared',
      DMA_CHANNEL_MASK,
      (status & ~STATUS_NZCV) | BYTE_SIGN_BIT | carry | overflow,
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
