import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskComplementSignGates(options) {
  return prepareTaskPlan(
    options,
    [0x80f7cb, 0x80f7e7, 0x80f80e, 0x80f82b],
    runTaskComplementSignGates,
  );
}

export function runTaskComplementSignGates(a) {
  const leftGate = a.entry === 0x80f7cb || a.entry === 0x80f80e;
  const gateWord = leftGate ? a.stackWord(3, 'left-sign-gate') : null;
  const right = a.pullWord('right-PLA'),
    negative = Boolean((leftGate ? gateWord : right) & 0x8000);
  let value,
    left = null,
    comparedRight = null;
  if (negative) value = leftGate ? 0 : 65535;
  else {
    comparedRight = a.entry === 0x80f80e || a.entry === 0x80f82b ? (right - 1) & 65535 : right;
    left = a.stackWord(1, 'fresh-left-CMP');
    const carry = Number(comparedRight >= left);
    a.ctx.status = (a.ctx.status & ~1) | carry;
    value = carry ? 0 : 65535;
  }
  a.writeWord((a.ctx.s + 1) & 65535, value, 16, 'complement-sign-result');
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
