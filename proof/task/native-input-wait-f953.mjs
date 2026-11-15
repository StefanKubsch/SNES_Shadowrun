// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { validateTaskActionsOptions } from '../replay/native-actions.mjs';
import { waitForConfirmKey } from '../replay/native-input-wait.mjs';

export function prepareTaskNativeInputWaitF953(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(options, [0x80f953], (a) => waitForConfirmKey(a, options));
}
