// The time limit of the Cortex bomb (lifted from 80:E270; register-level reference
// in proof/game-reference/main-timer.mjs).
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
// through their frames from the routine table; the notice and the
// text wait for the NMI of their uploads. Before each call A holds the value the
// original leaves in it (none of them reads it, but a wait's NMI saves it). The sound
// effect (src/apu/sound-effect.mjs) is lifted and waits for nothing; its frame is not
// reproduced. The routine itself sets neither X nor Y; after a sound they are left as
// the original sound effect leaves them (src/game/main-upkeep.mjs).
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
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
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

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
  NO_OBJECT = WORD_MASK,
  SOUND_HIGH_BYTE = 0xff00;
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
// routines the table of the register-level callees.
export function* timeLimitSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    call = (site, target) => nativeCallSequence(h, events, routines, site, target);
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
      ctx.a = NOTICE.frames;
      path = 'notice';
      return;
    }
    const left = frames - 1;
    setWord(wram, TIMER_FRAMES, left);
    const fast = hours === 0 && left < WARNING_FAST_BELOW;
    // The last hour compares the frames with E10; the carry stays for the main loop's
    // later callees (its own loads change only sign and zero).
    if (hours === 0) ctx.status = fast ? ctx.status & ~FLAG_CARRY : ctx.status | FLAG_CARRY;
    if (left & (fast ? WARNING_FAST_MASK : WARNING_SLOW_MASK)) return;
    setWord(wram, DP_SOUND_OBJECT, NO_OBJECT);
    setWord(wram, DP_SOUND_LEVEL, WARNING_LEVEL);
    setWord(wram, DP_SOUND_VOICE, WARNING_VOICES);
    setWord(wram, DP_SOUND_EFFECT, WARNING_SOUND);
    const sound = playSoundEffect(mem, accessorPort(h.a), {
      object: NO_OBJECT,
      effect: WARNING_SOUND,
      level: WARNING_LEVEL,
      voices: WARNING_VOICES,
    });
    // The sound effect leaves the sound word with FF in its high byte and the offset.
    ctx.x = sound | SOUND_HIGH_BYTE;
    ctx.y = WARNING_SOUND;
  };
  if (path === 'notice') {
    // The notice returns its window in A.
    yield* call(CALL.notice, NOTICE_CALL);
    yield () => {
      setWord(wram, DP_WINDOW, ctx.a);
      setWord(wram, DP_ARGUMENT, 0);
      setWord(wram, DP_CURSOR_ROW, 0);
    };
    yield* call(CALL.cursor, CURSOR_CALL);
    yield () => {
      const hours = word(wram, TIMER);
      setWord(wram, DP_ARGUMENT, hours);
      ctx.a = (hours - 1) & WORD_MASK;
      setWord(wram, TIMER, ctx.a);
    };
    yield* call(CALL.number, NUMBER_CALL);
    yield () => {
      ctx.a = word(wram, TIMER) ? TEXT_HOURS : TEXT_LAST_HOUR;
      setWord(wram, DP_ARGUMENT, ctx.a);
    };
    yield* call(CALL.text, TEXT_CALL);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
