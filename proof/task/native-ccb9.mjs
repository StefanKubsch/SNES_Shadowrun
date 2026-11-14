// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getCurrentRoomHeaderReference } from '../game-reference/room-story.mjs';

export const prepareTaskNativeCCB9 = (options) =>
  prepareTaskPlan(options, [0x80ccb9], (a) => getCurrentRoomHeaderReference(a));
