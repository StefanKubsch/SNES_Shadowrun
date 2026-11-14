// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { af1fRegisters } from '../../src/task/native-bar-tiles.mjs';
import {
  validateNoticeReleaseOptions,
  releaseNoticeWindowsObserved,
} from '../../src/task/native-slot-release.mjs';

export function prepareTaskNativeClearFF79(options) {
  const invalid = validateNoticeReleaseOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80ff79],
    (a) => releaseNoticeWindowsObserved(a, options),
    af1fRegisters,
  );
}
