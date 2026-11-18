// The zones around the player figure (lifted from 80:8000 with its zone check
// 80:803B; register-level reference in proof/replay/main-zone-gate.mjs).
//
// Each pass, the player figure's position (x, y and height, each divided by 4) is
// tested against the room's two zone lists, which the long pointer in the direct page
// word 9D points at. Each list starts with a count byte; each zone has six limit words
// (lowest x, y and height, then highest x, y and height, all inclusive) and a data
// word. A zone of the first list that holds the figure appends a script task (80:C34A,
// with the data word as its script) and the search goes on; a zone of the second list
// changes the scene (80:A4BF, with the data word) and the main loop starts its next
// pass at once (the carry set in the original, a returned flag here). Without a player figure nothing is tested.
//
// The scene change composes the live room entry through its frame below the zone
// check's frame (its NMI writes below them); the task append (lifted in
// src/game/task-append.mjs) runs below the pushed list offset and its return word. The direct page
// words 0E, 11 and 14 (the position), 17 (the list) and 1A (the zones left) are written
// as the original writes them.
//
// Registers (user decision 2026-11-17): game state only; the scene change and the task
// append take the data word as a parameter, and the routine leaves no A, X, Y or flags.
// playerZonesRoutineSequence is the register form for register-level callers: the
// carry set after a scene change.
import { taskStop } from '../system/task-stop.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { enterRoomCallSequence } from './room-entry.mjs';
import { appendScriptCall } from '../script/task-api.mjs';
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
} from '../data/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

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

// Test the zones around the player figure (80:8000), a sequence for a native call
// continuation: h the main loop's access (direct page 0, data bank 80), events its live
// frame events. Both task creation and room entry compose directly. zones.changed
// tells whether a zone changed the scene (the carry in the original).
export function* playerZonesSequence(h, events, zones = {}) {
  const { a } = h,
    { mem } = a,
    { wram } = mem;
  zones.changed = false;
  // The zone lists through the long pointer, read as the original's [9D],Y.
  const list = (offset) => {
    const at = (word(wram, DP_ZONE_LIST) | (wram[DP_ZONE_LIST + 2] << WORD_BITS)) + offset;
    return mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
  };
  const slot = word(wram, PLAYER_OBJECT);
  if (slot & WORD_SIGN) return yield* rts(h);
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
    if (!count) continue;
    setWord(wram, DP_ZONE_COUNT, count);
    yield () => a.pushWord(CHECK_RETURN);
    for (;;) {
      const left = (word(wram, DP_ZONE_COUNT) - 1) & WORD_MASK;
      setWord(wram, DP_ZONE_COUNT, left);
      if (left & WORD_SIGN) break;
      // The first failing limit skips the rest of the zone.
      const failed = LIMITS.find((n) => {
        const limit = list((offset + 2 * n) & WORD_MASK),
          value = position[n % AXES];
        return n < AXES ? value < limit : limit < value;
      });
      if (failed !== undefined) {
        offset = (offset + ZONE_BYTES) & WORD_MASK;
        continue;
      }
      const data = list((offset + ZONE_DATA) & WORD_MASK);
      offset = (offset + ZONE_DATA) & WORD_MASK;
      if (index) {
        // A zone of the second list: the scene change, then the next pass.
        yield* dialogCallBody(h, SCENE_CHANGE_CALL, SCENE_CHANGE, () =>
          enterRoomCallSequence(h, events, data),
        );
        yield () => {
          a.pullWord();
          zones.changed = true;
        };
        return yield* rts(h);
      }
      // A zone of the first list: append its script task, then go on.
      offset = (offset + 2) & WORD_MASK;
      yield () => {
        a.pushWord(offset);
        a.pushWord(APPEND_RETURN);
        const append = appendScriptCall(a, data);
        if (append.rawReturnWord !== APPEND_RETURN)
          taskStop('task_native_helper_return_required', {
            actual: append.rawReturnWord,
            expected: APPEND_RETURN,
          });
        offset = a.pullWord();
      };
    }
    yield () => a.pullWord();
  }
  // Both lists tested.
  yield () => setWord(wram, DP_ZONE_LIST_INDEX, LISTS);
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// The register form for register-level callers: the carry set after a scene change.
export function* playerZonesRoutineSequence(h, events) {
  const zones = {},
    result = yield* playerZonesSequence(h, events, zones);
  h.ctx.status = zones.changed ? h.ctx.status | FLAG_CARRY : h.ctx.status & ~FLAG_CARRY;
  return result;
}
