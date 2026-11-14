import { prepareTaskPlan } from './plan.mjs';

export function prepareTaskStateWrites(options) {
  return prepareTaskPlan(options, [0x80f8f1, 0x80f902], runTaskStateWrites);
}

export function runTaskStateWrites(a) {
  const offsetWord = a.streamWord('state-offset-WORD');
  a.ctx.x = offsetWord;
  a.ctx.y = (a.ctx.y + 2) & 65535;
  const value = a.pullWord('state-value-PLA'),
    stateAddress = 0x7e0000 + offsetWord;
  const width = a.entry === 0x80f8f1 ? 1 : 2;
  if (width === 1) a.write(stateAddress, value & 255, 'state-BYTE');
  else a.writeWord(stateAddress, value, 24, 'state-WORD');
  return { ...a.fetch(), offsetWord, stateAddress, value, stateWriteBytes: width };
}
