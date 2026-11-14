// Register-level reference of the room entry 80:A4BF (moved from
// src/task/main-transition.mjs; lifted in src/game/room-entry.mjs). Its callees stay
// register-level in src/task/main-transition.mjs and the routine tables, where other
// callers use them; the reference calls all of them through their original frames.
import { TRANSITION_ROUTINES } from '../../src/task/main-transition.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import {
  CAMERA_BOX,
  DIALOG_WINDOW,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  GAME_OPTIONS,
  MUSIC,
  OPTION_MUSIC_RESTORE,
  ROOM,
  WRAM,
} from '../../src/task/wram.mjs';
import {
  ROOM_ENTRY_DIRECTION,
  ROOM_ENTRY_POSITION,
  ROOM_HEADER_CAMERA,
  ROOM_HEADER_MUSIC,
  ROOM_TABLE,
} from '../../src/data/rooms.mjs';
import { LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const NONE = WORD_MASK;
// Direct page of the room entry: the room header pointer, the script, point and sight
// lists, and the start direction and position.
const DP_ROOM_HEADER = 0x86,
  DP_SCRIPT_LIST = 0x9d,
  DP_POINT_LIST = 0xf3,
  DP_SIGHT_LIST = 0xfc,
  DP_START_DIRECTION = 0x11,
  DP_START_X = 0x14,
  DP_START_Y = 0x17,
  DP_START_Z = 0x1a;
// Brightness fades of 81:B0AC: speed -2 (out) and +2 (in).
const FADE_OUT = 0xfffe,
  FADE_IN = 2;
// Room music byte FF: none; 80:A4BF then restores FIGHT_MUSIC.
const NO_ROOM_MUSIC = BYTE_MASK;
// Room lists after the script list: entries of 14 bytes (box and data word) and of 6
// bytes (point); 80:A4BF skips a list as count * (2 << shifts) - count * 2 + 1 bytes.
const BOX_DATA_SHIFTS = 3,
  POINT_SHIFTS = 2;

// 80:A4BF: enter the room: load its header and lists, place the actors and the group,
// set the camera, the music and fade in.
export function enterRoomReference(h, e, r = TRANSITION_ROUTINES) {
  return drainNativeSequence(roomEntryReferenceSequence(h, e, r));
}
// Original routine $80:A4BF.
function* roomEntryReferenceSequence(h, e, r) {
  const { ctx } = h,
    call = (pc, target, long = false) => nativeCallSequence(h, e, r, pc, target, long);
  let result;
  yield () => {
    h.write(WRAM + ROOM, ctx.a);
    h.asl();
    h.asl();
    h.asl();
    h.adc(h.read(WRAM + ROOM));
    h.index('x', ctx.a);
    h.load(h.read(ROOM_TABLE + ctx.x));
    h.dpWrite(DP_ROOM_HEADER, ctx.a);
  };
  yield* call(0x80a4d1, 0x80a44d);
  yield () => {
    h.load(LOROM_OFFSET);
    h.testBits(DP_ROOM_HEADER, true, true);
    h.phx();
    h.load(FADE_OUT);
  };
  yield* call(0x80a4dd, 0x81b0ac, true);
  yield* call(0x80a4e1, 0x80bcb2);
  yield* call(0x80a4e4, 0x80c1a6);
  let stopMusic;
  yield () => {
    h.load(h.read(h.abs(GAME_OPTIONS)));
    h.bit(OPTION_MUSIC_RESTORE);
    stopMusic = Boolean(ctx.status & FLAG_ZERO);
    if (!stopMusic) {
      h.load(h.read(h.abs(FIGHT_LIST_INDEX)));
      stopMusic = !(ctx.status & FLAG_NEGATIVE);
      if (!stopMusic) {
        h.index('y', ROOM_HEADER_MUSIC);
        h.load(h.read(h.indirect(DP_ROOM_HEADER, ctx.y)));
        h.load(ctx.a & BYTE_MASK);
        h.cmp(NO_ROOM_MUSIC);
        if (!(ctx.status & FLAG_ZERO)) {
          h.cmp(h.read(h.abs(MUSIC)));
          stopMusic = !(ctx.status & FLAG_ZERO);
        }
      }
    }
  };
  if (stopMusic) yield* call(0x80a506, 0x81ef94, true);
  yield () => {
    h.index('y', ROOM_HEADER_CAMERA);
    h.load(h.read(h.indirect(DP_ROOM_HEADER, ctx.y)));
    h.load(ctx.a - 1);
    h.write(h.abs(CAMERA_BOX), ctx.a);
    h.load(h.read(h.indirect(DP_ROOM_HEADER)));
    h.load(ctx.a & BYTE_MASK);
  };
  yield* call(0x80a518, 0x81a117, true);
  for (const [pc, t, long] of [
    [0x80a51c, 0x81b0bd, true],
    [0x80a520, 0x81b0a1, true],
    [0x80a524, 0x818861, true],
    [0x80a528, 0x80ff79, false],
    [0x80a52b, 0x81a772, true],
  ])
    yield* call(pc, t, long);
  yield () => {
    h.plx();
    h.load(h.read(ROOM_TABLE + ROOM_ENTRY_DIRECTION + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    h.dpWrite(DP_START_DIRECTION, ctx.a);
    for (const [at, dp] of [
      [ROOM_TABLE + ROOM_ENTRY_POSITION, DP_START_X],
      [ROOM_TABLE + ROOM_ENTRY_POSITION + 2, DP_START_Y],
      [ROOM_TABLE + ROOM_ENTRY_POSITION + 2 * 2, DP_START_Z],
    ]) {
      h.load(h.read(at + ctx.x));
      h.dpWrite(dp, ctx.a);
    }
  };
  for (const [pc, t, long] of [
    [0x80a54b, 0x80a2fa, false],
    [0x80a54e, 0x80a3b6, false],
    [0x80a551, 0x80a464, false],
    [0x80a554, 0x819ae6, true],
    [0x80a558, 0x818d05, true],
    [0x80a55c, 0x818bd9, true],
  ])
    yield* call(pc, t, long);
  let music;
  yield () => {
    h.load(h.read(h.abs(GAME_OPTIONS)));
    h.load(ctx.a & OPTION_MUSIC_RESTORE);
    music = Boolean(ctx.status & FLAG_ZERO);
    if (!music) {
      h.load(h.read(h.abs(MUSIC)));
      h.cmp(NONE);
      if (ctx.status & FLAG_ZERO) {
        h.index('y', ROOM_HEADER_MUSIC);
        h.load(h.read(h.indirect(DP_ROOM_HEADER, ctx.y)));
        h.load(ctx.a & BYTE_MASK);
        h.cmp(NO_ROOM_MUSIC);
        if (ctx.status & FLAG_ZERO) h.load(h.read(h.abs(FIGHT_MUSIC)));
        music = true;
      }
    }
  };
  if (music) yield* call(0x80a580, 0x81ef47, true);
  yield* call(0x80a584, 0x818756, true);
  yield* call(0x80a588, 0x808511);
  yield () => {
    for (const [ptr, shifts, out] of [
      [DP_SCRIPT_LIST, BOX_DATA_SHIFTS, DP_POINT_LIST],
      [DP_POINT_LIST, BOX_DATA_SHIFTS, DP_POINT_LIST],
      [DP_POINT_LIST, POINT_SHIFTS, DP_SIGHT_LIST],
    ]) {
      h.load(h.read(h.indirect(ptr)));
      h.load(ctx.a & BYTE_MASK);
      h.asl();
      h.pha();
      for (let i = 0; i < shifts; i++) h.asl();
      ctx.status |= FLAG_CARRY;
      h.sbc(h.read((ctx.s + 1) & WORD_MASK, 2));
      ctx.status |= FLAG_CARRY;
      h.adc(h.dp(ptr));
      h.dpWrite(out, ctx.a);
      h.pla();
    }
  };
  yield* call(0x80a5c3, 0x80babb);
  yield () => h.write(h.abs(DIALOG_WINDOW), 0);
  yield* call(0x80a5c9, 0x81ad92, true);
  yield () => {
    h.load(NONE);
    h.write(h.abs(DIALOG_WINDOW), ctx.a);
    h.load(FADE_IN);
  };
  yield* call(0x80a5d6, 0x81b0ac, true);
  yield () => {
    result = h.rts();
  };
  return result;
}

export const ROOM_ENTRY_REFERENCE_ENTRIES = [[0x80a4bf, enterRoomReference]];
// A copy of a routine table with this reference.
export const withRoomEntryReference = (table) =>
  new Map([...table, ...ROOM_ENTRY_REFERENCE_ENTRIES]);
// The reference waits through its callees; its continuation is found by its run
// function, as the lifted entry holds the target.
NATIVE_CALL_CONTINUATIONS.set(enterRoomReference, {
  run: enterRoomReference,
  create: ({ h, events, routines = TRANSITION_ROUTINES }) =>
    new NativeCallContinuation(h.a, roomEntryReferenceSequence(h, events, routines)),
});
