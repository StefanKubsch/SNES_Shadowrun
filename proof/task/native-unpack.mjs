// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { unpackStreamLong } from '../../src/task/native-unpack.mjs';

export const prepareTaskUnpack9F49 = (options) =>
  prepareTaskPlan(options, [0x809f49], (a) => unpackStreamLong(a));
