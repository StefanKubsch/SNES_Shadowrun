// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { changeScene } from '../../src/task/native-scene-change.mjs';

export const prepareTaskNativeCC33 = (options) =>
  prepareTaskPlan(options, [0x80cc33], (a) => changeScene(a));
