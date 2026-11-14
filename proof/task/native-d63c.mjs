// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { circleSwarmLeaderReference } from '../game-reference/swarm-start.mjs';

export const prepareTaskNativeD63C = (options) =>
  prepareTaskPlan(options, [0x80d63c], (a) => circleSwarmLeaderReference(a));
