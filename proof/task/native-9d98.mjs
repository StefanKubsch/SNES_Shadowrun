// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { hasObjectRecordPropertyReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative9D98 = (options) =>
  prepareTaskPlan(options, [0x809d98], (a) => hasObjectRecordPropertyReference(a));
