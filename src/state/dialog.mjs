import { jakeState } from './jake.mjs';
// The dialog's state by name (docs/READABLE-GAME.md, phase 1): whether the dialog has
// ended, the current record's flags, the dialog's windows and partner, the known topics,
// and the music and options the dialog reads. The game code uses these names only; where
// the values are kept is this module's business (until phase 3 the game's work memory,
// which the golden traces compare).
import { readStateByte, writeStateByte } from './objects.mjs';
import {
  DIALOG_END,
  DIALOG_RECORD_FLAGS,
  GAME_OPTIONS,
  MEMBER_PORTRAIT,
  MUSIC,
  OPTION_MUSIC,
  TOPIC_FLAGS,
  TOPIC_LIST,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// Where the dialog keeps its windows and partner while it runs (the text natives and the
// topic scripts read them too).
const TEXT_WINDOW = 0x14,
  MENU_WINDOW = 0x17,
  PARTNER = 0x26;
// The end of the topic list; a topic with a set flag is hidden.
export const TOPIC_LIST_END = BYTE_MASK;
// "None", as a word.
export const NONE = 0xffff;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

export function dialogState(mem) {
  const { wram } = mem;
  return {
    get ended() {
      return word(wram, DIALOG_END) !== 0;
    },
    // The end word: 0 runs on, any other value (FFFF from a cancel) ends the dialog.
    set endWord(value) {
      setWord(wram, DIALOG_END, value);
    },
    // The dialog whose portrait the status and spell menus show for the chosen member.
    get memberPortrait() {
      return word(wram, MEMBER_PORTRAIT);
    },
    get recordFlags() {
      return word(wram, DIALOG_RECORD_FLAGS);
    },
    set recordFlags(value) {
      setWord(wram, DIALOG_RECORD_FLAGS, value);
    },
    get textWindow() {
      return word(wram, TEXT_WINDOW);
    },
    set textWindow(window) {
      setWord(wram, TEXT_WINDOW, window);
    },
    get menuWindow() {
      return word(wram, MENU_WINDOW);
    },
    set menuWindow(window) {
      setWord(wram, MENU_WINDOW, window);
    },
    get partner() {
      return word(wram, PARTNER);
    },
    set partner(object) {
      setWord(wram, PARTNER, object);
    },
    // Jake shows his alternate portrait.
    get jakeAlternate() {
      return jakeState(mem).alternatePortrait !== 0;
    },
    get music() {
      return word(wram, MUSIC);
    },
    get musicOption() {
      return (word(wram, GAME_OPTIONS) & OPTION_MUSIC) !== 0;
    },
    // The known topics: the topic at a place of the list and its flag.
    topic: (place) => readStateByte(wram, TOPIC_LIST + place),
    setTopic: (place, topic) => writeStateByte(wram, TOPIC_LIST + place, topic),
    topicFlag: (place) => readStateByte(wram, TOPIC_FLAGS + place),
    setTopicFlag: (place, flag) => writeStateByte(wram, TOPIC_FLAGS + place, flag),
  };
}
