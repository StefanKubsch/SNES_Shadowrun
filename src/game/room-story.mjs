// The room headers and the story stage that scripts read and raise (lifted from the
// script natives 80:CCCC, 80:CCB9, 80:D134 and 80:CCA4; register-level references in
// proof/game-reference/room-story.mjs).
//
// The room table 8D:929D (src/data/rooms.mjs) holds nine bytes per room, its header word
// first. The original forms the entry offset 9 * room as 8 * room (three doublings) plus
// the room with an ADC whose carry is the bit the third doubling shifted out (bit 13 of
// the room), all in 16 bits; for the game's rooms that carry is zero. The current room
// lies at 7E:2DE2.
//
// The story stage word 7E:2DE4 holds the bit of the stage reached: stage n (1 to 16) is
// bit n - 1. The original forms it by n rotations through the carry (a 17-bit rotation)
// of 0 with the carry set; a stage of 0 rotates 65536 times. A stage below the current
// word is not stored.
import { ROOM, STORY_STAGE, WRAM } from '../task/wram.mjs';
import { ROOM_TABLE } from '../data/rooms.mjs';
import { BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const ROOM_SHIFT = 3,
  // The bit of the room the third doubling shifts into the carry.
  ROOM_CARRY_BIT = WORD_BITS - ROOM_SHIFT,
  // The 17 bits of the rotation through the carry; the X loop runs 65536 times for 0.
  ROTATION_BITS = WORD_BITS + 1,
  LOOP_WRAP = 0x10000;

const longWord = (mem, address) => mem.read16(address & LONG_MASK);

// The room table offset of room as the original forms it.
const roomEntry = (room) =>
  (((room << ROOM_SHIFT) & WORD_MASK) + room + ((room >>> ROOM_CARRY_BIT) & 1)) & WORD_MASK;

// 80:CCCC: the header word of the room.
export const roomHeader = (mem, room) => longWord(mem, ROOM_TABLE + roomEntry(room));
// 80:CCB9: the header word of the current room.
export const currentRoomHeader = (mem) => roomHeader(mem, mem.read16(WRAM + ROOM));
// 80:D134: the story stage (low byte).
export const storyStage = (mem) => mem.read16(WRAM + STORY_STAGE) & BYTE_MASK;

// The stage word of stage n: the carry bit 16 rotated left n times within 17 bits.
function stageWord(stage) {
  const turns = (stage === 0 ? LOOP_WRAP : stage) % ROTATION_BITS,
    bit = (WORD_BITS + turns) % ROTATION_BITS;
  return (1 << bit) & WORD_MASK;
}
// 80:CCA4: raise the story stage to stage n unless it is past it.
export function raiseStoryStage(mem, stage) {
  const word = stageWord(stage);
  if (word >= mem.read16(WRAM + STORY_STAGE)) mem.write16(WRAM + STORY_STAGE, word);
}
