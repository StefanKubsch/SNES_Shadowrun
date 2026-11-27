import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The depth sort of the draw list (lifted from 80:AFFC with its depth rule comparisons
// 80:B0A5 and 80:B0ED; register-level reference runDrawListSortPass in
// proof/replay/native-scene-sprites.mjs).
//
// Each pass the draw list 7E:14B2 (last position in 7E:14B0) gets one bubble pass from
// its end down to the first pair and, with more than two objects, one back up. A pair
// swaps when the first object's key is below the second's, so the list ends with the
// objects nearest the viewer drawn first. The key is the diagonal (x + y) / 2. When
// either object has a depth rule (7E:0F88), the key of one of them grows by its depth
// bias (7E:0FE0) depending on how the two lie on one axis: the second object's rule
// decides when its sign is set, else the first object's. With the first object's rule,
// rules 1 and 2 bias the first object when it lies at or past the second in y (rule 1)
// or x (rule 2), rules 3 and 4 when it lies before it in x (rule 3) or y (rule 4); with
// the second object's rule, the second object gets the bias in the opposite cases.
// Only the low 15 bits of a rule count; another rule than 1 to 4 has no comparison in
// the original's jump tables and stops at `depth_rule_required`.
//
// The direct page words of the original are written: the keys 11 and 14, the first
// object 17 and the list position 1A. The rule comparisons run without their JSR
// frames, whose return words lie only in free stack bytes. Registers (user decision
// 2026-11-17): game state only; no A, X, Y or flags are left (the sprite list sets its
// own before reading them).
import { taskStop } from '../system/task-stop.mjs';
import { DRAW_LIST, DRAW_LIST_INDEX } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { lowObjectWord } from '../state/objects.mjs';

const LOW_WRAM_END = 0x2000,
  ENTRY_BYTES = 2,
  RULE_MASK = 0x7fff,
  // The pass back up runs only for more than two objects (last position not 2).
  TWO_OBJECTS = 2;
// Direct page locals of the original.
const DP_FIRST_KEY = 0x11,
  DP_SECOND_KEY = 0x14,
  DP_FIRST_OBJECT = 0x17,
  DP_POSITION = 0x1a;
// The rules 1 to 4: the axis compared, and whether the first object's rule biases the
// first object when it lies at or past the second (else before it).
const RULES = new Map([
  [1, { axis: 'y', whenAhead: true }],
  [2, { axis: 'x', whenAhead: true }],
  [3, { axis: 'x', whenAhead: false }],
  [4, { axis: 'y', whenAhead: false }],
]);

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Sort the draw list (80:AFFC) on the access h of the sprite list (data bank 80, which
// reaches WRAM below 2000), without the JSR frame (its return word lies only in free
// stack bytes).
export function sortDrawListInPlace(h) {
  const { wram } = h.a.mem;
  const get = (base, index) => {
    if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
    return word(wram, base + index);
  };
  const object = (name, slot) => lowObjectWord(wram, name, slot);
  const last = get(DRAW_LIST_INDEX, 0);
  if (last === 0 || last & WORD_SIGN) return;
  // One pair at list position: swap when the first key is below the second.
  const step = (position) => {
    const first = get(DRAW_LIST, position),
      second = get(DRAW_LIST + ENTRY_BYTES, position);
    let firstKey = object('diagonal', first),
      secondKey = object('diagonal', second);
    setWord(wram, DP_FIRST_OBJECT, first);
    setWord(wram, DP_FIRST_KEY, firstKey);
    const secondRule = object('depthRule', second);
    if (object('depthRule', first) | secondRule) {
      setWord(wram, DP_SECOND_KEY, secondKey);
      setWord(wram, DP_POSITION, position);
      const bySecond = (secondRule & WORD_SIGN) !== 0,
        ruleWord = bySecond ? secondRule : object('depthRule', first),
        rule = RULES.get(ruleWord & RULE_MASK);
      // The comparison 80:B0A5 or 80:B0ED, without its JSR frame.
      if (!rule) taskStop('depth_rule_required', { rule: ruleWord });
      const ahead = object(rule.axis, first) >= object(rule.axis, second);
      if (ahead === (rule.whenAhead !== bySecond)) {
        const biased = bySecond ? second : first,
          key = bySecond ? secondKey : firstKey,
          bias = object('depthBias', biased),
          sum = (key + bias) & WORD_MASK;
        if (bySecond) secondKey = sum;
        else firstKey = sum;
        setWord(wram, bySecond ? DP_SECOND_KEY : DP_FIRST_KEY, sum);
      }
    }
    if (firstKey < secondKey) {
      setWord(wram, DRAW_LIST + ENTRY_BYTES + position, first);
      setWord(wram, DRAW_LIST + position, second);
    }
  };
  // Down from the last pair; the first step runs even when the position is negative.
  let position = (last - ENTRY_BYTES) & WORD_MASK;
  do {
    step(position);
    position = (position - ENTRY_BYTES) & WORD_MASK;
  } while (!(position & WORD_SIGN));
  if (last === TWO_OBJECTS) return;
  position = ENTRY_BYTES;
  do {
    step(position);
    position = (position + ENTRY_BYTES) & WORD_MASK;
  } while (position < last);
}
// The RTS form for register-level callers is sortDrawListJsr in
// tools/register-forms/jsr-forms.mjs.
