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
import {
  SLOT_OFFSETS_FOUR,
  saveSlotCount,
  FOUR_SAVE_SLOTS,
  ORIGINAL_SAVE_SLOTS,
} from './save-slots.mjs';
import { SLOT_CHECKED_BYTES, CHECKSUM_WORD_BYTES } from './save-slots.mjs';
import {
  RECORD_ATTRIBUTE,
  RECORD_SKILL,
  RECORD_SPELL,
  RUNNERS,
  RUNNER_EQUIPMENT_BYTES,
  RUNNER_EQUIPMENT_ROWS,
  RUNNER_MAGIC_POINT_ROWS,
} from '../data/runners.mjs';
import { TEXT_NONE } from '../data/native-member-spell-menu.mjs';
import {
  GROUP_INDEX,
  JAKE_ALTERNATE_PORTRAIT,
  JAKE_BODY,
  JAKE_DERMAL_ARMOUR,
  JAKE_WIRED_REFLEXES,
  KARMA,
  MAGIC_POINTS,
  MAIN_LOOP_EXIT,
  MAIN_LOOP_RELOAD,
  NUYEN,
  ROOM,
  RUNNER_ARMOUR,
  SAVE_STATE_START,
  SCRIPT_VARIABLES,
  SELECTED_SPELL_NAME,
  SELECTED_SPELL_SCRIPT,
  SPELL_LIST,
  STORY_STAGE,
  TOPIC_LIST,
} from '../data/wram.mjs';
import { CODE_BANK_BASE, SRAM_FIRST_BANK } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The main start, its end before the main loop's first call, and the room start.
export const GAME_START = 0x9688,
  GAME_START_END = 0x96ab,
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
  GROUP_EMPTY = 0xfffe,
  SCRIPT_WORDS = 32;
// Jake's new-game record (src/data/runners.mjs): Body, Strength and Charisma 3,
// state-count maximum 30, Firearms and Computer 1; the listed bytes 0.
const JAKE_START_ATTRIBUTE = 3,
  JAKE_START_COUNT_MAX = 0x1e,
  JAKE_START_SKILL = 1,
  JAKE_CLEARED_BYTES = [
    JAKE_ALTERNATE_PORTRAIT,
    JAKE_DERMAL_ARMOUR,
    JAKE_WIRED_REFLEXES,
    JAKE_BODY + RECORD_SKILL.unarmed_combat,
    JAKE_BODY + RECORD_SKILL.armed_combat,
    JAKE_BODY + RECORD_SKILL.leadership,
    JAKE_BODY + RECORD_SKILL.negotiation,
    JAKE_BODY + RECORD_ATTRIBUTE.magic,
    JAKE_BODY + RECORD_SPELL.powerball,
    JAKE_BODY + RECORD_SPELL.invisibility,
    JAKE_BODY + RECORD_SPELL.summon_spirit,
    JAKE_BODY + RECORD_SPELL.freeze,
    JAKE_BODY + RECORD_SPELL.heal,
    JAKE_BODY + RECORD_SPELL.armour,
  ],
  CLEARED_WORDS = [NUYEN, NUYEN + 2, KARMA, SELECTED_SPELL_SCRIPT, SPELL_LIST];
// The save slot offsets 81:B124 (two original slots; four with the option,
// src/game/save-slots.mjs). A slot holds its checksum word and the save state.
const SLOT_OFFSETS = 0x81b124,
  SAVE_SLOT_BYTES = SLOT_CHECKED_BYTES + CHECKSUM_WORD_BYTES;
const SRAM_BASE = SRAM_FIRST_BANK << 16;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const readRomWord = (mem, at) => mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS);

// 80:98E9: the new game's state: the packed state, cleared script words, every
// runner's starting equipment and magic points, and Jake's record.
export function setUpNewGameState(a) {
  const { mem } = a,
    { wram } = mem;
  unpackStream(mem, NEW_GAME_STREAM, NEW_GAME_TARGET);
  unlockBulletproofVest(a);
  fillStateBytes(wram, 0, SCRIPT_VARIABLES, SCRIPT_VARIABLES + SCRIPT_WORDS * 2);
  for (let i = 0; i < RUNNERS * RUNNER_EQUIPMENT_BYTES; i++)
    writeStateByte(
      wram,
      RUNNER_ARMOUR + i,
      mem.read8(CODE_BANK_BASE | (RUNNER_EQUIPMENT_ROWS + i)),
    );
  for (let i = 0; i < RUNNERS; i++)
    writeStateByte(
      wram,
      MAGIC_POINTS + i,
      mem.read8(CODE_BANK_BASE | (RUNNER_MAGIC_POINT_ROWS + i)),
    );
  for (const field of ['body', 'strength', 'charisma'])
    writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE[field], JAKE_START_ATTRIBUTE);
  writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.count_max, JAKE_START_COUNT_MAX);
  for (const at of JAKE_CLEARED_BYTES) writeStateByte(wram, at, 0);
  writeStateByte(wram, JAKE_BODY + RECORD_SKILL.firearms, JAKE_START_SKILL);
  writeStateByte(wram, JAKE_BODY + RECORD_SKILL.computer, JAKE_START_SKILL);
  for (const at of CLEARED_WORDS) setWord(wram, at, 0);
  setWord(wram, SELECTED_SPELL_NAME, TEXT_NONE);
}

// 80:960D: a new game. Returns its first room.
export function startNewGame(a) {
  const { wram } = a.mem;
  setUpNewGameState(a);
  setWord(wram, TOPIC_LIST, NO_TOPICS);
  setWord(wram, STORY_STAGE, FIRST_STORY_STAGE);
  setWord(wram, GROUP_INDEX, GROUP_EMPTY);
  return NEW_GAME_ROOM;
}

// The SRAM offset of a save slot (81:B11A).
export function saveSlotOffset(a, slot) {
  const index = (slot << 1) & WORD_MASK;
  if (index >= ORIGINAL_SAVE_SLOTS * 2 && saveSlotCount(a) === FOUR_SAVE_SLOTS)
    return SLOT_OFFSETS_FOUR[index >> 1];
  return readRomWord(a.mem, SLOT_OFFSETS + index);
}

// 81:B198: load the save slot from SRAM (the checksum word included). The caller
// checked the slot's validity before.
export function loadSavedGame(a, slot) {
  const { mem } = a,
    offset = saveSlotOffset(a, slot);
  for (let i = 0; i < SAVE_SLOT_BYTES; i++)
    writeStateByte(
      mem.wram,
      SAVE_STATE_START + i,
      mem.read8(SRAM_BASE | ((offset + i) & WORD_MASK)),
    );
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
// Live starts (with frame jobs) take game services only; recorded callers see the
// original end at 80:96AB as their PC.
export function* roomStartSequence(h, events, room) {
  yield () => setUpGameScreen(sceneRuntime(h), tasksOf(h.a));
  yield* enterRoomSequence(h, events, room);
  yield () => {
    const m = sceneRuntime(h);
    setWord(m.wram, MAIN_LOOP_RELOAD, 0);
    setWord(m.wram, MAIN_LOOP_EXIT, 0);
    resetFixedColour(m);
  };
  if (events?.frameJobs) return undefined;
  h.ctx.pc = GAME_START_END;
  return h.ctx.pc;
}

// The title cycle's demo runs startNewGame (80:960D) without the frame; the RTS form
// for register-level harnesses is startNewGameJsr in proof/caller/jsr-forms.mjs.
