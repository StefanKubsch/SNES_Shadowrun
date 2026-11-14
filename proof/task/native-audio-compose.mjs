// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import {
  playSoundEffect,
  loadSampleData,
  subtractSampleLength,
  runTaskAudioWord,
  taskAudioDevices,
} from '../../src/task/native-audio-compose.mjs';

const entries = [0x80c46e, 0x81f130, 0x81f100, 0x81f122, 0x81f1e8];

export const prepareTaskNativeAudioCompose = (options) =>
  prepareTaskPlan(
    options,
    entries,
    (a) => {
      const events = { calls: [] };
      let result;
      if (options.entry === 0x80c46e) result = playSoundEffect(a, events);
      else if (options.entry === 0x81f130) result = loadSampleData(a, events);
      else if (options.entry === 0x81f100) result = subtractSampleLength(a, events);
      else result = runTaskAudioWord(a, events, options.entry === 0x81f1e8);
      return { ...result, calls: Object.freeze(events.calls) };
    },
    taskAudioDevices,
  );
