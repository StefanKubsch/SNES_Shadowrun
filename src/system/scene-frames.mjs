// Frame waits and input reads of the lifted scenes (cutscene, intro, matrix, title
// and start menu). The game runs them on the lag-free frame model: a frame wait
// lets the next NMI arrive, an input read takes the pad presses of that frame.
import { taskStop } from './task-stop.mjs';
import { lagFree } from '../vm/frame-events.mjs';
import { takePadPresses } from './joypad.mjs';
import { nmiAtBranch, waitForFrame } from './frame-wait.mjs';

// The frame interface of one scene run (scene names it for a stop).
// Each method returns a sequence for yield*:
//   wait(m)              wait for the next frame
//   input(m)             read the pad presses of this frame
//   atBranch(pc, status) one pass of a polling loop at its branch (an NMI may arrive)
//   brightnessZero(m)    wait until the NMI callback has faded the screen to black
export function sceneFrames(h, events, scene) {
  if (!lagFree(events)) taskStop('frame_model_required', { scene });
  return liveFrames(h, events);
}

function liveFrames(h, events) {
  return {
    wait: (m) => waitForFrame(h, events, m.port),
    input: (m) => [() => takePadPresses(m.wram)],
    atBranch: (pc, status) => nmiAtBranch(h, events, pc, status),
    brightnessZero: null,
  };
}
