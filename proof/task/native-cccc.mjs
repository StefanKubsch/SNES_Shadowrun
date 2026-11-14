// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getRoomHeader } from '../../src/task/native-room-entry.mjs';

export const prepareTaskNativeCCCC = (options) =>
  prepareTaskPlan(options, [0x80cccc], (a) => getRoomHeader(a));
