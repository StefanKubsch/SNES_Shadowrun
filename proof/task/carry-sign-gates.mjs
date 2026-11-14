import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskCarrySignGates(options) {
  return prepareTaskPlan(options, [0x80f745, 0x80f762, 0x80f789, 0x80f7a5], runTaskCarrySignGates);
}

export function runTaskCarrySignGates(a) {
  const leftGate = a.entry === 0x80f745 || a.entry === 0x80f789;
  const gateWord = leftGate ? a.stackWord(3, 'left-sign-gate') : null;
  const right = a.pullWord('right-PLA'),
    negative = Boolean((leftGate ? gateWord : right) & 0x8000);
  let value,
    left = null,
    comparedRight = null;
  if (negative) value = leftGate ? 65535 : 0;
  else {
    comparedRight = a.entry === 0x80f745 || a.entry === 0x80f762 ? (right - 1) & 65535 : right;
    left = a.stackWord(1, 'fresh-left-CMP');
    const carry = Number(comparedRight >= left);
    a.ctx.status = (a.ctx.status & ~1) | carry;
    value = carry ? 65535 : 0;
  }
  a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'carry-sign-result');
  return {
    ...a.fetch(),
    gateWord,
    right,
    left,
    comparedRight,
    negative,
    value,
    compared: left !== null,
  };
}
