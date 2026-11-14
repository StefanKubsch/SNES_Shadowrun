// The register-level routines the main loop's lifted callees still call through
// their frames (notice, window, text, text buffer, number, sound, random, input, glove release, action
// menu and dialog), with the shared observation set and real return frames. The time
// limit 80:E270 and the glove action 80:BF3B are lifted in src/game/time-limit.mjs and
// src/game/glove-action.mjs; their register-level references are in
// proof/game-reference/main-timer.mjs and main-glove-action.mjs.
import { TALK_ROUTINES, talkWithObjectAdapter } from './native-dialog.mjs';
import { showNoticeAdapter } from './native-notice.mjs';
import { setTextCursor, printNumber } from './native-list-prerequisites.mjs';
import { printTextAdapter, drawTextBufferAdapter } from './native-text-compose.mjs';
import { playSoundEffectRoutine } from '../apu/sound-effect.mjs';
import { randomByte, randomBelow } from './native-random.mjs';
import { chooseActionAdapter } from './native-actions.mjs';

// Already proven routines, with the shared observation set and real return frames.
export const MAIN_UPKEEP_ROUTINES = new Map([
  ...[0x81b0a1, 0x809e1a, 0x80bcb2, 0x80fa3e, 0x80f963].map((t) => [t, TALK_ROUTINES.get(t)]),
  [0x80fec1, showNoticeAdapter],
  [0x80faac, (h, e) => setTextCursor(h.a, e, false)],
  [0x80fd80, (h, e) => printNumber(h.a, e, false)],
  [0x80fe69, printTextAdapter],
  [0x80fb39, drawTextBufferAdapter],
  [0x80c46e, playSoundEffectRoutine],
  [0x80c560, (h) => randomByte(h.a, false)],
  [0x80c51f, (h) => randomBelow(h.a, false)],
  [0x8099eb, chooseActionAdapter],
  [0x80936c, talkWithObjectAdapter],
]);
