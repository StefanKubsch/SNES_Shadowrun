import { prepareTaskPlan } from './plan.mjs';
export function runTaskEndReturn(a) {
  const resultWord = a.pullWord('END-result-PLA');
  a.writeWord(a.ctx.bank * 65536, resultWord, 24, 'END-result');
  // Read after both result stores; do not reuse an external saved-S value.
  const savedOuterS = a.readWord(a.ctx.bank * 65536 + 0x1f2, 24, 'fresh-saved-outer-S');
  const outerReturnWord = a.readWord((savedOuterS + 1) & 65535, 16, 'intact-outer-return', true);
  a.ctx.s = (savedOuterS + 2) & 65535;
  a.ctx.a = 0;
  a.ctx.d = 0;
  a.ctx.status = (a.ctx.status & ~0x82) | 2;
  a.ctx.pc = (outerReturnWord + 1) & 65535;
  return {
    resultWord,
    savedOuterS,
    outerReturnWord,
    returnTarget: 0x800000 | a.ctx.pc,
    frontier: 'actual-outer-return-target',
    scope: 'manual-END-byte-plan-and-return-context',
    targetExecuted: false,
  };
}
export const prepareTaskEndReturn = (options) =>
  prepareTaskPlan(options, [0x80f4be], runTaskEndReturn);
