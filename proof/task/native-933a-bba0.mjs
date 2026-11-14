// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
import { runTaskSelectionObserved, selectionDevices } from '../../src/task/native-selection.mjs';

export function prepareTaskSelectionRoot(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80933a, 0x80bba0],
    (a) => runTaskSelectionObserved(a, options, options.entry),
    selectionDevices,
  );
}
