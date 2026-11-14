// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { readInput, sendApuCommand, computeSoundPan } from '../../src/task/native-input-apu.mjs';

const devices = Object.freeze({
  writes: Object.freeze([0x2140, 0x2141, 0x2142, 0x2143, 0x4202, 0x4203]),
  reads: Object.freeze([0x2140, 0x4217]),
  observationPcs: Object.freeze([0x81f00e, 0x80c44f, 0x80c45a]),
});

export const prepareTaskNativeInputApu = (options) =>
  prepareTaskPlan(
    options,
    [0x809e1a, 0x81f007, 0x80c416],
    (a) =>
      options.entry === 0x809e1a
        ? readInput(a)
        : options.entry === 0x81f007
          ? sendApuCommand(a)
          : computeSoundPan(a),
    devices,
  );
