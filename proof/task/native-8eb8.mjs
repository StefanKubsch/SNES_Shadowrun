// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { resumeObject } from '../../src/task/native-object-halt-clear.mjs';

export const prepareTaskNative8EB8 = (options) =>
  prepareTaskPlan(options, [0x808eb8], (a) => resumeObject(a));
