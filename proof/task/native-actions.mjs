// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import {
  validateTaskActionsOptions,
  taskActionsEntries as entries,
  runTaskActionsObserved,
  taskActionsDevices,
} from '../../src/task/native-actions.mjs';

export function prepareTaskNativeActions(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    entries,
    (a) => runTaskActionsObserved(a, options, options.entry),
    taskActionsDevices,
  );
}
