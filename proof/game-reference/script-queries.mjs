// Register-level references of the pad, player and glove getters 80:9E59, 80:9E5F,
// 80:CD97, 80:D18A, 80:C0F7 and 80:C100 (moved from src/task/native-pad-*.mjs,
// native-player-object*.mjs and native-glove-screen-*.mjs; lifted in
// src/game/script-queries.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { leaf } from '../../src/task/native-leaf-support.mjs';
import {
  GLOVE_SCREEN_X,
  GLOVE_SCREEN_Y,
  PAD_HELD,
  PAD_PRESSED,
  PLAYER_OBJECT,
} from '../../src/task/wram.mjs';
import { BYTE_MASK } from '../../src/constants/bits.mjs';
// 80:9E59: return the joypad buttons currently held.
export const getPadHeldReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PAD_HELD))));
    },
    outerReturn,
  );
// 80:9E5F: return the joypad buttons newly pressed this frame.
export const getPadPressedReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PAD_PRESSED))));
    },
    outerReturn,
  );
// 80:CD97: return the object slot of the player figure (the leader).
export const getPlayerObjectReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PLAYER_OBJECT))));
    },
    outerReturn,
  );
// 80:D18A: a second, byte-identical ROM copy of getPlayerObject (80:CD97) with its own native ID.
export const getPlayerObjectCopyReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PLAYER_OBJECT))));
    },
    outerReturn,
  );
// 80:C0F7: return the screen X position (one byte) of the glove sprite.
export const getGloveScreenXReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const word = h.load(h.longRead(h.abs(GLOVE_SCREEN_X)));
      h.result(h.load(word & BYTE_MASK));
    },
    outerReturn,
  );
// 80:C100: return the screen Y position (one byte) of the glove sprite.
export const getGloveScreenYReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const word = h.load(h.longRead(h.abs(GLOVE_SCREEN_Y)));
      h.result(h.load(word & BYTE_MASK));
    },
    outerReturn,
  );
