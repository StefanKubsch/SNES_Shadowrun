// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { testObjectCollision } from '../../src/task/native-object-collision.mjs';

export const prepareTaskNative8371 = (options) =>
  prepareTaskPlan(options, [0x808371], (a) => testObjectCollision(a));
