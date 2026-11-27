// Random per-function tests of the lifted room header and story stage natives
// (src/game/room-story.mjs through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their
// former register-level references (proof/game-reference/room-story.mjs): 80:CCCC (a room's
// header), 80:CCB9 (the current room's), 80:D134 (the stage) and 80:CCA4 (its raise).
// Both sides run the native from its script call (data bank 80, direct page 0, the RTS
// frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the
// device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { getRoomHeader as getRoomHeaderLifted } from '../src/script/native-room-entry.mjs';
import { getCurrentRoomHeader as getCurrentRoomHeaderLifted } from '../src/script/native-room-entry-current.mjs';
import { getStoryStage as getStoryStageLifted } from '../src/script/native-story-stage-get.mjs';
import { raiseStoryStage as raiseStoryStageLifted } from '../src/script/native-story-stage-raise.mjs';
import { ROOM, STORY_STAGE } from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const getRoomHeader = leafRts(getRoomHeaderLifted);
const getCurrentRoomHeader = leafRts(getCurrentRoomHeaderLifted);
const getStoryStage = leafRts(getStoryStageLifted);
const raiseStoryStage = leafRts(raiseStoryStageLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Rooms of the game's range, stages 0 to 20.
  ROOMS = 0x200,
  STAGES = 21;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // The argument: a room, a stage or any word (bit 13 set: the ADC's carry).
  setWord(wram, 0, [rnd(ROOMS), rnd(STAGES), rnd(WORD)][rnd(3)]);
  setWord(wram, ROOM, [rnd(ROOMS), rnd(WORD)][rnd(2)]);
  // The current stage: a single bit or any word.
  setWord(wram, STORY_STAGE, [1 << rnd(16), 0, rnd(WORD)][rnd(3)]);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const native = (name, entry, run) => ({
  name,
  entry,
  samples: 400,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    native('getRoomHeader 80:CCCC', 0x80cccc, getRoomHeader),
    native('getCurrentRoomHeader 80:CCB9', 0x80ccb9, getCurrentRoomHeader),
    native('getStoryStage 80:D134', 0x80d134, getStoryStage),
    native('raiseStoryStage 80:CCA4', 0x80cca4, raiseStoryStage),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
