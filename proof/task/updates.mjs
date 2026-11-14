import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskUpdates(a) {
  const duplicate = a.entry === 0x80f3f0,
    value = duplicate ? a.stackWord(1, 'Duplicate-top') : a.pullWord('Update-top-PLA');
  const result = duplicate ? value : (value + (a.entry === 0x80f3e4 ? 1 : -1)) & 65535;
  a.pushWord(result, 'Update-PHA');
  return { ...a.fetch(), value, result };
}
export const prepareTaskUpdates = (options) =>
  prepareTaskPlan(options, [8451044, 8451050, 8451056], runTaskUpdates);
