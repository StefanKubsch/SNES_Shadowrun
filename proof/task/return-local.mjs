import { prepareTaskPlan } from './plan.mjs';

export function runTaskReturnLocal(a) {
  const dp05 = (a.ctx.d + 5) & 65535;
  const originalPointer = a.readWord(dp05, 16, 'local-pointer'),
    newPointer = (originalPointer + 2) & 65535;
  a.writeWord(dp05, newPointer, 16, 'local-pointer');
  const freshPointer = a.readWord(dp05, 16, 'fresh-return-pointer');
  const returnWord = a.readWord(a.ctx.bank * 65536 + freshPointer, 24, 'saved-local-return');
  a.ctx.y = returnWord;
  return { ...a.fetch(), originalPointer, newPointer, freshPointer, returnWord };
}
export const prepareTaskReturnLocal = (options) =>
  prepareTaskPlan(options, [0x80f454], runTaskReturnLocal);
