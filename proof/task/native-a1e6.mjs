// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addSceneObject } from '../../src/task/native-scene-object-add.mjs';

export const prepareTaskNativeA1E6 = (options) =>
  prepareTaskPlan(options, [0x80a1e6], (a) => addSceneObject(a));
