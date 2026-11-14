// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorKindValue } from '../../src/task/native-record-kind-attribute.mjs';

export const prepareTaskNativeCAF2 = (options) =>
  prepareTaskPlan(options, [0x80caf2], (a) => getActorKindValue(a));
