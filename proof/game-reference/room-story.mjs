// Register-level references of the room header and story stage script natives (moved
// from src/task/native-room-entry.mjs, native-room-entry-current.mjs,
// native-story-stage-get.mjs and native-story-stage-raise.mjs; lifted in
// src/game/room-story.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { ROOM, STORY_STAGE, WRAM } from '../../src/task/wram.mjs';
import { ROOM_TABLE } from '../../src/data/rooms.mjs';
import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

// 80:CCCC: return the header word of the room (first argument) from the room table.
// Entries are nine bytes: 8 * room (three ASLs) + room, by ADC without CLC, so the
// carry of the third shift is added as well.
export const getRoomHeaderReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.dp(FIRST_ARGUMENT));
      h.asl();
      h.asl();
      h.asl();
      h.arithmetic(h.dp(FIRST_ARGUMENT));
      const entry = h.index('x', h.ctx.a);
      h.result(h.load(h.longRead(ROOM_TABLE + entry)), 'leaf-table-result');
    },
    outerReturn,
  );
// 80:CCB9: return the header word of the current room from the room table.
// Entries are nine bytes: 8 * room (three ASLs) + room, by ADC without CLC, so the
// carry of the third shift is added as well. The room is read twice, fresh.
export const getCurrentRoomHeaderReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.longRead(WRAM + ROOM));
      h.asl();
      h.asl();
      h.asl();
      h.arithmetic(h.longRead(WRAM + ROOM));
      const entry = h.index('x', h.ctx.a);
      h.result(h.load(h.longRead(ROOM_TABLE + entry)), 'leaf-table-result');
    },
    outerReturn,
  );
// 80:D134: return the story stage (low byte); the flags come from the AND.
export const getStoryStageReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(WRAM + STORY_STAGE) & BYTE_MASK));
    },
    outerReturn,
  );
// 80:CCA4: raise the story stage to stage n (first argument, 1 to 16): the stage word is
// the bit 2^(n-1), formed by n ROL A from 0 after one SEC (each later ROL shifts in the
// old bit 15). The word is stored only when it is not below the current stage (CMP,
// BCC); the flags come from that CMP.
export const raiseStoryStageReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(0);
      h.ctx.status |= FLAG_CARRY;
      do {
        a.tick();
        const carry = h.ctx.status & FLAG_CARRY,
          nextCarry = Number(h.ctx.a >= WORD_SIGN);
        h.load((h.ctx.a * 2 + carry) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | nextCarry;
        h.index('x', (h.ctx.x - 1) & WORD_MASK);
      } while (h.ctx.x !== 0);
      const stage = h.ctx.a,
        current = h.longRead(WRAM + STORY_STAGE);
      h.nz((stage - current) & WORD_MASK);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(stage >= current);
      if (stage >= current) h.longWrite(WRAM + STORY_STAGE, stage);
    },
    outerReturn,
  );
