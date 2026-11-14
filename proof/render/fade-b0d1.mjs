import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  BYTE_BITS,
  BYTE_MASK,
  WORD_MASK,
  WORD_SIGN,
  NIBBLE_MASK,
  HIGH_BYTE_MASK,
  INT8_MAX,
} from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import { BRIGHTNESS_FADE, BRIGHTNESS_FADE_FRAMES, INIDISP_SHADOW } from '../../src/task/wram.mjs';

const DEFAULT_MAX_WORK = 1000000;
const FADE_STACK_BYTES = 3;
const STATUS_NZC = FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY;
const OVERFLOW_FLAG_SHIFT = 6;

// Manual ROM-derived data operation. One call is not an elapsed frame or
// clock tick; actual byte owners and callback integration remain explicit.
export function prepareRenderB0D1({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
} = {}) {
  if ((x !== null && !isWord(x)) || (y !== null && !isWord(y)))
    throw Error('Invalid render fade context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    FADE_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(renderB0D1(view, { bank, status, x, y }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export function renderB0D1(view, { bank, status, x = null, y = null }, budget) {
  let phase = 'gate',
    gate = null,
    countdown = null,
    period = null;
  const base = bank * BANK_SIZE,
    operations = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, address, value, bytes) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes }));
    return value;
  };
  const read = (offset, bytes = 2) => {
    tick();
    const address = base + offset;
    return record(
      'read',
      address,
      view.read(address) | (bytes === 2 ? view.read(address + 1) << BYTE_BITS : 0),
      bytes,
    );
  };
  const write = (offset, value, bytes = 2) => {
    tick();
    const address = base + offset;
    view.write(address, value & BYTE_MASK);
    if (bytes === 2) view.write(address + 1, value >>> BYTE_BITS);
    record('write', address, value, bytes);
  };
  const result = (outcome, a, nz, carry = status & 1) => {
    const finalStatus = (status & ~STATUS_NZC) | nz | carry;
    return {
      handled: true,
      outcome,
      a,
      x,
      y,
      bank,
      status: finalStatus,
      carry,
      overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
      gate,
      countdown,
      period,
      work: budget.work,
      operations: Object.freeze(operations),
      ioWrites: Object.freeze([]),
    };
  };
  const nz = (a, sign) => (a === 0 ? 2 : 0) | (a & sign ? FLAG_NEGATIVE : 0);
  try {
    gate = read(BRIGHTNESS_FADE);
    if (gate === 0) return result('gate_zero', 0, 2);
    phase = 'countdown';
    countdown = (read(BRIGHTNESS_FADE_FRAMES) - 1) & WORD_MASK;
    write(BRIGHTNESS_FADE_FRAMES, countdown);
    if (countdown !== 0) return result('countdown_prepared', gate, nz(countdown, WORD_SIGN));
    phase = 'reload';
    const reload = read(BRIGHTNESS_FADE),
      negative = Boolean(reload & WORD_SIGN);
    period = negative ? -reload & WORD_MASK : reload;
    write(BRIGHTNESS_FADE_FRAMES, period);
    phase = 'brightness';
    const nibble = read(INIDISP_SHADOW, 1) & NIBBLE_MASK,
      highA = period & HIGH_BYTE_MASK;
    if (negative ? nibble === 0 : nibble === NIBBLE_MASK) {
      phase = 'stop';
      write(BRIGHTNESS_FADE, 0);
      return result('fade_stopped', highA | nibble, 2, negative ? status & 1 : 1);
    }
    const freshByte = read(INIDISP_SHADOW, 1),
      lowA = negative ? (freshByte - 1) & BYTE_MASK : (freshByte + 1) & BYTE_MASK & INT8_MAX;
    write(INIDISP_SHADOW, lowA, 1);
    return result(
      negative ? 'brightness_decreased' : 'brightness_increased',
      highA | lowA,
      nz(lowA, FLAG_NEGATIVE),
      negative ? status & 1 : 0,
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
