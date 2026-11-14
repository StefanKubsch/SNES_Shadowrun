// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { waitForRandomStateChange } from '../../src/task/native-frame-wait.mjs';

function validateTaskCounterOptions(options) {
  if (options.waitMode !== 'record-observations') taskStop('task_wait_mode_required');
  const values = options.waitObservations;
  if (
    !Array.isArray(values) ||
    !Object.isFrozen(values) ||
    !values.every(
      (o) =>
        o &&
        Object.isFrozen(o) &&
        o.pc === 0x81b0a5 &&
        o.address === 0x7e1c76 &&
        o.width === 2 &&
        Number.isInteger(o.value) &&
        o.value >= 0 &&
        o.value <= 65535,
    )
  )
    taskStop('task_wait_observations_required');
}

export const prepareTaskNativeCounterB0A1 = (options) =>
  prepareTaskPlan(options, [0x81b0a1], (a) => {
    validateTaskCounterOptions(options);
    return waitForRandomStateChange(a, options);
  });
