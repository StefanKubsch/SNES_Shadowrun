// Register-level script opcode with its argument prefix and the script call bridge
// 80:F488 with its child link 80:C36A, used only by the task opcode proofs; the game
// runs scripts through src/script/.
import { taskStop } from '../../src/system/task-stop.mjs';
import {
  scriptAllocationEquations,
  runTaskFrameAllocation,
} from '../../src/system/script-yield.mjs';
import { runTaskScriptArguments } from './script-arguments.mjs';
import {
  TASK_CONTINUATION,
  TASK_CURSOR,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
  TASK_WAIT,
} from '../../src/vm/layout.mjs';
import { renderAddress } from '../../src/render/data.mjs';
import { FLAG_DECIMAL } from '../../src/constants/cpu-flags.mjs';
import { WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { CODE_BANK_BASE, CODE_BANK_PAIR } from '../../src/constants/memory-map.mjs';

export function runTaskScriptOpcode(a, options) {
  const prefix = runTaskScriptArguments(a);
  if (options.expectedScriptId !== undefined && prefix.id !== options.expectedScriptId)
    taskStop('task_script_ID_required');
  return { ...prefix, ...runTaskScriptYield(a, options), argumentPrefixExecuted: true };
}

// 80:C36A: allocate the child's frame through a real JSR 80:C2C8 and link it before
// the caller, which then waits for it.
const CHILD_FRAME_RETURN_WORD = 0xc36c,
  CHILD_FRAME_RESUME = 0xc36d;
const SCRIPT_CHILD_RETURN_WORD = 0xf494;
const WAIT_FOR_CHILD = WORD_MASK;
function child(a, h) {
  const { c, load, ix, rw, ww, rts } = h;
  a.pushWord(CHILD_FRAME_RETURN_WORD, 'child-JSR-frame');
  runTaskFrameAllocation(a, h);
  rts(CHILD_FRAME_RESUME);
  load(rw(TASK_CURSOR));
  ww(TASK_NEXT + c.x, c.a);
  ix('y', c.a);
  load(rw(TASK_PREVIOUS + c.y));
  ww(TASK_PREVIOUS + c.x, c.a);
  load(c.x);
  ww(TASK_PREVIOUS + c.y, c.a);
  load(WAIT_FOR_CHILD);
  ww(TASK_WAIT + c.y, c.a);
  load(a.pullWord('child-PLA-caller-return'));
  ww(TASK_CONTINUATION + c.y, c.a);
  ix('y', rw(TASK_PREVIOUS + c.x));
  if (c.y & WORD_SIGN) ww(TASK_LIST_HEAD, c.x);
  else {
    load(c.x);
    ww(TASK_NEXT + c.y, c.a);
  }
  const outerReturnWord = rts(null, true);
  return {
    outerReturnWord,
    returnTarget: CODE_BANK_BASE | c.pc,
    frontier: 'actual-outer-yield-target',
    returnTargetExecuted: false,
    scope: 'manual-script52-arguments-frame-heap-child-outer-yield',
    stackMigrationExecuted: true,
    fullTaskBinding: false,
  };
}
export function runTaskScriptYield(a, options) {
  if (a.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  if (
    ![1, 2].every((n) =>
      options.protectedStackBytes.includes(renderAddress((a.ctx.a + n) & WORD_MASK)),
    )
  )
    taskStop('task_outer_return_required');
  const h = scriptAllocationEquations(a);
  a.ctx.s = a.ctx.a;
  h.load(0);
  a.ctx.d = h.nz(0);
  a.pushWord(CODE_BANK_PAIR, 'script-bridge-PEA');
  for (let n = 0; n < 2; n++) {
    a.ctx.bank = h.nz(a.read((a.ctx.s + 1) & WORD_MASK, 'script-bridge-PLB'), 1);
    a.ctx.s = (a.ctx.s + 1) & WORD_MASK;
  }
  a.pushWord(SCRIPT_CHILD_RETURN_WORD, 'script-JSR-child');
  return child(a, h);
}
