// Frame waits and input reads of the lifted scenes for recorded interrupt
// observations of the original. The game runs these scenes on the lag-free frame
// model (src/system/scene-frames.mjs); the comparisons instead call the original
// register-level routines from the original call sites, so every wait and read
// consumes its recorded observations. Importing this module installs the driver.
import { installRecordedSceneFrames } from '../../src/system/scene-frames.mjs';
import { sceneFrameCallSequence, sceneInputCallSequence } from './scene-observed-calls.mjs';
import { nativeCallSequence } from '../../src/system/native-call-continuation.mjs';
import { FadePollContinuation } from '../../src/system/main-wait-interrupt.mjs';
import { sceneWaitByte } from './main-scene-wait.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { SCENE_BRIGHTNESS, WRAM } from '../../src/data/wram.mjs';

// The original frame wait 81:EEBB and long input read 80:F298 that the title and
// the start menu call through their routine tables.
const WAIT_FRAME = 0x81eebb,
  READ_INPUT = 0x80f298;
// The cutscene's fade poll 81:CF4C: LDA 11A3 / BNE, where the NMI arrives.
const FADE_POLL = 0x81cf4c;
// Original call sites per scene. The return addresses of these calls are never read.
const SITES = Object.freeze({
  cutscene: { wait: 0x81cdf8, input: 0x81cdf8 },
  intro: { wait: 0x81e07e, input: 0x81e082 },
  matrix: { wait: 0x81c3ca },
  title: { wait: 0x81d694, input: 0x81d694 },
  'start-menu': { wait: 0x81e14a, input: 0x81e14a },
});
// The title and the start menu call through the routine table of their caller.
const TABLE_SCENES = new Set(['title', 'start-menu']);
// Polling loops read their recorded port values; no NMI is placed at the branch.
const NO_BRANCH = () => [];

function recordedFrames(h, events, scene, routines) {
  const sites = SITES[scene];
  if (!sites) taskStop('recorded_scene_frames_unknown_scene', { scene });
  if (TABLE_SCENES.has(scene)) {
    const call = (target) => nativeCallSequence(h, events, routines, sites.wait, target, true);
    return {
      wait: () => call(WAIT_FRAME),
      input: () => call(READ_INPUT),
      atBranch: NO_BRANCH,
      brightnessZero: null,
    };
  }
  return {
    wait: () => sceneFrameCallSequence(h, events, sites.wait),
    input: () => sceneInputCallSequence(h, events, sites.input),
    atBranch: NO_BRANCH,
    brightnessZero: () => cutsceneFadePoll(h, events),
  };
}

// The cutscene waits until the NMI callback has faded the brightness to 0: with
// recorded interrupts as the original polling graph, else with one recorded byte
// per poll.
function* cutsceneFadePoll(h, events) {
  if (events?.interrupts !== undefined) {
    yield { continuation: new FadePollContinuation(h, events) };
    return;
  }
  for (let value = 1; value !== 0;)
    yield () => (value = sceneWaitByte(h, events, FADE_POLL, WRAM + SCENE_BRIGHTNESS));
}

installRecordedSceneFrames(recordedFrames);
