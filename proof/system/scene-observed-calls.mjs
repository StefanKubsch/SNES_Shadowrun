// Fixed scene calls for recorded waits/input (the proof driver of
// recorded-scene-frames.mjs); they consume the original explicit observations.
import { taskStop } from '../../src/system/task-stop.mjs';
import { dialogCallBody } from '../../src/system/native-call-continuation.mjs';
import { ObservedWaitContinuation } from '../../src/system/main-wait-interrupt.mjs';
import { waitForFrame } from '../../src/system/main-scene-wait.mjs';
import { readInput } from '../../src/system/native-input-apu.mjs';
import { PAD_HELD } from '../../src/data/wram.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';

const FRAME_WAIT = 0x81eebb,
  INPUT_LONG = 0x80f298,
  INPUT_WORD = 0x809e1a,
  INPUT_SITE = 0x80f29b;

export function* sceneFrameCallSequence(h, events, site) {
  return yield* dialogCallBody(
    h,
    site,
    FRAME_WAIT,
    function* () {
      if (events?.interrupts !== undefined)
        return yield { continuation: new ObservedWaitContinuation(h, events, FRAME_WAIT) };
      return yield () => waitForFrame(h, events);
    },
    true,
  );
}

function* inputWordSequence(h, events) {
  if (events?.interrupts !== undefined)
    return yield { continuation: new ObservedWaitContinuation(h, events, INPUT_WORD) };
  return yield () => {
    const address = h.abs(PAD_HELD),
      observation = events?.inputs?.[events.inputIndex];
    if (
      !observation ||
      !Object.isFrozen(observation) ||
      observation.pc !== INPUT_WORD ||
      observation.address !== address ||
      observation.width !== 2
    )
      taskStop('task_input_observation_required', {
        pc: INPUT_WORD,
        address,
        width: 2,
        observationIndex: events?.inputIndex,
      });
    events.inputIndex++;
    h.write(address, observation.value, 2);
    return readInput(h.a, false);
  };
}

export function* sceneInputCallSequence(h, events, site) {
  return yield* dialogCallBody(
    h,
    site,
    INPUT_LONG,
    function* () {
      yield () => {
        h.php();
        h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
      };
      yield* dialogCallBody(h, INPUT_SITE, INPUT_WORD, () => inputWordSequence(h, events));
      return yield () => {
        h.plp();
        return h.rtl();
      };
    },
    true,
  );
}
