import { readStateByte, writeStateByte } from '../state/objects.mjs';
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
// The scene change composes the live room entry directly; the task append is the
// lifted one of src/game/task-append.mjs. The original's zone check frame (JSR 803B),
// the list offset it pushes around the append and the append's and the scene change's
// return words lie only in free stack bytes and are not reproduced (game state only,
// user decision 2026-11-17). The direct page words 0E, 11 and 14 (the position), 17
// (the list) and 1A (the zones left) are written as the original writes them.
//
// Registers (user decision 2026-11-17): game state only; the scene change and the task
// append take the data word as a parameter, and the routine leaves no A, X, Y or flags.
// The register form for register-level callers (the carry set after a scene change) is
// in proof/caller/live-loop-routines.mjs.
import { enterRoomSequence } from './room-entry.mjs';
import { appendScript } from '../script/task-api.mjs';
import {
  DP_ZONE_COUNT,
  DP_ZONE_HEIGHT,
  DP_ZONE_LIST,
  DP_ZONE_LIST_INDEX,
  DP_ZONE_X,
  DP_ZONE_Y,
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
import { lowObjectWord } from '../state/objects.mjs';

const POSITION_SHIFT = 2,
  ZONE_BYTES = 14,
  // A zone's data word follows its six limit words.
  ZONE_DATA = 12,
  // Three axes (x, y, height), each with a lowest and a highest limit.
  AXES = 3,
  LIMIT_WORDS = 2 * AXES,
  LISTS = 2;

// The limit words in their order: lowest x, y and height, then highest.
const LIMITS = Array.from({ length: LIMIT_WORDS }, (_, n) => n);

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Test the zones around the player figure (80:8000), a sequence for a native call
// continuation: h the main loop's access (direct page 0, data bank 80), events its live
// frame events. Both task creation and room entry compose directly. zones.changed
// tells whether a zone changed the scene (the carry in the original). The main loop
// runs it without its JSR frame; the RTS form is playerZonesJsr in
// proof/caller/jsr-forms.mjs.
export function* playerZonesSequence(h, events, zones = {}) {
  const { a } = h,
    { mem } = a,
    { wram } = mem;
  zones.changed = false;
  // The zone lists through the long pointer, read as the original's [9D],Y.
  const list = (offset) => {
    const at =
      (word(wram, DP_ZONE_LIST) | (readStateByte(wram, DP_ZONE_LIST + 2) << WORD_BITS)) + offset;
    return mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
  };
  const slot = word(wram, PLAYER_OBJECT);
  if (slot & WORD_SIGN) return;
  let position;
  yield () => {
    lowObjectWord(wram, 'height', slot);
    position = ['x', 'y', 'height'].map(
      (field) => lowObjectWord(wram, field, slot) >>> POSITION_SHIFT,
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
        yield* enterRoomSequence(h, events, data);
        zones.changed = true;
        return;
      }
      // A zone of the first list: append its script task, then go on.
      offset = (offset + 2) & WORD_MASK;
      yield () => appendScript(a, data);
    }
  }
  // Both lists tested.
  yield () => setWord(wram, DP_ZONE_LIST_INDEX, LISTS);
}
