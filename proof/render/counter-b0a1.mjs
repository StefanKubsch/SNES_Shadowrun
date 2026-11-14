import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { wordWaitAccess } from './word-wait.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { RANDOM_STATE } from '../../src/task/wram.mjs';
import { WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const COUNTER_STACK_BYTES = 3;
const STATUS_NZC = FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY;
const OVERFLOW_FLAG_SHIFT = 6;

export function prepareRenderB0A1({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  waitMode = null,
  waitRead1C76 = null,
} = {}) {
  if (
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead1C76 !== null &&
      (!Array.isArray(waitRead1C76) || !Array.from(waitRead1C76).every(isWord)))
  )
    throw Error('Invalid render B0A1 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    COUNTER_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      renderB0A1(view, { bank, status, x, y, waitMode, waitRead1C76 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed long WORD source and one saved baseline, independent of DBR.
// Observed changes share the outer overlay; no native counter write, clock,
// callback completion or interrupt execution. Only the outer caller commits.
export function renderB0A1(
  view,
  { bank, status, x = null, y = null, waitMode = null, waitRead1C76 = null, observations = {} },
  budget,
) {
  const address = WRAM_BASE + RANDOM_STATE,
    operations = [];
  observations.counterPolls ??= 0;
  let phase = 'baseline',
    polls = 0;
  try {
    const baseline = wordWaitAccess(view, budget, operations, phase).read(address);
    phase = 'poll';
    const io = wordWaitAccess(view, budget, operations, phase);
    let observed;
    do {
      if (waitRead1C76 !== null) {
        if (waitMode !== 'record-observations')
          throw { renderBoundary: true, reason: 'render_wait_context_required', address };
        if (observations.counterPolls >= waitRead1C76.length)
          throw { renderBoundary: true, reason: 'render_wait_read_required', address };
      }
      observed = io.poll(address, waitRead1C76?.[observations.counterPolls]);
      observations.counterPolls++;
      polls++;
    } while (observed === baseline);
    const difference = (baseline - observed) & WORD_MASK;
    const flags =
      (status & ~STATUS_NZC) |
      Number(baseline >= observed) |
      (difference & WORD_SIGN ? FLAG_NEGATIVE : 0);
    return {
      handled: true,
      outcome: 'counter_change_observed',
      a: baseline,
      baseline,
      observed,
      x,
      y,
      bank,
      status: flags,
      carry: flags & 1,
      overflow: (flags >>> OVERFLOW_FLAG_SHIFT) & 1,
      polls,
      counterPolls: observations.counterPolls,
      work: budget.work,
      operations: Object.freeze(operations),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase, polls };
  }
}
