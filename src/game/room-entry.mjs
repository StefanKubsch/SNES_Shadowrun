// The room entry (lifted from 80:A4BF with 80:A44D, 81:B0AC, 81:B0BD, 80:A464,
// 81:8D05, 80:8511 and 80:BABB; register-level reference in
// proof/game-reference/room-entry.mjs). The group 80:A2FA and the actors 80:A3B6
// are lifted in room-actors.mjs, the camera box clamp 81:8A05 in camera-box.mjs.
//
// A room is entered from the room table 8D:929D (src/data/rooms.mjs): its header
// gives the scene, the music, the camera box and the actors, its entry the start
// direction and position. The entry fades out, puts the glove away, resets the
// task scheduler, stops the music unless the room keeps it, loads the scene,
// blanks the screen and waits for the frame, resets the fixed colour, the notice
// windows and the object slots, creates the group and the room's actors, places the
// camera at the start, uploads the scene tiles and palette, scrolls the camera in,
// starts the music, builds the collision grid, resets the fight list, finds the
// room's lists, resets the formation trail, draws the windows and fades in.
//
// The glove 80:BCB2 and the notice windows 80:FF79 are lifted in window-release.mjs.
//
// The frame wait 81:B0A1 is lifted in src/system/frame-wait.mjs for the lag-free
// frame model; with recorded interrupts it runs register-level through its frame.
//
// The scene load 81:A117, the scene tiles 81:9AE6 and the collision grid 81:8756 are
// lifted in scene-load.mjs, scene-tiles.mjs and collision-grid.mjs, with the
// unpackers 80:9F69 and 80:9E7E of src/system/unpack.mjs, the camera jump 81:8BD9 here
// with the tile buffers 81:8A91 and map edges 81:8954 of camera-scroll.mjs, the
// window list 81:AD92 in window-list.mjs; the Mesen cold boot replay calls their
// register-level versions. They read the direct page words the entry writes, as in
// the original (the caller's direct page is 0).
//
// The music stop 81:EF94 and the music change 81:EF47 (src/apu/music-mode.mjs) are
// lifted for the lag-free frame model, which delivers no NMI in their sound driver
// handshakes. A recorded game run can deliver one there, which only the
// register-level versions replay, so with recorded interrupt observations they run
// through their frames (docs/AUDIO-ROUTINES-LIFT.md keeps EF47 in the table for this
// caller).
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setMusicMode } from '../apu/music-mode.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import { resetObjectSlots, resetTaskScheduler } from './game-screen.mjs';
import { resetFixedColour } from './fixed-colour.mjs';
import { createGroupSequence, placeRoomActorsSequence } from './room-actors.mjs';
import { clampToCameraBox } from './camera-box.mjs';
import { buildCollisionGrid } from './collision-grid.mjs';
import { uploadSceneTilesSequence } from './scene-tiles.mjs';
import { updateTileBuffers, uploadMapEdges } from './camera-scroll.mjs';
import { loadSceneSequence } from './scene-load.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import { putGloveAwayCall, releaseNoticeWindowsCall } from './window-release.mjs';
import {
  BRIGHTNESS_FADE,
  BRIGHTNESS_FADE_FRAMES,
  CAMERA_BOX,
  CAMERA_BOX_BANK,
  CAMERA_BOX_HIGH,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_X_MAX,
  CAMERA_Y,
  CAMERA_Y_MAX,
  DIALOG_WINDOW,
  EMPTY_LIST,
  FIGHT_FIRST_REMOVAL,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  FIGHT_UNREAD,
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_LAST,
  FORMATION_X,
  FORMATION_Y,
  GAME_OPTIONS,
  HARMLESS_HITS,
  INIDISP_SHADOW,
  MAP_UPLOAD_HELD,
  MUSIC,
  OPTION_MUSIC_RESTORE,
  ROOM,
  SCENE_PALETTE_UPLOAD,
} from '../task/wram.mjs';
import {
  ROOM_BANK,
  ROOM_ENTRY_DIRECTION,
  ROOM_ENTRY_POSITION,
  ROOM_HEADER_CAMERA,
  ROOM_HEADER_MUSIC,
  ROOM_TABLE,
} from '../data/rooms.mjs';
import { INIDISP_FORCED_BLANK } from '../constants/ppu.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const NONE = WORD_MASK,
  LONG_MASK = 0xffffff;
// Direct page of the room entry: the header pointer (bank DP88), the script list
// (bank DP9F), the room lists after the actors (bank DP9C), the point list (bank
// DPF5, first the exit list) and the sight list (bank DPFE); all lie in the header's
// bank.
const DP_ROOM_HEADER = 0x86,
  DP_ROOM_HEADER_BANK = 0x88,
  DP_ROOM_LISTS_BANK = 0x9c,
  DP_SCRIPT_LIST = 0x9d,
  DP_SCRIPT_LIST_BANK = 0x9f,
  DP_POINT_LIST = 0xf3,
  DP_POINT_LIST_BANK = 0xf5,
  DP_SIGHT_LIST = 0xfc,
  DP_SIGHT_LIST_BANK = 0xfe;
// The start direction and position for the group, and the camera position handed
// to the camera box clamp (its Y word shares the direction's word).
const DP_START_DIRECTION = 0x11,
  DP_START_X = 0x14,
  DP_START_Y = 0x17,
  DP_START_Z = 0x1a,
  DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11;
// A room table entry is nine bytes; the original forms room * 9 as room * 8 + room
// with the carry of the last shift (bit 13 of the room).
const ENTRY_SHIFT = 3,
  ENTRY_CARRY_BIT = 13;
// Brightness fades of 81:B0AC: speed -2 (out) and +2 (in); a step every |speed| + 8
// frames.
const FADE_OUT = 0xfffe,
  FADE_IN = 2,
  FADE_FRAMES_BASE = 8;
// The room's music byte FF: none (the music before a fight comes back instead).
const NO_ROOM_MUSIC = BYTE_MASK;
// 80:A464: the camera starts at ((0488 - x - y) / 2) * 4 and (0100 + y - x) * 4, its
// Y raised by 0100 minus four times the start height.
const CAMERA_ROW_BASE = 0x488,
  CAMERA_COLUMN_BASE = 0x100,
  CAMERA_HEIGHT_BASE = 0x100,
  CAMERA_SHIFT = 2;
// The room lists after the script list: boxes with a data word (14 bytes) and points
// (6 bytes); a list is skipped as its count byte plus count * (2 << shifts) - count * 2.
const BOX_DATA_SHIFTS = 3,
  POINT_SHIFTS = 2;
// Original call sites of the routines still called through their frames.
const GLOVE_SITE = 0x80a4e1,
  SCENE_LOAD_SITE = 0x80a518,
  FRAME_WAIT_SITE = 0x80a520,
  NOTICE_WINDOWS_SITE = 0x80a528,
  SCENE_TILES_SITE = 0x80a554,
  CAMERA_JUMP_SITE = 0x80a55c,
  // A JSL pushes the address of its last byte.
  JSL_LAST_BYTE = 3,
  COLLISION_GRID_SITE = 0x80a584,
  WINDOW_LIST_SITE = 0x80a5c9,
  MUSIC_STOP_SITE = 0x80a506,
  MUSIC_MODE_SITE = 0x80a580,
  // The return words of the JSRs to the group 80:A2FA and the actors 80:A3B6.
  GROUP_RETURN = 0xa54d,
  ACTORS_RETURN = 0xa550;
const LOAD_SCENE = 0x81a117,
  WAIT_FOR_FRAME = 0x81b0a1,
  UPLOAD_SCENE_TILES = 0x819ae6,
  JUMP_CAMERA = 0x818bd9,
  BUILD_COLLISION_GRID = 0x818756,
  STOP_MUSIC = 0x81ef94,
  SET_MUSIC_MODE = 0x81ef47;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// The long pointer in direct page word at with its bank byte two bytes on.
const longPointer = (wram, at) => (wram[at + 2] << WORD_BITS) | word(wram, at);

// The header's bank (80:A44D): bit 15 of the header word selects the second room
// bank; the header, the camera box and the room lists all lie in it.
function setRoomBanks(wram, header) {
  const bank = ROOM_BANK + (header >>> (WORD_BITS - 1));
  for (const at of [
    DP_ROOM_HEADER_BANK,
    CAMERA_BOX_BANK,
    DP_SCRIPT_LIST_BANK,
    DP_ROOM_LISTS_BANK,
    DP_POINT_LIST_BANK,
    DP_SIGHT_LIST_BANK,
  ])
    wram[at] = bank;
}
// Start a brightness fade at speed (negative: out) (81:B0AC).
function startBrightnessFade(wram, speed) {
  setWord(wram, BRIGHTNESS_FADE, speed);
  const frames = speed & WORD_SIGN ? -speed & WORD_MASK : speed;
  setWord(wram, BRIGHTNESS_FADE_FRAMES, frames + FADE_FRAMES_BASE);
}
// Stop the fade and blank the screen (81:B0BD).
export function forceBlank(wram) {
  setWord(wram, BRIGHTNESS_FADE, 0);
  setWord(wram, INIDISP_SHADOW, INIDISP_FORCED_BLANK);
}
// No fighters, no removal, nothing unread, no harmless hits (80:8511).
function resetFightList(wram) {
  setWord(wram, FIGHT_LIST_INDEX, EMPTY_LIST);
  for (const at of [FIGHT_FIRST_REMOVAL, FIGHT_UNREAD, HARMLESS_HITS]) setWord(wram, at, 0);
}
// The formation trail of the player figure cleared (80:BABB): only the first X and Y
// words, all height words.
function resetFormationTrail(wram) {
  setWord(wram, FORMATION_INDEX, 0);
  setWord(wram, FORMATION_X, 0);
  setWord(wram, FORMATION_Y, 0);
  for (let x = FORMATION_LAST; x >= 0; x -= 2) setWord(wram, FORMATION_HEIGHT + x, 0);
}
// The word at offset of the room header, read through its direct page pointer.
const headerWord = (mem, wram, offset) => readWord(mem, longPointer(wram, DP_ROOM_HEADER) + offset);
// The music byte of the room header, or with FF the music before the fight.
function roomMusic(mem, wram) {
  const music = headerWord(mem, wram, ROOM_HEADER_MUSIC) & BYTE_MASK;
  return music === NO_ROOM_MUSIC ? word(wram, FIGHT_MUSIC) : music;
}
// Keep the music only when the option allows it, no fight runs and the room has the
// same music or none.
function keepsMusic(mem, wram) {
  if (!(word(wram, GAME_OPTIONS) & OPTION_MUSIC_RESTORE)) return false;
  if (!(word(wram, FIGHT_LIST_INDEX) & WORD_SIGN)) return false;
  const music = headerWord(mem, wram, ROOM_HEADER_MUSIC) & BYTE_MASK;
  return music === NO_ROOM_MUSIC || music === word(wram, MUSIC);
}
// The room lists after the script list: the exit list and the point list follow the
// boxes, the sight list follows the points.
function findRoomLists(mem, wram) {
  for (const [from, shifts, to] of [
    [DP_SCRIPT_LIST, BOX_DATA_SHIFTS, DP_POINT_LIST],
    [DP_POINT_LIST, BOX_DATA_SHIFTS, DP_POINT_LIST],
    [DP_POINT_LIST, POINT_SHIFTS, DP_SIGHT_LIST],
  ]) {
    const twice = (mem.read8(longPointer(wram, from)) << 1) & WORD_MASK,
      bytes = ((twice << shifts) - twice) & WORD_MASK;
    setWord(wram, to, word(wram, from) + bytes + 1);
  }
}
// The camera at the start position (80:A464), clamped by the camera box (81:8A05)
// and the camera limits.
function placeCameraAtStart(mem, wram) {
  const x = word(wram, DP_START_X),
    y = word(wram, DP_START_Y),
    // SEC, SBC x, SBC y: a borrow of the first subtraction takes one more.
    first = CAMERA_ROW_BASE - x,
    row = (first - y - (first < 0 ? 1 : 0)) & WORD_MASK,
    cameraY = ((row >>> 1) << CAMERA_SHIFT) & WORD_MASK,
    cameraX = ((CAMERA_COLUMN_BASE + y - x) << CAMERA_SHIFT) & WORD_MASK;
  setWord(wram, CAMERA_Y, cameraY);
  setWord(wram, CAMERA_X, cameraX);
  setWord(wram, DP_CAMERA_X, cameraX);
  setWord(wram, DP_CAMERA_Y, cameraY);
  clampToCameraBox(mem, wram);
  const height = (word(wram, DP_START_Z) << CAMERA_SHIFT) & WORD_MASK;
  setWord(wram, DP_START_Z, height);
  setWord(
    wram,
    DP_CAMERA_Y,
    (((word(wram, DP_CAMERA_Y) + CAMERA_HEIGHT_BASE) & WORD_MASK) - height) & WORD_MASK,
  );
  for (const [dp, at, max] of [
    [DP_CAMERA_X, CAMERA_X, CAMERA_X_MAX],
    [DP_CAMERA_Y, CAMERA_Y, CAMERA_Y_MAX],
  ]) {
    const value = word(wram, dp);
    setWord(wram, at, value & WORD_SIGN ? 0 : Math.min(value, max));
  }
}

// The frame wait 81:B0A1, called with a JSL from site. With the lag-free frame model
// the lifted wait runs below the original's JSL frame in bank 81, so the NMI finds
// the same stack and registers; recorded interrupt observations keep the
// register-level wait.
const WAIT_BANK = 0x81;
export function* waitForFrameCall(h, events, call, site) {
  if (!lagFree(events)) {
    yield* call(site, WAIT_FOR_FRAME, true);
    return;
  }
  const { ctx, a } = h;
  let callerBank;
  yield () => {
    callerBank = ctx.programBank;
    a.write(ctx.s, callerBank);
    ctx.s = (ctx.s - 1) & WORD_MASK;
    a.pushWord((site + JSL_LAST_BYTE) & WORD_MASK);
    ctx.programBank = WAIT_BANK;
  };
  yield* waitForCounterWord(h, events);
  yield () => {
    a.pullWord();
    ctx.s = (ctx.s + 1) & WORD_MASK;
    ctx.programBank = callerBank;
  };
}

// 81:8BD9: the camera jumps by 0400 in x (back when it is at 0400 or more), then
// scrolls there in 32 steps of 20 with the camera box off and the map uploads held
// back once more; each step fills the tile buffers (81:8A91) and sends the map edges
// and the scroll (81:8954), both lifted in camera-scroll.mjs. The jump runs in bank 81 below
// its JSL frame, with the camera box word and the step count on the stack.
const CAMERA_JUMP = 0x400,
  CAMERA_JUMP_STEP = 0x20,
  CAMERA_JUMP_STEPS = 0x20,
  JUMP_BANK = 0x81,
  JUMP_WAIT_SITE = 0x818bdd;
function* jumpCameraSequence(h, events, call) {
  const { ctx, a } = h,
    { wram, video } = sceneRuntime(h),
    callerBank = ctx.programBank;
  yield () => {
    a.write(ctx.s, callerBank);
    ctx.s = (ctx.s - 1) & WORD_MASK;
    a.pushWord((CAMERA_JUMP_SITE + JSL_LAST_BYTE) & WORD_MASK);
    ctx.programBank = JUMP_BANK;
    forceBlank(wram);
  };
  yield* waitForFrameCall(h, events, call, JUMP_WAIT_SITE);
  yield () => {
    setWord(wram, MAP_UPLOAD_HELD, word(wram, MAP_UPLOAD_HELD) - 1);
    a.pushWord(word(wram, CAMERA_BOX_HIGH));
    setWord(wram, CAMERA_BOX_HIGH, 0);
    setWord(wram, CAMERA_SPEED_Y, 0);
    const x = word(wram, CAMERA_X),
      back = x >= CAMERA_JUMP;
    setWord(wram, CAMERA_X, back ? x - CAMERA_JUMP : x + CAMERA_JUMP);
    setWord(wram, CAMERA_SPEED_X, back ? CAMERA_JUMP_STEP : -CAMERA_JUMP_STEP);
  };
  for (let step = CAMERA_JUMP_STEPS; step > 0; step--) {
    yield () => {
      a.pushWord(step);
      updateTileBuffers(wram);
      uploadMapEdges(wram, video);
      a.pullWord();
    };
  }
  yield () => {
    setWord(wram, CAMERA_SPEED_X, 0);
    setWord(wram, CAMERA_BOX_HIGH, a.pullWord());
    setWord(wram, MAP_UPLOAD_HELD, word(wram, MAP_UPLOAD_HELD) + 1);
    a.pullWord();
    ctx.s = (ctx.s + 1) & WORD_MASK;
    ctx.programBank = callerBank;
  };
}

// The music stop (81:EF94): no music, the volume target 0.
function stopMusic(m) {
  setWord(m.wram, MUSIC, NONE);
  m.sound(APU_COMMAND_VOLUME_TARGET, 0);
}

// Enter room (80:A4BF), a sequence for a native call continuation: h is the accessor
// of the caller, events its frame events, routines the table of the routines still
// called through their frames.
export function* enterRoomSequence(h, events, routines, room) {
  const { ctx } = h,
    m = sceneRuntime(h),
    { mem, wram, video } = m,
    call = (site, target, long = false) =>
      nativeCallSequence(h, events, routines, site, target, long);
  let entry;
  yield () => {
    setWord(wram, ROOM, room);
    entry = ((room << ENTRY_SHIFT) + room + ((room >>> ENTRY_CARRY_BIT) & 1)) & WORD_MASK;
    const header = readWord(mem, ROOM_TABLE + entry);
    setRoomBanks(wram, header);
    setWord(wram, DP_ROOM_HEADER, header | LOROM_OFFSET);
    startBrightnessFade(wram, FADE_OUT);
    // The original keeps the table offset in X and on the stack (PHX) up to the
    // object slots; the callees in between run below it.
    ctx.x = entry;
    h.a.pushWord(entry);
  };
  yield* putGloveAwayCall(h, events, GLOVE_SITE);
  yield () => resetTaskScheduler(wram);
  // Without lag-free frames the music routines run register-level through their frames.
  const liftedMusic = Boolean(lagFree(events));
  if (!keepsMusic(mem, wram))
    if (liftedMusic) yield () => stopMusic(m);
    else yield* call(MUSIC_STOP_SITE, STOP_MUSIC, true);
  // The Mesen cold boot replay records interrupts inside the scene load, the scene
  // tiles, the camera jump and the collision grid, which only their register-level
  // versions replay.
  const replay = Boolean(events?.startupInterrupts);
  let scene;
  yield () => {
    setWord(wram, CAMERA_BOX, headerWord(mem, wram, ROOM_HEADER_CAMERA) - 1);
    scene = headerWord(mem, wram, 0) & BYTE_MASK;
    ctx.a = scene;
  };
  if (replay) yield* call(SCENE_LOAD_SITE, LOAD_SCENE, true);
  else yield* loadSceneSequence(h, scene, SCENE_LOAD_SITE);
  yield () => forceBlank(wram);
  yield* waitForFrameCall(h, events, call, FRAME_WAIT_SITE);
  yield () => resetFixedColour(m);
  yield* releaseNoticeWindowsCall(h, events, NOTICE_WINDOWS_SITE);
  yield () => {
    resetObjectSlots(wram, video);
    ctx.x = h.a.pullWord();
    setWord(wram, DP_START_DIRECTION, mem.read8(ROOM_TABLE + ROOM_ENTRY_DIRECTION + entry));
    [DP_START_X, DP_START_Y, DP_START_Z].forEach((at, n) =>
      setWord(wram, at, readWord(mem, ROOM_TABLE + ROOM_ENTRY_POSITION + 2 * n + entry)),
    );
  };
  // The group and the actors call the object creation (object-create.mjs) and the
  // group the turn (object-turn.mjs) below the return words of the original JSRs.
  for (const [returnWord, sequence] of [
    [GROUP_RETURN, createGroupSequence],
    [ACTORS_RETURN, placeRoomActorsSequence],
  ]) {
    yield () => h.a.pushWord(returnWord);
    yield* sequence(h);
    yield () => h.a.pullWord();
  }
  yield () => placeCameraAtStart(mem, wram);
  if (replay) yield* call(SCENE_TILES_SITE, UPLOAD_SCENE_TILES, true);
  else yield* uploadSceneTilesSequence(h);
  yield () => setWord(wram, SCENE_PALETTE_UPLOAD, word(wram, SCENE_PALETTE_UPLOAD) + 1);
  if (replay) yield* call(CAMERA_JUMP_SITE, JUMP_CAMERA, true);
  else yield* jumpCameraSequence(h, events, call);
  // Without the option the music mode 0 starts; with it the room's music, only when
  // none plays.
  const restore = word(wram, GAME_OPTIONS) & OPTION_MUSIC_RESTORE;
  if (!restore || word(wram, MUSIC) === NONE) {
    const mode = () => (restore ? roomMusic(mem, wram) : 0);
    if (liftedMusic) yield () => setMusicMode(mem, m.port, mode());
    else {
      yield () => {
        ctx.a = mode();
      };
      yield* call(MUSIC_MODE_SITE, SET_MUSIC_MODE, true);
    }
  }
  if (replay) yield* call(COLLISION_GRID_SITE, BUILD_COLLISION_GRID, true);
  else yield () => buildCollisionGrid(mem, wram);
  yield () => {
    resetFightList(wram);
    findRoomLists(mem, wram);
    resetFormationTrail(wram);
    setWord(wram, DIALOG_WINDOW, 0);
  };
  yield* drawWindowListSequence(h, events, WINDOW_LIST_SITE);
  yield () => {
    setWord(wram, DIALOG_WINDOW, NONE);
    startBrightnessFade(wram, FADE_IN);
  };
}
