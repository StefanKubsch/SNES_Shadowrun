import { prepareTaskPlan } from './plan.mjs';
import { remainderBody } from './remainder-common.mjs';
export function runTaskRemainderSigned(a) {
  a.ctx.x = 0;
  if (a.entry !== 0x80f689) {
    a.ctx.a = a.stackWord(3, 'left-sign-WORD');
    if (a.ctx.a & 0x8000) {
      a.ctx.a = -a.ctx.a & 65535;
      a.ctx.x++;
    }
    // 72 discards the normalized register value; only 76 stores it.
    if (a.entry === 0x80f696) a.writeWord((a.ctx.s + 3) & 65535, a.ctx.a, 16, 'left-normalization');
  }
  a.ctx.a = a.pullWord('fresh-right-PLA');
  if (a.entry !== 0x80f67a && a.ctx.a & 0x8000) {
    a.ctx.a = -a.ctx.a & 65535;
    a.ctx.x++;
  }
  return remainderBody(a);
}
export const prepareTaskRemainderSigned = (options) =>
  prepareTaskPlan(options, [0x80f67a, 0x80f689, 0x80f696], runTaskRemainderSigned);
