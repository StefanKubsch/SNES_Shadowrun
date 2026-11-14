// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorStateProperty } from '../../src/task/native-record-property-get.mjs';

export const prepareTaskNativeCB4D = (options) =>
  prepareTaskPlan(options, [0x80cb4d], (a) => getActorStateProperty(a));
