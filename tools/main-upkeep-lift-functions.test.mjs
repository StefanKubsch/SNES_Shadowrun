import { gloveActionSequence as formerGloveActionSequence } from './register-forms/glove-action.mjs';
import { timeLimitSequence as recordedTimeLimitSequence } from './register-forms/time-limit.mjs';
import { printNumberSequence as formerNumberSequence } from './register-forms/window-text.mjs';
import { printTextSequence as formerTextSequence } from './register-forms/text-print.mjs';

// Random per-function tests of the main loop's lifted upkeep (src/game/main-upkeep.mjs)
// against the frozen outcomes (tools/lift-vectors/) of the former register-level
// references (retired with proof/), docs/MAIN-LOOP-LIFT.md: the colour effect 81:8877,
// the palette cycles 81:8076, the hit shake 80:DE94, the camera follow 81:8C2E, the tile
// buffers 81:8A91, the formation step 80:BAD5, the notice time limits 80:FF14, the time
// limit 80:E270, the glove action 80:BF3B, the animation step 80:AC2F, the glove release
// 80:BCB2, the text cursor 80:FAAC, the number 80:FD80, the text 80:FE69, the window
// opening 80:F963, the colour clear 81:886A, the text width 80:FA92, the notice windows
// 80:FF79, the portrait rows 80:8F20 and unpacker 80:9F6D, and the menu list's mark
// 80:A5F9, its removal 80:A5DB and the list drawing 80:A617. Each runs from the caller
// frame with the main loop's data bank 80; the outcomes hold the WRAM, the device writes
// and, where callers read them, registers (tools/lift-function-harness.mjs).
//
// The cases whose lifted side was a register-level composition of proof/ (glove movement,
// object search, motion pass, notice, text buffer, action menu, dialog and its menus and
// text, portrait windows, tiles and uploads, object tiles, menu choice) went with proof/
// (user decision 2026-11-26); the lifted compositions are compared in their caller tests.
import { prng, DialogTestMemory } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { liveWindowEvents, windowMapSource, windowTables } from './lift-window-samples.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../src/vm/layout.mjs';
import { shakeHitPlayer } from '../src/game/player-hit.mjs';
import { recordFormationStep } from '../src/game/formation-trail.mjs';
import { updateTileBuffers } from '../src/game/camera-scroll.mjs';
import { followPlayerWithCamera } from '../src/game/camera-follow.mjs';
import { advancePaletteCycles } from '../src/game/palette-cycles.mjs';
import { applyColourEffect } from '../src/game/fixed-colour.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { noticeTimeoutJsr } from './register-forms/jsr-forms.mjs';
import {
  runPutGloveAway,
  runOpenWindow,
  runReleaseNoticeWindows,
} from './register-forms/upkeep-routines.mjs';
import { stepAnimationInPlace } from '../src/game/object-animation.mjs';
import { drainNativeSequence } from './register-forms/native-call-continuation.mjs';
import { drawTextBufferSequence } from '../src/game/text-draw.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { unpackPortraitRoutine } from './register-forms/portrait-routines.mjs';
import { portraitStreams } from '../src/data/portraits.mjs';
import { MARK, UNMARK, drawListSequence, markRowSequence } from '../src/game/menu-list.mjs';
import {
  setTextCursorJsr,
  shiftPortraitRowsJsr,
  playSoundEffectJsr,
  clearFixedColourJsl,
  setWindowTextWidthJsr,
} from './register-forms/jsr-forms.mjs';
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
  DP_CURSOR_ROW,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
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
  OBJECT_ACTION_DIRECTIONS,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_DIALOG,
  OBJECT_TASK,
  PAD_PRESSED,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The upkeep routines with the return of their original callers (JSR or JSL).
function runHitShake(h) {
  shakeHitPlayer(h.a.mem.wram);
  return h.rts();
}
function runFormationStep(h) {
  recordFormationStep(h.a.mem.wram);
  return h.rts();
}
function runColourEffect(h) {
  applyColourEffect(sceneRuntime(h));
  return h.rtl();
}
function runPaletteCycles(h) {
  advancePaletteCycles(h.a.mem.wram);
  return h.rtl();
}
function runCameraFollow(h) {
  followPlayerWithCamera(h.a.mem, h.a.mem.wram);
  return h.rtl();
}
function runTileBuffers(h) {
  updateTileBuffers(h.a.mem.wram);
  return h.rtl();
}
function runNoticeTimeouts(h, events) {
  return drainNativeSequence(noticeTimeoutJsr(h, events));
}
function runPrintNumber(h, events, routines) {
  return drainNativeSequence(formerNumberSequence(h, events, routines));
}
function runPrintText(h, events, routines) {
  return drainNativeSequence(formerTextSequence(h, events, routines));
}
function runTimeLimit(h, events, routines) {
  return drainNativeSequence(recordedTimeLimitSequence(h, events, routines));
}
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
const side = (s) => createSide(s, new Map());
// The lifted side starts from the reference's registers and caller frame.
const lifted = (run, long, events) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = long ? 0x81 : 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, events?.(h));
  return registers(h);
};
// Game state only (user decision 2026-11-17): the lifted upkeep routines leave no X and
// Y, so their cases compare the data bank and memory.
const registers = (h) => h.ctx.bank.toString(16);
// Game state only (user decision 2026-11-17): the lifted text cursor and the routines
// that end with it or the number leave no A, X, Y and flags; the data bank stays.
const dataBank = (h) => h.ctx.bank.toString(16);
// The glove action's A and N, V, Z and C reach the scheduler round 80:C1E3 that follows
// it; the time limit's carry and overflow outlive the main loop's own loads.
const roundRegisters = (h) =>
  [h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & 0xc3].map((v) => v.toString(16)).join();

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
  // Game state only (user decision 2026-11-17): the lifted side leaves no X and Y.
  lifted: (h, input) => (lifted(runNoticeTimeouts, false, liveWindowEvents)(h, input), ''),
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
      ...TIME_LIMIT_CALLEES,
      // The reference plays the warning sound through its frame.
      [0x80c46e, playSoundEffectJsr],
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
  // Game state only (user decision 2026-11-17): the carry of the last hour reaches only
  // the P a later NMI saves; the X and Y of the warning sound are no game state either.
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runTimeLimit(h, null, TIME_LIMIT_CALLEES);
    return '';
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
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(formerGloveActionSequence(h, null, GLOVE_ACTION_CALLEES));
    return roundRegisters(h);
  },
};

const romWord = (at) => WINDOW_ROM.read8(at) | (WINDOW_ROM.read8(at + 1) << 8);
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
  // The lifted animation step leaves no registers.
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    stepAnimationInPlace(h, input.x);
    h.a.pullWord();
    return dataBank(h);
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
  side: (s) => createSide(s, new Map(GLOVE_ACTION_CALLEES)),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
  outside: new Set(['object_slot_required', 'task_slot_required']),
});
// A picture whose upload jobs or slots run past 2000 (a random tile count with as many
// jobs, which the original writes into the hardware registers) is outside the lifted
// domain. The free stack below the caller's frame (1EEF-1EF0) differs: the lifted step
// pushes no caller Y (user decision 2026-11-17).
registerCases([OBJECT_ANIMATION], {
  sample,
  side: (s) => createSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
  outside: new Set(['object_slot_required']),
});

// The glove release 80:BCB2: a glove target or none, compared on game state only (the
// lifted release leaves no registers).
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
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runPutGloveAway(h, liveWindowEvents(h));
  },
};
// The lifted window release does not reproduce the frames of the window map unpack
// below the window list's; the notice's and the release's own frames lie above them.
registerCases([GLOVE_RELEASE], {
  sample,
  side,
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1ee2]],
});

// The hardware multiplier and divider (Book I 2-15-1) on both sides of the cursor,
// number, text and window tests, so that the loops end as in the game (the PPU's signed
// multiplier comes from the side's picture back end); the device writes are still
// recorded.
const MATH = { a: 0, dividend: 0, product: 0, quotient: 0 };
function mathSide(s, routines) {
  const state = createSide(s, routines),
    { read, write } = state.a.devices,
    math = { ...MATH };
  state.a.devices = {
    bus: state.picture,
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
                  : null;
      return value === null ? read(address, width) : value & (width === 1 ? 0xff : 0xffff);
    },
    write(pc, address, value, width) {
      write(pc, address, value, width);
      const at = address & 0xffff;
      if (at === 0x4202) math.a = value & 0xff;
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
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    setTextCursorJsr(h);
    return dataBank(h);
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

// The text buffer's upload requests (81:ACAF to 81:ACC9) are serviced at their blocking
// branches: each request word clears, as the NMI's upload job leaves it.
const TEXT_UPLOAD_REQUESTS = new Map([
  [0x81acb2, 0x1f8],
  [0x81acc0, 0x1f6],
  [0x81acc6, 0x1fa],
  [0x81accc, 0x1fc],
]);
function liveTextEvents(h) {
  const frames = new LagFreeFrames({ nmitimen: 0x81 });
  frames.textWait = (_h, _events, _status, pc) => {
    const request = TEXT_UPLOAD_REQUESTS.get(pc);
    if (request === undefined) throw new Error(`Unexpected text wait ${pc.toString(16)}`);
    h.a.mem.write16(request, 0);
    return true;
  };
  return { interrupts: frames };
}
// The window opening 80:F963: the last window index anywhere up to past the limit, window
// positions at and past the map's edges, sizes from 3 x 3 up, attributes, and the next
// tile near the wrap at 2400. The lifted
// side services the same tile and map requests at their lag-free blocking branches.
// Real upload NMIs remain covered by the integration comparisons.
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
  // The lifted window opening leaves no A, X, Y and flags (user decision 2026-11-17).
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    runOpenWindow(h, liveWindowEvents(h));
    return dataBank(h);
  },
};
registerCases([WINDOW_OPEN], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});

const plainLifted =
  (run, long, events, result = roundRegisters) =>
  (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = long ? 0x81 : 0x80;
    if (long) h.pushByte(0x81);
    h.push(0x1234, 2);
    run(h, events?.(h));
    return result(h);
  };
const DIALOG_SMALL = [
  {
    name: 'colour clear 81:886A',
    entry: 0x81886a,
    long: true,
    samples: 100,
    prepare: wordInput,
    // The lifted colour clear leaves no registers.
    lifted: plainLifted(clearFixedColourJsl, true, undefined, dataBank),
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
    // The lifted text width leaves no registers.
    lifted: plainLifted(setWindowTextWidthJsr, false, undefined, dataBank),
  },
  {
    name: 'notice windows 80:FF79',
    entry: 0x80ff79,
    samples: 300,
    prepare: (s) => {
      for (let x = 0; x < 8; x += 2) if (s.rnd(3) === 0) s.put(NOTICE_WINDOWS + x, 0xffff);
      return wordInput(s);
    },
    // Game state only: the lifted release leaves no registers.
    lifted: plainLifted(runReleaseNoticeWindows, false, liveWindowEvents, () => undefined),
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
// The portrait rows 80:8F20: the rows shifted from random data banks.
const PORTRAITS = [
  {
    name: 'portrait rows 80:8F20',
    entry: 0x808f20,
    samples: 50,
    prepare: (s) => ({ ...wordInput(s), bank: s.pick([0x80, 0x7e, 0]) }),
    // Game state only (user decision 2026-11-17): the lifted rows leave no registers.
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      shiftPortraitRowsJsr(h);
      return dataBank(h);
    },
  },
];
// The row shift's data bank push and the job count's frame lie below the caller's frame.
registerCases(PORTRAITS, {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
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
// page or not. The text buffer's upload requests are serviced at their blocking
// branches (liveTextEvents).
//
// Re-keyed on 2026-11-27 from the former form, which drew with the register-level text
// buffer of proof/ and recorded polls: each sample's former outcome confirmed its old
// vector, and the lifted game state matched it outside the text mask buffer
// 7E:2AE0-2AEF, which the recorded polls filled with random read-back words. Three list
// samples that the former form stopped at its recorded polls' end (a fixture boundary,
// task_wait_observation_required) got vectors of their lifted outcome.
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
    return {
      ...wordInput(s),
      y: s.pick([page, (page + 2 * s.rnd(6)) & 0xffff, s.rnd(0x10000)]),
    };
  },
  // The marks end with the lifted text print, which leaves no A, X, Y and flags.
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(
      markRowSequence(h, liveTextEvents(h), drawTextBufferSequence, form, input.y),
    );
    return dataBank(h);
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
// list or past its end. The upload requests are serviced as for the marks.
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
    return wordInput(s);
  },
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(drawListSequence(h, liveTextEvents(h), drawTextBufferSequence));
    return dataBank(h);
  },
};
registerCases([MENU_LIST], {
  sample,
  side: (s) => mathSide(s, new Map()),
  runtime: (h) => h,
  ignored: [[0x1e80, 0x1eef]],
});
