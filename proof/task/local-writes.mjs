import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskLocalWrites(a) {
  const indexWord = a.streamWord('local-index-WORD'),
    index = indexWord & 255;
  a.ctx.x = index;
  a.ctx.y = (a.ctx.y + 1) & 65535;
  const value = a.pullWord('local-value-PLA'),
    localAddress = (a.ctx.d + 0x13 + index) & 65535,
    width = a.entry === 0x80f3c6 ? 1 : 2;
  if (width === 1) a.write(localAddress, value & 255, 'local-BYTE');
  else a.writeWord(localAddress, value, 16, 'local-WORD');
  return {
    ...a.fetch(),
    indexWord,
    index,
    poppedWord: value,
    localAddress,
    localWriteBytes: width,
  };
}
export const prepareTaskLocalWrites = (options) =>
  prepareTaskPlan(options, [8451014, 8451031], runTaskLocalWrites);
