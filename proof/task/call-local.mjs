import { prepareTaskPlan } from './plan.mjs';

export function runTaskCallLocal(a) {
  const targetWord = a.streamWord('call-target-WORD');
  a.ctx.x = targetWord;
  a.ctx.y = (a.ctx.y + 2) & 65535;
  const dp05 = (a.ctx.d + 5) & 65535;
  const destination = a.readWord(dp05, 16, 'call-destination-pointer');
  a.writeWord(a.ctx.bank * 65536 + destination, a.ctx.y, 24, 'saved-local-return');
  const freshPointer = a.readWord(dp05, 16, 'fresh-call-pointer');
  const newPointer = (freshPointer - 2) & 65535;
  a.writeWord(dp05, newPointer, 16, 'local-pointer');
  a.ctx.y = targetWord;
  return { ...a.fetch(), targetWord, destination, freshPointer, newPointer };
}
export const prepareTaskCallLocal = (options) =>
  prepareTaskPlan(options, [0x80f442], runTaskCallLocal);
