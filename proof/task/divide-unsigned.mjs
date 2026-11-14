import { prepareTaskPlan } from './plan.mjs';
import { divideLeft, divideBody } from './divide-common.mjs';
export function runTaskDivideUnsigned(a) {
  a.ctx.x = 0;
  divideLeft(a);
  return divideBody(a);
}
export const prepareTaskDivideUnsigned = (options) =>
  prepareTaskPlan(options, [0x80f609], runTaskDivideUnsigned);
