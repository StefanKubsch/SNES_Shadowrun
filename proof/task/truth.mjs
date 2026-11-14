import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskTruth(a) {
  if (a.entry === 0x80f8bf) {
    const value = a.stackWord(1, 'Boolean-top');
    if (value !== 0) a.writeWord((a.ctx.s + 1) & 65535, 65535, 16, 'Boolean-top-result');
    return { ...a.fetch(), value, result: value ? 65535 : 0, operandStore: value !== 0 };
  }
  const right = a.pullWord('Truth-right-PLA'),
    left = a.stackWord(1, 'Truth-left-CMP'),
    equal = right === left,
    result = (a.entry === 0x80f843 ? equal : !equal) ? 65535 : 0;
  a.ctx.status = (a.ctx.status & ~1) | Number(right >= left);
  a.writeWord((a.ctx.s + 1) & 65535, result, 16, 'Truth-left-result');
  return { ...a.fetch(), left, right, result, operandStore: true };
}
export const prepareTaskTruth = (options) =>
  prepareTaskPlan(options, [8452287, 8452163, 8452223], runTaskTruth);
