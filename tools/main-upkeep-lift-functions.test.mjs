// Random per-function tests of the main loop's lifted upkeep (src/game/main-upkeep.mjs)
// against the register-level references (proof/game-reference/main-upkeep.mjs and
// main-camera.mjs), docs/MAIN-LOOP-LIFT.md: the colour effect 81:8877, the palette
// cycles 81:8076, the hit shake 80:DE94, the camera follow 81:8C2E, the tile buffers
// 81:8A91, the formation step 80:BAD5, the notice time limits 80:FF14 and the time
// limit 80:E270 and the glove action 80:BF3B (proof/game-reference/main-timer.mjs and
// main-glove-action.mjs), the notice 80:FEC1 and the glove release 80:BCB2
// (src/task/native-notice.mjs and native-dialog-portrait.mjs), the text cursor 80:FAAC
// and the number 80:FD80 (native-list-prerequisites.mjs), the text 80:FE69
// and the text buffer 80:FB39 (native-text-compose.mjs), the window opening 80:F963
// (native-window-open.mjs), the action menu 80:99EB (native-actions.mjs) and the dialog
// 80:936C with its close 80:92C5 and its callees 81:886A, 80:FA92 and 80:FF79
// (native-dialog.mjs), the dialog's main menu 80:91E2 and topic choice 80:9215
// and the dialog text 80:9178 with its topic add 80:908C (native-dialog-text.mjs), the
// portrait window 80:8F3A and 80:8F97, the portrait rows 80:8F20, uploads 80:9022 and
// 80:905E, their DMA job 80:8FF5 and unpacker 80:9F6D, the menu list's mark 80:A5F9 and
// its removal 80:A5DB and the list drawing 80:A617 (native-list-prerequisites.mjs) and the
// menu choice 80:A6A5 to 80:A6C7 (native-menu-compose.mjs) (native-dialog-portrait.mjs) and the object tiles
// 80:ADF4 with 80:AE12 (native-scene-tiles.mjs). Both sides
// run from the same caller frame with the main loop's data bank 80 and must leave the
// same WRAM, the same PPU writes and the same X and Y, which a later wait's NMI saves
// (tools/lift-function-harness.mjs).
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { uploadEvents, windowMapSource, windowTables } from './lift-window-samples.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../src/task/main-loop-upkeep.mjs';
import { MAIN_CAMERA_REFERENCE_ENTRIES } from '../proof/game-reference/main-camera.mjs';
import { MAIN_UPKEEP_REFERENCE_ENTRIES } from '../proof/game-reference/main-upkeep.mjs';
import { MAIN_TIMER_REFERENCE_ENTRIES } from '../proof/game-reference/main-timer.mjs';
import { MAIN_GLOVE_ACTION_REFERENCE_ENTRIES } from '../proof/game-reference/main-glove-action.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../src/vm/layout.mjs';
import {
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runTileBuffers,
  runHitShake,
  runNoticeTimeouts,
  runPaletteCycles,
  runTimeLimit,
  runGloveAction,
  runGloveMove,
  runPutGloveAway,
  runShowNotice,
  runPrintNumber,
  runPrintText,
  runDrawTextBuffer,
  runOpenWindow,
  runChooseAction,
  runReleaseNoticeWindows,
  runObjectMotion,
  runPortraitTiles,
} from '../src/game/main-upkeep.mjs';
import { MAIN_MOTION_ROUTINES, moveAndAnimateObjects } from '../src/task/main-loop-motion.mjs';
import { bcbeSequence, moveGlove } from '../src/task/native-glove.mjs';
import { objectSearchSequence } from '../src/game/object-search.mjs';
import { stepAnimation } from '../src/game/object-animation.mjs';
import { stepObjectAnimation } from '../src/task/native-scene-tiles.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';
import { GLOVE_ROUTINES } from '../src/task/native-glove-target-support.mjs';
import { showNotice } from '../src/task/native-notice.mjs';
import { drawTextBuffer, printText } from '../src/task/native-text-compose.mjs';
import { openWindowAdapter } from '../src/task/native-window-open.mjs';
import { chooseAction } from '../src/task/native-actions.mjs';
import { talkWithObject, TALK_ROUTINES } from '../src/task/native-dialog.mjs';
import {
  chooseDialogAction,
  chooseDialogTopic,
  showDialogText,
} from '../src/task/native-dialog-text.mjs';
import { showDialogTextSequence } from '../src/game/dialog-text.mjs';
import {
  openPortraitWindowSequence,
  closePortraitWindowSequence,
} from '../src/game/portrait-window.mjs';
import {
  shiftPortraitRowsRoutine,
  unpackPortraitRoutine,
  uploadFirstPortraitSequence,
  uploadSecondPortraitSequence,
  uploadPortraitTilesSequence,
} from '../src/game/portrait-upload.mjs';
import { reloadObjectTilesSequence } from '../src/game/object-tiles.mjs';
import { chooseFromMenuSequence } from '../src/game/menu-choice.mjs';
import { menuComposeSequence } from '../src/task/native-menu-compose.mjs';
import { portraitStreams } from '../src/data/portraits.mjs';
import { uploadPortraitTiles } from '../src/task/native-dialog-portrait.mjs';
import {
  chooseDialogActionSequence,
  chooseDialogTopicSequence,
} from '../src/game/dialog-menus.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import {
  talkSequence,
  clearFixedColourRoutine,
  setWindowTextWidthRoutine,
} from '../src/game/dialog-talk.mjs';
import {
  printNumber,
  runTaskListHelper,
  setTextCursor,
} from '../src/task/native-list-prerequisites.mjs';
import { MARK, UNMARK, drawListSequence, markRowSequence } from '../src/game/menu-list.mjs';
import { setTextCursorRoutine } from '../src/game/window-text.mjs';
import {
  CAMERA_BOX,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_Y,
  COLOUR_PHASE,
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_X,
  FORMATION_Y,
  OBJECT_DIAGONAL,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  COLOUR_REQUEST,
  NOTICE_EFFECT_FRAMES,
  NOTICE_FRAMES,
  DP_NOTICE_FRAMES,
  DP_CURSOR_ROW,
  TEXT_BUFFER,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  WINDOW_LEFT_PIXEL,
  WINDOW_STYLE,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  ACTION_MENU_OVERRIDE,
  DIALOG_END,
  TOPIC_LIST,
  TOPIC_FLAGS,
  GAME_OPTIONS,
  MUSIC,
  JAKE_ALTERNATE_PORTRAIT,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  NOTICE_WINDOWS,
  PALETTE_COUNT,
  PALETTE_DIRECTION,
  PALETTE_INDEX,
  PALETTE_PROGRESS,
  PALETTE_STEP,
  PALETTE_TABLE,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
  TIMER,
  TIMER_FRAMES,
  AIMING_SPELL,
  AIMING_WEAPON,
  GLOVE_BASE_X,
  GLOVE_BASE_Y,
  GLOVE_SNAP_X,
  GLOVE_SNAP_Y,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_KIND,
  OBJECT_NUMBER,
  SCRIPT_GLOVE_CHOICE,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_DIALOG,
  OBJECT_TASK,
  PAD_PRESSED,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  GLOVE_KIND,
  GLOVE_SPEED_X,
  GLOVE_SPEED_Y,
  GLOVE_X,
  GLOVE_Y,
  PAD_HELD,
  MOTION_ACTIVE,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_FLAGS,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  STATIC_NODE_END,
} from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  OBJECT_SLOTS = 0x2c,
  // The game's main stack; the window list's upload wait frames lie below 1EE2.
  GAME_STACK = 0x1ef0,
  // The game's sound directory pointer (98:FFFA), which the sample loader follows.
  SOUND_DIRECTORY = [0, 1, 2].map((n) =>
    new DialogTestMemory(new Uint8Array(WRAM_BYTES)).read8(0x98fffa + n),
  ),
  WINDOW_ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES));

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  wram.set(SOUND_DIRECTORY, 0x8c);
  windowMapSource(wram, WINDOW_ROM);
  windowTables(wram, rnd, pick);
  const put = (at, value) => {
    wram[at] = value & 0xff;
    wram[at + 1] = (value >>> 8) & 0xff;
  };
  return { seed, wram, rnd, pick, put };
}
// The reference calls its register-level callees (window release, random, sound).
const side = (s) =>
  createSide(
    s,
    new Map([
      ...MAIN_UPKEEP_ROUTINES,
      ...MAIN_UPKEEP_REFERENCE_ENTRIES,
      ...MAIN_CAMERA_REFERENCE_ENTRIES,
    ]),
  );
// The lifted side starts from the reference's registers and caller frame.
const lifted = (run, long, events) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = long ? 0x81 : 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, events?.());
  return registers(h);
};
const registers = (h) => [h.ctx.x, h.ctx.y].map((v) => v.toString(16)).join();
// The glove action's A and N, V, Z and C reach the scheduler round 80:C1E3 that follows
// it; the time limit's carry and overflow outlive the main loop's own loads.
const roundRegisters = (h) =>
  [h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & 0xc3].map((v) => v.toString(16)).join();
const carryRegisters = (h) =>
  [h.ctx.x, h.ctx.y, h.ctx.status & 0x41].map((v) => v.toString(16)).join();

const CASES = [
  {
    name: 'colour effect 81:8877',
    entry: 0x818877,
    long: true,
    samples: 600,
    prepare: (s) => {
      // Each request bit alone and together, the reset with any bits, and any word;
      // phases just before the fast ramp's end, at its wrap and anywhere.
      s.put(COLOUR_REQUEST, s.pick([0, 1, 2, 4, 3, 6, 8, 0x8000, 0x8007, 0xffff, s.rnd(0x10000)]));
      s.put(COLOUR_PHASE, s.pick([0x100, 0x140, 0x170, 0x180, 0x1f0, 0x1ff, s.rnd(0x10000)]));
      return { bank: 0x80, s: GAME_STACK };
    },
    result: registers,
    lifted: lifted(runColourEffect, true),
  },
  {
    name: 'palette cycles 81:8076',
    entry: 0x818076,
    long: true,
    samples: 600,
    prepare: (s) => {
      for (const x of [0, 2]) {
        s.put(PALETTE_STEP + x, s.pick([0, 1, 0x10, 0x40, 0x80, 0xff80, s.rnd(0x10000)]));
        s.put(PALETTE_PROGRESS + x, s.pick([0, 0x3f, 0x70, 0x7f, s.rnd(0x10000)]));
        s.put(PALETTE_DIRECTION + x, s.pick([0, 0x8000, s.rnd(0x10000)]));
        const count = s.pick([1, 2, 8, 16, s.rnd(0x10000)]);
        s.put(PALETTE_COUNT + x, count);
        s.put(PALETTE_INDEX + x, s.pick([0, count - 1, count, 0x8000, s.rnd(0x10000)]));
        s.put(PALETTE_TABLE + x, s.rnd(0x10000));
      }
      return { bank: 0x80, s: GAME_STACK };
    },
    result: registers,
    lifted: lifted(runPaletteCycles, true),
  },
  {
    name: 'hit shake 80:DE94',
    entry: 0x80de94,
    samples: 400,
    prepare: (s) => {
      s.put(PLAYER_OBJECT, s.pick([2 * s.rnd(OBJECT_SLOTS), 2 * s.rnd(OBJECT_SLOTS), 0xffff]));
      s.put(PLAYER_HIT_FRAMES, s.pick([0, 1, 2, 3, 0x10, 0x11, 0x8000, 0xffff, s.rnd(0x10000)]));
      return { bank: 0x80, s: GAME_STACK };
    },
    result: registers,
    lifted: lifted(runHitShake, false),
  },
];

// The player figure in a game slot (or none), at positions around the camera.
function playerFigure(s) {
  const slot = s.pick([2 * s.rnd(OBJECT_SLOTS), 2 * s.rnd(OBJECT_SLOTS), 0xffff]);
  s.put(PLAYER_OBJECT, slot);
  if (slot & 0x8000) return slot;
  const x = s.pick([0x400 + s.rnd(0x800), s.rnd(0x10000)]),
    y = s.pick([0x400 + s.rnd(0x800), s.rnd(0x10000)]);
  s.put(OBJECT_X + slot, x);
  s.put(OBJECT_Y + slot, y);
  s.put(OBJECT_DIAGONAL + slot, s.pick([(x + y) >>> 1, s.rnd(0x10000)]));
  s.put(OBJECT_HEIGHT + slot, s.pick([0, 0x100, s.rnd(0x400), s.rnd(0x10000)]));
  return slot;
}
CASES.push(
  {
    name: 'camera follow 81:8C2E',
    entry: 0x818c2e,
    long: true,
    samples: 600,
    prepare: (s) => {
      playerFigure(s);
      // The camera box: none, a box in bank 7F (any limits, or none at its first
      // word), or any pointer.
      const box = 0x18000 + s.rnd(0x1000);
      if (s.rnd(2)) s.put(box + 1, 0xffff);
      s.wram[CAMERA_BOX] = box & 0xff;
      s.put(CAMERA_BOX + 1, s.pick([0, 0x7f00 | ((box >>> 8) & 0xff), s.rnd(0x10000)]));
      s.put(CAMERA_X, s.pick([s.rnd(0x801), s.rnd(0x10000)]));
      s.put(CAMERA_Y, s.pick([s.rnd(0x47d), s.rnd(0x10000)]));
      // Often near the aim (as without a box), where the dead zone, the quarter and the
      // height count.
      const slot = s.wram[PLAYER_OBJECT] | (s.wram[PLAYER_OBJECT + 1] << 8),
        get = (t) => s.wram[t + slot] | (s.wram[t + slot + 1] << 8),
        near = () => s.rnd(0x100) - 0x80;
      if (!(slot & 0x8000) && s.rnd(2)) {
        s.put(CAMERA_X, 0x400 + get(OBJECT_Y) - get(OBJECT_X) + near());
        s.put(CAMERA_Y, 0x910 - get(OBJECT_DIAGONAL) + 0x100 - get(OBJECT_HEIGHT) + near());
      }
      return { bank: 0x80, s: GAME_STACK };
    },
    result: registers,
    lifted: lifted(runCameraFollow, true),
  },
  {
    name: 'tile buffers 81:8A91',
    entry: 0x818a91,
    long: true,
    samples: 300,
    prepare: (s) => {
      const speed = () => s.pick([0, 0, 4 * (s.rnd(0x11) - 8), 0x20, 0xffe0, s.rnd(0x10000)]);
      s.put(CAMERA_X, s.pick([s.rnd(0x801), s.pick([0, 0x800]), s.rnd(0x10000)]));
      s.put(CAMERA_Y, s.pick([s.rnd(0x47d), s.pick([0, 0x47c]), s.rnd(0x10000)]));
      s.put(CAMERA_SPEED_X, speed());
      s.put(CAMERA_SPEED_Y, speed());
      return { bank: 0x80, s: GAME_STACK };
    },
    result: registers,
    lifted: lifted(runTileBuffers, true),
  },
  {
    name: 'formation step 80:BAD5',
    entry: 0x80bad5,
    samples: 600,
    prepare: (s) => {
      const slot = playerFigure(s);
      s.put(PLAYER_HIT_FRAMES, s.pick([0, 0, 0, 1, s.rnd(0x10000)]));
      const index = s.pick([0, 2, 0x7e, 2 * s.rnd(0x40), s.rnd(0x10000)]);
      s.put(FORMATION_INDEX, index);
      // The newest step often equals the figure in some or all fields.
      const at = (t) => (t + slot) & 0xffff,
        same = s.rnd(4);
      if (same > 0)
        s.put(FORMATION_X + index, s.wram[at(OBJECT_X)] | (s.wram[at(OBJECT_X) + 1] << 8));
      if (same > 1)
        s.put(FORMATION_Y + index, s.wram[at(OBJECT_Y)] | (s.wram[at(OBJECT_Y) + 1] << 8));
      if (same > 2)
        s.put(
          FORMATION_HEIGHT + index,
          s.wram[at(OBJECT_HEIGHT)] | (s.wram[at(OBJECT_HEIGHT) + 1] << 8),
        );
      return { bank: 0x80, s: GAME_STACK, x: s.rnd(0x10000), y: s.rnd(0x10000) };
    },
    result: registers,
    lifted: lifted(runFormationStep, false),
  },
);

// The notice time limits: notices in some slots (often the window list's last
// window) with one frame left or more, and the effect frames running or not.
const NOTICE_TIMEOUT = {
  name: 'notice time limits 80:FF14',
  entry: 0x80ff14,
  samples: 300,
  prepare: (s) => {
    for (let x = 0; x < 8; x += 2) s.put(NOTICE_FRAMES + x, s.pick([1, 1, 2, 0, s.rnd(0x10000)]));
    s.put(NOTICE_EFFECT_FRAMES, s.pick([0, 0, 1, 2, 0x40, s.rnd(0x10000)]));
    // Mostly free slots apart from the ones windowTables uses.
    if (s.rnd(4) === 0) s.put(NOTICE_WINDOWS + 2 * s.rnd(4), 0xffff);
    return { bank: 0x80, s: GAME_STACK };
  },
  events: uploadEvents,
  result: registers,
  lifted: lifted(runNoticeTimeouts, false, uploadEvents),
};

// The time limit's and the glove action's register-level callees are replaced on both
// sides by the same stand-ins: each records the direct page words 00 to 0C, A, X, Y,
// the stack pointer and the word above its return address (the object slot the glove
// action pushes) as device writes, then leaves A, X, Y and the flags from random WRAM words;
// the number changes the hours, which the time limit reads again, and the action menu
// may end the object's task, which the glove action looks up again. The callees
// themselves wait for recorded uploads and input and are compared through their
// frames in tools/main-text-continuation.test.mjs and the live alley session.
const STAND_IN_RECORD = 0xf000,
  STAND_IN_SOURCE = 0x1000;
const standIn =
  (n, after = () => {}) =>
  (h) => {
    const { ctx } = h,
      { wram } = h.a.mem,
      word = (at) => wram[at] | (wram[at + 1] << 8),
      record = (value) => h.a.devices.write(0, STAND_IN_RECORD + n, value, 2);
    for (let at = 0; at <= 0x0c; at += 2) record(word(at));
    const y = ctx.y;
    [ctx.a, ctx.x, ctx.y, ctx.s, word(ctx.s + 3)].forEach(record);
    [ctx.a, ctx.x, ctx.y] = [0, 2, 4].map((o) => word(STAND_IN_SOURCE + 8 * n + o));
    // Sign, overflow, zero and carry as a callee leaves them (none reads them on entry).
    ctx.status = (ctx.status & ~0xc3) | (word(STAND_IN_SOURCE + 8 * n + 6) & 0xc3);
    after(wram, y);
    return h.rts();
  };
const TIME_LIMIT_CALLEES = new Map(
  [0x80fec1, 0x80faac, 0x80fd80, 0x80fe69].map((target, n) => [
    target,
    standIn(n, (wram) => {
      if (target !== 0x80fd80) return;
      wram[TIMER] = wram[STAND_IN_SOURCE + 6];
      wram[TIMER + 1] = wram[STAND_IN_SOURCE + 7] & 1;
    }),
  ]),
);
const GLOVE_ACTION_CALLEES = new Map(
  [0x80fec1, 0x80bcb2, 0x809e1a, 0x8099eb, 0x80936c].map((target, n) => [
    target,
    // The action menu may end the object's task (in half the samples here).
    standIn(n, (wram, object) => {
      if (target !== 0x8099eb || wram[STAND_IN_SOURCE + 0x30] & 1) return;
      wram[OBJECT_TASK + object] = 0xff;
      wram[OBJECT_TASK + object + 1] = 0xff;
    }),
  ]),
);
const timeLimitSide = (s) =>
  createSide(
    s,
    new Map([
      ...MAIN_TIMER_REFERENCE_ENTRIES,
      ...TIME_LIMIT_CALLEES,
      // The reference plays the warning sound through its frame.
      [0x80c46e, MAIN_UPKEEP_ROUTINES.get(0x80c46e)],
    ]),
  );

// The time limit: hours negative, zero, one (the last hour) or more; frames zero
// (an hour ends: the notice), one, at the warning steps around E10 and E20 or anywhere.
const TIME_LIMIT = {
  name: 'time limit 80:E270',
  entry: 0x80e270,
  samples: 400,
  prepare: (s) => {
    s.put(TIMER, s.pick([0xffff, 0x8000, 0, 0, 1, 2, 3, 0x10, s.rnd(0x10000)]));
    s.put(
      TIMER_FRAMES,
      s.pick([0, 0, 1, 0x20, 0x21, 0x40, 0x41, 0xdc1, 0xe01, 0xe11, 0xe21, 0xe41, s.rnd(0x10000)]),
    );
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      // Any sign, overflow, zero and carry from the previous callee.
      status: s.rnd(0x100) & 0xc3,
    };
  },
  result: carryRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runTimeLimit(h, null, TIME_LIMIT_CALLEES);
    return carryRegisters(h);
  },
};

// The glove action: aiming or not, a glove target or none, any of B, L and R pressed
// (alone, together or none), an object with a task or none whose task waits itself or
// for a child, wait masks with and without the offered and accepted bits, distances
// at the reach limits in each field, and dialog records or none. Task slots below 60
// keep the task tables clear of the player slot word.
const GLOVE_ACTION = {
  name: 'glove action 80:BF3B',
  entry: 0x80bf3b,
  samples: 600,
  prepare: (s) => {
    s.put(AIMING_WEAPON, s.pick([0, 0, 0, 0xffff]));
    s.put(AIMING_SPELL, s.pick([0, 0, 0, 0xffff]));
    s.put(GLOVE_TARGET_TAG, s.pick([0x10, 0x10, 0, 0xffff]));
    const pads = [0, 0x8000, 0x20, 0x10, 0x8020, 0x8010, 0x30, 0x8030, 0x8000, 0x20, 0x10];
    s.put(PAD_PRESSED, s.pick([...pads, s.rnd(0x10000)]));
    const object = 2 * s.rnd(OBJECT_SLOTS),
      player = s.pick([2 * s.rnd(OBJECT_SLOTS), object]),
      task = 2 * s.rnd(0x30),
      child = (task + 2 + 2 * s.rnd(0x2f)) % 0x60;
    s.put(GLOVE_TARGET_OBJECT, object);
    s.put(PLAYER_OBJECT, player);
    s.put(OBJECT_TASK + object, s.pick([task, task, task, 0xffff]));
    const bits = () =>
      s.pick([0x6002, 0x6682, 0x67f2, 0x600, 0x610, 0x80, 2, 0x4000, 0, s.rnd(0x8000)]);
    if (s.rnd(3) === 0) {
      s.put(TASK_WAIT + task, 0x8000 | s.rnd(0x8000));
      s.put(TASK_PREVIOUS + task, child);
      s.put(TASK_WAIT + child, bits());
    } else s.put(TASK_WAIT + task, bits());
    for (const [field, deltas] of [
      [OBJECT_X, [0, 0x50, 0x51, 0xa0, 0xa1, -0x50, -0xa1, 0x8000, s.rnd(0x10000)]],
      [OBJECT_Y, [0, 0x50, 0x51, 0xa0, 0xa1, -0x51, -0xa0, 0x8000, s.rnd(0x10000)]],
      [OBJECT_HEIGHT, [0, 0x80, 0x81, -0x80, -0x81, 0x8000, s.rnd(0x10000)]],
    ]) {
      const at = s.rnd(0x10000);
      s.put(field + player, at);
      if (player !== object) s.put(field + object, at + s.pick(deltas));
    }
    s.put(OBJECT_DIALOG + object, s.pick([0, s.rnd(0x10000)]));
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      // Any sign, overflow, zero and carry from the previous callee.
      status: s.rnd(0x100) & 0xc3,
    };
  },
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runGloveAction(h, null, GLOVE_ACTION_CALLEES);
    return roundRegisters(h);
  },
};

// The glove movement: a glove out or not, the pad's directions alone, opposite and
// together, speeds at the limits and beyond, positions at the edges and beyond (also
// where the addition overflows), a glove target or none, and draw lists empty or
// short. The object search runs register-level in the reference and lifted in the
// lifted movement (compared alone below), the release register-level on both sides;
// their window and text calls are the recording stand-ins (the text width is read for
// real); the window release runs for real with the recorded upload polls, lifted in
// the lifted movement.
const GLOVE_MOVE_CALLEES = new Map([
  ...GLOVE_ROUTINES,
  ...[0x80f963, 0x80fe69].map((target, n) => [target, standIn(n)]),
]);
const GLOVE_MOVE = {
  name: 'glove movement 80:BE6D',
  events: uploadEvents,
  entry: 0x80be6d,
  samples: 600,
  prepare: (s) => {
    s.put(GLOVE_KIND, s.pick([0, 0xffff, 0xffff, 0xfffd]));
    const held = s.pick([0, 0, 1, 2, 3, 4, 8, 12, 5, 10, 15, s.rnd(16)]) << 8;
    s.put(PAD_HELD, held | (s.rnd(0x10000) & 0xf0f0));
    const speeds = [0, 0x30, 0x2d0, 0x2d1, 0x300, 0xfd00, 0xfd30, 0xfd2f, 0x7fff, 0x8000];
    s.put(GLOVE_SPEED_X, s.pick([...speeds, s.rnd(0x10000)]));
    s.put(GLOVE_SPEED_Y, s.pick([...speeds, s.rnd(0x10000)]));
    const positions = [0x300, 0x2ff, 0xef00, 0xeeff, 0xce00, 0xcdff, 0, 0xffff, 0x7f00, 0x8100];
    s.put(GLOVE_X, s.pick([...positions, s.rnd(0x10000)]));
    s.put(GLOVE_Y, s.pick([...positions, s.rnd(0x10000)]));
    s.put(GLOVE_TARGET_TAG, s.pick([0xffff, 0x10, 0, s.rnd(0x10000)]));
    s.put(DRAW_LIST_INDEX, s.pick([0xffff, 0, 2, 4]));
    for (let y = 0; y < 6; y += 2) s.put(DRAW_LIST + y, 2 * s.rnd(OBJECT_SLOTS));
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runGloveMove(h, uploadEvents(), GLOVE_MOVE_CALLEES);
    return roundRegisters(h);
  },
};

// The object search: up to four objects on the draw list (or none, the index negative),
// with or without a picture, kinds of the kind table with and without a
// name, kind 0B with each glove and aim, runners (found in the runner table or not)
// and others. Each object's position is chosen from a distance to the glove's base on
// the screen, and the glove often lies within its box on either axis, at its edges or
// outside. The marked object is often one of the list's, with recorded offsets near the
// glove's. Its release runs register-level on both sides, the window and the text are
// the recording stand-ins, and the text width is measured for real.
const RUNNER_NUMBERS = 0x809700,
  RUNNER_ROWS = 13,
  KINDS = 0x140,
  RESTRICTED_KIND = 0x0b;
const romWord = (at) => WINDOW_ROM.read8(at) | (WINDOW_ROM.read8(at + 1) << 8);
const OBJECT_SEARCH = {
  name: 'object search 80:BCBE',
  entry: 0x80bcbe,
  samples: 1500,
  prepare: (s) => {
    const word = (at) => s.wram[at] | (s.wram[at + 1] << 8);
    const glove = s.pick([0xffff, 0xffff, 0xfffd]);
    s.put(GLOVE_KIND, glove);
    const baseX = s.pick([0x600, 0x600, s.rnd(0x10000)]),
      baseY = s.pick([0xc00, 0xc00, s.rnd(0x10000)]);
    s.put(GLOVE_BASE_X, baseX);
    s.put(GLOVE_BASE_Y, baseY);
    s.put(AIMING_SPELL, s.pick([0, 0, 0xffff]));
    s.put(SCRIPT_GLOVE_CHOICE, s.pick([0, 0, 0xffff]));
    const count = s.pick([1, 1, 2, 3, 4, 0]);
    s.put(DRAW_LIST_INDEX, s.pick([2 * count - 2, 2 * count - 2, 0xfffe]));
    const slots = new Set();
    while (slots.size < count) slots.add(2 * s.rnd(OBJECT_SLOTS));
    const list = [...slots];
    let screenX = s.rnd(0x100),
      screenY = s.rnd(0x100);
    const camX = word(CAMERA_X),
      camY = word(CAMERA_Y);
    list.forEach((slot, n) => {
      s.put(DRAW_LIST + 2 * n, slot);
      s.put(OBJECT_ACTION_DIRECTIONS + slot, s.rnd(5) ? 1 + s.rnd(0xffff) : 0);
      s.put(OBJECT_KIND + slot, s.rnd(6) ? s.rnd(KINDS) : RESTRICTED_KIND);
      const box = [OBJECT_BOX_X1, OBJECT_BOX_Y1, OBJECT_BOX_X2, OBJECT_BOX_Y2].map((field) => {
        const value = s.pick([0, 4, 0x10, s.rnd(0x40), (0x10000 - s.rnd(0x10)) & 0xffff]);
        s.put(field + slot, value);
        return value;
      });
      const boxHeight = s.pick([0, 0x10, s.rnd(0x40)]);
      s.put(OBJECT_BOX_HEIGHT + slot, boxHeight);
      // The object's distances to the glove's base, set through its diagonal and x.
      const height = s.rnd(0x400),
        y = s.rnd(0x10000),
        rise = s.pick([s.rnd(0x300), s.rnd(0x300), s.rnd(0x10000)]),
        across = s.pick([s.rnd(0x400), s.rnd(0x400), s.rnd(0x10000)]);
      s.put(OBJECT_HEIGHT + slot, height);
      s.put(OBJECT_DIAGONAL + slot, (baseY - height - camY - rise) & 0xffff);
      s.put(OBJECT_Y + slot, y);
      s.put(OBJECT_X + slot, (baseX + y - camX - across) & 0xffff);
      s.put(OBJECT_FLAGS + slot, s.rnd(0x10000));
      s.put(
        OBJECT_NUMBER + slot,
        s.rnd(4) ? romWord(RUNNER_NUMBERS + 2 * s.rnd(RUNNER_ROWS)) : s.rnd(0x10000),
      );
      // The glove within the box (or at an edge) on each axis, for one object.
      if (s.rnd(2)) return;
      const [x1, y1, x2, y2] = box,
        objectY = (rise >>> 2) & 0xffff,
        top = (((2 * objectY - x1 - y1) & 0xffff) >>> 1) & 0xff,
        bottom = (((2 * (objectY - boxHeight) - x2 - y2) & 0xffff) >>> 1) & 0xff,
        objectX = (across >>> 2) & 0xffff,
        left = (objectX - x1 + y2) & 0xff,
        right = (objectX + y1 - x2) & 0xff;
      screenY = s.pick([top, bottom, (bottom + 1) & 0xff, bottom + s.rnd(top - bottom + 1)]);
      screenX = s.pick([left, right, (right + 1) & 0xff, right + s.rnd(left - right + 1)]);
      // The marked object's distance from the recorded offset: within FF or not.
      const distance = () => s.pick([0xfe, 0xff, 0x100, s.rnd(0x100), s.rnd(0x10000)]);
      s.put(GLOVE_SNAP_X, objectX - distance());
      s.put(GLOVE_SNAP_Y, objectY - distance());
    });
    s.put(GLOVE_X, ((screenX & 0xff) << 8) | s.rnd(0x100));
    s.put(GLOVE_Y, ((screenY & 0xff) << 8) | s.rnd(0x100));
    const target = count ? list[s.rnd(count)] : 0;
    s.put(GLOVE_TARGET_TAG, s.pick([0xffff, word(OBJECT_KIND + target), s.rnd(0x10000)]));
    s.put(GLOVE_TARGET_OBJECT, s.pick([target, target, s.rnd(0x10000)]));
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  events: uploadEvents,
  reference: (h, events) => drainNativeSequence(bcbeSequence(h, events, GLOVE_MOVE_CALLEES)),
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(objectSearchSequence(h, uploadEvents(), GLOVE_MOVE_CALLEES));
    return roundRegisters(h);
  },
};

// The animation step: an object with its action record's direction offsets (or none)
// and frame stream in bank 8C, a picture change, a restart or none, clocks and speeds
// that carry into bit 7 or not, repeats running out, streams that loop, play once or
// end (with a task chain whose waits end), and pictures whose tiles fit the upload list
// and the free VRAM slots or not, with more, fewer or as many slots as before.
const ACTION_KINDS = 275,
  ACTION_LIST = 0x8ced8a,
  ANIMATION_FIELDS = {
    change: 0x1140,
    speed: 0x4088,
    clock: 0x4030,
    repeats: 0x3fd8,
    offset: 0x11f0,
    count: 0x10e8,
    direction: 0x1198,
    selection: 0x1038,
    task: 0x1350,
    slots: 0x12a0,
    head: 0x12f8,
  },
  VRAM_SLOT_COUNT = 0x0d1c,
  VRAM_SLOT_FREE_LIST = 0x0d1e,
  VRAM_SLOT_NEXT = 0x1564,
  VRAM_SLOTS = 0x40,
  TASK_SLOTS = 48,
  UPLOAD_INDEX = 0x82,
  STREAM_BANK = 0x40;
const OBJECT_ANIMATION = {
  name: 'animation 80:AC2F',
  entry: 0x80ac2f,
  samples: 1500,
  prepare: (s) => {
    const f = ANIMATION_FIELDS,
      slot = 2 * s.rnd(OBJECT_SLOTS),
      // Some records lie outside the ROM half of bank 8C; their bytes read as 0 here.
      romByte = (at) => (at & 0x8000 ? WINDOW_ROM.read8(at) : 0),
      bankWord = (bank, at) =>
        romByte((bank << 16) | (at & 0xffff)) | (romByte((bank << 16) | ((at + 1) & 0xffff)) << 8);
    // A record whose first frame has tiles (the selections of a kind are not all used).
    let directions, direction, first, offset, frame;
    for (let tries = 0; tries < 50; tries++) {
      const kind = s.rnd(ACTION_KINDS),
        record = bankWord(0x8c, romWord(ACTION_LIST + 2 * kind) + 2 * s.rnd(4));
      directions = (record + 8) & 0xffff;
      direction = s.rnd(8);
      first = romByte(0x8c0000 | ((directions + direction) & 0xffff));
      offset = s.pick([first, first, first + 2]);
      frame = bankWord(0x8c, directions + offset);
      if (romByte(((0x9b + (frame >>> 15)) << 16) | frame | 0x8000)) break;
    }
    s.wram[STREAM_BANK] = 0x8c;
    s.put(OBJECT_ACTION_DIRECTIONS + slot, s.rnd(8) ? directions : 0);
    s.put(f.direction + slot, direction);
    s.put(f.offset + slot, offset);
    s.put(f.change + slot, s.pick([0, 0, 0, 0xffff, frame, frame, s.rnd(0x10000)]));
    s.put(f.speed + slot, s.pick([0, 0x10, 0x40, 0x80, 0x100, s.rnd(0x10000)]));
    s.put(f.clock + slot, s.pick([0, 0x7f, 0x70, s.rnd(0x80), s.rnd(0x10000)]));
    s.put(f.repeats + slot, s.pick([1, 1, 2, 0, s.rnd(0x10000)]));
    s.put(f.count + slot, s.pick([0, 1 + s.rnd(0x7f), 0x80 | s.rnd(0x80), s.rnd(0x10000)]));
    s.put(f.selection + slot, s.rnd(0x10000));
    // A task chain up to tasks that do not wait for a child.
    s.put(f.task + slot, s.pick([0xffff, 2 * s.rnd(TASK_SLOTS)]));
    for (let task = 0; task < 2 * TASK_SLOTS; task += 2) {
      s.put(TASK_WAIT + task, s.rnd(3) ? s.rnd(0x8000) : 0x8000 | s.rnd(0x8000));
      s.put(TASK_PREVIOUS + task, 2 * s.rnd(TASK_SLOTS));
    }
    // The VRAM slots: chains through random slots, as many free or fewer.
    for (let n = 0; n < VRAM_SLOTS; n++) s.put(VRAM_SLOT_NEXT + 2 * n, 2 * s.rnd(VRAM_SLOTS));
    s.put(VRAM_SLOT_FREE_LIST, 2 * s.rnd(VRAM_SLOTS));
    s.put(VRAM_SLOT_COUNT, s.pick([0, 4, 0x10, s.rnd(0x20)]));
    s.put(f.slots + slot, s.pick([0, 1, 4, 8, s.rnd(0x10)]));
    s.put(f.head + slot, 2 * s.rnd(VRAM_SLOTS));
    s.put(UPLOAD_INDEX, s.pick([0, 0x10, 0x30, 0x48, 0x4c, 2 * s.rnd(0x28)]));
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: slot,
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  reference: (h) => stepObjectAnimation(h, null),
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    stepAnimation(h, null);
    return roundRegisters(h);
  },
};

// The motion pass: up to six objects on the draw list, in the grid or not, halted or
// not, with or without a box height, boxes inside one cell or across two to four (the
// box offsets and positions near the cell edges), still or moving without collision
// tests, and the static nodes ending anywhere. The movement runs register-level on
// both sides; the animation is the recording stand-in.
// The real animation keeps Y (PHY/PLY), so the stand-in leaves it too.
const ANIMATION_STAND_IN = standIn(0);
const MOTION_CALLEES = new Map([
  ...MAIN_MOTION_ROUTINES,
  [
    0x80ac2f,
    (h, e) => {
      const { y } = h.ctx,
        result = ANIMATION_STAND_IN(h, e);
      h.ctx.y = y;
      return result;
    },
  ],
]);
const OBJECT_MOTION = {
  name: 'motion pass 80:AFC4',
  entry: 0x80afc4,
  samples: 500,
  prepare: (s) => {
    const count = s.pick([0, 1, 2, 3, 6, s.rnd(7)]);
    s.put(DRAW_LIST_INDEX, 2 * count - 2);
    s.put(STATIC_NODE_END, 2 * s.rnd(0x300));
    const slots = new Set();
    while (slots.size < count) slots.add(2 * s.rnd(OBJECT_SLOTS));
    [...slots].forEach((slot, n) => {
      s.put(DRAW_LIST + 2 * n, slot);
      s.put(
        OBJECT_FLAGS + slot,
        s.pick([0x100, 0x100, 0x140, 0x500, 0x400, 0, s.rnd(0x10000) & ~0x23]),
      );
      s.put(OBJECT_BOX_HEIGHT + slot, s.pick([0, 1, 0x20, s.rnd(0x40)]));
      for (const field of [OBJECT_BOX_X1, OBJECT_BOX_Y1])
        s.put(field + slot, s.pick([0, 0xfff8, 0xfff0, s.rnd(0x10)]));
      for (const field of [OBJECT_BOX_X2, OBJECT_BOX_Y2])
        s.put(field + slot, s.pick([0, 8, 0x10, 0x40, s.rnd(0x80)]));
      for (const field of [OBJECT_X, OBJECT_Y])
        s.put(field + slot, s.pick([0xfc, 0x100, 0xfe0, 0x1000, s.rnd(0x10000)]));
      s.put(OBJECT_HEIGHT + slot, s.rnd(0x1000));
      // Still, so the movement's collision tests are not reached.
      for (const field of [OBJECT_VELOCITY_X, OBJECT_VELOCITY_Y, OBJECT_VELOCITY_Z])
        s.put(field + slot, 0);
      s.put(MOTION_ACTIVE + slot, 0);
    });
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runObjectMotion(h, null, MOTION_CALLEES);
    return roundRegisters(h);
  },
};

// Below the caller frame (from 1EEE) lie the frames of the reference's inner calls,
// which the lifted code does not produce (docs/MATRIX-LIFT.md).
registerCases(CASES, { sample, side, runtime: (h) => h, ignored: [[0x1e80, 0x1eee]] });
// Below the caller frame (1EEF-1EF0) the reference leaves the frames of its random,
// sound and upload wait calls, which the lifted code does not produce
// (docs/MATRIX-LIFT.md); the release frames there are equal on both sides.
registerCases([NOTICE_TIMEOUT], {
  sample,
  side,
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});
// The reference leaves the frame of its sound call below the caller frame; the
// stand-ins' frames there are equal on both sides.
registerCases([TIME_LIMIT], {
  sample,
  side: timeLimitSide,
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});
// The glove action leaves no frames below its caller's but the stand-ins', equal on both sides.
registerCases([GLOVE_ACTION], {
  sample,
  side: (s) =>
    createSide(s, new Map([...MAIN_GLOVE_ACTION_REFERENCE_ENTRIES, ...GLOVE_ACTION_CALLEES])),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
  outside: new Set(['object_slot_required', 'task_slot_required']),
});
// The glove movement's search and release leave the frames of their calls below the
// caller's.
registerCases([GLOVE_MOVE], {
  sample,
  side: (s) => createSide(s, new Map([[0x80be6d, moveGlove], ...GLOVE_MOVE_CALLEES])),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});
// The object search reproduces the frames of its calls and pushes, so the stack below
// the caller's frame is compared down to the release's inner frames.
registerCases([OBJECT_SEARCH], {
  sample,
  side: (s) => createSide(s, new Map(GLOVE_MOVE_CALLEES)),
  runtime: (h) => h,
  // The lifted name window release does not reproduce the frames of the window map
  // unpack below the window list's (docs/MATRIX-LIFT.md); the search's own pushes and
  // calls lie above them.
  ignored: [[0x1e80, 0x1ee2]],
});
// A picture whose upload jobs or slots run past 2000 (a random tile count with as many
// jobs, which the original writes into the hardware registers) is outside the lifted
// domain.
registerCases([OBJECT_ANIMATION], {
  sample,
  side: (s) => createSide(s, new Map()),
  runtime: (h) => h,
  ignored: [],
  outside: new Set(['object_slot_required']),
});
// The motion pass reproduces the frames of its collision list, so the stack below the
// caller's frame is compared too.
registerCases([OBJECT_MOTION], {
  sample,
  side: (s) => createSide(s, new Map([[0x80afc4, moveAndAnimateObjects], ...MOTION_CALLEES])),
  runtime: (h) => h,
  ignored: [],
});

// The notice 80:FEC1: window attributes 0400 (the effect) or others, text numbers
// within the table's bank, and the four notice slots free or used, with frames often
// equal (the last of equal ones is replaced) or at the ends. The window opening and the
// text are the recording stand-ins on both sides (the window list's release runs for
// real with the recorded upload polls, lifted in the lifted notice).
const NOTICE_CALLEES = new Map([0x80f963, 0x80fe69].map((target, n) => [target, standIn(n)]));
const NOTICE_SHOW = {
  name: 'notice 80:FEC1',
  entry: 0x80fec1,
  samples: 600,
  prepare: (s) => {
    s.put(DP_WINDOW_ATTRIBUTES, s.pick([0x400, 0x400, 0, 0x2400, s.rnd(0x10000)]));
    s.put(DP_NOTICE_TEXT, s.pick([0, 4, 0x10, s.rnd(0x1000)]));
    s.put(DP_NOTICE_FRAMES, s.rnd(0x10000));
    const free = s.pick([0, 0, 1, 2, 4]);
    for (let x = 0; x < 8; x += 2) {
      s.put(NOTICE_FRAMES + x, s.pick([0x3c, 0x3c, 1, 0, 0xffff, s.rnd(0x10000)]));
      if (free && s.rnd(free + 1) === 0) s.put(NOTICE_WINDOWS + x, 0xffff);
    }
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  reference: (h, events) => showNotice(h.a, events, false, NOTICE_CALLEES),
  events: uploadEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runShowNotice(h, uploadEvents(), NOTICE_CALLEES);
    return roundRegisters(h);
  },
};
// The glove release 80:BCB2: a glove target or none; the name window release runs
// register-level in the reference and lifted in the lifted release.
const GLOVE_RELEASE = {
  name: 'glove release 80:BCB2',
  entry: 0x80bcb2,
  samples: 400,
  prepare: (s) => {
    s.put(GLOVE_TARGET_TAG, s.pick([0x10, 0, 0xffff, 0x8000, s.rnd(0x10000)]));
    return {
      bank: 0x80,
      s: GAME_STACK,
      a: s.rnd(0x10000),
      x: s.rnd(0x10000),
      y: s.rnd(0x10000),
      status: s.rnd(0x100) & 0xc3,
    };
  },
  events: uploadEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runPutGloveAway(h, uploadEvents());
    return roundRegisters(h);
  },
};
// The lifted window release does not reproduce the frames of the window map unpack
// below the window list's; the notice's and the release's own frames lie above them.
registerCases([NOTICE_SHOW, GLOVE_RELEASE], {
  sample,
  side,
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1ee2]],
});

// The hardware multiplier and divider (Book I 2-15-1) and the PPU's signed multiplier
// (M7A written twice, M7B, MPYL; Book I 2-27-1) on both sides of the cursor, number,
// text and window tests, so that the loops end as in the game; the device writes are
// still recorded.
const MATH = { a: 0, dividend: 0, product: 0, quotient: 0, m7a: 0, m7latch: 0, m7product: 0 };
function mathSide(s, routines) {
  const state = createSide(s, routines),
    { read, write } = state.a.devices,
    math = { ...MATH };
  state.a.devices = {
    read: (address, width) => {
      const at = address & 0xffff,
        value =
          at === 0x4214
            ? math.quotient
            : at === 0x4215
              ? math.quotient >>> 8
              : at === 0x4216
                ? math.product
                : at === 0x4217
                  ? math.product >>> 8
                  : at === 0x2134
                    ? math.m7product
                    : at === 0x2135
                      ? math.m7product >>> 8
                      : at === 0x2136
                        ? math.m7product >>> 16
                        : null;
      return value === null ? read(address, width) : value & (width === 1 ? 0xff : 0xffff);
    },
    write(pc, address, value, width) {
      write(pc, address, value, width);
      const at = address & 0xffff;
      if (at === 0x211b) {
        math.m7a = ((value & 0xff) << 8) | math.m7latch;
        math.m7latch = value & 0xff;
      } else if (at === 0x211c)
        math.m7product = (((math.m7a << 16) >> 16) * ((value << 24) >> 24)) & 0xffffff;
      else if (at === 0x4202) math.a = value & 0xff;
      else if (at === 0x4203) math.product = math.a * (value & 0xff);
      else if (at === 0x4204)
        math.dividend = width === 2 ? value & 0xffff : (math.dividend & 0xff00) | (value & 0xff);
      else if (at === 0x4205) math.dividend = (math.dividend & 0xff) | ((value & 0xff) << 8);
      else if (at === 0x4206) {
        const d = value & 0xff;
        math.quotient = d ? Math.floor(math.dividend / d) : 0xffff;
        math.product = d ? math.dividend % d : math.dividend;
      }
    },
  };
  return state;
}
const bankRegisters = (h) => [roundRegisters(h), h.ctx.bank.toString(16)].join();
const wordInput = (s) => ({
  bank: 0x80,
  s: GAME_STACK,
  a: s.rnd(0x10000),
  x: s.rnd(0x10000),
  y: s.rnd(0x10000),
  status: s.rnd(0x100) & 0xc3,
});
// The text cursor: windows of the window tables or any index, rows and columns anywhere
// (columns below two wrap the byte), tile starts where the additions carry.
const TEXT_CURSOR = {
  name: 'text cursor 80:FAAC',
  entry: 0x80faac,
  samples: 600,
  prepare: (s) => {
    s.put(0, s.pick([0, 2, 4, 6, 0xe, s.rnd(0x10000)]));
    s.put(DP_CURSOR_ROW, s.pick([0, 1, 2, 3, s.rnd(0x10000)]));
    s.put(2, s.pick([0, 1, 0x10, 0x7fff, 0xffff, s.rnd(0x10000)]));
    return wordInput(s);
  },
  reference: (h) => setTextCursor(h.a, { calls: [] }, false),
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    setTextCursorRoutine(h);
    return bankRegisters(h);
  },
};
// The number: one to five digits, zero and the ends. The text buffer 80:FB39 is a
// recording stand-in on both sides that also records the data bank it starts with.
const drawStandIn = standIn(0);
const NUMBER_CALLEES = new Map([
  [
    0x80fb39,
    (h, e) => {
      h.a.devices.write(0, 0xf0f0, h.ctx.bank, 1);
      return drawStandIn(h, e);
    },
  ],
]);
const PRINT_NUMBER = {
  name: 'number 80:FD80',
  entry: 0x80fd80,
  samples: 600,
  prepare: (s) => {
    s.put(2, s.pick([0, 1, 9, 10, 99, 100, 9999, 10000, 0xffff, s.rnd(0x10000)]));
    return wordInput(s);
  },
  reference: (h) => printNumber(h.a, { calls: [] }, false, NUMBER_CALLEES),
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runPrintNumber(h, null, NUMBER_CALLEES);
    return bankRegisters(h);
  },
};
// Both push the data bank and the bank pair below the caller's frame; the stack is
// compared whole.
registerCases([TEXT_CURSOR, PRINT_NUMBER], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [],
});

// The text: the game's text numbers (80:D9B8, often the first ones) and any number, which
// decodes whatever the code tree gives; the bit buffer and its count anywhere. The text
// buffer 80:FB39 is the recording stand-in with the data bank on both sides.
const TEXT_NUMBER_TABLE = 0x80d9b8;
const TEXT_PRINT = {
  name: 'text 80:FE69',
  entry: 0x80fe69,
  samples: 600,
  prepare: (s) => {
    const n = s.pick([0, 1, 4, s.rnd(0x40), s.rnd(0x400)]);
    s.put(
      2,
      s.pick([
        romWord(TEXT_NUMBER_TABLE + 2 * n),
        romWord(TEXT_NUMBER_TABLE + 2 * n),
        s.rnd(0x10000),
      ]),
    );
    return wordInput(s);
  },
  reference: (h) =>
    printText(h.a, { calls: [], values: null, waitIndex: 0 }, false, NUMBER_CALLEES),
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runPrintText(h, null, NUMBER_CALLEES);
    return bankRegisters(h);
  },
};
// The bank pushes and the bit reader's last frame and push lie below the caller's frame;
// the stack is compared whole.
registerCases([TEXT_PRINT], {
  sample,
  side: (s) => createSide(s, new Map()),
  runtime: (h) => h,
  ignored: [],
});

// The text buffer 80:FB39: a window of the window tables with its cursor anywhere in its
// text area (or past it), styles alone and together (bold, underline, shifted rows,
// capitals), texts of words, spaces, bold toggles and small letters long enough to wrap
// and to run past the window's bottom. Both sides run the register-level upload requests
// with recorded polls; the polls and the read-back mask words are found by running the
// reference until it no longer asks for one.
const STYLES = [0, 8, 0x10, 0x20, 0x40, 0x60, 0x80, 0x88, 0x68, 0xb8];
const TEXT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?';
let textObservations = [];
const textEvents = () => ({
  mode: 'record-observations',
  values: textObservations,
  waitIndex: 0,
  calls: [],
  waitEvents: [],
});
function findTextObservations(s, input) {
  const values = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    const side = mathSide(s, new Map()),
      events = { ...textEvents(), values };
    Object.assign(side.a.ctx, input);
    side.a.ctx.programBank = 0x80;
    side.h.push(0x1234, 2);
    try {
      drawTextBuffer(side.a, events, false);
      return values;
    } catch (error) {
      if (error.reason !== 'task_wait_observation_required') return values;
      const at = events.waitIndex + error.observationIndex,
        poll = (error.address & 0xffff) < 0x200;
      values[at] = Object.freeze({
        pc: error.pc,
        address: error.address,
        width: 2,
        value: poll ? 0 : s.rnd(0x10000),
      });
    }
  }
  return values;
}
const TEXT_DRAW = {
  name: 'text buffer 80:FB39',
  entry: 0x80fb39,
  samples: 800,
  prepare: (s) => {
    const x = 2 * s.rnd(8),
      columns = s.wram[WINDOW_COLUMNS + x],
      rows = s.wram[WINDOW_ROWS + x],
      start = s.wram[WINDOW_TILE_START + x] | (s.wram[WINDOW_TILE_START + x + 1] << 8);
    s.put(0, x);
    s.put(WINDOW_STYLE + x, s.pick([...STYLES, s.rnd(0x10000)]));
    s.put(
      WINDOW_CURSOR_TILE + x,
      s.pick([start, start + s.rnd(columns * rows), start + s.rnd(0x40), s.rnd(0x10000)]),
    );
    s.put(WINDOW_CURSOR_PIXEL + x, s.pick([0, 0, s.rnd(8), s.rnd(8), s.rnd(0x10000)]));
    s.put(WINDOW_LEFT_PIXEL + x, s.pick([0, 0, s.rnd(0x20), s.rnd(0x10000)]));
    let text = '';
    const length = s.pick([0, 1, 5, s.rnd(40), s.rnd(120)]);
    while (text.length < length)
      text += s.pick([' ', ' ', '|', ...TEXT_CHARACTERS]).repeat(s.pick([1, 1, 1, 2]));
    [...text.slice(0, length)].forEach((c, i) => (s.wram[TEXT_BUFFER + i] = c.charCodeAt(0)));
    s.wram[TEXT_BUFFER + length] = 0;
    const input = { ...wordInput(s), bank: 0x7e };
    textObservations = findTextObservations(s, input);
    return input;
  },
  reference: (h, events) => drawTextBuffer(h.a, events, false),
  events: textEvents,
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runDrawTextBuffer(h, textEvents());
    return bankRegisters(h);
  },
};
// The lifted routine reproduces only the frames of its upload requests below the
// caller's frame (the register-level one pushes its calls' frames and its own bytes).
registerCases([TEXT_DRAW], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The window opening 80:F963: the last window index anywhere up to past the limit, window
// positions at and past the map's edges, sizes from 3 x 3 up, attributes, and the next
// tile near the wrap at 2400. Both sides wait with one recorded poll each for the tile
// request (81:ACBD) and the map upload (81:ACAF); the lifted side runs the register-level
// tile request and map upload through their frames.
const windowEvents = () => ({
  mode: 'record-observations',
  values: [
    Object.freeze({ pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 }),
    Object.freeze({ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 }),
  ],
  waitIndex: 0,
  calls: [],
  waitEvents: [],
});
const WINDOW_OPEN = {
  name: 'window opening 80:F963',
  entry: 0x80f963,
  samples: 800,
  prepare: (s) => {
    s.put(WINDOW_LAST_INDEX, s.pick([0xffff, 0, 2 * s.rnd(8), 0x1a, 0x1c, 0x1e]));
    s.put(0, s.pick([0, 1, 2, 12, 0x1c, 0x1f, 0x20, s.rnd(0x10000)]));
    s.put(2, s.pick([0, 1, 3, 0x18, 0x1b, 0x1c, s.rnd(0x10000)]));
    s.put(DP_WINDOW_COLUMNS, s.pick([3, 4, 11, 0x14, 0x20]));
    s.put(DP_WINDOW_ROWS, s.pick([3, 4, 8, 10, 0x1c]));
    s.put(8, s.pick([0, 0x2000, 0x400, s.rnd(0x10000)]));
    s.put(WINDOW_NEXT_TILE, s.pick([0x40, 0x100, 0x2300, 0x23f0, 0x2400 - 9, s.rnd(0x2400)]));
    return wordInput(s);
  },
  reference: (h, events) => openWindowAdapter(h, events),
  events: windowEvents,
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runOpenWindow(h, windowEvents());
    return bankRegisters(h);
  },
};
// The action menu 80:99EB: accepted actions alone and together (cast a spell, open and
// close), none, and the override. The window opening and the menu are recording
// stand-ins on both sides: the window one leaves a window of the window tables in the
// direct page word 00, the menu one a row of the list, past it or a cancel (FFFF); the
// window release runs for real with the recorded upload polls (lifted in the lifted
// menu).
const ACTION_BITS = [0x80, 0x10, 2, 0x20, 0x40, 0x100, 0x200, 0x400, 0x600, 0x2000, 0x4000];
const MENU_CALLEES = new Map([
  [
    0x80f963,
    standIn(0, (wram) => {
      wram[0] = 2 * (wram[STAND_IN_SOURCE + 0x40] & 7);
      wram[1] = 0;
    }),
  ],
  [
    0x80a6a5,
    standIn(1, (wram) => {
      const row = wram[STAND_IN_SOURCE + 0x41] % 12;
      wram[0] = row === 11 ? 0xff : row;
      wram[1] = row === 11 ? 0xff : 0;
    }),
  ],
]);
const ACTION_MENU = {
  name: 'action menu 80:99EB',
  entry: 0x8099eb,
  samples: 600,
  prepare: (s) => {
    let accepted = 0;
    for (const bit of ACTION_BITS) if (s.rnd(3) === 0) accepted |= bit;
    s.put(ACTION_MENU_OVERRIDE, s.pick([0, 0, 0, accepted ^ 0x80, s.rnd(0x10000)]));
    return { ...wordInput(s), a: s.pick([accepted, accepted, 0, s.rnd(0x10000)]) };
  },
  reference: (h, events) => chooseAction(h.a, events, MENU_CALLEES),
  events: uploadEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runChooseAction(h, uploadEvents(), MENU_CALLEES);
    return roundRegisters(h);
  },
};
// The register-level window drawing pushes its bytes below the caller's frame, which the
// lifted one does not reproduce; the menu's release leaves the window map unpack's
// frames there.
registerCases([WINDOW_OPEN, ACTION_MENU], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The dialog 80:936C with its close 80:92C5: every callee is a recording stand-in on
// both sides. The menu stand-in chooses Exit, Talk or Ask about (Exit from its fifth
// call on), the topic one a topic or none (FF), the text one sometimes ends the dialog
// (7E:1D63); the frame wait keeps X, as the real wait. They also record the carry and
// overflow they get. Dialog records of the game's 139,
// music options on and off, the current music equal or not, and Jake's alternate
// portrait or not.
const DIALOG_TARGETS = [
  0x81886a, 0x80bcb2, 0x80ff79, 0x81ef47, 0x80f963, 0x80fa92, 0x809f6d, 0x808f20, 0x809022,
  0x80905e, 0x808f3a, 0x809178, 0x81b0a1, 0x8091e2, 0x809215, 0x808f97, 0x80adf4, 0x809e1a,
  0x80b8de, 0x80fa3e,
];
const DIALOG_COUNT = 0xf0f0;
const dialogAfter = {
  0x8091e2: (wram) => {
    const c = wram[DIALOG_COUNT]++,
      source = STAND_IN_SOURCE + 8 * DIALOG_TARGETS.indexOf(0x8091e2);
    wram[source] = c >= 3 ? 0 : wram[0x1100 + c] % 3;
    wram[source + 1] = 0;
  },
  0x809215: (wram) => {
    const v = wram[0x1110 + (wram[DIALOG_COUNT + 1]++ & 0xf)];
    wram[0] = (v & 3) === 0 ? 0xff : v & 0x1e;
    wram[1] = 0;
  },
  0x809178: (wram) => {
    if ((wram[0x1120 + (wram[DIALOG_COUNT + 2]++ & 0xf)] & 7) === 0)
      wram[DIALOG_END] = wram[DIALOG_END + 1] = 0xff;
  },
};
// The callees in bank 81 return with RTL.
const DIALOG_CALLEES = new Map(
  DIALOG_TARGETS.map((target, n) => {
    const run = standIn(n, dialogAfter[target]),
      long = target >>> 16 === 0x81;
    return [
      target,
      (h, e) => {
        // The carry and overflow the dialog passes on are recorded too.
        h.a.devices.write(0, STAND_IN_RECORD + 0x80 + n, h.ctx.status & 0x41, 1);
        const x = h.ctx.x,
          raw = run(long ? { ...h, rts: h.rtl } : h, e);
        if (target === 0x81b0a1) h.ctx.x = x;
        return raw;
      },
    ];
  }),
);
const dialogEvents = () => ({
  mode: 'record-observations',
  values: [],
  waitIndex: 0,
  calls: [],
  waitEvents: [],
  inputs: [],
  inputIndex: 0,
});
const DIALOG = {
  name: 'dialog 80:936C',
  entry: 0x80936c,
  samples: 600,
  prepare: (s) => {
    const record = s.rnd(139),
      at = 0x8d0000 | romWord(0x8094f7 + 2 * record),
      music = romWord(0x8094e8 + 2 * (WINDOW_ROM.read8(at + 3) & 0x7f));
    s.put(2, record);
    s.put(DIALOG_END, 0);
    s.put(DIALOG_COUNT, 0);
    s.wram[DIALOG_COUNT + 2] = 0;
    s.put(STAND_IN_SOURCE + 8 * DIALOG_TARGETS.indexOf(0x8091e2), s.rnd(3));
    s.put(GAME_OPTIONS, s.pick([0, 1, s.rnd(0x10000)]));
    s.put(MUSIC, s.pick([music, music, 0, 5, s.rnd(0x10000)]));
    s.wram[JAKE_ALTERNATE_PORTRAIT] = s.pick([0, 0, 1]);
    return wordInput(s);
  },
  reference: (h, events) => talkWithObject(h.a, events, false, DIALOG_CALLEES),
  events: dialogEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(talkSequence(h, dialogEvents(), DIALOG_CALLEES));
    return roundRegisters(h);
  },
};
registerCases([DIALOG], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [],
});

// The dialog's small callees: the colour clear 81:886A, the text width 80:FA92 (widths
// positive, zero and negative, windows of the tables) and the notice windows' release
// 80:FF79 with registers (slots used or free, the real window release with the recorded
// upload polls).
const plainLifted = (run, long, events) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = long ? 0x81 : 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, events?.());
  return roundRegisters(h);
};
const DIALOG_SMALL = [
  {
    name: 'colour clear 81:886A',
    entry: 0x81886a,
    long: true,
    samples: 100,
    prepare: wordInput,
    reference: (h) => TALK_ROUTINES.get(0x81886a)(h),
    result: roundRegisters,
    lifted: plainLifted(clearFixedColourRoutine, true),
  },
  {
    name: 'text width 80:FA92',
    entry: 0x80fa92,
    samples: 400,
    prepare: (s) => {
      s.put(0, 2 * s.rnd(8));
      s.put(4, s.pick([0, 1, 0x50, 0xfff8, 0x8000, s.rnd(0x10000)]));
      return wordInput(s);
    },
    reference: (h) => TALK_ROUTINES.get(0x80fa92)(h),
    result: roundRegisters,
    lifted: plainLifted(setWindowTextWidthRoutine, false),
  },
  {
    name: 'notice windows 80:FF79',
    entry: 0x80ff79,
    samples: 300,
    prepare: (s) => {
      for (let x = 0; x < 8; x += 2) if (s.rnd(3) === 0) s.put(NOTICE_WINDOWS + x, 0xffff);
      return wordInput(s);
    },
    reference: (h, events) => TALK_ROUTINES.get(0x80ff79)(h, events),
    events: uploadEvents,
    result: roundRegisters,
    lifted: plainLifted(runReleaseNoticeWindows, false, uploadEvents),
  },
];
// The window release's map unpack frames below the caller's are not reproduced.
registerCases(DIALOG_SMALL, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1ee2]],
});

// The dialog's main menu 80:91E2 and topic choice 80:9215: the text routines' menu,
// window opening and release are recording stand-ins on both sides (the menu leaves a
// row or a cancel, the window opening a window). Topic lists empty, all flagged, or with
// up to twelve topics, some flagged.
const menuRoutines = () => ({
  menu: (a) =>
    standIn(0, (wram) => {
      const row = wram[STAND_IN_SOURCE + 0x50] % 6;
      wram[0] = row === 5 ? 0xff : row;
      wram[1] = row === 5 ? 0xff : 0;
    })(dialogAccess(a)),
  allocate: (a) =>
    standIn(1, (wram) => {
      wram[0] = 2 * (wram[STAND_IN_SOURCE + 0x51] & 7);
      wram[1] = 0;
    })(dialogAccess(a)),
  release: (a) => standIn(2)(dialogAccess(a)),
});
const DIALOG_MENUS = [
  [0x8091e2, 'main menu 80:91E2', chooseDialogAction, chooseDialogActionSequence],
  [0x809215, 'topic choice 80:9215', chooseDialogTopic, chooseDialogTopicSequence],
].map(([entry, name, reference, lifted]) => ({
  name: `dialog ${name}`,
  entry,
  samples: 600,
  prepare: (s) => {
    const count = s.pick([0, 1, 3, 12, s.rnd(13)]),
      flagged = s.pick([0, 1, 2, 3]);
    for (let n = 0; n < count; n++) {
      s.wram[TOPIC_LIST + n] = s.rnd(64);
      s.wram[TOPIC_FLAGS + n] = flagged === 3 || s.rnd(4) < flagged ? 1 + s.rnd(255) : 0;
    }
    s.wram[TOPIC_LIST + count] = 0xff;
    s.put(DIALOG_END, 0);
    return wordInput(s);
  },
  reference: (h, events) => reference(h, events, menuRoutines()),
  events: dialogEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(lifted(h, dialogEvents(), menuRoutines()));
    return roundRegisters(h);
  },
}));
// The topic list pushes X around each text lookup below the caller's frame, which the
// lifted choice does not reproduce.
registerCases(DIALOG_MENUS, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The dialog text 80:9178 with the topic add 80:908C: the game's dialog records, keys
// FFFF, FFFE, FFFD and the record's topics or others, and sorted topic lists (empty, short
// or long, with flags). The window request, cursor and text are recording stand-ins on
// both sides, the topic action one that records the registers it gets.
const textRoutines = () => ({
  request: (a) => standIn(0)(dialogAccess(a)),
  cursor: (a) => standIn(1)(dialogAccess(a)),
  text: (a) => standIn(2)(dialogAccess(a)),
  topic: (h) => {
    const { ctx } = h;
    for (const value of [ctx.a, ctx.x, ctx.y, ctx.s, ctx.status & 0xc3])
      h.a.devices.write(0, STAND_IN_RECORD + 0x40, value, 2);
  },
});
const DIALOG_TEXT = {
  name: 'dialog text 80:9178',
  entry: 0x809178,
  samples: 800,
  prepare: (s) => {
    const record = 0x8d0000 | romWord(0x8094f7 + 2 * s.rnd(139));
    s.put(0x11, record & 0xffff);
    s.wram[0x13] = record >>> 16;
    // The record's keys from byte 4 on (key, length, ...), up to its end F8.
    const keys = [];
    for (let y = 4, n = 0; n < 40; n++) {
      const key = WINDOW_ROM.read8(record + y);
      if (key === 0xf8) break;
      keys.push(key);
      y += 1 + WINDOW_ROM.read8(record + y + 1);
    }
    const key = s.pick([0xffff, 0xfffe, 0xfffd, ...keys, ...keys, s.rnd(0x100)]);
    const count = s.pick([0, 2, 8, s.rnd(30)]),
      topics = Array.from({ length: count }, () => s.rnd(0x40)).sort((x, y) => x - y);
    [...new Set(topics)].forEach((topic, n) => {
      s.wram[TOPIC_LIST + n] = topic;
      s.wram[TOPIC_FLAGS + n] = s.rnd(3) === 0 ? 1 : 0;
      s.wram[TOPIC_LIST + n + 1] = 0xff;
    });
    if (!count) s.wram[TOPIC_LIST] = 0xff;
    return { ...wordInput(s), a: key };
  },
  reference: (h, events) => showDialogText(h, events, textRoutines()),
  events: dialogEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(showDialogTextSequence(h, dialogEvents(), textRoutines()));
    return roundRegisters(h);
  },
};
registerCases([DIALOG_TEXT], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [],
});

// The portrait window opened and closed (80:8F3A, 80:8F97): both sides wait for the
// frame counter with the register-level word wait, whose polls are found by running the
// reference until it asks for no more (each poll gives a new counter value); HDMA
// shadows with the channel on or off.
function findCounterPolls(s, input, run, valueFor = null) {
  const values = [];
  for (let attempt = 0; attempt < 400; attempt++) {
    const side = mathSide(s, new Map()),
      events = { ...dialogEvents(), values };
    Object.assign(side.a.ctx, input);
    side.a.ctx.programBank = 0x80;
    side.h.push(0x1234, 2);
    try {
      run(side.h, events);
      return values;
    } catch (error) {
      if (error.reason !== 'task_wait_observation_required') return values;
      // The inline waits of bank 80 give the index in the whole list, the word wait in
      // the rest from events.waitIndex.
      const index =
        error.pc >>> 16 === 0x80
          ? error.observationIndex
          : events.waitIndex + (error.observationIndex ?? 0);
      values[index] = Object.freeze({
        pc: error.pc,
        address: error.address,
        width: error.width ?? 2,
        // The portraits' DMA request ends negative; the counter changes.
        value:
          valueFor?.(error, attempt) ??
          ((error.address & 0xffff) === 0x140
            ? 0x8000 | s.rnd(0x8000)
            : (s.rnd(0xffff) + 1 + attempt) & 0xffff),
      });
    }
  }
  return values;
}
let portraitPolls = [];
const portraitEvents = () => ({ ...dialogEvents(), values: portraitPolls });
const WAIT_TABLE = new Map([[0x81b0a1, TALK_ROUTINES.get(0x81b0a1)]]);
const PORTRAIT_WINDOWS = [
  [0x808f3a, 'open', openPortraitWindowSequence],
  [0x808f97, 'close', closePortraitWindowSequence],
].map(([entry, name, lifted]) => ({
  name: `portrait window ${name} ${entry.toString(16)}`,
  entry,
  samples: 150,
  prepare: (s) => {
    s.wram[0x1c4] = s.pick([0, 1, 0xff, s.rnd(0x100)]);
    const input = wordInput(s);
    portraitPolls = findCounterPolls(s, input, (h, e) => TALK_ROUTINES.get(entry)(h, e));
    return input;
  },
  reference: (h, events) => TALK_ROUTINES.get(entry)(h, events),
  events: portraitEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(lifted(h, portraitEvents(), WAIT_TABLE));
    return roundRegisters(h);
  },
}));
// The edges' JSR frame and pushed status lie below the caller's frame.
registerCases(PORTRAIT_WINDOWS, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The portrait rows 80:8F20, the portraits' uploads 80:9022 and 80:905E and their DMA
// job 80:8FF5: the request's polls are found by running the reference, which calls the
// register-level DMA job, the lifted side the lifted one; dialog flags with and without
// the mirror bit, job counts at the ends, VRAM addresses and requests of any word.
const DMA_TABLE = new Map([[0x808ff5, runPortraitTiles]]);
const PORTRAITS = [
  {
    name: 'portrait tiles 80:8FF5',
    entry: 0x808ff5,
    samples: 200,
    prepare: (s) => {
      s.put(0x140, s.rnd(0x10000));
      const input = { ...wordInput(s), x: s.pick([0, 0x800, s.rnd(0x10000)]) };
      portraitPolls = findCounterPolls(s, input, (h, e) => uploadPortraitTiles(h, e));
      return input;
    },
    reference: (h, events) => uploadPortraitTiles(h, events),
    events: portraitEvents,
    result: roundRegisters,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      drainNativeSequence(uploadPortraitTilesSequence(h, portraitEvents()));
      return roundRegisters(h);
    },
  },
  {
    name: 'portrait rows 80:8F20',
    entry: 0x808f20,
    samples: 50,
    prepare: (s) => ({ ...wordInput(s), bank: s.pick([0x80, 0x7e, 0]) }),
    reference: (h) => TALK_ROUTINES.get(0x808f20)(h),
    result: bankRegisters,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      shiftPortraitRowsRoutine(h);
      return bankRegisters(h);
    },
  },
  ...[
    [0x809022, 'first', uploadFirstPortraitSequence],
    [0x80905e, 'second', uploadSecondPortraitSequence],
  ].map(([entry, name, lifted]) => ({
    name: `portrait upload ${name} ${entry.toString(16)}`,
    entry,
    samples: 200,
    prepare: (s) => {
      s.put(0x1ba, s.pick([0, 0x80, s.rnd(0x10000)]));
      s.put(0x1562, s.pick([0, 0xffff, 0x7fff, s.rnd(0x10000)]));
      const input = wordInput(s);
      portraitPolls = findCounterPolls(s, input, (h, e) => TALK_ROUTINES.get(entry)(h, e));
      return input;
    },
    reference: (h, events) => TALK_ROUTINES.get(entry)(h, events),
    events: portraitEvents,
    result: roundRegisters,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      drainNativeSequence(lifted(h, portraitEvents(), DMA_TABLE));
      return roundRegisters(h);
    },
  })),
];
// The row shift's data bank push and the job count's frame lie below the caller's frame.
registerCases(PORTRAITS, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The object tiles 80:ADF4 with 80:AE12: one to four objects on the draw list, prepared
// as for the animation step, most without a picture change (their current picture's
// tiles are queued again), some with a change or a restart whose picture has few tiles
// (the animation step runs until it takes it, a frame apart), upload indices that fill
// the list or not, and plenty of free VRAM slots. Both sides wait with the register-level
// word wait; the polls of the waits and the NMI's words are found by running the
// reference: the job lists empty at once or after a poll, the upload index after a frame
// small (the NMI also writes it during the job list waits).
const RELOAD_WAITS = new Set([0x80ae5e, 0x80ae0c]);
const reloadPollValue = (s) => (error, attempt) => {
  const address = error.address & 0xffff;
  if (address === 0x1562 && RELOAD_WAITS.has(error.pc)) return s.rnd(3) && attempt ? 0 : 1;
  if (address === 0x82) return s.pick([0, 0, 8, 0x20]);
  if (error.pc === 0x80ae23 && address === 0x1562) return s.pick([0, 0, 1]);
  return null;
};
const pictureTiles = (picture) =>
  WINDOW_ROM.read8(((0x9b + (picture >>> 15)) << 16) | picture | 0x8000);
const OBJECT_TILES = {
  name: 'object tiles 80:ADF4',
  entry: 0x80adf4,
  samples: 400,
  prepare: (s) => {
    const objects = 1 + s.rnd(4),
      slots = [];
    for (let n = 0; n < objects; n++) {
      const { x: slot } = OBJECT_ANIMATION.prepare(s),
        change = ANIMATION_FIELDS.change + slot,
        picture = s.wram[change] | (s.wram[change + 1] << 8);
      if (s.rnd(3) || (picture !== 0xffff && pictureTiles(picture) > 0x18)) s.put(change, 0);
      slots.push(slot);
    }
    s.put(DRAW_LIST_INDEX, 2 * (objects - 1));
    slots.forEach((slot, n) => s.put(DRAW_LIST + 2 * n, slot));
    s.put(VRAM_SLOT_COUNT, 0x40);
    const input = wordInput(s);
    portraitPolls = findCounterPolls(
      s,
      input,
      (h, e) => TALK_ROUTINES.get(0x80adf4)(h, e),
      reloadPollValue(s),
    );
    return input;
  },
  reference: (h, events) => TALK_ROUTINES.get(0x80adf4)(h, events),
  events: portraitEvents,
  result: roundRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(reloadObjectTilesSequence(h, portraitEvents(), WAIT_TABLE));
    return roundRegisters(h);
  },
};
// The animation step's pushes and the job count's frames lie below the caller's frame. A
// field past 2000, which the reference reads unmapped, lies outside the lifted domain, as
// in the animation test.
registerCases([OBJECT_TILES], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
  outside: new Set(['object_slot_required']),
});

// The portrait unpacker 80:9F6D: the game's portrait streams (and now and then another
// offset or a bank word with a high byte) into bank 7F at 5250 or elsewhere, from random
// status and data banks. The bit reads' JSR frames lie below the caller's frame.
const PORTRAIT_STREAMS = portraitStreams((at) => WINDOW_ROM.read8(at));
const PORTRAIT_UNPACK = {
  name: 'portrait unpack 80:9F6D',
  entry: 0x809f6d,
  samples: 150,
  prepare: (s) => {
    const stream = s.pick(PORTRAIT_STREAMS);
    return {
      ...wordInput(s),
      a: stream & 0xffff,
      y: (stream >>> 16) | (s.rnd(4) ? 0 : s.rnd(0x100) << 8),
      x: s.pick([0x5250, 0x5250, 0x5250, s.rnd(0x10000)]),
      bank: s.pick([0x80, 0x7e, s.rnd(0x100)]),
    };
  },
  reference: (h, events) => TALK_ROUTINES.get(0x809f6d)(h, events),
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    unpackPortraitRoutine(h, null);
    return bankRegisters(h);
  },
};
registerCases([PORTRAIT_UNPACK], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The menu list's mark 80:A5F9 and its removal 80:A5DB: a window of the window tables,
// list columns and rows inside it or anywhere, page starts and word indices in Y on the
// page or not. Both sides run the register-level upload requests of the text buffer with
// recorded polls (the reference's text buffer register-level, the lifted side's lifted),
// found by running the reference until it no longer asks for one.
function findListObservations(s, input, entry) {
  const values = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    const side = mathSide(s, new Map()),
      events = { ...textEvents(), values };
    Object.assign(side.a.ctx, input);
    side.a.ctx.programBank = 0x80;
    side.h.push(0x1234, 2);
    try {
      runTaskListHelper(side.a, events, entry, false);
      return values;
    } catch (error) {
      if (error.reason !== 'task_wait_observation_required') return values;
      const at = events.waitIndex + error.observationIndex,
        poll = (error.address & 0xffff) < 0x200;
      values[at] = Object.freeze({
        pc: error.pc,
        address: error.address,
        width: 2,
        value: poll ? 0 : s.rnd(0x10000),
      });
    }
  }
  return values;
}
const DRAW_TABLE = new Map([[0x80fb39, runDrawTextBuffer]]);
const MENU_MARKS = [
  [0x80a5f9, 'mark', MARK],
  [0x80a5db, 'unmark', UNMARK],
].map(([entry, name, form]) => ({
  name: `menu ${name} ${entry.toString(16)}`,
  entry,
  samples: 300,
  prepare: (s) => {
    const x = 2 * s.rnd(8),
      page = s.pick([0, 0, 2 * s.rnd(8), s.rnd(0x10000)]);
    s.put(0, x);
    s.put(0x1d95, page);
    s.put(0x1d99, s.pick([1, 2, 3, s.rnd(0x20), s.rnd(0x10000)]));
    s.put(0x1d9b, s.pick([0, 1, 4, s.rnd(0x10), s.rnd(0x10000)]));
    const input = {
      ...wordInput(s),
      y: s.pick([page, (page + 2 * s.rnd(6)) & 0xffff, s.rnd(0x10000)]),
    };
    textObservations = findListObservations(s, input, entry);
    return input;
  },
  reference: (h, events) => runTaskListHelper(h.a, events, entry, false),
  events: textEvents,
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(markRowSequence(h, textEvents(), DRAW_TABLE, form));
    return bankRegisters(h);
  },
}));
// The frames of the inner calls lie below the caller's frame.
registerCases(MENU_MARKS, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The menu list drawing 80:A617: a window of the window tables, lists of up to nine of
// the game's text numbers (in bank 7E) with numbers or none (below 2000 through the data
// bank), with and without numbers shown, one to six visible rows and page starts on the
// list or past its end. The upload requests' polls are found as for the marks.
const LIST_TOKENS = 0x3000,
  LIST_VALUES = 0x0400;
const MENU_LIST = {
  name: 'menu list 80:A617',
  entry: 0x80a617,
  samples: 120,
  prepare: (s) => {
    const x = 2 * s.rnd(8),
      count = s.rnd(10);
    s.put(0, x);
    s.put(6, 1 + s.rnd(6));
    s.put(8, LIST_TOKENS);
    s.wram[0x0a] = 0x7e;
    s.put(0x0c, LIST_VALUES);
    for (let n = 0; n < count; n++) {
      s.put(LIST_TOKENS + 2 * n, romWord(TEXT_NUMBER_TABLE + 2 * s.rnd(0x40)));
      s.put(LIST_VALUES + 2 * n, s.pick([0, 1, 99, s.rnd(0x10000)]));
    }
    s.put(LIST_TOKENS + 2 * count, 0);
    s.put(0x1d95, s.pick([0, 0, 2 * s.rnd(count + 1), 2 * s.rnd(12)]));
    s.put(0x1d99, s.pick([1, 2, 3, 1 + s.rnd(8)]));
    s.put(0x1d9b, s.pick([0, 1, 2, s.rnd(6)]));
    s.put(0x1da5, s.pick([0, 0xffff]));
    const input = wordInput(s);
    textObservations = findListObservations(s, input, 0x80a617);
    return input;
  },
  reference: (h, events) => runTaskListHelper(h.a, events, 0x80a617, false),
  events: textEvents,
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(drawListSequence(h, textEvents(), DRAW_TABLE));
    return bankRegisters(h);
  },
};
registerCases([MENU_LIST], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

// The menu choice 80:A6A5 to 80:A6C7: all four entries on lists of one to nine of the
// game's text numbers (hotkey words or numbers in 0C), one to six visible rows, and a pad
// script per sample: presses of down, up, R and L, held down or up long enough to
// repeat, hotkeys, then B, Y or a hotkey. The word wait, the pad word (from the script,
// the newly pressed and held words) and the sound are stand-ins on both sides; the
// reference draws with its register-level list helpers, the lifted side with the lifted
// ones, both with the recorded polls of the text uploads and the page's tile requests.
const MENU_ENTRIES = [0x80a6a5, 0x80a6ad, 0x80a6b8, 0x80a6c7];
let menuPads = [];
const menuEvents = () => ({ ...textEvents(), pads: menuPads, padIndex: 0 });
const MENU_STAND_INS = new Map([
  [
    0x81b0a1,
    (h) => {
      h.ctx.a = 0x1234;
      return h.rtl();
    },
  ],
  [
    0x809e1a,
    (h, e) => {
      const [pressed, held] = e.pads[Math.min(e.padIndex++, e.pads.length - 1)],
        { wram } = h.a.mem;
      wram[PAD_PRESSED] = pressed & 0xff;
      wram[PAD_PRESSED + 1] = pressed >>> 8;
      wram[PAD_HELD] = held & 0xff;
      wram[PAD_HELD + 1] = held >>> 8;
      h.ctx.a = held & 0x0f;
      h.ctx.status = (h.ctx.status & ~0x83) | (h.ctx.a ? 0 : 2);
      return h.rts();
    },
  ],
  [
    0x80c46e,
    (h) => {
      h.ctx.x = 0xff4c;
      return h.rts();
    },
  ],
]);
const MENU_LIFTED_CALLEES = new Map([...MENU_STAND_INS, [0x80fb39, runDrawTextBuffer]]);
function findMenuObservations(s, input, entry) {
  const values = [];
  for (let attempt = 0; attempt < 400; attempt++) {
    const side = mathSide(s, new Map()),
      events = { ...menuEvents(), values };
    Object.assign(side.a.ctx, input);
    side.a.ctx.programBank = 0x80;
    side.h.push(0x1234, 2);
    try {
      drainNativeSequence(menuComposeSequence(side.a, events, entry, false, MENU_STAND_INS));
      return values;
    } catch (error) {
      if (error.reason !== 'task_wait_observation_required') return values;
      // The tile request's wait 81:ACBD gives the index in the whole list.
      const at =
          error.pc === 0x81acbd
            ? error.observationIndex
            : events.waitIndex + error.observationIndex,
        poll = (error.address & 0xffff) < 0x200;
      values[at] = Object.freeze({
        pc: error.pc,
        address: error.address,
        width: 2,
        value: poll ? 0 : s.rnd(0x10000),
      });
    }
  }
  return values;
}
const MENU_CHOICES = MENU_ENTRIES.map((entry) => ({
  name: `menu choice ${entry.toString(16)}`,
  entry,
  samples: 40,
  prepare: (s) => {
    const x = 2 * s.rnd(8),
      count = 1 + s.rnd(9),
      keys = [0x10, 0x20, 0x40, 0x80, 0x1000, 0x4000, 0x8000, 0x0100, 0x0200];
    s.put(0, x);
    s.put(2, 1 + s.rnd(8));
    s.put(4, s.rnd(6));
    s.put(6, 1 + s.rnd(6));
    s.put(8, LIST_TOKENS);
    s.wram[0x0a] = 0x7e;
    s.put(0x0c, LIST_VALUES);
    for (let n = 0; n < count; n++) {
      s.put(LIST_TOKENS + 2 * n, romWord(TEXT_NUMBER_TABLE + 2 * s.rnd(0x40)));
      s.put(LIST_VALUES + 2 * n, s.pick([0, 1, s.pick(keys), s.rnd(0x10000)]));
    }
    s.put(LIST_TOKENS + 2 * count, 0);
    const pads = [];
    for (let n = s.rnd(8); n > 0; n--) {
      const press = s.pick([0, 0x400, 0x400, 0x800, 0x10, 0x20, s.pick(keys)]);
      if (s.rnd(10)) pads.push([press, press]);
      else for (let k = 0; k < 22; k++) pads.push([k ? 0 : press, press]);
    }
    pads.push([s.pick([0x8000, 0x2000, 0x80, s.pick(keys)]), 0]);
    pads.push([0x8000, 0]);
    menuPads = pads;
    const input = { ...wordInput(s), a: s.rnd(count) };
    textObservations = findMenuObservations(s, input, entry);
    return input;
  },
  reference: (h, events) =>
    drainNativeSequence(menuComposeSequence(h.a, events, entry, false, MENU_STAND_INS)),
  events: menuEvents,
  result: bankRegisters,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(chooseFromMenuSequence(h, menuEvents(), MENU_LIFTED_CALLEES, entry));
    return bankRegisters(h);
  },
}));
// The frames of the inner calls lie below the caller's frame.
registerCases(MENU_CHOICES, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});
