import { prepareTaskPlan } from './plan.mjs';
import { multiplyBody } from './multiply-common.mjs';
export function runTaskMultiplyUnsigned(a) {
  a.ctx.x = 0;
  return multiplyBody(a);
}
export const prepareTaskMultiplyUnsigned = (options) =>
  prepareTaskPlan(options, [0x80f581], runTaskMultiplyUnsigned);
