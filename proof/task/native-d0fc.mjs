// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorKind } from '../../src/task/native-record-kind-get.mjs';

export const prepareTaskNativeD0FC = (options) =>
  prepareTaskPlan(options, [0x80d0fc], (a) => getActorKind(a));
