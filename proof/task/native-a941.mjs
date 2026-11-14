// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectVelocityX } from '../../src/task/native-object-velocity-x.mjs';

export const prepareTaskNativeA941 = (options) =>
  prepareTaskPlan(options, [0x80a941], (a) => getObjectVelocityX(a));
