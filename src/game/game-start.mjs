import { jakeState } from '../state/jake.mjs';
import { runnerContent } from '../content/runners.mjs';
import { runnerState } from '../state/runners.mjs';
import { partyState } from '../state/party.mjs';
import { fillStateBytes } from '../state/objects.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The start of a game (lifted from 80:9688, 80:9699, 80:960D, 80:98E9 and 81:B198;
// register-level reference in proof/game-reference/game-start.mjs). The room start
// calls the lifted game screen set-up (src/game/game-screen.mjs), room entry
// (src/game/room-entry.mjs) and fixed colour reset (src/game/fixed-colour.mjs)
// directly.
//
// After the start menu the outer owner (src/frontend/game-owner.mjs) enters the main
// start 80:9688 with the menu's choice in direct page word 0: a new game (FFFF)
// or a save slot. The start sets up the new game's state or loads the slot from
// SRAM, then the room start 80:9699 builds the game screen and enters the room.
// The start ends before the first call of the main loop (80:96AB). The attract game
// enters the room start directly with room AB (proof/replay/main-frontend.mjs).
import { tasksOf } from '../script/task-api.mjs';
import { unpackStream } from '../system/unpack.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { unlockBulletproofVest } from './bugfixes.mjs';
import { setUpGameScreen } from './game-screen.mjs';
import { resetFixedColour } from './fixed-colour.mjs';
import { enterRoomSequence } from './room-entry.mjs';
import { fourSaveSlots } from './bugfixes.mjs';
import { readSaveSlot } from '../storage/srm.mjs';
import { savedGameState } from '../state/saved-game.mjs';
import { TEXT_NONE } from '../data/native-member-spell-menu.mjs';
import {
  KARMA,
  MAIN_LOOP_EXIT,
  MAIN_LOOP_RELOAD,
  NUYEN,
  ROOM,
  SCRIPT_VARIABLES,
  SELECTED_SPELL_NAME,
  SELECTED_SPELL_SCRIPT,
  SPELL_LIST,
  STORY_STAGE,
  TOPIC_LIST,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The main start and the room start.
export const GAME_START = 0x9688,
  ROOM_START = 0x9699;
// The choice the outer owner leaves in direct page word 0.
const CHOICE = 0;
// A new game: the packed new-game state 8B:FBD2 (into 7E:2E00, inside the save
// state), the first room, story stage 1, an empty topic list (FF ends it in both
// bytes) and an empty group (the last word index before Jake joins).
const NEW_GAME_STREAM = 0x8bfbd2,
  NEW_GAME_TARGET = 0x2e00,
  NEW_GAME_ROOM = 3,
  FIRST_STORY_STAGE = 1,
  NO_TOPICS = 0xffff,
  SCRIPT_WORDS = 32;
// Jake's new-game record (src/data/runners.mjs): Body, Strength and Charisma 3,
// state-count maximum 30, Firearms and Computer 1; the listed bytes 0.
const JAKE_START_ATTRIBUTE = 3,
  JAKE_START_COUNT_MAX = 0x1e,
  JAKE_START_SKILL = 1,
  CLEARED_WORDS = [NUYEN, NUYEN + 2, KARMA, SELECTED_SPELL_SCRIPT, SPELL_LIST];
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// 80:98E9: the new game's state: the packed state, cleared script words, every
// runner's starting equipment and magic points, and Jake's record.
export function setUpNewGameState(a) {
  const { mem } = a,
    { wram } = mem;
  unpackStream(mem, NEW_GAME_STREAM, NEW_GAME_TARGET);
  unlockBulletproofVest(a);
  fillStateBytes(wram, 0, SCRIPT_VARIABLES, SCRIPT_VARIABLES + SCRIPT_WORDS * 2);
  for (const [index, defaults] of runnerContent(mem).entries()) {
    const runner = runnerState(mem, index);
    Object.assign(runner.armour, defaults.armour);
    Object.assign(runner.weapon, defaults.weapon);
    runner.magicPoints = defaults.magic_points;
  }
  const jake = jakeState(mem);
  for (const field of ['body', 'strength', 'charisma']) jake[field] = JAKE_START_ATTRIBUTE;
  jake.maxHealth = JAKE_START_COUNT_MAX;
  jake.magic = 0;
  jake.alternatePortrait = jake.dermalArmour = jake.wiredReflexes = 0;
  for (const name of Object.keys(jake.skills)) jake.skills[name] = 0;
  for (const name of Object.keys(jake.spells)) jake.spells[name] = 0;
  jake.skills.firearms = jake.skills.computer = JAKE_START_SKILL;
  for (const at of CLEARED_WORDS) setWord(wram, at, 0);
  setWord(wram, SELECTED_SPELL_NAME, TEXT_NONE);
}

// 80:960D: a new game. Returns its first room.
export function startNewGame(a) {
  const { wram } = a.mem;
  setUpNewGameState(a);
  setWord(wram, TOPIC_LIST, NO_TOPICS);
  setWord(wram, STORY_STAGE, FIRST_STORY_STAGE);
  partyState(a.mem).lastMember = -1;
  return NEW_GAME_ROOM;
}

// Load the selected slot after the title has checked its checksum.
export function loadSavedGame(a, slot) {
  readSaveSlot(a.mem.sram, slot, savedGameState(a.mem), fourSaveSlots(a));
  unlockBulletproofVest(a);
}

// 80:9688: the main start. Ends before the main loop at 80:96AB; returns that
// program counter.
// The live game loop enters it right after the owner (src/script/game-loop.mjs); it
// receives the owner's choice as a value. Legacy callers may omit it and use
// direct page word 0. It checks no registers. The register-level entry check
// (direct page 0, data bank 80, 16-bit registers) belongs to the proof callers
// (requireGameStartEntry in proof/caller/game-start.mjs).
export function* gameStartSequence(h, events, choice = word(h.a.mem.wram, CHOICE)) {
  let room;
  yield () => {
    const { wram } = h.a.mem;
    if (choice & WORD_SIGN) room = startNewGame(h.a);
    else {
      loadSavedGame(h.a, choice);
      room = word(wram, ROOM);
    }
  };
  return yield* roomStartSequence(h, events, room);
}

// 80:9699: the game screen, the room and the fixed colour; the main loop's reload
// and exit requests are cleared. Ends before the main loop at 80:96AB.
export function* roomStartSequence(h, events, room) {
  yield () => setUpGameScreen(sceneRuntime(h), tasksOf(h.a));
  yield* enterRoomSequence(h, events, room);
  yield () => {
    const m = sceneRuntime(h);
    setWord(m.wram, MAIN_LOOP_RELOAD, 0);
    setWord(m.wram, MAIN_LOOP_EXIT, 0);
    resetFixedColour(m);
  };
}

// The title cycle's demo runs startNewGame (80:960D) without the frame; the RTS form
// for register-level harnesses is startNewGameJsr in tools/register-forms/jsr-forms.mjs.
