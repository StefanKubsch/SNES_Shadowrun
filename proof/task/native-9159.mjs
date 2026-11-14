// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { isTopicKnown } from '../../src/task/native-topic-known.mjs';

export const prepareTaskNative9159 = (options) =>
  prepareTaskPlan(options, [0x809159], (a) => isTopicKnown(a));
