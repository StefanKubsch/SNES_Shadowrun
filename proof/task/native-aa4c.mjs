// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { releaseObjectGraphicsReference } from '../game-reference/object-release.mjs';

export const prepareTaskNativeAA4C = (options) =>
  prepareTaskPlan(options, [0x80aa4c], (a) => releaseObjectGraphicsReference(a));
