import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskStateReads(options) {
  return prepareTaskPlan(options, [0x80f8d4, 0x80f8e4], runTaskStateReads);
}

export function runTaskStateReads(a) {
  const offsetWord = a.streamWord('state-offset-WORD');
  a.ctx.x = offsetWord;
  a.ctx.y = (a.ctx.y + 2) & 65535;
  const stateAddress = 0x7e0000 + offsetWord,
    stateWord = a.readWord(stateAddress, 24, 'state-WORD');
  const value = a.entry === 0x80f8d4 ? stateWord & 255 : stateWord;
  a.pushWord(value, 'state-PHA');
  return { ...a.fetch(), offsetWord, stateAddress, stateWord, value };
}
