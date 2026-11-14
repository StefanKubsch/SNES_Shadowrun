// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectVelocityY } from '../../src/task/native-object-velocity-y.mjs';

export const prepareTaskNativeA949 = (options) =>
  prepareTaskPlan(options, [0x80a949], (a) => getObjectVelocityY(a));
