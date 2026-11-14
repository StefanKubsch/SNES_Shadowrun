import { prepareTaskPlan } from './plan.mjs';

export function runTaskSignExtension(a) {
  const operandWord = a.streamWord('sign-operand-WORD');
  a.ctx.y = (a.ctx.y + 1) & 65535;
  const local = a.entry === 0x80f408;
  if (local) a.ctx.x = operandWord & 255;
  const sourceWord = local
    ? a.readWord((a.ctx.d + 0x13 + a.ctx.x) & 65535, 16, 'sign-local-WORD')
    : operandWord;
  const low = sourceWord & 255,
    carry = Number(low >= 128),
    value = carry ? 0xff00 | low : low;
  a.ctx.status = (a.ctx.status & ~1) | carry;
  a.pushWord(value, 'sign-PHA');
  return { ...a.fetch(), operandWord, sourceWord, value, carry };
}
export const prepareTaskSignExtension = (options) =>
  prepareTaskPlan(options, [0x80f3f6, 0x80f408], runTaskSignExtension);
