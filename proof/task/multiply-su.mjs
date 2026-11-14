import { prepareTaskPlan } from './plan.mjs';
import { multiplyPrefix, multiplyBody } from './multiply-common.mjs';
export function runTaskMultiplySU(a) {
  a.ctx.x = 0;
  multiplyPrefix(a, 3);
  return multiplyBody(a);
}
export const prepareTaskMultiplySU = (options) =>
  prepareTaskPlan(options, [0x80f546], runTaskMultiplySU);
