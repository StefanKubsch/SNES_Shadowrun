// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { markTopic } from '../../src/task/native-topic-mark.mjs';

export const prepareTaskNative913C = (options) =>
  prepareTaskPlan(options, [0x80913c], (a) => markTopic(a));
