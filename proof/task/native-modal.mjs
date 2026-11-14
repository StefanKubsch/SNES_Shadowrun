// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
import { runTaskModalObserved, modalDevices } from '../../src/task/native-modal.mjs';

export function prepareTaskModalRoot(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80cd43, 0x80cd20, 0x80cbf7, 0x80935b],
    (a) => runTaskModalObserved(a, options, options.entry),
    modalDevices,
  );
}
