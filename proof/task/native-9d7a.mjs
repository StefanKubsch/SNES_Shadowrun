// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { resetObjectRecordPropertyReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative9D7A = (options) =>
  prepareTaskPlan(options, [0x809d7a], (a) => resetObjectRecordPropertyReference(a));
