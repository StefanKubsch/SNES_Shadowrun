// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { markTopicReference } from '../game-reference/topic-list.mjs';

export const prepareTaskNative913C = (options) =>
  prepareTaskPlan(options, [0x80913c], (a) => markTopicReference(a));
