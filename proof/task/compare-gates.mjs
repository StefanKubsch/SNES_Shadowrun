import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskCompareGates(options) {
  return prepareTaskPlan(options, [0x80f852, 0x80f86e, 0x80f88e, 0x80f8aa], runTaskCompareGates);
}

export function runTaskCompareGates(a) {
  const leftGate = a.entry === 0x80f852 || a.entry === 0x80f88e;
  const gateWord = leftGate ? a.stackWord(3, 'left-sign-gate') : null;
  const right = a.pullWord('right-PLA');
  const negative = Boolean((leftGate ? gateWord : right) & 0x8000);
  let value,
    left = null;
  if (negative) value = a.entry === 0x80f852 || a.entry === 0x80f86e ? 0 : 65535;
  else {
    left = a.stackWord(1, 'fresh-left-CMP');
    a.ctx.status = (a.ctx.status & ~1) | Number(right >= left);
    // Original AE BEQ +0 always reaches DEX for nonnegative right.
    value = a.entry === 0x80f86e ? 65535 : right === left ? 0 : 65535;
  }
  a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'compare-result');
  return { ...a.fetch(), gateWord, right, left, negative, value, compared: left !== null };
}
