// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { resetPlayerControl } from '../../src/task/native-player-control-reset.mjs';

export const prepareTaskNativeDE7E = (options) =>
  prepareTaskPlan(options, [0x80de7e], (a) => resetPlayerControl(a));
