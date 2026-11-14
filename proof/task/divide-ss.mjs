import { prepareTaskPlan } from './plan.mjs';
import { divideLeft, divideBody } from './divide-common.mjs';
export function runTaskDivideSS(a) {
  a.ctx.x = 0;
  divideLeft(a, true);
  if (a.ctx.a & 0x8000) {
    a.ctx.a = -a.ctx.a & 65535;
    a.ctx.x++;
  }
  return divideBody(a);
}
export const prepareTaskDivideSS = (options) =>
  prepareTaskPlan(options, [0x80f5f0], runTaskDivideSS);
