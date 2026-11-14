import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskJump(options) {
  return prepareTaskPlan(options, [0x80f43c], runTaskJump);
}

export function runTaskJump(a) {
  const targetWord = a.streamWord('jump-target-WORD');
  a.ctx.y = targetWord;
  return { ...a.fetch(), targetWord };
}
