import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskJumpZero(options) {
  return prepareTaskPlan(options, [0x80f420], runTaskJumpZero);
}

export function runTaskJumpZero(a) {
  const conditionWord = a.pullWord('jump-condition-PLA'),
    taken = conditionWord === 0;
  const targetWord = taken ? a.streamWord('jump-target-WORD') : null;
  a.ctx.y = taken ? targetWord : (a.ctx.y + 2) & 65535;
  return { ...a.fetch(), conditionWord, taken, targetWord };
}
