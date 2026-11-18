import '../system/recorded-scene-frames.mjs';
import { frontendContinuations, FRONTEND_TEXT_ROUTINES } from './main-frontend-text.mjs';

import { drainNativeSequence } from '../../src/system/native-call-continuation.mjs';
import { titleSequence as liftedTitle } from '../../src/frontend/title.mjs';
import { startMenuSequence as liftedStartMenu } from '../../src/frontend/start-menu.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';

// Register forms of the lifted title and start menu for register-level callers. The
// start menu takes A nonzero right after the title and leaves A the choice; the 8-bit
// fade out of the original leaves X at FF and clears the high byte of Y.
const FADE_OUT_X = 0xff;
function* startMenuSequence(h, e, r) {
  const menu = {},
    result = yield* liftedStartMenu(h, e, r, (h.ctx.a & WORD_MASK) !== 0, menu);
  Object.assign(h.ctx, { a: menu.choice, x: FADE_OUT_X, y: h.ctx.y & BYTE_MASK });
  return result;
}
// The title leaves A 1 after a held button, 0 after the whole title (its low byte with
// an 8-bit accumulator), and the zero flag of that load.
function* titleSequence(h, e, r) {
  const shown = {},
    result = yield* liftedTitle(h, e, r, shown),
    { ctx } = h,
    value = shown.key ? 1 : 0;
  ctx.a = ctx.status & FLAG_MEMORY_8BIT ? (ctx.a & ~BYTE_MASK) | value : value;
  ctx.status = (ctx.status & ~(FLAG_NEGATIVE | FLAG_ZERO)) | (value ? 0 : FLAG_ZERO);
  return result;
}
import {
  attractGameSequence,
  runAttractGame,
  runTitleCycle,
  titleCycleSequence,
} from '../frontend-caller/title-cycle.mjs';

// 81:E14A: the start menu (src/frontend/start-menu.mjs).
export function openStartMenu(h, e, r = FRONTEND_MENU_ROUTINES) {
  return drainNativeSequence(startMenuSequence(h, e, r));
}
// 81:D694: the prologue and the title (src/frontend/title.mjs).
export function playTitle(h, e, r = FRONTEND_MENU_ROUTINES) {
  return drainNativeSequence(titleSequence(h, e, r));
}
export const FRONTEND_MENU_ROUTINES = new Map([
  ...FRONTEND_TEXT_ROUTINES,
  // The lifted start menu, title, title cycle and attract game (src/frontend).
  [0x81e14a, openStartMenu],
  [0x81d694, playTitle],
  [0x80a168, runAttractGame],
  [0x80a18c, runTitleCycle],
]);
frontendContinuations(
  [
    [0x81e14a, openStartMenu, startMenuSequence],
    [0x81d694, playTitle, titleSequence],
    [0x80a18c, runTitleCycle, titleCycleSequence],
    [0x80a168, runAttractGame, attractGameSequence],
  ],
  () => FRONTEND_MENU_ROUTINES,
);
