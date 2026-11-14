// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectRecordFirstByteReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCA2B = (options) =>
  prepareTaskPlan(options, [0x80ca2b], (a) => getObjectRecordFirstByteReference(a));
