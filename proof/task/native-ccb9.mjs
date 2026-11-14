// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getCurrentRoomHeader } from '../../src/task/native-room-entry-current.mjs';

export const prepareTaskNativeCCB9 = (options) =>
  prepareTaskPlan(options, [0x80ccb9], (a) => getCurrentRoomHeader(a));
