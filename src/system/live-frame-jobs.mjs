// Ordinary frame jobs selected by the scene's installed callback. The original
// callback pointer remains scene state until the picture interface is rebuilt;
// it is not an entry PC or a return address.
import { updateGameFrame } from '../game/game-nmi.mjs';
import { updateMatrixFrame } from '../matrix/matrix-scene.mjs';
import { updateCutsceneFrame } from '../cutscene/cutscene-scene.mjs';
import { updateIntroFrame } from '../intro/intro-scene.mjs';
import {
  updatePrologueFrame,
  updateTitleObjectsFrame,
  updateTitlePanFrame,
  updateTitleScrollFrame,
} from '../frontend/title.mjs';
import { updateStartMenuFrame } from '../frontend/start-menu.mjs';
import { NMI_CALLBACK, NMI_CALLBACK_BANK, RANDOM_STATE, WRAM } from '../data/wram.mjs';
import { WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { taskStop } from './task-stop.mjs';

const FRAME_JOBS = new Map([
  [0x80c152, updateGameFrame],
  [0x81bec3, updateMatrixFrame],
  [0x81d479, updateCutsceneFrame],
  [0x81df0e, updateIntroFrame],
  [0x81dad6, updateTitleObjectsFrame],
  [0x81dd54, updatePrologueFrame],
  [0x81d93e, updateTitlePanFrame],
  [0x81dcac, updateTitleScrollFrame],
  [0x81e6ae, updateStartMenuFrame],
  // Boot screens install an empty callback.
  [0x81e839, () => {}],
]);

export function runFrameJobs(a, carry) {
  const mem = a.mem,
    target = mem.read16(WRAM + NMI_CALLBACK) | (mem.read8(WRAM + NMI_CALLBACK_BANK) << WORD_BITS),
    run = FRAME_JOBS.get(target);
  if (!run) taskStop('live_frame_callback_frontier', { target });
  mem.write16(WRAM + RANDOM_STATE, (mem.read16(WRAM + RANDOM_STATE) + 1) & WORD_MASK);
  run({ a }, carry);
}
