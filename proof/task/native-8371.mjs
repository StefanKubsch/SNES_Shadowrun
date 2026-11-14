// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { testObjectCollisionReference } from '../game-reference/action-box-collision.mjs';

export const prepareTaskNative8371 = (options) =>
  prepareTaskPlan(options, [0x808371], (a) => testObjectCollisionReference(a));
