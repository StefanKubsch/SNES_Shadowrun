// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorKindFlags } from '../../src/task/native-record-kind-second-attribute.mjs';

export const prepareTaskNativeCB06 = (options) =>
  prepareTaskPlan(options, [0x80cb06], (a) => getActorKindFlags(a));
