// The task append 80:C34A as register-level callers call it with JSR (moved from
// src/script/task-api.mjs and src/game/task-append.mjs; lifted callers use
// appendScriptCall and appendScriptReturn, which leave no registers). The script lies
// in X and its arguments in the direct page words 00 on. Leaves A the new task slot,
// X the list's old head with its sign and zero, Y at the frame's PC word and returns
// by RTS; returns the raw return word.
import { appendTask } from '../../src/game/task-append.mjs';
import { argumentWords } from '../../src/script/task-api.mjs';
import { NONE } from '../../src/script/scheduler.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

// The frame's PC word, where the original leaves Y.
const FRAME_PC = 3,
  NO_TASK = WORD_MASK;
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const taskWord = (slot) => (slot === NONE ? NO_TASK : 2 * slot);
// The RTS of the append.
function returnFrom(a) {
  const rawReturnWord = a.pullWord();
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return { rawReturnWord };
}

// On the JS scheduler (a.tasks) the task API appends the task; on the WRAM tables the
// lifted append, which also leaves the carry and overflow of the frame's end.
export function appendScriptTaskCall(a) {
  if (!a.tasks) return appendTableTaskCall(a);
  const { ctx } = a,
    tasks = a.tasks,
    head = taskWord(tasks.scheduler.head);
  ctx.a = tasks.append(ctx.x, argumentWords(a.mem, ctx.x));
  ctx.x = head;
  ctx.y = FRAME_PC;
  flag(ctx, FLAG_NEGATIVE, head & WORD_SIGN);
  flag(ctx, FLAG_ZERO, head === 0);
  return returnFrom(a);
}

// The append on the WRAM task tables: the return word lies on the stack, direct page 0
// and binary arithmetic.
export function appendTableTaskCall(a) {
  const { ctx } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  const { slot, head, carry, overflow } = appendTask(a, ctx.x);
  ctx.a = slot;
  ctx.x = head;
  ctx.y = FRAME_PC;
  flag(ctx, FLAG_NEGATIVE, head & WORD_SIGN);
  flag(ctx, FLAG_ZERO, head === 0);
  flag(ctx, FLAG_CARRY, carry);
  flag(ctx, FLAG_OVERFLOW, overflow);
  return returnFrom(a);
}
