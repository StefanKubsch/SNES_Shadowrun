import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskStateSignExtension(options) {
  return prepareTaskPlan(options, [0x80f90f], runTaskStateSignExtension);
}

export function runTaskStateSignExtension(a) {
  const offsetWord = a.streamWord('state-offset-WORD');
  a.ctx.x = offsetWord;
  a.ctx.y = (a.ctx.y + 2) & 65535;
  const stateAddress = 0x7e0000 + offsetWord,
    stateWord = a.readWord(stateAddress, 24, 'state-WORD');
  const low = stateWord & 255,
    carry = Number(low >= 128),
    value = carry ? 0xff00 | low : low;
  a.ctx.status = (a.ctx.status & ~1) | carry;
  a.pushWord(value, 'state-sign-PHA');
  return { ...a.fetch(), offsetWord, stateAddress, stateWord, value, carry };
}
