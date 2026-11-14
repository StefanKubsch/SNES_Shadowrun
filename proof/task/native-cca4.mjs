// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { raiseStoryStage } from '../../src/task/native-story-stage-raise.mjs';

export const prepareTaskNativeCCA4 = (options) =>
  prepareTaskPlan(options, [0x80cca4], (a) => raiseStoryStage(a));
