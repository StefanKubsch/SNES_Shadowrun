// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import {
  readTextBit,
  runTaskTextGeometry,
  closeTextMask,
  runTaskTextWait,
} from '../../src/task/native-text-prerequisites.mjs';

const registers = Object.freeze({
  writes: Object.freeze([0x4202, 0x4203, 0x4204, 0x4205, 0x4206]),
  reads: Object.freeze([0x4214, 0x4216, 0x4217]),
  observationPcs: Object.freeze([0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94]),
});

export const prepareTaskTextAF04 = (options) =>
  prepareTaskPlan(options, [0x81af04], (a) => readTextBit(a));

export const prepareTaskTextADBA = (options) =>
  prepareTaskPlan(options, [0x81adba], (a) => runTaskTextGeometry(a, 'ADBA'), registers);

export const prepareTaskTextAE14 = (options) =>
  prepareTaskPlan(options, [0x81ae14], (a) => runTaskTextGeometry(a, 'AE14'), registers);

export const prepareTaskTextAE4D = (options) =>
  prepareTaskPlan(options, [0x81ae4d], (a) => runTaskTextGeometry(a, 'AE4D'), registers);

export const prepareTaskTextAEC8 = (options) =>
  prepareTaskPlan(options, [0x81aec8], (a) => closeTextMask(a));

function prepareWait(options, name, entry) {
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
  return prepareTaskPlan(options, [entry], (a) =>
    runTaskTextWait(a, name, { mode: waitMode, values: waitObservations }),
  );
}

export const prepareTaskTextAEF4 = (options) => prepareWait(options, 'AEF4', 0x81aef4);

export const prepareTaskTextAEFC = (options) => prepareWait(options, 'AEFC', 0x81aefc);

export const prepareTaskTextACC3 = (options) => prepareWait(options, 'ACC3', 0x81acc3);

export const prepareTaskTextACC9 = (options) => prepareWait(options, 'ACC9', 0x81acc9);
