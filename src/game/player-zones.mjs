// The zones around the player figure (lifted from 80:8000 with its zone check
// 80:803B; register-level reference in src/task/main-zone-gate.mjs).
//
// Each pass, the player figure's position (x, y and height, each divided by 4) is
// tested against the room's two zone lists, which the long pointer in the direct page
// word 9D points at. Each list starts with a count byte; each zone has six limit words
// (lowest x, y and height, then highest x, y and height, all inclusive) and a data
// word. A zone of the first list that holds the figure appends a script task (80:C34A,
// with the data word as its script) and the search goes on; a zone of the second list
// changes the scene (80:A4BF, with the data word) and the main loop starts its next
// pass at once (the carry set). Without a player figure nothing is tested.
//
// The scene change is still register-level and runs through its frame below the zone
// check's frame (its NMI writes below them); the task append (lifted in
// src/game/task-append.mjs) runs below the pushed list offset and its return word. The direct page
// words 0E, 11 and 14 (the position), 17 (the list) and 1A (the zones left) are written
// as the original writes them. A, X, Y and the flags are left as the original leaves
// them: the next callees and the waits of the next pass start with them.
import { taskStop } from '../task/plan.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import {
  DP_ZONE_COUNT,
  DP_ZONE_HEIGHT,
  DP_ZONE_LIST,
  DP_ZONE_LIST_INDEX,
  DP_ZONE_X,
  DP_ZONE_Y,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const POSITION_SHIFT = 2,
  ZONE_BYTES = 14,
  // A zone's data word follows its six limit words.
  ZONE_DATA = 12,
  // Three axes (x, y, height), each with a lowest and a highest limit.
  AXES = 3,
  LIMIT_WORDS = 2 * AXES,
  LISTS = 2,
  LOW_WRAM_END = 0x2000;
// The zone check's frame (JSR 803B at 80:8029), the task append's return word (JSR
// C34A at 80:80A5) and the scene change's call site.
const CHECK_RETURN = 0x802b,
  APPEND_RETURN = 0x80a7,
  SCENE_CHANGE_CALL = 0x8080ad,
  SCENE_CHANGE = 0x80a4bf;

// The limit words in their order: lowest x, y and height, then highest.
const LIMITS = Array.from({ length: LIMIT_WORDS }, (_, n) => n);

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// The flags a callee starts with: the carry of the last limit comparison that held,
// sign and zero of the word loaded last (the data word, or the list offset after INY).
function enterCall(ctx, loaded) {
  flag(ctx, FLAG_CARRY, true);
  flag(ctx, FLAG_NEGATIVE, loaded & WORD_SIGN);
  flag(ctx, FLAG_ZERO, loaded === 0);
}

// Test the zones around the player figure (80:8000), a sequence for a native call
// continuation: h the main loop's access (direct page 0, data bank 80), events its frame
// events, routines { c34a, a4bf } the task append and the register-level scene change.
export function* playerZonesSequence(h, events, routines) {
  const { ctx, a } = h,
    { mem } = a,
    { wram } = mem;
  // The zone lists through the long pointer, read as the original's [9D],Y.
  const list = (offset) => {
    const at = (word(wram, DP_ZONE_LIST) | (wram[DP_ZONE_LIST + 2] << WORD_BITS)) + offset;
    return mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
  };
  let result;
  const slot = word(wram, PLAYER_OBJECT);
  if (slot & WORD_SIGN) {
    yield () => {
      ctx.y = slot;
      flag(ctx, FLAG_NEGATIVE, true);
      flag(ctx, FLAG_ZERO, false);
      flag(ctx, FLAG_CARRY, false);
      result = h.rts();
    };
    return result;
  }
  let position;
  yield () => {
    if (OBJECT_HEIGHT + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
    position = [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT].map(
      (field) => word(wram, field + slot) >>> POSITION_SHIFT,
    );
    [DP_ZONE_X, DP_ZONE_Y, DP_ZONE_HEIGHT].forEach((dp, n) => setWord(wram, dp, position[n]));
    setWord(wram, DP_ZONE_LIST_INDEX, 0);
  };
  let offset = 0;
  for (let index = 0; index < LISTS; index++) {
    setWord(wram, DP_ZONE_LIST_INDEX, index);
    const count = list(offset) & BYTE_MASK;
    offset = (offset + 1) & WORD_MASK;
    ctx.a = count;
    if (count) {
      setWord(wram, DP_ZONE_COUNT, count);
      yield () => a.pushWord(CHECK_RETURN);
      for (;;) {
        const left = (word(wram, DP_ZONE_COUNT) - 1) & WORD_MASK;
        setWord(wram, DP_ZONE_COUNT, left);
        if (left & WORD_SIGN) break;
        // The first failing limit skips the rest of the zone (the original adds the
        // remaining bytes with a clear carry, which sets the overflow).
        const failed = LIMITS.find((n) => {
          const limit = list((offset + 2 * n) & WORD_MASK),
            value = position[n % AXES];
          return n < AXES ? value < limit : limit < value;
        });
        if (failed !== undefined) {
          const at = (offset + 2 * failed) & WORD_MASK,
            rest = ZONE_BYTES - 2 * failed,
            next = (at + rest) & WORD_MASK;
          flag(ctx, FLAG_OVERFLOW, (~(at ^ rest) & (at ^ next) & WORD_SIGN) !== 0);
          offset = next;
          continue;
        }
        const data = list((offset + ZONE_DATA) & WORD_MASK);
        offset = (offset + ZONE_DATA) & WORD_MASK;
        if (index) {
          // A zone of the second list: the scene change, then the next pass.
          ctx.y = offset;
          ctx.a = data;
          enterCall(ctx, data);
          yield* nativeCallSequence(
            h,
            events,
            new Map([[SCENE_CHANGE, routines.a4bf]]),
            SCENE_CHANGE_CALL,
            SCENE_CHANGE,
            false,
            false,
          );
          yield () => {
            a.pullWord();
            flag(ctx, FLAG_CARRY, true);
            result = h.rts();
          };
          return result;
        }
        // A zone of the first list: append its script task, then go on.
        offset = (offset + 2) & WORD_MASK;
        yield () => {
          ctx.a = data;
          ctx.x = data;
          ctx.y = offset;
          enterCall(ctx, offset);
          a.pushWord(offset);
          a.pushWord(APPEND_RETURN);
          const append = routines.c34a(a);
          if (append.rawReturnWord !== APPEND_RETURN)
            taskStop('task_native_helper_return_required', {
              actual: append.rawReturnWord,
              expected: APPEND_RETURN,
            });
          ctx.y = a.pullWord();
        };
      }
      yield () => a.pullWord();
    }
  }
  // Both lists tested: the list counter (2) was compared with 1, the carry cleared.
  yield () => {
    setWord(wram, DP_ZONE_LIST_INDEX, LISTS);
    ctx.a = LISTS;
    ctx.y = offset;
    flag(ctx, FLAG_NEGATIVE, false);
    flag(ctx, FLAG_ZERO, false);
    flag(ctx, FLAG_CARRY, false);
    result = h.rts();
  };
  return result;
}
