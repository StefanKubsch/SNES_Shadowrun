// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { releaseObjectGraphics } from '../../src/task/native-object-release-direct.mjs';

export const prepareTaskNativeAA4C = (options) =>
  prepareTaskPlan(options, [0x80aa4c], (a) => releaseObjectGraphics(a));
