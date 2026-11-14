import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskCarryCompare(options) {
  return prepareTaskPlan(options, [0x80f735, 0x80f77a, 0x80f7bc, 0x80f7fe], runTaskCarryCompare);
}

export function runTaskCarryCompare(a) {
  const right = a.pullWord('right-PLA');
  const comparedRight = a.entry === 0x80f735 || a.entry === 0x80f7fe ? (right - 1) & 65535 : right;
  const left = a.stackWord(1, 'fresh-left-CMP'),
    carry = Number(comparedRight >= left);
  a.ctx.status = (a.ctx.status & ~1) | carry;
  const value = (a.entry === 0x80f7bc ? !carry : carry) ? 65535 : 0;
  a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'carry-compare-result');
  return { ...a.fetch(), right, comparedRight, left, carry, value };
}
