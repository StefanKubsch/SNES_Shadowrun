// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getStoryStageReference } from '../game-reference/room-story.mjs';

export const prepareTaskNativeD134 = (options) =>
  prepareTaskPlan(options, [0x80d134], (a) => getStoryStageReference(a));
