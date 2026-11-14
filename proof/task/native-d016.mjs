// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { requestRoomReload } from '../../src/task/native-room-reload.mjs';

export const prepareTaskNativeD016 = (options) =>
  prepareTaskPlan(options, [0x80d016], (a) => requestRoomReload(a));
