import { routineCaller } from './routine-call.mjs';
import { enterRoomSequence } from '../game/room-entry.mjs';
import { unpackStep } from './native-unpack-body.mjs';
import { SCENE_GRAPHICS_ROUTINES } from './main-scene-graphics.mjs';
import { TALK_ROUTINES } from './native-dialog.mjs';
import { createObject } from './native-object-create.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import { drawWindowListAdapter } from './native-render-compose.mjs';
import { sendApuCommand } from './native-input-apu.mjs';
import { clampToCameraBox, updateCameraTileBuffers } from './main-loop-camera.mjs';
import { clearFixedColour } from './native-dialog-portrait.mjs';
import { ObservedWaitContinuation } from './main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';
import {
  BRIGHTNESS_FADE,
  BRIGHTNESS_FADE_FRAMES,
  CAMERA_BOX_BANK,
  CAMERA_BOX_HIGH,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_X_MAX,
  CAMERA_Y,
  CAMERA_Y_MAX,
  COLOUR_PHASE,
  COLOUR_REQUEST,
  DIALOG_WINDOW,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  EMPTY_LIST,
  FIGHT_FIRST_REMOVAL,
  FIGHT_LIST_INDEX,
  FIGHT_UNREAD,
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_LAST,
  FORMATION_X,
  FORMATION_Y,
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_SLOTS,
  HARMLESS_HITS,
  INIDISP_SHADOW,
  JAKE_DERMAL_ARMOUR,
  MAP_COLUMN_BG1,
  MAP_COLUMN_BG2,
  MAP_COLUMN_UPLOAD,
  MAP_COLUMN_VRAM_BG1,
  MAP_COLUMN_VRAM_BG2,
  MAP_LINE_BYTES,
  MAP_ROW_BG1,
  MAP_ROW_BG2,
  MAP_ROW_UPLOAD,
  MAP_ROW_VRAM_BG1,
  MAP_ROW_VRAM_BG2,
  MAP_UPLOAD_HELD,
  MUSIC,
  OBJECT_ARMOUR,
  OBJECT_CLASS_MASK,
  OBJECT_DEPTH_ORDER,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RUNNER_ARMOUR_RATING,
  SCENE_PALETTE_UPLOAD,
  STORY_STAGE,
  WRAM,
} from './wram.mjs';
import { ROOM_BANK, ROOM_HEADER_ACTOR_COUNT } from '../data/rooms.mjs';
import { ACTOR_KIND, ACTOR_RECORD, ACTOR_SCRIPT, ACTOR_TABLE } from '../data/actors.mjs';
import { RUNNER_LAST_INDEX, RUNNER_OBJECT_NUMBERS } from '../data/runners.mjs';
import {
  A1T3L,
  DAS3L,
  VMADDL,
  VMAINC,
  MDMAEN,
  BG1HOFS,
  BG1VOFS,
  DMAP0,
  DMAP3,
  DMA_CHANNEL_STRIDE,
} from '../constants/hardware-registers.mjs';
import {
  INIDISP_FORCED_BLANK,
  VMAINC_INCREMENT_AFTER_HIGH,
  VMAINC_STEP_32,
} from '../constants/ppu.mjs';
import { WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// Value written to mark a slot or the music as unset (negative).
const NONE = WORD_MASK;
// Direct page of the room transition: the room header pointer (bank DP88), the room
// lists after the actors (bank DP9C), the script list (bank DP9F), the point list (bank
// DPF5) and the sight list (bank DPFE); 80:A44D sets all banks.
const DP_ROOM_HEADER = 0x86,
  DP_ROOM_HEADER_BANK = 0x88,
  DP_ROOM_LISTS = 0x9a,
  DP_ROOM_LISTS_BANK = 0x9c,
  DP_SCRIPT_LIST_BANK = 0x9f,
  DP_POINT_LIST_BANK = 0xf5,
  DP_SIGHT_LIST_BANK = 0xfe;
// The start direction and position of the room entry (80:A4BF) and the projected camera
// position handed to 81:8A05 (80:A464).
const DP_START_DIRECTION = 0x11,
  DP_START_X = 0x14,
  DP_START_Y = 0x17,
  DP_START_Z = 0x1a,
  DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11;
// 80:A2FA keeps the member index; 80:AAAF takes the direction in DP02.
const DP_MEMBER = 0x26,
  DP_ACTION_DIRECTION = 2;
// 80:A3B6: actors left, the actor flags and record; the high five bits of the actor's x
// and y words form DP06 (A835 takes it as its height argument).
const DP_ACTORS_LEFT = 0x29,
  DP_ACTOR_FLAGS = 0x20,
  DP_ACTOR_RECORD = 0x23,
  DP_ACTOR_BITS = DP_OBJECT_HEIGHT;
// Actor words: coordinate in bits 0-10, flag bits above; actor flags bits 6 and 7 become
// OBJECT_DEPTH_ORDER bits 15 and 0; a state record's holder word at +3 (FFFF: none).
const ACTOR_COORDINATE_MASK = 0x7ff,
  ACTOR_FLAG_BITS = 0xf800,
  ACTOR_DEPTH_BITS = 0xc0,
  STATE_HOLDER = 3;
// Kind of Jake's figure (80:A2FA makes it the player figure); his dermal armour adds 2.
const JAKE_KIND = 0x0b,
  DERMAL_ARMOUR_BONUS = 2;
// Brightness fades of 81:B0AC: frames = |speed| + 8.
const FADE_FRAMES_BASE = 8;
// 81:8861 sets the colour phase before 80:886A.
const COLOUR_PHASE_START = 0x180;
// 80:A464: camera = ((0488 - x - y) / 2) * 4 and (0100 + y - x) * 4, minus the height.
const CAMERA_ROW_BASE = 0x488,
  CAMERA_COLUMN_BASE = 0x100,
  CAMERA_HEIGHT_BASE = 0x100;
// 81:8BD9 scrolls the camera by 0400 in 20 steps of 20.
const CAMERA_JUMP = 0x400,
  CAMERA_JUMP_STEP = 0x20,
  CAMERA_JUMP_STEPS = 0x20;
// 81:8954 uses DMA channel 3 for the map columns and rows.
const MAP_CHANNEL = 1 << ((DMAP3 - DMAP0) / DMA_CHANNEL_STRIDE);

// 80:A4BF and its original scene/actor/camera transition. Waits and device
// responses keep the existing explicit observation contracts.
// Original routine $80:A44D.
function setRoomBanks(h) {
  h.asl();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(ROOM_BANK);
  h.adc(0);
  h.dpWrite(DP_ROOM_HEADER_BANK, h.ctx.a);
  h.write(h.abs(CAMERA_BOX_BANK), h.ctx.a);
  for (const at of [
    DP_SCRIPT_LIST_BANK,
    DP_ROOM_LISTS_BANK,
    DP_POINT_LIST_BANK,
    DP_SIGHT_LIST_BANK,
  ])
    h.dpWrite(at, h.ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
// 81:B0AC: start a brightness fade with the speed in A (negative: out); the fade lasts
// |speed| + 8 frames.
export function setBrightnessFadeSpeed(h) {
  const { ctx } = h;
  h.write(h.abs(BRIGHTNESS_FADE), ctx.a);
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
  }
  ctx.status &= ~FLAG_CARRY;
  h.adc(FADE_FRAMES_BASE);
  h.write(h.abs(BRIGHTNESS_FADE_FRAMES), ctx.a);
  return h.rtl();
}
// 81:B0BD: stop the fade and switch the screen to forced blank.
export function forceBlank(h) {
  h.write(h.abs(BRIGHTNESS_FADE), 0);
  h.load(INIDISP_FORCED_BLANK);
  h.write(h.abs(INIDISP_SHADOW), h.ctx.a);
  return h.rtl();
}
// Original routine $81:EF94.
function runMusicStop(h, e, r = TRANSITION_ROUTINES) {
  h.load(NONE);
  h.write(h.abs(MUSIC), h.ctx.a);
  h.load(2);
  h.index('x', 0);
  routineCaller(h, e, r)(0x81efa0, 0x81f007, true);
  return h.rtl();
}
// Original routine $81:8861.
function resetFixedColour(h) {
  h.write(h.abs(COLOUR_REQUEST), 0);
  h.load(COLOUR_PHASE_START);
  h.write(h.abs(COLOUR_PHASE), h.ctx.a);
  return clearFixedColour(h);
}
// 80:8D05: request the upload of the scene palette (INC of the request word).
export function requestScenePaletteUpload(h) {
  h.modify(h.abs(SCENE_PALETTE_UPLOAD), 'inc');
  return h.rtl();
}
// Original routine $80:8511.
function runFightListReset(h) {
  h.load(EMPTY_LIST);
  h.write(h.abs(FIGHT_LIST_INDEX), h.ctx.a);
  for (const at of [FIGHT_FIRST_REMOVAL, FIGHT_UNREAD, HARMLESS_HITS]) h.write(h.abs(at), 0);
  return h.rts();
}
// 80:BABB: reset the position ring buffer of the player figure.
function resetFormationTrail(h) {
  const { ctx } = h;
  h.write(h.abs(FORMATION_INDEX), 0);
  h.index('x', FORMATION_LAST);
  h.load(0);
  h.write(WRAM + FORMATION_X, ctx.a);
  h.write(WRAM + FORMATION_Y, ctx.a);
  do {
    h.write(WRAM + FORMATION_HEIGHT + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
// 81:8954: send a pending map column (VRAM step 32) and row (step 1) of BG1 and BG2,
// then the scroll registers of both layers.
export function uploadMapEdgesAndScroll(h, e) {
  const { ctx } = h;
  for (const [pending, source1, source2, vram1, vram2, increment, pcs] of [
    [
      MAP_COLUMN_UPLOAD,
      MAP_COLUMN_BG1,
      MAP_COLUMN_BG2,
      MAP_COLUMN_VRAM_BG1,
      MAP_COLUMN_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH | VMAINC_STEP_32,
      [0x81895c, 0x818962, 0x818968, 0x81896f, 0x818974, 0x81897c, 0x818982, 0x818988, 0x81898f],
    ],
    [
      MAP_ROW_UPLOAD,
      MAP_ROW_BG1,
      MAP_ROW_BG2,
      MAP_ROW_VRAM_BG1,
      MAP_ROW_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH,
      [0x81899f, 0x8189a5, 0x8189ab, 0x8189b2, 0x8189b7, 0x8189bf, 0x8189c5, 0x8189cb, 0x8189d2],
    ],
  ]) {
    const [
      pcSource1,
      pcLength1,
      pcVram1,
      pcIncrement,
      pcStart1,
      pcSource2,
      pcLength2,
      pcVram2,
      pcStart2,
    ] = pcs;
    h.load(h.read(h.abs(pending)));
    if (ctx.status & FLAG_ZERO) continue;
    h.load(source1);
    h.portWrite(A1T3L, ctx.a, 2, pcSource1);
    h.load(MAP_LINE_BYTES);
    h.portWrite(DAS3L, ctx.a, 2, pcLength1);
    h.load(h.read(h.abs(vram1)));
    h.portWrite(VMADDL, ctx.a, 2, pcVram1);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(increment);
    h.portWrite(VMAINC, ctx.a & BYTE_MASK, 1, pcIncrement);
    h.load(MAP_CHANNEL);
    h.portWrite(MDMAEN, ctx.a & BYTE_MASK, 1, pcStart1);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(source2);
    h.portWrite(A1T3L, ctx.a, 2, pcSource2);
    h.load(MAP_LINE_BYTES);
    h.portWrite(DAS3L, ctx.a, 2, pcLength2);
    h.load(h.read(h.abs(vram2)));
    h.portWrite(VMADDL, ctx.a, 2, pcVram2);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(MAP_CHANNEL);
    h.portWrite(MDMAEN, ctx.a & BYTE_MASK, 1, pcStart2);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(pending), 0);
  }
  // BG1 and BG2 (port + 2) scroll by camera / 4, high byte 0.
  for (const [source, port, pcs] of [
    [CAMERA_X, BG1HOFS, [0x8189e1, 0x8189e4, 0x8189e7, 0x8189ea]],
    [CAMERA_Y, BG1VOFS, [0x8189f6, 0x8189f9, 0x8189fc, 0x8189ff]],
  ]) {
    const [pcLow, pcLowHigh, pcSecond, pcSecondHigh] = pcs;
    h.load(h.read(h.abs(source)));
    h.lsr();
    h.lsr();
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(port, ctx.a & BYTE_MASK, 1, pcLow);
    h.portWrite(port, 0, 1, pcLowHigh);
    h.portWrite(port + 2, ctx.a & BYTE_MASK, 1, pcSecond);
    h.portWrite(port + 2, 0, 1, pcSecondHigh);
    if (source === CAMERA_X) unpackStep(h, e, 0x8189ed);
    h.rep(FLAG_MEMORY_8BIT);
  }
  return h.rtl();
}
// Original routine $81:8BD9 (lifted in src/game/room-entry.mjs; this version serves
// the reference entry and the Mesen cold boot replay).
function jumpCamera(h, e, r = TRANSITION_ROUTINES) {
  return drainNativeSequence(jumpCameraSequence(h, e, r));
}
// 81:8BD9: scroll the camera by CAMERA_JUMP with the camera box off.
function* jumpCameraSequence(h, e, r) {
  const { ctx } = h,
    call = (pc, target) => nativeCallSequence(h, e, r, pc, target, true);
  let result;
  yield* call(0x818bd9, 0x81b0bd);
  yield* call(0x818bdd, 0x81b0a1);
  yield () => {
    h.modify(h.abs(MAP_UPLOAD_HELD), 'dec');
    h.load(h.read(h.abs(CAMERA_BOX_HIGH)));
    h.pha();
    h.write(h.abs(CAMERA_BOX_HIGH), 0);
    h.write(h.abs(CAMERA_SPEED_Y), 0);
    h.load(h.read(h.abs(CAMERA_X)));
    h.cmp(CAMERA_JUMP);
    if (ctx.status & FLAG_CARRY) {
      h.sbc(CAMERA_JUMP);
      h.write(h.abs(CAMERA_X), ctx.a);
      h.load(CAMERA_JUMP_STEP);
    } else {
      h.adc(CAMERA_JUMP);
      h.write(h.abs(CAMERA_X), ctx.a);
      h.load(-CAMERA_JUMP_STEP & WORD_MASK);
    }
    h.write(h.abs(CAMERA_SPEED_X), ctx.a);
    h.index('x', CAMERA_JUMP_STEPS);
    h.phx();
  };
  for (;;) {
    yield* call(0x818c14, 0x818a91);
    yield* call(0x818c18, 0x818954);
    yield () => {
      h.plx();
      h.index('x', ctx.x - 1);
    };
    if (ctx.status & FLAG_ZERO) break;
    yield () => h.phx();
  }
  yield () => {
    h.write(h.abs(CAMERA_SPEED_X), 0);
    h.pla();
    h.write(h.abs(CAMERA_BOX_HIGH), ctx.a);
    h.modify(h.abs(MAP_UPLOAD_HELD), 'inc');
    result = h.rtl();
  };
  return result;
}
// 80:A464: project the start position to the camera, clamp it with the camera box
// (81:8A05) and the camera limits.
function placeCameraAtStart(h, e, r = TRANSITION_ROUTINES) {
  const { ctx } = h;
  ctx.status |= FLAG_CARRY;
  h.load(CAMERA_ROW_BASE);
  h.sbc(h.dp(DP_START_X));
  h.sbc(h.dp(DP_START_Y));
  h.lsr();
  h.asl();
  h.asl();
  h.write(h.abs(CAMERA_Y), ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.load(CAMERA_COLUMN_BASE);
  h.adc(h.dp(DP_START_Y));
  ctx.status |= FLAG_CARRY;
  h.sbc(h.dp(DP_START_X));
  h.asl();
  h.asl();
  h.write(h.abs(CAMERA_X), ctx.a);
  h.dpWrite(DP_CAMERA_X, ctx.a);
  h.load(h.read(h.abs(CAMERA_Y)));
  h.dpWrite(DP_CAMERA_Y, ctx.a);
  routineCaller(h, e, r)(0x80a487, 0x818a05, true);
  h.modify(DP_START_Z, 'asl', true);
  h.modify(DP_START_Z, 'asl', true);
  h.load(h.dp(DP_CAMERA_Y));
  ctx.status &= ~FLAG_CARRY;
  h.adc(CAMERA_HEIGHT_BASE);
  ctx.status |= FLAG_CARRY;
  h.sbc(h.dp(DP_START_Z));
  h.dpWrite(DP_CAMERA_Y, ctx.a);
  for (const [dp, at, max] of [
    [DP_CAMERA_X, CAMERA_X, CAMERA_X_MAX],
    [DP_CAMERA_Y, CAMERA_Y, CAMERA_Y_MAX],
  ]) {
    h.load(h.dp(dp));
    if (ctx.status & FLAG_NEGATIVE) h.load(0);
    h.cmp(max);
    if (ctx.status & FLAG_CARRY) h.load(max);
    h.write(h.abs(at), ctx.a);
  }
  return h.rts();
}
// 80:A2FA: create the group members at the start position (lifted in
// src/game/room-actors.mjs; this register-level version serves the reference entry).
function createGroupMembers(h, e, r = TRANSITION_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(NONE);
  h.write(h.abs(PLAYER_OBJECT), ctx.a);
  h.write(h.abs(DIALOG_WINDOW), ctx.a);
  h.load(h.read(WRAM + GROUP_INDEX));
  if (ctx.status & FLAG_NEGATIVE) return h.rts();
  h.index('x', ctx.a);
  for (;;) {
    h.dpWrite(DP_MEMBER, ctx.x, 2);
    for (const [from, to] of [
      [DP_START_X, DP_OBJECT_X],
      [DP_START_Y, DP_OBJECT_Y],
      [DP_START_Z, DP_OBJECT_HEIGHT],
    ]) {
      h.load(h.dp(from));
      h.dpWrite(to, ctx.a);
    }
    h.load(h.read(WRAM + GROUP_OBJECTS + ctx.x));
    h.dpWrite(DP_OBJECT_KIND, ctx.a);
    h.pha();
    h.load(h.read(WRAM + GROUP_NUMBERS + ctx.x));
    h.index('x', ctx.a);
    h.load(h.read(ACTOR_TABLE + ACTOR_SCRIPT + ctx.x));
    h.dpWrite(DP_OBJECT_SCRIPT, ctx.a);
    call(0x80a32d, 0x80a835);
    h.load(h.read((ctx.s + 1) & WORD_MASK, 2));
    h.cmp(JAKE_KIND);
    if (ctx.status & FLAG_ZERO) {
      h.load(h.dp(DP_OBJECT_KIND));
      h.write(h.abs(PLAYER_OBJECT), ctx.a);
    }
    h.load(h.dp(DP_START_DIRECTION));
    h.dpWrite(DP_ACTION_DIRECTION, ctx.a);
    call(0x80a340, 0x80aaaf);
    h.index('y', h.dp(DP_OBJECT_KIND, 2));
    h.index('x', h.dp(DP_MEMBER, 2));
    h.load(h.read(WRAM + GROUP_NUMBERS + ctx.x));
    h.write(h.abs(OBJECT_NUMBER) + ctx.y, ctx.a);
    h.index('x', ctx.a);
    h.load(h.read(ACTOR_TABLE + ctx.x));
    h.load(ctx.a & ACTOR_DEPTH_BITS);
    h.xba();
    h.asl();
    h.adc(0);
    h.write(h.abs(OBJECT_DEPTH_ORDER) + ctx.y, ctx.a);
    h.load(h.read(ACTOR_TABLE + ACTOR_RECORD + ctx.x));
    h.write(h.abs(OBJECT_RECORD) + ctx.y, ctx.a);
    h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
    h.index('x', RUNNER_LAST_INDEX + 2);
    do {
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
      h.cmp(h.read(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    } while (!(ctx.status & FLAG_ZERO));
    // Four bytes of runner armour per runner.
    h.load(ctx.x);
    h.asl();
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(WRAM + RUNNER_ARMOUR_RATING + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    h.index('x', ctx.y);
    h.write(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
    h.pla();
    h.cmp(JAKE_KIND);
    if (ctx.status & FLAG_ZERO) {
      h.load(h.read(WRAM + JAKE_DERMAL_ARMOUR));
      h.load(ctx.a & BYTE_MASK);
      if (!(ctx.status & FLAG_ZERO)) {
        ctx.status &= ~FLAG_CARRY;
        h.load(h.read(WRAM + OBJECT_ARMOUR + ctx.x));
        h.adc(DERMAL_ARMOUR_BONUS);
        h.write(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
      }
    } else {
      h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
      h.load(ctx.a | OBJECT_CLASS_MASK);
      h.write(h.abs(OBJECT_FLAGS) + ctx.x, ctx.a);
    }
    h.index('x', h.dp(DP_MEMBER, 2));
    h.load(ctx.y);
    h.write(h.abs(GROUP_SLOTS) + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_NEGATIVE) return h.rts();
  }
}
// Original routine $80:A3B6 (lifted in src/game/room-actors.mjs; this register-level
// version serves the reference entry).
function runActorsPlace(h, e, r = TRANSITION_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r),
    input = () => h.read(h.indirect(DP_ROOM_HEADER, ctx.y)),
    next = () => {
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
    };
  h.index('y', ROOM_HEADER_ACTOR_COUNT);
  h.load(input());
  h.index('y', ctx.y + 1);
  h.load(ctx.a & BYTE_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_ACTORS_LEFT, ctx.a);
    do {
      h.load(input());
      h.load(ctx.a & ACTOR_COORDINATE_MASK);
      h.dpWrite(DP_OBJECT_X, ctx.a);
      h.load(input());
      h.load(ctx.a & ACTOR_FLAG_BITS);
      h.xba();
      h.lsr();
      h.lsr();
      h.lsr();
      h.dpWrite(DP_ACTOR_BITS, ctx.a);
      next();
      h.load(input());
      h.load(ctx.a & ACTOR_COORDINATE_MASK);
      h.dpWrite(DP_OBJECT_Y, ctx.a);
      h.load(input());
      h.load(ctx.a & ACTOR_FLAG_BITS);
      h.xba();
      h.asl();
      h.asl();
      h.testBits(DP_ACTOR_BITS, true, true);
      next();
      h.load(input());
      h.index('x', ctx.a);
      next();
      h.load(h.read(ACTOR_TABLE + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_ACTOR_FLAGS, ctx.a);
      h.load(ctx.a | h.read(WRAM + STORY_STAGE));
      let create = !(ctx.status & FLAG_ZERO);
      if (create) {
        h.load(h.read(ACTOR_TABLE + ACTOR_RECORD + ctx.x));
        h.dpWrite(DP_ACTOR_RECORD, ctx.a);
        if (!(ctx.status & FLAG_ZERO)) {
          h.phx();
          h.index('x', ctx.a);
          h.load(h.read(WRAM + STATE_HOLDER + ctx.x));
          h.plx();
          h.cmp(NONE);
          create = Boolean(ctx.status & FLAG_ZERO);
        }
        if (create) {
          h.load(h.read(ACTOR_TABLE + ACTOR_KIND + ctx.x));
          h.dpWrite(DP_OBJECT_KIND, ctx.a);
          h.load(h.read(ACTOR_TABLE + ACTOR_SCRIPT + ctx.x));
          h.dpWrite(DP_OBJECT_SCRIPT, ctx.a);
          h.phy();
          h.phx();
          call(0x80a423, 0x80a835);
          h.index('x', h.dp(DP_OBJECT_KIND, 2));
          h.pla();
          h.write(h.abs(OBJECT_NUMBER) + ctx.x, ctx.a);
          h.load(h.dp(DP_ACTOR_FLAGS));
          h.load(ctx.a & ACTOR_DEPTH_BITS);
          h.xba();
          h.asl();
          h.adc(0);
          h.write(h.abs(OBJECT_DEPTH_ORDER) + ctx.x, ctx.a);
          h.load(h.dp(DP_ACTOR_RECORD));
          h.write(h.abs(OBJECT_RECORD) + ctx.x, ctx.a);
          h.ply();
        }
      }
      h.modify(DP_ACTORS_LEFT, 'dec', true);
    } while (!(ctx.status & FLAG_ZERO));
  }
  h.load(ctx.y);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_ROOM_HEADER));
  h.dpWrite(DP_ROOM_LISTS, ctx.a);
  return h.rts();
}
// 80:A4BF for register-level callers: the lifted room entry with the room in A
// (src/game/room-entry.mjs; register-level reference in
// proof/game-reference/room-entry.mjs). The routines it still calls through their
// frames come from r.
export function enterRoom(h, e, r = TRANSITION_ROUTINES) {
  return drainNativeSequence(enterRoomRoutineSequence(h, e, r));
}
function* enterRoomRoutineSequence(h, e, r) {
  yield* enterRoomSequence(h, e, r, h.ctx.a & WORD_MASK);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

for (const [target, run, sequence] of [
  [0x80a4bf, enterRoom, enterRoomRoutineSequence],
  [0x818bd9, jumpCamera, jumpCameraSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events, routines = TRANSITION_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
NATIVE_CALL_CONTINUATIONS.set(0x81b0a1, {
  run: TALK_ROUTINES.get(0x81b0a1),
  create: ({ h, events }) =>
    events?.interrupts === undefined ? null : new ObservedWaitContinuation(h, events, 0x81b0a1),
});
export const TRANSITION_ROUTINES = new Map([
  ...SCENE_GRAPHICS_ROUTINES,
  ...[0x80bcb2, 0x80ff79, 0x81b0a1, 0x81ef47].map((t) => [t, TALK_ROUTINES.get(t)]),
  [0x80a4bf, enterRoom],
  [0x80a44d, setRoomBanks],
  [0x81b0ac, setBrightnessFadeSpeed],
  [0x81b0bd, forceBlank],
  [0x81ef94, runMusicStop],
  [0x818861, resetFixedColour],
  [0x818d05, requestScenePaletteUpload],
  [0x808511, runFightListReset],
  [0x80babb, resetFormationTrail],
  [0x818954, uploadMapEdgesAndScroll],
  [0x818bd9, jumpCamera],
  [0x80a464, placeCameraAtStart],
  [0x80a2fa, createGroupMembers],
  [0x80a3b6, runActorsPlace],
  [0x80a835, (h) => createObject(h.a, false)],
  [0x80aaaf, (h) => setObjectDirection(h.a, false)],
  [0x81ad92, drawWindowListAdapter],
  [0x81f007, (h) => sendApuCommand(h.a, false)],
  [0x818a05, clampToCameraBox],
  [0x818a91, updateCameraTileBuffers],
]);
