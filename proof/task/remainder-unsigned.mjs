import { prepareTaskPlan } from './plan.mjs';
import { remainderBody } from './remainder-common.mjs';
export function runTaskRemainderUnsigned(a) {
  a.ctx.x = 0;
  a.ctx.a = a.pullWord('right-PLA');
  return remainderBody(a);
}
export const prepareTaskRemainderUnsigned = (options) =>
  prepareTaskPlan(options, [0x80f6ae], runTaskRemainderUnsigned);
