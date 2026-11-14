// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { isTopicKnownReference } from '../game-reference/topic-list.mjs';

export const prepareTaskNative9159 = (options) =>
  prepareTaskPlan(options, [0x809159], (a) => isTopicKnownReference(a));
