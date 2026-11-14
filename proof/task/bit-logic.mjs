import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskBitLogic(a) {
  const right = a.pullWord('logic-right-PLA');
  let left = null,
    value;
  if (a.entry === 0x80f72d) {
    value = right ^ 65535;
    a.pushWord(value, 'NOT-PHA');
  } else {
    left = a.stackWord(1, 'logic-left');
    value =
      a.entry === 0x80f715 ? right & left : a.entry === 0x80f71d ? right | left : right ^ left;
    a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'logic-left-result');
  }
  return { ...a.fetch(), left, right, value };
}
export const prepareTaskBitLogic = (options) =>
  prepareTaskPlan(options, [8451861, 8451869, 8451877, 8451885], runTaskBitLogic);
