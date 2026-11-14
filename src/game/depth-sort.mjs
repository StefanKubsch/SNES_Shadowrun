// The depth sort of the draw list (lifted from 80:AFFC with its depth rule comparisons
// 80:B0A5 and 80:B0ED; register-level reference runDrawListSortPass in
// src/task/native-scene-sprites.mjs).
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
// object 17 and the list position 1A. The frames of the rule comparisons are
// reproduced on the stack. A, X, Y and the flags are left as the original leaves them.
import { taskStop } from '../task/plan.mjs';
import {
  DRAW_LIST,
  DRAW_LIST_INDEX,
  OBJECT_DEPTH_BIAS,
  OBJECT_DEPTH_RULE,
  OBJECT_DIAGONAL,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
  [1, { axis: OBJECT_Y, whenAhead: true }],
  [2, { axis: OBJECT_X, whenAhead: true }],
  [3, { axis: OBJECT_X, whenAhead: false }],
  [4, { axis: OBJECT_Y, whenAhead: false }],
]);
// Original call sites of the comparisons: by the first object's rule (B0A5) or the
// second's (B0ED), in the pass down and in the pass up.
const FIRST_RULE_TARGET = 0x80b0a5,
  SECOND_RULE_TARGET = 0x80b0ed,
  DOWN_CALLS = [0x80b029, 0x80b02e],
  UP_CALLS = [0x80b07b, 0x80b080];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};

// Sort the draw list (80:AFFC) on the access h of the sprite list (data bank 80, which
// reaches WRAM below 2000).
export function sortDrawList(h) {
  const { ctx } = h,
    { wram } = h.a.mem;
  const get = (base, index) => {
    if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
    return word(wram, base + index);
  };
  const last = get(DRAW_LIST_INDEX, 0);
  if (last === 0 || last & WORD_SIGN) {
    ctx.x = last;
    signAndZero(ctx, last);
    return h.rts();
  }
  // One pair at list position: swap when the first key is below the second.
  const step = (position, [firstCall, secondCall]) => {
    const first = get(DRAW_LIST, position),
      second = get(DRAW_LIST + ENTRY_BYTES, position);
    let firstKey = get(OBJECT_DIAGONAL, first),
      secondKey = get(OBJECT_DIAGONAL, second);
    setWord(wram, DP_FIRST_OBJECT, first);
    setWord(wram, DP_FIRST_KEY, firstKey);
    const secondRule = get(OBJECT_DEPTH_RULE, second);
    if (get(OBJECT_DEPTH_RULE, first) | secondRule) {
      setWord(wram, DP_SECOND_KEY, secondKey);
      setWord(wram, DP_POSITION, position);
      const bySecond = (secondRule & WORD_SIGN) !== 0,
        ruleWord = bySecond ? secondRule : get(OBJECT_DEPTH_RULE, first),
        rule = RULES.get(ruleWord & RULE_MASK);
      h.call(
        bySecond ? secondCall : firstCall,
        bySecond ? SECOND_RULE_TARGET : FIRST_RULE_TARGET,
        () => {
          if (!rule) taskStop('depth_rule_required', { rule: ruleWord });
          const ahead = get(rule.axis, first) >= get(rule.axis, second);
          if (ahead === (rule.whenAhead !== bySecond)) {
            const biased = bySecond ? second : first,
              key = bySecond ? secondKey : firstKey,
              bias = get(OBJECT_DEPTH_BIAS, biased),
              sum = (key + bias) & WORD_MASK;
            flag(ctx, FLAG_OVERFLOW, (~(key ^ bias) & (key ^ sum) & WORD_SIGN) !== 0);
            if (bySecond) secondKey = sum;
            else firstKey = sum;
            setWord(wram, bySecond ? DP_SECOND_KEY : DP_FIRST_KEY, sum);
          }
          return h.rts();
        },
      );
    }
    ctx.y = second;
    ctx.a = firstKey;
    if (firstKey < secondKey) {
      setWord(wram, DRAW_LIST + ENTRY_BYTES + position, first);
      setWord(wram, DRAW_LIST + position, second);
      ctx.a = second;
    }
  };
  // Down from the last pair; the first step runs even when the position is negative.
  let position = (last - ENTRY_BYTES) & WORD_MASK;
  do {
    step(position, DOWN_CALLS);
    position = (position - ENTRY_BYTES) & WORD_MASK;
  } while (!(position & WORD_SIGN));
  ctx.x = position;
  if (last === TWO_OBJECTS) {
    // CMP #2 equal.
    ctx.a = last;
    flag(ctx, FLAG_NEGATIVE, false);
    flag(ctx, FLAG_ZERO, true);
    flag(ctx, FLAG_CARRY, true);
    return h.rts();
  }
  position = ENTRY_BYTES;
  do {
    step(position, UP_CALLS);
    position = (position + ENTRY_BYTES) & WORD_MASK;
  } while (position < last);
  // CPX with the last position: the carry set, sign and zero of the difference.
  ctx.x = position;
  signAndZero(ctx, (position - last) & WORD_MASK);
  flag(ctx, FLAG_CARRY, true);
  return h.rts();
}
