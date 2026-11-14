import { prepareTaskPlan } from './plan.mjs';
import { divideLeft, divideBody } from './divide-common.mjs';
export function runTaskDivideSU(a) {
  a.ctx.x = 0;
  divideLeft(a, true);
  return divideBody(a);
}
export const prepareTaskDivideSU = (options) =>
  prepareTaskPlan(options, [0x80f5cc], runTaskDivideSU);
