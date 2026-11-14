// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { openWindow } from '../../src/task/native-window-open.mjs';

const devices = Object.freeze({
  writes: Object.freeze([0x211b, 0x211c]),
  reads: Object.freeze([0x2134, 0x2135]),
});

export function prepareTaskNativeF963(options) {
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
          [0x81acbd, 0x81acaf].includes(o.pc) &&
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
    [0x80f963],
    (a) => openWindow(a, { mode: waitMode, values: waitObservations }),
    devices,
  );
}
