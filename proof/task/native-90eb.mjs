// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addTopic } from '../../src/task/native-topic-add.mjs';

export const prepareTaskNative90EB = (options) =>
  prepareTaskPlan(options, [0x8090eb], (a) => addTopic(a));
