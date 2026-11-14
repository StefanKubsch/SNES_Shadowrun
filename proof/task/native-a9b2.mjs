// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { af1fRegisters } from '../../src/task/native-bar-tiles.mjs';
import { unpackWindowMap } from '../../src/task/native-render-unpack.mjs';

export const prepareTaskNativeA9B2 = (options) =>
  prepareTaskPlan(options, [0x81a9b2], (a) => unpackWindowMap(a), af1fRegisters);
