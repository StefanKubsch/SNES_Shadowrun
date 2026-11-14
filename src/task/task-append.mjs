import { TASK_LIST_HEAD, TASK_NEXT, TASK_PREVIOUS } from '../vm/layout.mjs';
import { WORD_SIGN } from '../constants/bits.mjs';
import { NO_TASK } from './wram.mjs';
import { taskStop } from './plan.mjs';
import { scriptAllocationEquations, runTaskFrameAllocation } from './script-yield.mjs';
import { FLAG_DECIMAL } from '../constants/cpu-flags.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';

const APPEND_FRAME_RETURN_WORD = 0xc34c,
  APPEND_FRAME_RESUME = 0xc34d;

// Fixed original C34A/C2C8/C242 equations, including failure continuations.
// No normalized heap/slot model, initialization or scheduler is substituted.
// 80:C34A: append a script task (with C2C8 and C242).
export function appendScriptTask(a, outerReturn = true) {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (a.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  const h = scriptAllocationEquations(a),
    { c, load, ix, rw, ww, rts } = h;
  a.pushWord(APPEND_FRAME_RETURN_WORD, 'append-JSR-frame');
  runTaskFrameAllocation(a, h);
  rts(APPEND_FRAME_RESUME);
  load(rw(TASK_LIST_HEAD));
  ww(TASK_NEXT + c.x, c.a);
  load(NO_TASK);
  ww(TASK_PREVIOUS + c.x, c.a);
  load(c.x);
  ix('x', rw(TASK_LIST_HEAD));
  if (!(c.x & WORD_SIGN)) ww(TASK_PREVIOUS + c.x, c.a);
  ww(TASK_LIST_HEAD, c.a);
  const rawReturnWord = rts(null, outerReturn);
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | c.pc,
    returnTargetExecuted: false,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-actual-C34A-frame-heap-append',
    dynamicDispatchExecuted: false,
  };
}
