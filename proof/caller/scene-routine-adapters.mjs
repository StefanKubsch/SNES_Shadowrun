// Register-level entries of lifted scene code that only routine tables of references
// and comparisons reach: the game's audio 81:EF63 (live body in
// src/intro/intro-scene.mjs) and the title pan objects 81:D9D5 entered on their own
// (live body in src/intro/intro-objects.mjs). The game calls the bodies directly.
import '../system/recorded-scene-frames.mjs';
import { setUpGameAudio, RETURN_DATA_BANK } from '../../src/intro/intro-scene.mjs';
import { word } from '../../src/matrix/matrix-runtime.mjs';
import { DP_TITLE_POSITION } from '../../src/data/wram.mjs';
import { drawPanObjects } from '../../src/intro/intro-objects.mjs';
import { sceneRuntime } from '../../src/system/scene-runtime.mjs';

// 81:EF63 for register-level callers (the outer owner 80:A141): the game's audio,
// data bank 80, RTL.
export function setUpGameAudioRoutine(h) {
  setUpGameAudio(sceneRuntime(h));
  h.ctx.bank = RETURN_DATA_BANK;
  return h.rtl();
}

// 81:D9D5 entered on its own: the objects of the title pan.
export function handlePanObjects(h) {
  const m = sceneRuntime(h);
  drawPanObjects(m, word(m.wram, DP_TITLE_POSITION));
  return h.rtl();
}
