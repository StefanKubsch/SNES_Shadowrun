// Frame waits and input reads of the lifted scenes (cutscene, intro, matrix, title
// and start menu). The game runs them on the lag-free frame model: a frame wait
// lets the next NMI arrive, an input read takes the pad presses of that frame.
//
// Comparisons with recorded interrupt observations of the original run the same
// scenes, but their waits and reads must consume the recorded observations at the
// original call sites. That register-level driver lives in proof/ and installs
// itself here; the scenes never see the original addresses.
import { taskStop } from './task-stop.mjs';
import { lagFree } from '../vm/frame-events.mjs';
import { takePadPresses } from './joypad.mjs';
import { nmiAtBranch, waitForFrame } from './frame-wait.mjs';

let recordedDriver = null;

// Installed by proof/system/recorded-scene-frames.mjs.
export function installRecordedSceneFrames(driver) {
  recordedDriver = driver;
}

// The frame interface of one scene run. scene names the scene for the recorded
// driver; routines are the routine table a register-level caller passed in.
// Each method returns a sequence for yield*:
//   wait(m)              wait for the next frame
//   input(m)             read the pad presses of this frame
//   atBranch(pc, status) one pass of a polling loop at its branch (an NMI may arrive)
//   brightnessZero(m)    wait until the NMI callback has faded the screen to black
export function sceneFrames(h, events, scene, routines = null) {
  if (lagFree(events)) return liveFrames(h, events);
  if (!recordedDriver) taskStop('recorded_scene_frames_required', { scene });
  return recordedDriver(h, events, scene, routines);
}

function liveFrames(h, events) {
  return {
    wait: (m) => waitForFrame(h, events, m.port),
    input: (m) => [() => takePadPresses(m.wram)],
    atBranch: (pc, status) => nmiAtBranch(h, events, pc, status),
    brightnessZero: null,
  };
}
