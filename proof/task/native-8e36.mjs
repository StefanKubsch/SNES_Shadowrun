// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import {
  hitObjectsInBlastObserved,
  hitObjectsInBlastDevices,
} from '../../src/task/native-object-hit.mjs';

export const prepareTaskNative8E36 = (options) =>
  prepareTaskPlan(
    options,
    [0x808e36],
    (a) => hitObjectsInBlastObserved(a, options),
    hitObjectsInBlastDevices,
  );
