// Values the scripts ask for (lifted from the script natives 80:9E59, 80:9E5F, 80:CD97,
// 80:D18A, 80:C0F7 and 80:C100; register-level references in
// proof/game-reference/script-queries.mjs): the joypad's held and newly pressed buttons,
// the player figure's object slot (80:D18A is a byte-identical copy of 80:CD97 with its
// own native ID) and the glove sprite's screen position bytes.
import { dataBankWord } from '../system/data-bank.mjs';
import {
  GLOVE_SCREEN_X,
  GLOVE_SCREEN_Y,
  PAD_HELD,
  PAD_PRESSED,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:9E59: the buttons held.
export const padHeld = (mem) => dataBankWord(mem, PAD_HELD);
// 80:9E5F: the buttons newly pressed this frame.
export const padPressed = (mem) => dataBankWord(mem, PAD_PRESSED);
// 80:CD97 and 80:D18A: the player figure's object slot (negative: none).
export const playerObject = (mem) => dataBankWord(mem, PLAYER_OBJECT);
// 80:C0F7 and 80:C100: the glove sprite's screen X and Y (bytes).
export const gloveScreenX = (mem) => dataBankWord(mem, GLOVE_SCREEN_X) & BYTE_MASK;
export const gloveScreenY = (mem) => dataBankWord(mem, GLOVE_SCREEN_Y) & BYTE_MASK;
