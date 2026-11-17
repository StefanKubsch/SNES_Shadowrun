import { finishLeaf } from '../system/native-leaf-support.mjs';
import { setGloveLimits } from '../game/glove-target.mjs';
// Glove kinds of $01D8: FFFF action glove, FFFE crosshair, FFFD spell glove.
export const GLOVE_KIND_ACTION = 0xffff,
  GLOVE_KIND_CROSSHAIR = 0xfffe,
  GLOVE_KIND_SPELL = 0xfffd;
// Glove limits $01E4/$01E6 and kind $01E8 = $01D8 (flags from the last LDA#), the tails of BC67, BC80
// and BC99 after their JSR BC36. NativeB8 enters BC80 at BC83 (crosshair), Native6B BC99 at BC9C (spell).
export const GLOVE_LIMITS = Object.freeze({
  action: [0x0600, 0x0c00, GLOVE_KIND_ACTION],
  crosshair: [0x05e4, 0x0be8, GLOVE_KIND_CROSSHAIR],
  spell: [0x0600, 0x0c00, GLOVE_KIND_SPELL],
});
// 80:BC36 puts the glove over the player figure: Y from 0C00 minus diagonal, height, camera Y and
// 48; X from 0600 plus Y minus X, camera X and 10 (both shifted and byte-swapped).
export const GLOVE_OVER_PLAYER = Object.freeze({
  yBase: 0x0c00,
  yOffset: 0x48,
  xBase: 0x600,
  xOffset: 0x10,
});

// 80:BC83 (lifted in src/game/glove-target.mjs; register-level reference in
// proof/game-reference/script-measures.mjs): switch to the crosshair limits (the tail of
// 80:BC80 after its JSR 80:BC36).
export const limitCrosshair = (a, outerReturn = true) => {
  setGloveLimits(a.mem, GLOVE_LIMITS.crosshair);
  return finishLeaf(a, outerReturn);
};
