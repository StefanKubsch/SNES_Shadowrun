import { prepareTaskPlan } from './plan.mjs';

// Original F927 status publication and RTS from the CURRENT native stack.
// The BYTE accumulator operations retain hidden High-A; LDX remains WORD.
export function runTaskStatusReturn(a) {
  const first = a.read(a.ctx.bank * 65536 + 0x1be, 'status01BE');
  const index = a.readWord(a.ctx.d, 16, 'fresh-DP00-index');
  const firstValue = (first & 0xfb) | (index & 0x8000 ? 4 : 0);
  a.write(a.ctx.bank * 65536 + 0x1be, firstValue, 'status01BE-bit2');
  const second = a.read(a.ctx.bank * 65536 + 0x1c0, 'fresh-status01C0');
  const secondValue = (second & 0xfb) | (index === 1 ? 4 : 0);
  a.write(a.ctx.bank * 65536 + 0x1c0, secondValue, 'status01C0-bit2');
  a.ctx.a = (a.ctx.a & 0xff00) | secondValue;
  a.ctx.x = index;
  a.ctx.status =
    (a.ctx.status & ~0xa3) |
    (index >= 1 ? 1 : 0) |
    (secondValue === 0 ? 2 : 0) |
    (secondValue & 0x80);
  const returnS = a.ctx.s,
    outerReturnWord = a.readWord((returnS + 1) & 65535, 16, 'intact-current-stack-return', true);
  a.ctx.s = (returnS + 2) & 65535;
  a.ctx.pc = (outerReturnWord + 1) & 65535;
  return {
    index,
    firstValue,
    secondValue,
    returnS,
    outerReturnWord,
    returnTarget: 0x800000 | a.ctx.pc,
    frontier: 'actual-outer-return-target',
    scope: 'manual-F927-status-and-current-stack-RTS',
    targetExecuted: false,
  };
}
export const prepareTaskStatusReturn = (options) =>
  prepareTaskPlan(options, [0x80f927], runTaskStatusReturn);
