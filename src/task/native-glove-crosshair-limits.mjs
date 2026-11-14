import { leaf } from './native-leaf-support.mjs';
import { GLOVE_KIND, GLOVE_BASE_X, GLOVE_BASE_Y, GLOVE_LIMIT_KIND } from './wram.mjs';
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
// Store the projection bases and the kind of one GLOVE_LIMITS entry, then the kind
// again as the active glove kind (each value by LDA #, STA at DBR).
export function applyGloveLimits(h, [left, top, kind]) {
  for (const [field, value] of [
    [GLOVE_BASE_X, left],
    [GLOVE_BASE_Y, top],
    [GLOVE_LIMIT_KIND, kind],
  ])
    h.longWrite(h.abs(field), h.load(value));
  h.longWrite(h.abs(GLOVE_KIND), h.ctx.a);
}

// 80:BC83: switch to the crosshair limits (the tail of 80:BC80 after its JSR 80:BC36).
export const limitCrosshair = (a, outerReturn = true) =>
  leaf(a, (h) => applyGloveLimits(h, GLOVE_LIMITS.crosshair), outerReturn);
