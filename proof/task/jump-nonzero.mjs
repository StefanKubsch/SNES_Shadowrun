import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskJumpNonzero(options) {
  return prepareTaskPlan(options, [0x80f42e], runTaskJumpNonzero);
}

export function runTaskJumpNonzero(a) {
  const conditionWord = a.pullWord('jump-condition-PLA'),
    taken = conditionWord !== 0;
  const targetWord = taken ? a.streamWord('jump-target-WORD') : null;
  a.ctx.y = taken ? targetWord : (a.ctx.y + 2) & 65535;
  return { ...a.fetch(), conditionWord, taken, targetWord };
}
