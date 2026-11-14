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
// enters the room start directly with room AB (src/task/main-frontend.mjs).
import { drainNativeSequence } from '../task/native-call-continuation.mjs';
import { taskStop } from '../task/plan.mjs';
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
import { TEXT_NONE } from '../task/native-member-spell-menu.mjs';
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
} from '../task/wram.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE, SRAM_FIRST_BANK } from '../constants/memory-map.mjs';
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

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readRomWord = (mem, at) => mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS);

// 80:98E9: the new game's state: the packed state, cleared script words, every
// runner's starting equipment and magic points, and Jake's record.
export function setUpNewGameState(a) {
  const { mem } = a,
    { wram } = mem;
  unpackStream(mem, NEW_GAME_STREAM, NEW_GAME_TARGET);
  unlockBulletproofVest(a);
  wram.fill(0, SCRIPT_VARIABLES, SCRIPT_VARIABLES + SCRIPT_WORDS * 2);
  for (let i = 0; i < RUNNERS * RUNNER_EQUIPMENT_BYTES; i++)
    wram[RUNNER_ARMOUR + i] = mem.read8(CODE_BANK_BASE | (RUNNER_EQUIPMENT_ROWS + i));
  for (let i = 0; i < RUNNERS; i++)
    wram[MAGIC_POINTS + i] = mem.read8(CODE_BANK_BASE | (RUNNER_MAGIC_POINT_ROWS + i));
  for (const field of ['body', 'strength', 'charisma'])
    wram[JAKE_BODY + RECORD_ATTRIBUTE[field]] = JAKE_START_ATTRIBUTE;
  wram[JAKE_BODY + RECORD_ATTRIBUTE.count_max] = JAKE_START_COUNT_MAX;
  for (const at of JAKE_CLEARED_BYTES) wram[at] = 0;
  wram[JAKE_BODY + RECORD_SKILL.firearms] = JAKE_START_SKILL;
  wram[JAKE_BODY + RECORD_SKILL.computer] = JAKE_START_SKILL;
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
    mem.wram[SAVE_STATE_START + i] = mem.read8(SRAM_BASE | ((offset + i) & WORD_MASK));
  unlockBulletproofVest(a);
}

// 80:9688: the main start. Ends before the main loop at 80:96AB; returns that
// program counter.
// The main start's entry: program counter 80:9688, direct page 0, data bank 80 and
// 16-bit registers.
export function requireGameStartEntry(ctx) {
  if (
    ctx.programBank !== CODE_BANK ||
    ctx.pc !== GAME_START ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_start_entry_required', { pc: ctx.pc });
}
export function* gameStartSequence(h, events, routines) {
  requireGameStartEntry(h.ctx);
  let room;
  yield () => {
    const { wram } = h.a.mem,
      choice = word(wram, CHOICE);
    if (choice & WORD_SIGN) room = startNewGame(h.a);
    else {
      loadSavedGame(h.a, choice);
      room = word(wram, ROOM);
    }
  };
  return yield* roomStartSequence(h, events, routines, room);
}

// 80:9699: the game screen, the room and the fixed colour; the main loop's reload
// and exit requests are cleared. Ends before the main loop at 80:96AB.
export function* roomStartSequence(h, events, routines, room) {
  const { ctx } = h;
  yield () => setUpGameScreen(sceneRuntime(h));
  // The routines the room entry still calls through their frames come from routines.
  yield* enterRoomSequence(h, events, routines, room);
  yield () => {
    const m = sceneRuntime(h);
    setWord(m.wram, MAIN_LOOP_RELOAD, 0);
    setWord(m.wram, MAIN_LOOP_EXIT, 0);
    resetFixedColour(m);
    ctx.pc = GAME_START_END;
  };
  return ctx.pc;
}

// Run wrappers for the routine tables: the main start (the driver's entry), and
// the new game and the save load for their original callers.
export function runGameStart(h, e, r) {
  return drainNativeSequence(gameStartSequence(h, e, r));
}
export function runNewGame(h) {
  h.ctx.a = startNewGame(h.a);
  return h.rts();
}
export function runNewGameState(h) {
  setUpNewGameState(h.a);
  return h.rts();
}
export function runSaveLoad(h) {
  loadSavedGame(h.a, h.ctx.a & WORD_MASK);
  return h.rtl();
}
