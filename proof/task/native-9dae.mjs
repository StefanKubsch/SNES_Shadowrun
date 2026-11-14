// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { isActorStateProperty } from '../../src/task/native-record-property-equals.mjs';

export const prepareTaskNative9DAE = (options) =>
  prepareTaskPlan(options, [0x809dae], (a) => isActorStateProperty(a));
