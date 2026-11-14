// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import {
  taskMenuEntries as entries,
  runTaskMenuCompose,
  taskMenuDevices as devices,
} from '../../src/task/native-menu-compose.mjs';

export function prepareTaskNativeMenuCompose(options) {
  const {
    waitMode = null,
    waitObservations = null,
    inputMode = null,
    inputObservations = null,
  } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (
    (inputMode !== null && inputMode !== 'record-observations') ||
    (inputObservations !== null && inputMode !== 'record-observations')
  )
    return { handled: false, reason: 'task_input_mode_required' };
  const records = (values, pcs) =>
    values === null ||
    (Array.isArray(values) &&
      Object.isFrozen(values) &&
      Array.from(values).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          pcs.includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= 0xffffff &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= 65535,
      ));
  if (!records(waitObservations, [0x81acc3, 0x81acc9, 0x81acbd, 0x81b0a5]))
    return { handled: false, reason: 'task_wait_observations_required' };
  if (!records(inputObservations, [0x809e1a]))
    return { handled: false, reason: 'task_input_observations_required' };
  return prepareTaskPlan(
    options,
    entries,
    (a) => {
      const events = {
        mode: waitMode,
        values: waitObservations,
        waitIndex: 0,
        calls: [],
        inputMode,
        inputs: inputObservations,
        inputIndex: 0,
      };
      const result = runTaskMenuCompose(a, events, options.entry);
      if (events.waitIndex !== (waitObservations?.length ?? 0))
        taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
      if (events.inputIndex !== (inputObservations?.length ?? 0))
        taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
      return {
        ...result,
        calls: Object.freeze(events.calls),
        waitObservationsUsed: events.waitIndex,
        inputObservationsUsed: events.inputIndex,
      };
    },
    devices,
  );
}
