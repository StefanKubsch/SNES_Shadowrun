// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { randomBelow, randomByte, taskRandomDevices } from '../../src/task/native-random.mjs';

export const prepareTaskNativeRandom = (options) =>
  prepareTaskPlan(
    options,
    [0x80c51f, 0x80c560],
    (a) => (options.entry === 0x80c51f ? randomBelow(a) : randomByte(a)),
    taskRandomDevices,
  );
