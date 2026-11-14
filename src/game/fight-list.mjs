// The fight list (lifted from 80:8521 and 80:855E; register-level references in
// proof/game-reference/fight-list-append.mjs and src/task/native-fight-list-remove.mjs).
//
// The fight list holds the objects in a fight as words after its index word; the index
// points at the last entry (FFFE: empty). The first entry starts a fight: an eighth of
// the karma is kept for the fight's gain and, with music enabled and another mode
/// playing, that mode is kept to be restored afterwards and the fight music starts.
//
// Removing an object closes its gap. The first removal of a fight counts down the
// group members' nonzero formation positions (7E:2DF8), unless the leader goes alone or
// the group is empty. The last removal ends the fight: the karma gained since the first
// entry (karma / 8 then and now) shows in a notice with its number and a sound, and with
// the music option the music kept by the first entry plays again (none if there was
// none), else the music mode 0.
import { setMusicMode } from '../apu/music-mode.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
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
  FIGHT_FIRST_REMOVAL,
  FIGHT_KARMA,
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_POSITIONS,
  OPTION_MUSIC_RESTORE,
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  GAME_OPTIONS,
  KARMA,
  MUSIC,
  MUSIC_FIGHT,
  OPTION_MUSIC,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The fight's karma is an eighth of the karma; FFFF keeps no music.
const FIGHT_KARMA_SHIFT = 3,
  NO_MUSIC = WORD_MASK;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Append object to the fight list (80:8521; the original has no capacity check).
export function appendToFightList(mem, port, object) {
  const { wram } = mem,
    index = (word(wram, FIGHT_LIST_INDEX) + 2) & WORD_MASK;
  setWord(wram, FIGHT_LIST_INDEX, index);
  // Through the data bank 80 as the original (src/system/data-bank.mjs).
  setDataBankWord(mem, FIGHT_LIST, index, object);
  if (index !== 0) return;
  setWord(wram, FIGHT_KARMA, word(wram, KARMA) >>> FIGHT_KARMA_SHIFT);
  setWord(wram, FIGHT_MUSIC, NO_MUSIC);
  if (!(word(wram, GAME_OPTIONS) & OPTION_MUSIC)) return;
  const music = word(wram, MUSIC);
  if (music === MUSIC_FIGHT) return;
  setWord(wram, FIGHT_MUSIC, music);
  setMusicMode(mem, port, MUSIC_FIGHT);
}

// The karma notice: at 10/2, nine columns (ten from a gain of 10 on) and three rows,
// text 4 for 78 frames; then the gain at the cursor, the text 7117 and the sound 32 at
// level FF on voices 7.
const KARMA_NOTICE = { left: 10, top: 2, columns: 9, wideColumns: 10, rows: 3 },
  WIDE_FROM = 10,
  NOTICE_TEXT = 4,
  NOTICE_FRAMES = 0x78,
  TEXT_KARMA_GAIN = 0x7117,
  KARMA_SOUND = 0x32,
  KARMA_SOUND_LEVEL = BYTE_MASK,
  KARMA_SOUND_VOICES = 7,
  DP_WINDOW = 0,
  DP_TEXT = 2,
  NO_OBJECT = WORD_MASK,
  // The music mode without the restore option.
  MUSIC_OFF = 0;
// Original call sites (JSR, the music JSL) and callees.
const NOTICE_CALL = [0x8085e4, 0x80fec1],
  CURSOR_CALL = [0x8085ed, 0x80faac],
  NUMBER_CALL = [0x8085f5, 0x80fd80],
  TEXT_CALL = [0x8085fd, 0x80fe69],
  SOUND_CALL = [0x808614, 0x80c46e],
  MUSIC_RESTORE_SITE = 0x808624,
  MUSIC_OFF_SITE = 0x80862c,
  MUSIC_MODE = 0x81ef47;
const negative = (value) => (value & WORD_SIGN) !== 0;

// Remove the object (the direct page word 00) from the fight list (80:855E), a sequence
// that ends with the native's RTS; routines holds the notice, cursor, number, text,
// sound and music mode routines.
export function* removeFromFightListSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    call = ([site, target], long = false) =>
      nativeCallSequence(h, events, routines, site, target, long);
  let state = 'missing';
  yield () => {
    const object = word(wram, 0);
    let x = word(wram, FIGHT_LIST_INDEX);
    while (!negative(x) && dataBankWord(mem, FIGHT_LIST, x) !== object) x = (x - 2) & WORD_MASK;
    if (negative(x)) return;
    // Close the gap; the end is read again after each move, as the original.
    do {
      setDataBankWord(mem, FIGHT_LIST, x, dataBankWord(mem, FIGHT_LIST + 2, x));
      x = (x + 2) & WORD_MASK;
    } while (x < word(wram, FIGHT_LIST_INDEX));
    if (word(wram, FIGHT_FIRST_REMOVAL) === 0) {
      setWord(wram, FIGHT_FIRST_REMOVAL, WORD_MASK);
      const members = word(wram, GROUP_INDEX);
      if (!negative(word(wram, GROUP_LEADER_ONLY)) && !negative(members))
        for (let m = members; !negative(m); m = (m - 2) & WORD_MASK) {
          const position = word(wram, GROUP_POSITIONS + m);
          if (position !== 0) setWord(wram, GROUP_POSITIONS + m, position - 1);
        }
    }
    const last = (word(wram, FIGHT_LIST_INDEX) - 2) & WORD_MASK;
    setWord(wram, FIGHT_LIST_INDEX, last);
    if (!negative(last)) {
      state = 'removed';
      return;
    }
    const gain = ((word(wram, KARMA) >>> FIGHT_KARMA_SHIFT) - word(wram, FIGHT_KARMA)) & WORD_MASK;
    state = gain === 0 ? 'ended' : 'gain';
    if (gain === 0) return;
    setWord(wram, FIGHT_KARMA, gain);
    for (const [at, value] of [
      [DP_WINDOW_COLUMNS, gain >= WIDE_FROM ? KARMA_NOTICE.wideColumns : KARMA_NOTICE.columns],
      [DP_WINDOW_LEFT, KARMA_NOTICE.left],
      [DP_WINDOW_TOP, KARMA_NOTICE.top],
      [DP_WINDOW_ROWS, KARMA_NOTICE.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
      [DP_NOTICE_TEXT, NOTICE_TEXT],
      [DP_NOTICE_FRAMES, NOTICE_FRAMES],
    ])
      setWord(wram, at, value);
    // A holds the last value loaded, as the original passes it on.
    ctx.a = NOTICE_FRAMES;
  };
  if (state === 'gain') {
    yield* call(NOTICE_CALL);
    yield () => {
      // The notice leaves its window in A.
      setWord(wram, DP_WINDOW, ctx.a);
      setWord(wram, DP_TEXT, 0);
      setWord(wram, DP_CURSOR_ROW, 0);
    };
    yield* call(CURSOR_CALL);
    yield () => {
      ctx.a = word(wram, FIGHT_KARMA);
      setWord(wram, DP_TEXT, ctx.a);
    };
    yield* call(NUMBER_CALL);
    yield () => {
      ctx.a = TEXT_KARMA_GAIN;
      setWord(wram, DP_TEXT, ctx.a);
    };
    yield* call(TEXT_CALL);
    yield () => {
      setWord(wram, 0, NO_OBJECT);
      setWord(wram, DP_SOUND_LEVEL, KARMA_SOUND_LEVEL);
      setWord(wram, DP_SOUND_VOICE, KARMA_SOUND_VOICES);
      setWord(wram, DP_SOUND_EFFECT, KARMA_SOUND);
      ctx.a = KARMA_SOUND;
    };
    yield* call(SOUND_CALL);
  }
  if (state === 'gain' || state === 'ended') {
    let site = null;
    yield () => {
      if (!(word(wram, GAME_OPTIONS) & OPTION_MUSIC_RESTORE)) {
        ctx.a = MUSIC_OFF;
        site = MUSIC_OFF_SITE;
        return;
      }
      const music = word(wram, FIGHT_MUSIC);
      if (negative(music)) return;
      ctx.a = music;
      site = MUSIC_RESTORE_SITE;
    };
    if (site !== null) yield* call([site, MUSIC_MODE], true);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
