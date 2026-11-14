// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { changeRoom } from '../../src/task/native-room-change.mjs';

export const prepareTaskNativeCC97 = (options) =>
  prepareTaskPlan(options, [0x80cc97], (a) => changeRoom(a));
