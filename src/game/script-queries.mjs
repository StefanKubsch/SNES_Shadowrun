// Values the scripts ask for (lifted from the script natives 80:9E59, 80:9E5F, 80:CD97,
// 80:D18A, 80:C0F7, 80:C100 and 80:D9A7; register-level references in
// proof/game-reference/script-queries.mjs and script-measures.mjs): the joypad's held and
// newly pressed buttons, the player figure's object slot (80:D18A is a byte-identical copy
// of 80:CD97 with its own native ID), the glove sprite's screen position bytes and a
// signed word halved (rounded towards minus infinity).
import { dataBankWord } from '../system/data-bank.mjs';
import {
  GLOVE_SCREEN_X,
  GLOVE_SCREEN_Y,
  PAD_HELD,
  PAD_PRESSED,
  PLAYER_OBJECT,
} from '../data/wram.mjs';
import { BYTE_MASK, WORD_SIGN } from '../constants/bits.mjs';

// 80:9E59: the buttons held.
export const padHeld = (mem) => dataBankWord(mem, PAD_HELD);
// 80:9E5F: the buttons newly pressed this frame.
export const padPressed = (mem) => dataBankWord(mem, PAD_PRESSED);
// 80:CD97, 80:D18A and 80:D186 (D18A after a BRK that returns at once): the player
// figure's object slot (negative: none).
export const playerObject = (mem) => dataBankWord(mem, PLAYER_OBJECT);
// 80:C0F7 and 80:C100: the glove sprite's screen X and Y (bytes).
export const gloveScreenX = (mem) => dataBankWord(mem, GLOVE_SCREEN_X) & BYTE_MASK;
export const gloveScreenY = (mem) => dataBankWord(mem, GLOVE_SCREEN_Y) & BYTE_MASK;
// 80:D9A7: the signed word halved (an arithmetic shift right).
export const halveSigned = (value) => (value >>> 1) | (value & WORD_SIGN);
