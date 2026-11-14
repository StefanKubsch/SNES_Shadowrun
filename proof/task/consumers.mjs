import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskConsumers(a) {
  if (a.entry === 0x80f8bb) {
    const discardedWord = a.pullWord('Drop-discard-WORD');
    return { ...a.fetch(), discardedWord };
  }
  if (a.ctx.status & 8) taskStop('task_binary_decimal_required');
  let left, right, value, carry, overflow;
  if (a.entry === 0x80f532) {
    right = a.pullWord('Add-right-PLA');
    left = a.stackWord(1, 'Add-left');
    const sum = right + left;
    value = sum & 65535;
    carry = Number(sum > 65535);
    overflow = Number(Boolean(~(right ^ left) & (right ^ value) & 0x8000));
    a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'Add-left-result');
  } else {
    left = a.stackWord(3, 'Subtract-left');
    right = a.stackWord(1, 'Subtract-right');
    value = (left - right) & 65535;
    carry = Number(left >= right);
    overflow = Number(Boolean((left ^ right) & (left ^ value) & 0x8000));
    a.writeWord((a.ctx.s + 3) & 65535, value, 16, 'Subtract-left-result');
    a.pullWord('Subtract-fresh-discarded-right');
  }
  a.ctx.status = (a.ctx.status & ~0x41) | carry | (overflow << 6);
  return { ...a.fetch(), left, right, value };
}
export const prepareTaskConsumers = (options) =>
  prepareTaskPlan(options, [8452283, 8451378, 8451387], runTaskConsumers);
