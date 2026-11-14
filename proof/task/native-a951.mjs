// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectVelocityZ } from '../../src/task/native-object-velocity-z.mjs';

export const prepareTaskNativeA951 = (options) =>
  prepareTaskPlan(options, [0x80a951], (a) => getObjectVelocityZ(a));
