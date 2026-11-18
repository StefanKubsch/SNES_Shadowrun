// The time limit of the Cortex bomb (lifted from 80:E270 and the script natives 80:E255,
// 80:E24E and 80:E262; register-level references in proof/game-reference/main-timer.mjs
// and proof/game-reference/script-timer.mjs).
//
// A script starts the time limit with 29 hours of DD4 frames each, stops it by setting
// the hours to FFFF (negative: the main loop no longer counts) and asks whether either
// the hours or the frames are nonzero.
//
// While the hours 7E:1D89 are not negative and either they or the frames 7E:1D87 are
// not zero, the main loop counts the frames down in every pass. When the frames of
// an hour run out, an hour lasts DD4 frames again and a notice window (8, 2, 11 x 4,
// text 4, B4 frames) shows the hours left before the count: "hour" in the last hour,
// "hours before your Cortex bomb goes off." otherwise; then the hours count down. In
// the last hour, while fewer than E10 frames are left, a warning sound 26 plays every
// 20 frames, otherwise every 40 frames (at level FF on voices 7, no object).
//
// The notice 80:FEC1 (lifted in notice-show.mjs), the text cursor 80:FAAC and the
// number 80:FD80 (lifted in window-text.mjs) and the text 80:FE69 (text-print.mjs) run
// directly through their call frames; the notice and the
// text wait for the NMI of their uploads. The sound effect (src/apu/sound-effect.mjs)
// is lifted and waits for nothing; its frame is not reproduced.
//
// Registers (user decision 2026-11-17): game state only; the notice 80:FEC1 returns its
// window as a value (A in the original). The carry the original leaves in the last hour
// reaches only the P a later NMI saves (the next main loop steps do not read it), so it
// is not kept, nor are A, X and Y.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { showNoticeSequence } from './notice-show.mjs';
import { setTextCursorRoutine, printNumberSequence } from './window-text.mjs';
import { printTextSequence } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import {
  DP_CURSOR_ROW,
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  TIMER,
  TIMER_FRAMES,
  TIMER_STOPPED,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';

const FRAMES_PER_HOUR = 0xdd4,
  NOTICE = Object.freeze({ left: 8, top: 2, columns: 0x11, rows: 4, text: 4, frames: 0xb4 }),
  TEXT_LAST_HOUR = 0x7446,
  TEXT_HOURS = 0x742f,
  WARNING_FAST_BELOW = 0xe10,
  WARNING_FAST_MASK = 0x1f,
  WARNING_SLOW_MASK = 0x3f,
  WARNING_SOUND = 0x26,
  WARNING_LEVEL = BYTE_MASK,
  WARNING_VOICES = 7,
  NO_OBJECT = WORD_MASK;
// The direct page words of the calls: the window (from the notice), the number and the text.
const DP_WINDOW = 0x00,
  DP_ARGUMENT = 0x02,
  DP_SOUND_OBJECT = 0x00;
// Original call sites.
const CALL = Object.freeze({
  notice: 0x80e2ab,
  cursor: 0x80e2b4,
  number: 0x80e2c0,
  text: 0x80e2d2,
});
const NOTICE_CALL = 0x80fec1,
  CURSOR_CALL = 0x80faac,
  NUMBER_CALL = 0x80fd80,
  TEXT_CALL = 0x80fe69;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Count the time limit down (80:E270), a sequence for a native call continuation:
// h the main loop's access (direct page 0, data bank 80), events its frame events,
// renderBuffer its text-buffer renderer sequence.
export function* timeLimitSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    call = (site, target, body) => dialogCallBody(h, site, target, body);
  let path = 'return';
  yield () => {
    const hours = word(wram, TIMER),
      frames = word(wram, TIMER_FRAMES);
    if (hours & WORD_SIGN || (hours | frames) === 0) return;
    if (frames === 0) {
      setWord(wram, TIMER_FRAMES, FRAMES_PER_HOUR);
      setWord(wram, DP_WINDOW_LEFT, NOTICE.left);
      setWord(wram, DP_WINDOW_TOP, NOTICE.top);
      setWord(wram, DP_WINDOW_COLUMNS, NOTICE.columns);
      setWord(wram, DP_WINDOW_ROWS, NOTICE.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      setWord(wram, DP_NOTICE_TEXT, NOTICE.text);
      setWord(wram, DP_NOTICE_FRAMES, NOTICE.frames);
      path = 'notice';
      return;
    }
    const left = frames - 1;
    setWord(wram, TIMER_FRAMES, left);
    const fast = hours === 0 && left < WARNING_FAST_BELOW;
    if (left & (fast ? WARNING_FAST_MASK : WARNING_SLOW_MASK)) return;
    setWord(wram, DP_SOUND_OBJECT, NO_OBJECT);
    setWord(wram, DP_SOUND_LEVEL, WARNING_LEVEL);
    setWord(wram, DP_SOUND_VOICE, WARNING_VOICES);
    setWord(wram, DP_SOUND_EFFECT, WARNING_SOUND);
    playSoundEffect(mem, accessorPort(h.a), {
      object: NO_OBJECT,
      effect: WARNING_SOUND,
      level: WARNING_LEVEL,
      voices: WARNING_VOICES,
    });
  };
  if (path === 'notice') {
    const shown = {};
    yield* call(CALL.notice, NOTICE_CALL, () => showNoticeSequence(h, events, renderBuffer, shown));
    yield () => {
      setWord(wram, DP_WINDOW, shown.window);
      setWord(wram, DP_ARGUMENT, 0);
      setWord(wram, DP_CURSOR_ROW, 0);
    };
    yield* call(CALL.cursor, CURSOR_CALL, () => segmentSequence(() => setTextCursorRoutine(h)));
    yield () => {
      const hours = word(wram, TIMER);
      setWord(wram, DP_ARGUMENT, hours);
      setWord(wram, TIMER, (hours - 1) & WORD_MASK);
    };
    yield* call(CALL.number, NUMBER_CALL, () => printNumberSequence(h, events, renderBuffer));
    yield () => setWord(wram, DP_ARGUMENT, word(wram, TIMER) ? TEXT_HOURS : TEXT_LAST_HOUR);
    yield* call(CALL.text, TEXT_CALL, () => printTextSequence(h, events, renderBuffer));
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The hours a script's time limit starts with.
const START_HOURS = 29,
  // A script's truth value.
  TRUE = WORD_MASK;

// 80:E255: start the time limit (29 hours, a full hour of frames).
export function startTimeLimit(mem) {
  setDataBankWord(mem, TIMER_FRAMES, 0, FRAMES_PER_HOUR);
  setDataBankWord(mem, TIMER, 0, START_HOURS);
}
// 80:E24E: stop the time limit (the hours FFFF; the frames stay).
export const stopTimeLimit = (mem) => setDataBankWord(mem, TIMER, 0, TIMER_STOPPED);
// 80:E262: TRUE while the hours or the frames are nonzero, else 0.
export const timeLimitRunning = (mem) =>
  dataBankWord(mem, TIMER_FRAMES) | dataBankWord(mem, TIMER) ? TRUE : 0;
