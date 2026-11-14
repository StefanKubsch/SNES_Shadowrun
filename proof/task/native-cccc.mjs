// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getRoomHeaderReference } from '../game-reference/room-story.mjs';

export const prepareTaskNativeCCCC = (options) =>
  prepareTaskPlan(options, [0x80cccc], (a) => getRoomHeaderReference(a));
