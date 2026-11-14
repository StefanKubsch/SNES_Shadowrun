// The group and the room's actors (lifted from 80:A2FA and 80:A3B6; register-level
// reference in src/task/main-transition.mjs, which proof/game-reference/room-entry.mjs
// calls).
//
// The room entry creates an object for each group member at the start position, then
// one for each actor of the room header that the story stage and its state record
// allow. The object creation 80:A835 is lifted in object-create.mjs, the turn 80:AAAF
// in object-turn.mjs. Both take their arguments in the direct page words 00 to 08;
// the creation returns the new slot in word 00, which is read back after each call,
// as in the original (the turn's selection path writes word 00 too). Both run below the words the original pushes around the calls; the
// caller pushes the return word of its JSR. The direct page words the original uses
// as locals (the member index 26; the actor flags 20, record 23 and the actors left
// 29) are written as in the original: the Mesen oracle compares them.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { taskStop } from '../task/plan.mjs';
import { createObjectCall } from './object-create.mjs';
import { turnObjectCall } from './object-turn.mjs';
import {
  DIALOG_WINDOW,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_SLOTS,
  JAKE_DERMAL_ARMOUR,
  OBJECT_ARMOUR,
  OBJECT_CLASS_MASK,
  OBJECT_DEPTH_ORDER,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RUNNER_ARMOUR_RATING,
  STORY_STAGE,
} from '../task/wram.mjs';
import {
  ACTOR_DEPTH_FLAGS,
  ACTOR_KIND,
  ACTOR_RECORD,
  ACTOR_SCRIPT,
  ACTOR_TABLE,
  STATE_HOLDER,
} from '../data/actors.mjs';
import { ROOM_HEADER_ACTOR_COUNT } from '../data/rooms.mjs';
import { RUNNER_LAST_INDEX, RUNNER_OBJECT_NUMBERS } from '../data/runners.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const NONE = WORD_MASK,
  LONG_MASK = 0xffffff,
  // The data bank of the room entry, in which the runner table is read.
  DATA_BANK = 0x80,
  // Even values of a 16-bit index.
  INDEX_WORDS = 0x8000;
// The room header pointer, the room lists after the actors (80:A3B6 leaves their
// start there), the start direction and position, and the direction argument of the
// turn 80:AAAF.
const DP_ROOM_HEADER = 0x86,
  DP_ROOM_LISTS = 0x9a,
  DP_START_DIRECTION = 0x11,
  DP_START_X = 0x14,
  DP_START_Y = 0x17,
  DP_START_Z = 0x1a,
  DP_DIRECTION = 2,
  DP_MEMBER = 0x26,
  DP_ACTOR_FLAGS = 0x20,
  DP_ACTOR_RECORD = 0x23,
  DP_ACTORS_LEFT = 0x29;
// Kind of Jake's figure: it becomes the player figure; his dermal armour adds 2.
const JAKE_KIND = 0x0b,
  DERMAL_ARMOUR_BONUS = 2;
// An actor of the header: x and y words with the coordinate in bits 0-10 and five
// flag bits above (together the height argument of 80:A835), and the actor offset.
const ACTOR_COORDINATE_MASK = 0x7ff,
  ACTOR_BITS_SHIFT = 11,
  ACTOR_Y_BITS_SHIFT = 5,
  HEADER_ACTOR_Y = 2,
  HEADER_ACTOR_OFFSET = 4,
  HEADER_ACTOR_BYTES = 6;
// Actor flags bits 6 and 7 become bits 15 and 0 of the depth order.
const DEPTH_FRONT_SHIFT = 9,
  DEPTH_BACK_SHIFT = 7;
// The runner armour is read at four times the runner's word index.
const ARMOUR_INDEX_SHIFT = 2;
// The end of the WRAM mirror that the original's data bank 80 reads.
const LOW_WRAM_END = 0x2000;
// Call sites and the return words of the JSRs from the room entry.
const GROUP_CREATE_SITE = 0x80a32d,
  GROUP_TURN_SITE = 0x80a340,
  ACTOR_CREATE_SITE = 0x80a423;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const depthOrder = (flags) =>
  (((flags & ACTOR_DEPTH_FLAGS) << DEPTH_FRONT_SHIFT) & WORD_MASK) |
  ((flags >>> DEPTH_BACK_SHIFT) & 1);

// The word index of the runner with this object number, searched from the last row
// down. When none matches (the game's group holds runners only) the search goes on
// as the original's 16-bit index wraps: below the table, then from 81:96FE down;
// it stops at a frontier when every index was read.
function runnerIndex(mem, number) {
  for (let n = 0, x = RUNNER_LAST_INDEX; n < INDEX_WORDS; n++, x = (x - 2) & WORD_MASK)
    if (readWord(mem, (DATA_BANK << WORD_BITS) + RUNNER_OBJECT_NUMBERS + x) === number) return x;
  return taskStop('group_runner_required', { number });
}

// Create the group members at the start position (80:A2FA), a sequence. The player
// figure and the dialog window are reset first; the last member comes first.
export function* createGroupSequence(h) {
  const { a } = h,
    { mem, wram } = sceneRuntime(h);
  yield () => {
    setWord(wram, PLAYER_OBJECT, NONE);
    setWord(wram, DIALOG_WINDOW, NONE);
  };
  for (
    let member = word(wram, GROUP_INDEX);
    !(member & WORD_SIGN);
    member = (member - 2) & WORD_MASK
  ) {
    const kind = word(wram, GROUP_OBJECTS + member);
    yield () => {
      setWord(wram, DP_MEMBER, member);
      setWord(wram, DP_OBJECT_X, word(wram, DP_START_X));
      setWord(wram, DP_OBJECT_Y, word(wram, DP_START_Y));
      setWord(wram, DP_OBJECT_HEIGHT, word(wram, DP_START_Z));
      setWord(wram, DP_OBJECT_KIND, kind);
      a.pushWord(kind);
      const number = word(wram, GROUP_NUMBERS + member);
      setWord(wram, DP_OBJECT_SCRIPT, readWord(mem, ACTOR_TABLE + ACTOR_SCRIPT + number));
    };
    yield () => createObjectCall(h, GROUP_CREATE_SITE);
    yield () => {
      if (kind === JAKE_KIND) setWord(wram, PLAYER_OBJECT, word(wram, DP_OBJECT_KIND));
      setWord(wram, DP_DIRECTION, word(wram, DP_START_DIRECTION));
    };
    yield () => turnObjectCall(h, GROUP_TURN_SITE);
    yield () => {
      const slot = word(wram, DP_OBJECT_KIND),
        number = word(wram, GROUP_NUMBERS + member);
      // Only a failed creation (no free slot) and a turn through the selection path
      // leave a slot past the object tables, which the original reaches through its
      // data bank 80 (in ROM above 2000).
      if (OBJECT_NUMBER + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
      setWord(wram, OBJECT_NUMBER + slot, number);
      setWord(wram, OBJECT_DEPTH_ORDER + slot, depthOrder(mem.read8(ACTOR_TABLE + number)));
      setWord(wram, OBJECT_RECORD + slot, readWord(mem, ACTOR_TABLE + ACTOR_RECORD + number));
      const index = runnerIndex(mem, number),
        armour = wram[RUNNER_ARMOUR_RATING + (index << ARMOUR_INDEX_SHIFT)];
      setWord(wram, OBJECT_ARMOUR + slot, armour);
      a.pullWord();
      if (kind !== JAKE_KIND)
        setWord(wram, OBJECT_FLAGS + slot, word(wram, OBJECT_FLAGS + slot) | OBJECT_CLASS_MASK);
      else if (wram[JAKE_DERMAL_ARMOUR])
        setWord(wram, OBJECT_ARMOUR + slot, armour + DERMAL_ARMOUR_BONUS);
      setWord(wram, GROUP_SLOTS + member, slot);
    };
  }
}

// Create the room's actors (80:A3B6), a sequence: each actor whose flags or the story
// stage are not zero and whose state record (if any) has no holder. Leaves the start
// of the room lists behind the actors in direct page word 9A.
export function* placeRoomActorsSequence(h) {
  const { a } = h,
    { mem, wram } = sceneRuntime(h),
    header = (wram[DP_ROOM_HEADER + 2] << WORD_BITS) | word(wram, DP_ROOM_HEADER),
    count = mem.read8((header + ROOM_HEADER_ACTOR_COUNT) & LONG_MASK);
  let offset = ROOM_HEADER_ACTOR_COUNT + 1;
  if (count) yield () => setWord(wram, DP_ACTORS_LEFT, count);
  for (let left = count; left > 0; left--) {
    const x = readWord(mem, header + offset),
      y = readWord(mem, header + offset + HEADER_ACTOR_Y),
      actor = readWord(mem, header + offset + HEADER_ACTOR_OFFSET);
    offset += HEADER_ACTOR_BYTES;
    const flags = mem.read8((ACTOR_TABLE + actor) & LONG_MASK),
      record = readWord(mem, ACTOR_TABLE + ACTOR_RECORD + actor),
      shown = (flags | word(wram, STORY_STAGE)) !== 0;
    let create = shown;
    yield () => {
      setWord(wram, DP_OBJECT_X, x & ACTOR_COORDINATE_MASK);
      setWord(wram, DP_OBJECT_Y, y & ACTOR_COORDINATE_MASK);
      setWord(
        wram,
        DP_OBJECT_HEIGHT,
        (x >>> ACTOR_BITS_SHIFT) | ((y >>> ACTOR_BITS_SHIFT) << ACTOR_Y_BITS_SHIFT),
      );
      setWord(wram, DP_ACTOR_FLAGS, flags);
      if (shown) setWord(wram, DP_ACTOR_RECORD, record);
      if (shown && record) {
        // The original keeps the actor on the stack (PHX) while it reads the holder.
        a.pushWord(actor);
        create = word(wram, record + STATE_HOLDER) === NONE;
        a.pullWord();
      }
    };
    if (create) {
      yield () => {
        setWord(wram, DP_OBJECT_KIND, readWord(mem, ACTOR_TABLE + ACTOR_KIND + actor));
        setWord(wram, DP_OBJECT_SCRIPT, readWord(mem, ACTOR_TABLE + ACTOR_SCRIPT + actor));
        // The original keeps the header offset and the actor on the stack (PHY, PHX).
        a.pushWord(offset);
        a.pushWord(actor);
      };
      yield () => createObjectCall(h, ACTOR_CREATE_SITE);
      yield () => {
        const slot = word(wram, DP_OBJECT_KIND);
        a.pullWord();
        a.pullWord();
        setWord(wram, OBJECT_NUMBER + slot, actor);
        setWord(wram, OBJECT_DEPTH_ORDER + slot, depthOrder(word(wram, DP_ACTOR_FLAGS)));
        setWord(wram, OBJECT_RECORD + slot, word(wram, DP_ACTOR_RECORD));
      };
    }
    yield () => setWord(wram, DP_ACTORS_LEFT, left - 1);
  }
  yield () => setWord(wram, DP_ROOM_LISTS, offset + word(wram, DP_ROOM_HEADER));
}
