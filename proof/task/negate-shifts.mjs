import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskNegateShifts(a) {
  if (a.entry === 0x80f6f4) {
    const value = a.pullWord('Negate-top-PLA'),
      result = -value & 65535;
    a.pushWord(result, 'Negate-PHA');
    return { ...a.fetch(), value, result, iterations: 0 };
  }
  const count = a.pullWord('PLX-count');
  a.ctx.x = count;
  if (count === 0)
    return { ...a.fetch(), count, result: null, iterations: 0, valueWordRead: false };
  let value = a.pullWord('Shift-value-PLA'),
    result = value,
    carry = a.ctx.status & 1;
  for (let n = 0; n < count; n++) {
    a.tick(3);
    const left = a.entry === 0x80f6fd;
    carry = left ? result >>> 15 : result & 1;
    result = left ? (result << 1) & 65535 : result >>> 1;
    a.ctx.x = (a.ctx.x - 1) & 65535;
  }
  a.ctx.status = (a.ctx.status & ~1) | carry;
  a.pushWord(result, 'Shift-PHA');
  return { ...a.fetch(), value, result, count, iterations: count, valueWordRead: true };
}
export const prepareTaskNegateShifts = (options) =>
  prepareTaskPlan(options, [8451828, 8451837, 8451849], runTaskNegateShifts);
