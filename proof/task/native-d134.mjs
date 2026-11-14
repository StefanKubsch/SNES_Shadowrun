// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getStoryStage } from '../../src/task/native-story-stage-get.mjs';

export const prepareTaskNativeD134 = (options) =>
  prepareTaskPlan(options, [0x80d134], (a) => getStoryStage(a));
