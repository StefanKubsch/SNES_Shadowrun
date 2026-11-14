import { prepareTaskPlan } from './plan.mjs';
import { multiplyPrefix, multiplyBody } from './multiply-common.mjs';
export function runTaskMultiplySS(a) {
  a.ctx.x = 0;
  multiplyPrefix(a, 1);
  multiplyPrefix(a, 3);
  return multiplyBody(a);
}
export const prepareTaskMultiplySS = (options) =>
  prepareTaskPlan(options, [0x80f566], runTaskMultiplySS);
