import { BYTE_MASK, BYTE_BITS, NIBBLE_MASK, BANK_SIZE } from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import {
  PAD_HELD,
  PAD_PREVIOUS,
  PAD_PRESSED,
  PAD_START,
  PAD_SELECT,
  PAD_L,
  PAD_R,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';

const DEFAULT_MAX_WORK = 1000000;
const STATUS_NZC = FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY;
const OVERFLOW_FLAG_SHIFT = 6;
const SOFT_RESET_PAD_WORD = PAD_START | PAD_SELECT | PAD_L | PAD_R;
const PAD_LOW_BITS_MASK = NIBBLE_MASK;

// Manual input consumer, no browser mapping or automatic frame binding.
export function prepareRender9E1A({
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
    throw Error('Invalid input consumer context');
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
    return view.finish(render9E1A(view, { bank, status, x, y }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export function render9E1A(view, { bank, status, x = null, y = null }, budget) {
  let phase = 'edge';
  const base = bank * BANK_SIZE,
    operations = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, address, value) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes: 2 }));
    return value;
  };
  const read = (offset) => {
    tick();
    const a = base + offset;
    return record('read', a, view.read(a) | (view.read(a + 1) << BYTE_BITS));
  };
  const write = (offset, value) => {
    tick();
    const a = base + offset;
    view.write(a, value & BYTE_MASK);
    view.write(a + 1, value >>> BYTE_BITS);
    record('write', a, value);
  };
  try {
    const first = read(PAD_HELD),
      previous = read(PAD_PREVIOUS),
      edge = (first ^ previous) & read(PAD_HELD);
    write(PAD_PRESSED, edge);
    phase = 'copy';
    const current = read(PAD_HELD);
    write(PAD_PREVIOUS, current);
    if (current === SOFT_RESET_PAD_WORD) {
      // No publishable partial reset. F007 and the following E382 startup
      // must belong to a complete future reset owner before committing.
      throw {
        renderBoundary: true,
        reason: 'render_reset_source_required',
        phase: 'reset',
        target: '80:E382',
      };
    }
    const a = current & PAD_LOW_BITS_MASK,
      carry = Number(current >= SOFT_RESET_PAD_WORD);
    if (a) {
      phase = 'filter';
      write(PAD_HELD, 0);
      write(PAD_PRESSED, 0);
    }
    const finalStatus = (status & ~STATUS_NZC) | carry | (a === 0 ? FLAG_ZERO : 0);
    return {
      handled: true,
      outcome: a ? 'input_filtered' : 'input_preserved',
      a,
      x,
      y,
      bank,
      status: finalStatus,
      carry,
      overflow: (finalStatus >>> OVERFLOW_FLAG_SHIFT) & 1,
      current,
      previous,
      edge,
      work: budget.work,
      operations: Object.freeze(operations),
      ioReads: Object.freeze([]),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: error.phase ?? phase };
  }
}
