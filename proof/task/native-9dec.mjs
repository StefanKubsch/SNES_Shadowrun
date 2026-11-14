// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addActorStateCount } from '../../src/task/native-record-count-add.mjs';

export const prepareTaskNative9DEC = (options) =>
  prepareTaskPlan(options, [0x809dec], (a) => addActorStateCount(a));
