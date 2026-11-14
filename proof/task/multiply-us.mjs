import { prepareTaskPlan } from './plan.mjs';
import { multiplyPrefix, multiplyBody } from './multiply-common.mjs';
export function runTaskMultiplyUS(a) {
  a.ctx.x = 0;
  multiplyPrefix(a, 1);
  return multiplyBody(a);
}
export const prepareTaskMultiplyUS = (options) =>
  prepareTaskPlan(options, [0x80f556], runTaskMultiplyUS);
