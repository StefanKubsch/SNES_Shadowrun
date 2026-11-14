import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
export function runTaskLocalReads(a) {
  const indexed = a.entry !== 0x80f8cb,
    indexWord = indexed ? a.streamWord('local-index-WORD') : null,
    index = indexed ? indexWord & 255 : 0;
  if (indexed) {
    a.ctx.x = index;
    a.ctx.y = (a.ctx.y + 1) & 65535;
  }
  const localAddress = (a.ctx.d + 0x13 + index) & 65535,
    localWord = a.readWord(localAddress, 16, 'local-WORD');
  const value = a.entry === 0x80f3b9 ? localWord : localWord & 255;
  a.pushWord(value, 'Local-PHA');
  return { ...a.fetch(), indexWord, index: indexed ? index : null, localAddress, localWord, value };
}
export const prepareTaskLocalReads = (options) =>
  prepareTaskPlan(options, [8450977, 8451001, 8452299], runTaskLocalReads);
