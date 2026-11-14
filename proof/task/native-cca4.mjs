// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { raiseStoryStageReference } from '../game-reference/room-story.mjs';

export const prepareTaskNativeCCA4 = (options) =>
  prepareTaskPlan(options, [0x80cca4], (a) => raiseStoryStageReference(a));
