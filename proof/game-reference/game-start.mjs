// Register-level reference of the start of a game: the main start 80:9688, the
// room start 80:9699 (with the attract game's rounds), the new game 80:960D with its
// state 80:98E9, and the save load 81:B198 (the lifted versions are
// src/game/game-start.mjs).
import { taskStop } from '../../src/task/plan.mjs';
import { unlockBulletproofVest } from '../../src/game/bugfixes.mjs';
import { dialogAccess } from '../../src/task/native-dialog-support.mjs';
import { getSaveSlotOffset } from '../../src/task/native-main-menu.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import { TEXT_NONE } from '../../src/task/native-member-spell-menu.mjs';
import { MAIN_START_ROUTINES } from '../../src/task/main-start.mjs';
import { GAME_SCREEN_REFERENCE_ENTRIES } from './game-screen.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from './room-entry.mjs';
import { attractRoundsSequence } from '../../src/task/main-frontend.mjs';
import {
  RECORD_ATTRIBUTE,
  RECORD_SKILL,
  RECORD_SPELL,
  RUNNERS,
  RUNNER_EQUIPMENT_BYTES,
  RUNNER_EQUIPMENT_ROWS,
  RUNNER_MAGIC_POINT_ROWS,
} from '../../src/data/runners.mjs';
import { SLOT_CHECKED_BYTES, CHECKSUM_WORD_BYTES } from '../../src/game/save-slots.mjs';
import { GAME_START, GAME_START_END } from '../../src/game/game-start.mjs';
import {
  DP_SAVE_SLOT,
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
  WRAM,
} from '../../src/task/wram.mjs';
import {
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_DECIMAL,
  FLAG_INDEX_8BIT,
} from '../../src/constants/cpu-flags.mjs';
import {
  CODE_BANK,
  SRAM_FIRST_BANK,
  WRAM_BANK,
  WRAM_BASE,
} from '../../src/constants/memory-map.mjs';

// 80:98E9 unpacks the new-game stream 8B:FBD2 to 7E:2E00 (inside the save
// state), clears the 32 script words and copies the magic point and equipment
// rows of all runners.
const NEW_GAME_STREAM = 0xfbd2,
  NEW_GAME_STREAM_BANK = 0x8b,
  NEW_GAME_TARGET = 0x2e00,
  SCRIPT_VARIABLES_LAST = 0x3e;
// Jake's new-game record (7E:3BFB, record layout src/data/runners.mjs): Body,
// Strength and Charisma 3, state-count maximum 30, Firearms and Computer 1,
// every other byte but byte 3 zero.
const JAKE_RECORD = WRAM_BASE + JAKE_BODY,
  JAKE_START_ATTRIBUTE = 3,
  JAKE_START_COUNT_MAX = 0x1e;
// 80:960D: an empty topic list (FF ends it in both bytes) and an empty group
// (the last word index of the group before Jake joins).
const NO_TOPICS = 0xffff,
  GROUP_EMPTY = 0xfffe;
// 81:B198 copies the save slot from SRAM, checksum word included.
const SAVE_SLOT_BYTES = SLOT_CHECKED_BYTES + CHECKSUM_WORD_BYTES;
// 80:960D returns the first room of a new game in A, as 81:B198 is followed by
// the saved ROOM; 9699 loads that room.
const NEW_GAME_ROOM = 3;

// The task routines with these references (built on first use: the task tables
// and this module import each other).
let routines = null;
function referenceRoutines() {
  routines ??= new Map([...MAIN_START_ROUTINES, ...REFERENCE_ROUTINES]);
  return routines;
}

// 80:98E9: original new-game stream and actor defaults. MVN keeps its actual
// A/X/Y/DBR effects; PHB/PLB restores the fresh saved bank, not a cached value.
function runNewGameDefaults(h, e, r = referenceRoutines()) {
  const { ctx } = h;
  h.load(NEW_GAME_STREAM);
  h.index('y', NEW_GAME_STREAM_BANK);
  h.index('x', NEW_GAME_TARGET);
  routineCaller(h, e, r)(0x8098f2, 0x809f4d);
  unlockBulletproofVest(h.a);
  h.index('x', SCRIPT_VARIABLES_LAST);
  h.load(0);
  do {
    h.write(WRAM + SCRIPT_VARIABLES + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.phb();
  h.index('x', RUNNER_EQUIPMENT_ROWS);
  h.index('y', RUNNER_ARMOUR);
  h.load(RUNNERS * RUNNER_EQUIPMENT_BYTES - 1);
  h.move(CODE_BANK, WRAM_BANK, 1);
  h.index('x', RUNNER_MAGIC_POINT_ROWS);
  h.index('y', MAGIC_POINTS);
  h.load(RUNNERS - 1);
  h.move(CODE_BANK, WRAM_BANK, 1);
  h.plb();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(JAKE_START_ATTRIBUTE);
  h.write(JAKE_RECORD + RECORD_ATTRIBUTE.body, ctx.a);
  h.load(JAKE_START_ATTRIBUTE);
  h.write(JAKE_RECORD + RECORD_ATTRIBUTE.strength, ctx.a);
  h.write(JAKE_RECORD + RECORD_ATTRIBUTE.charisma, ctx.a);
  h.load(JAKE_START_COUNT_MAX);
  h.write(JAKE_RECORD + RECORD_ATTRIBUTE.count_max, ctx.a);
  h.load(0);
  for (const at of [
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
  ])
    h.write(WRAM + at, ctx.a);
  h.load(1);
  h.write(JAKE_RECORD + RECORD_SKILL.firearms, ctx.a);
  h.write(JAKE_RECORD + RECORD_SKILL.computer, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(0);
  for (const at of [NUYEN, NUYEN + 2, KARMA, SELECTED_SPELL_SCRIPT, SPELL_LIST])
    h.write(WRAM + at, ctx.a);
  h.load(TEXT_NONE);
  h.write(WRAM + SELECTED_SPELL_NAME, ctx.a);
  return h.rts();
}
// Original routine $80:960D.
function runNewGame(h, e, r = referenceRoutines()) {
  routineCaller(h, e, r)(0x80960d, 0x8098e9);
  h.load(NO_TOPICS);
  h.write(WRAM + TOPIC_LIST, h.ctx.a);
  h.load(1);
  h.write(WRAM + STORY_STAGE, h.ctx.a);
  h.load(GROUP_EMPTY);
  h.write(WRAM + GROUP_INDEX, h.ctx.a);
  h.load(NEW_GAME_ROOM);
  return h.rts();
}
// 81:B198: load exactly 0F28 bytes, including the saved checksum word. The
// original caller's validity decision is outside this entry; none is invented.
function runSaveLoad(h) {
  const { ctx } = h;
  h.php();
  h.phb();
  h.dpWrite(DP_SAVE_SLOT, ctx.a);
  h.call(0x81b19c, 0x81b11a, () => getSaveSlotOffset(h));
  h.index('y', SAVE_STATE_START);
  h.load(SAVE_SLOT_BYTES - 1);
  h.move(SRAM_FIRST_BANK, WRAM_BANK, 1);
  unlockBulletproofVest(h.a);
  h.plb();
  h.plp();
  return h.rtl();
}

// The complete original prefix, stopping before the first main-loop call at
// 96AB. No return is fabricated and no boot/SRAM/device state is initialized.
export function runReferenceGameStart(h, e, r = referenceRoutines()) {
  return drainNativeSequence(referenceGameStartSequence(h, e, r));
}
function* referenceGameStartSequence(h, e, r) {
  const { ctx } = h;
  if (
    ctx.programBank !== CODE_BANK ||
    ctx.pc !== GAME_START ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_start_entry_required', { pc: ctx.pc });
  yield () => h.load(h.dp(0));
  if (ctx.status & FLAG_NEGATIVE) yield* nativeCallSequence(h, e, r, 0x80968c, 0x80960d);
  else {
    yield* nativeCallSequence(h, e, r, 0x809691, 0x81b198, true);
    yield () => h.load(h.read(WRAM + ROOM));
  }
  return yield* referenceRoomStartSequence(h, e, r);
}
// 80:9699: initialize the game screen, enter room A and reset the fixed colour. The
// attract-game caller 96F3 enters here with A=00AB and its real JSR 96FC frame; 9688
// falls through with its scene.
function* referenceRoomStartSequence(h, e, r) {
  const { ctx } = h;
  yield () => h.pha();
  yield* nativeCallSequence(h, e, r, 0x80969a, 0x809629);
  yield () => h.pla();
  yield* nativeCallSequence(h, e, r, 0x80969e, 0x80a4bf);
  yield () => {
    h.write(h.abs(MAIN_LOOP_RELOAD), 0);
    h.write(h.abs(MAIN_LOOP_EXIT), 0);
  };
  yield* nativeCallSequence(h, e, r, 0x8096a7, 0x818861, true);
  yield () => {
    ctx.pc = GAME_START_END;
  };
  return ctx.pc;
}
// Original routine $80:9699 for the attract game: the reference room start, then the
// shared main loop rounds (src/task/main-frontend.mjs).
export function runReferenceAttractRounds(h, e, r = referenceRoutines()) {
  return drainNativeSequence(referenceAttractRoundsSequence(h, e, r));
}
const referenceAttractRoundsSequence = (h, e, r) =>
  attractRoundsSequence(h, e, r, () => referenceRoomStartSequence(h, e, r));

const REFERENCE = [
  [0x809688, runReferenceGameStart, referenceGameStartSequence],
  [0x809699, runReferenceAttractRounds, referenceAttractRoundsSequence],
];
const REFERENCE_ROUTINES = [
  [0x80960d, runNewGame],
  [0x8098e9, runNewGameDefaults],
  [0x81b198, runSaveLoad],
];
export const GAME_START_REFERENCE_ENTRIES = [
  ...REFERENCE_ROUTINES,
  ...REFERENCE.map(([target, run]) => [target, run]),
];
// A copy of a routine table with these references and the register-level game
// screen set-up 80:9629 and room entry 80:A4BF (game-screen.mjs, room-entry.mjs)
// they call.
export const withGameStartReference = (table) =>
  new Map([
    ...table,
    ...GAME_START_REFERENCE_ENTRIES,
    ...GAME_SCREEN_REFERENCE_ENTRIES,
    ...ROOM_ENTRY_REFERENCE_ENTRIES,
  ]);
for (const [, run, sequence] of REFERENCE)
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines: r = referenceRoutines() }) =>
      new NativeCallContinuation(h.a, sequence(h, events, r)),
  });
// The register-level accessor form, for tests that hold a task accessor.
export const referenceGameStart = (a, e, r) => runReferenceGameStart(dialogAccess(a), e, r);
