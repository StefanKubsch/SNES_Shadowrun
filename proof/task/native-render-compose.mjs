// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { af1fRegisters } from '../../src/task/native-bar-tiles.mjs';
import {
  waitForTextMapUpload,
  requestTextMapUpload,
  drawWindow,
  drawWindowList,
  releaseWindow,
} from '../../src/task/native-render-compose.mjs';

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
          o.pc === 0x81acaf &&
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
  const events = { mode: waitMode, values: waitObservations, waitIndex: 0, waitEvents: [] };
  return prepareTaskPlan(
    options,
    [entry],
    (a) => {
      const result = run(a, events);
      if (events.waitIndex !== (events.values?.length ?? 0))
        taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
      return {
        ...result,
        waitObservationsUsed: events.waitIndex,
        waitEvents: Object.freeze(events.waitEvents),
      };
    },
    af1fRegisters,
  );
}

export const prepareTaskNativeACAF = (options) => prepare(options, 0x81acaf, waitForTextMapUpload);

export const prepareTaskNativeACB5 = (options) => prepare(options, 0x81acb5, requestTextMapUpload);

export const prepareTaskNativeACCF = (options) => prepare(options, 0x81accf, (a) => drawWindow(a));

export const prepareTaskNativeAD92 = (options) => prepare(options, 0x81ad92, drawWindowList);

export const prepareTaskNativeFA3E = (options) => prepare(options, 0x80fa3e, releaseWindow);
