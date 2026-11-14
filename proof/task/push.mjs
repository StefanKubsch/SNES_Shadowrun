import { prepareTaskPlan } from './plan.mjs';
export function runTaskPush(a) {
  const width = a.entry === 0x80f393 ? 0 : a.entry === 0x80f398 ? 1 : 2;
  const operand = width ? a.streamWord('push-operand-WORD') : 0,
    value = width === 1 ? operand & 255 : operand;
  a.ctx.y = (a.ctx.y + width) & 65535;
  a.pushWord(value, width ? 'PHA-operand' : 'PEA-zero');
  return { ...a.fetch(), pushedWord: value, operandBytesConsumed: width };
}
export const prepareTaskPush = (options) =>
  prepareTaskPlan(options, [0x80f393, 0x80f398, 0x80f3b1], runTaskPush);
