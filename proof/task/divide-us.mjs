import { prepareTaskPlan } from './plan.mjs';
import { divideLeft, divideBody } from './divide-common.mjs';
export function runTaskDivideUS(a) {
  a.ctx.x = 0;
  divideLeft(a);
  if (a.ctx.a & 0x8000) {
    a.ctx.a = -a.ctx.a & 65535;
    a.ctx.x++;
  }
  return divideBody(a);
}
export const prepareTaskDivideUS = (options) =>
  prepareTaskPlan(options, [0x80f5de], runTaskDivideUS);
