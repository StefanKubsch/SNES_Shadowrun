// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { placeObjectInFormation } from '../../src/task/native-formation-place.mjs';

export const prepareTaskNativeBB2C = (options) =>
  prepareTaskPlan(options, [0x80bb2c], (a) => placeObjectInFormation(a));
