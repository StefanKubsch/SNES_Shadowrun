// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { printText, drawTextBuffer } from '../../src/task/native-text-compose.mjs';

const registers = Object.freeze({
  writes: Object.freeze([0x4202, 0x4203, 0x4204, 0x4205, 0x4206]),
  reads: Object.freeze([0x4214, 0x4216, 0x4217]),
  observationPcs: Object.freeze([0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94]),
});

function prepare(options, entry, run) {
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
    [entry],
    (a) => {
      const events = { mode: waitMode, values: waitObservations, waitIndex: 0, calls: [] },
        result = run(a, events);
      if (events.waitIndex !== (waitObservations?.length ?? 0))
        taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
      return {
        ...result,
        calls: Object.freeze(events.calls),
        waitObservationsUsed: events.waitIndex,
      };
    },
    registers,
  );
}

export const prepareTaskTextFE69 = (options) => prepare(options, 0x80fe69, printText);

export const prepareTaskTextFB39 = (options) => prepare(options, 0x80fb39, drawTextBuffer);
