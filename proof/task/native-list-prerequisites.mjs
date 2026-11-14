// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import {
  runTaskListHelper,
  taskListDevices as devices,
} from '../../src/task/native-list-prerequisites.mjs';

const entries = [0x80a617, 0x80a5db, 0x80a5f9, 0x80faac, 0x80fd80];

export function prepareTaskNativeListPrerequisites(options) {
  const { waitMode = null, waitObservations = null } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (
    waitObservations !== null &&
    (!Array.isArray(waitObservations) ||
      !Object.isFrozen(waitObservations) ||
      !Array.from(waitObservations).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          [0x81acc3, 0x81acc9].includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= 0xffffff &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= 65535,
      ))
  )
    return { handled: false, reason: 'task_wait_observations_required' };
  return prepareTaskPlan(
    options,
    entries,
    (a) => {
      const events = { mode: waitMode, values: waitObservations, waitIndex: 0, calls: [] },
        result = runTaskListHelper(a, events, options.entry);
      if (events.waitIndex !== (waitObservations?.length ?? 0))
        taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
      return {
        ...result,
        calls: Object.freeze(events.calls),
        waitObservationsUsed: events.waitIndex,
      };
    },
    devices,
  );
}
