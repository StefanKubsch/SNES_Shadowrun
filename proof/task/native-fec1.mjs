// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import {
  validateNoticeOptions,
  showNoticeObserved,
  fec1Registers as devices,
} from '../../src/task/native-notice.mjs';

export function prepareTaskNativeFEC1(options) {
  const invalid = validateNoticeOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(options, [0x80fec1], (a) => showNoticeObserved(a, options), devices);
}
