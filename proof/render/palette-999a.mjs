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
  BYTE_SIGN,
} from '../../src/constants/bits.mjs';
import {
  SCENE_PALETTE_UPLOAD,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LIST,
  SCENE_BACKDROP,
} from '../../src/task/wram.mjs';
import {
  A1T4L,
  DAS4L,
  CGADD,
  A1B4,
  MDMAEN,
  CGDATA,
} from '../../src/constants/hardware-registers.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const SCENE_BACKDROP_HIGH = SCENE_BACKDROP + 1;
const OVERFLOW_FLAG_SHIFT = 6;
const STATUS_NZ = 0x82;
const PALETTE_POINTER_SHIFT = 5;
const PALETTE_SOURCE_BIAS = 0xf624;
const PALETTE_POINTER_CARRY_SHIFT = 11;
const OVERFLOW_BIT = 0x40;
const PALETTE_BYTES = 0x1e;
const CGRAM_INDEX_SCALE = 8;
const PALETTE_SOURCE_BANK = 0x8c;
const DMA_CHANNEL_MASK = 0x10;
const STATUS_NZCV = 0xc3;

// Complete local999A data/request algorithm. No CPU, channel, palette latch
// or interrupt execution. Indexed reads use full bank carry and live aliases.
export function prepareRender999A({
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
    throw Error('Invalid render palette context');
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
    return view.finish(render999A(view, { bank, status, x, y, ioMode }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Inner operation for an explicitly supplied larger atomic owner. Its
// result cannot commit; only the outer owner can finish the shared view.
export function render999A(view, { bank, status, x = null, y = null, ioMode = null }, budget) {
  let phase = 'gates',
    count = null,
    initialY = null,
    iterations = 0;
  const operations = [],
    ioWrites = [],
    base = bank * BANK_SIZE;
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
    count,
    initialY,
    iterations,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze(ioWrites),
  });
  try {
    if (read(base + SCENE_PALETTE_UPLOAD) === 0)
      return result('gate_0D0E_zero', 0, (status & ~STATUS_NZ) | 2);
    count = read(base + SCENE_PALETTE_COUNT);
    if (count === 0) return result('gate_0D10_zero', 0, (status & ~STATUS_NZ) | 2);
    initialY = y = (count * 2) & WORD_MASK;
    phase = 'records';
    let overflow;
    do {
      // Y is always even. Neither this record's start nor its high byte
      // needs the separate WORD-at-FFFF contract used by other helpers.
      const value = read(base + SCENE_PALETTE_LIST + y),
        shifted = (value << PALETTE_POINTER_SHIFT) & WORD_MASK;
      const sum = shifted + PALETTE_SOURCE_BIAS + ((value >>> PALETTE_POINTER_CARRY_SHIFT) & 1);
      overflow = ~(shifted ^ PALETTE_SOURCE_BIAS) & (shifted ^ sum) & WORD_SIGN ? OVERFLOW_BIT : 0;
      register(A1T4L, sum & WORD_MASK);
      register(DAS4L, PALETTE_BYTES);
      register(CGADD, (y * CGRAM_INDEX_SCALE + 1) & BYTE_MASK, 1);
      register(A1B4, PALETTE_SOURCE_BANK, 1);
      register(MDMAEN, DMA_CHANNEL_MASK, 1);
      iterations++;
      y = (y - 2) & WORD_MASK;
    } while (y !== 0);
    phase = 'tail';
    register(CGADD, 0, 1);
    register(CGDATA, read(base + SCENE_BACKDROP, 1), 1);
    const finalByte = read(base + SCENE_BACKDROP_HIGH, 1);
    register(CGDATA, finalByte, 1);
    write(SCENE_PALETTE_UPLOAD, 0);
    // High A is zero from LDA001E. N/Z belong to the last BYTE load;
    // C0 belongs to the last visit Y2, V to that visit's WORD ADC.
    return result(
      'requests_prepared',
      finalByte,
      (status & ~STATUS_NZCV) | overflow | (finalByte & BYTE_SIGN) | (finalByte === 0 ? 2 : 0),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
