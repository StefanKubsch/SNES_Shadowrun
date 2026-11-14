// Random per-function test of the lifted room entry 80:A4BF (src/game/room-entry.mjs,
// table entry enterRoom in src/task/main-transition.mjs) against the register-level
// reference (proof/game-reference/room-entry.mjs), docs/ROOM-ENTRY-LIFT.md. The
// glove 80:BCB2 and the notice windows 80:FF79 release their windows for real on both
// sides (each release redraws the window list). The routines both sides still call
// through their frames answer as stubs that record
// each call (target, return address, data bank) with the inputs they read: the argument words 00 to 08 for the object creation 80:A835
// (which answers with a slot in word 00) and the turn 80:AAAF. The group 80:A2FA, the
// actors 80:A3B6, the camera box clamp 81:8A05, the scene load 81:A117, the scene
// tiles 81:9AE6, the camera jump 81:8BD9, the collision grid 81:8756 and the window
// list 81:AD92 (with its real window map unpack and one recorded upload poll) run lifted on one side and register-level on the other; they
// are also compared alone, the actors on a synthetic header with any actor of the
// table, the grid on synthetic object and room lists, the tiles on tile stacks of
// real streams, the scene load on random scenes (twice their number). Both sides must
// leave the same WRAM outside the scratch, the same device writes and the same calls.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { uploadEvents, windowMapSource, windowTables } from './lift-window-samples.mjs';
import { MAIN_START_ROUTINES } from '../src/task/main-start.mjs';
import { TRANSITION_ROUTINES, enterRoom } from '../src/task/main-transition.mjs';
import { clampToCameraBox } from '../src/game/camera-box.mjs';
import { createGroupSequence, placeRoomActorsSequence } from '../src/game/room-actors.mjs';
import { buildCollisionGrid } from '../src/game/collision-grid.mjs';
import { uploadSceneTilesSequence } from '../src/game/scene-tiles.mjs';
import { updateTileBuffers, uploadMapEdges } from '../src/game/camera-scroll.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { loadSceneSequence } from '../src/game/scene-load.mjs';
import { createObject } from '../src/game/object-create.mjs';
import { appendScriptTaskCall } from '../src/game/task-append.mjs';
import { appendScriptTask as appendScriptTaskReference } from '../src/task/task-append.mjs';
import { turnObject, turnObjectRoutine } from '../src/game/object-turn.mjs';
import { setObjectDirection } from '../src/task/native-object-action-set.mjs';
import {
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  HEAP_USED,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
} from '../src/vm/layout.mjs';
import { putGloveAwaySequence, releaseNoticeWindowsSequence } from '../src/game/window-release.mjs';
import { SCENES } from '../src/data/lz-streams.mjs';
import { TILE_STREAMS } from '../src/data/tiles.mjs';
import { OBJECT_TYPES } from '../src/data/object-types.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';
import { enterRoomReference } from '../proof/game-reference/room-entry.mjs';
import {
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_DIRECTION,
  OBJECT_FRAME_COUNT,
  OBJECT_SELECTION,
  CAMERA_BOX,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_Y,
  MAP_COLUMN_UPLOAD,
  MAP_ROW_UPLOAD,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DRAW_LIST_INDEX,
  OBJECT_KIND,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  GAME_OPTIONS,
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  TILE_STACK_FIRST,
  TILE_STACK_LAST,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
  JAKE_DERMAL_ARMOUR,
  MUSIC,
  OPTION_MUSIC_RESTORE,
  STORY_STAGE,
} from '../src/task/wram.mjs';
import { RUNNERS, RUNNER_TABLE } from '../src/data/runners.mjs';
import { ACTORS, ACTOR_BYTES, ACTOR_TABLE } from '../src/data/actors.mjs';

const WRAM_BYTES = 0x20000,
  // The cartridge, read through an empty WRAM.
  ROM_MEMORY = new DialogTestMemory(new Uint8Array(0x20000)),
  HEX = 16,
  // The game's sound directory pointer (98:FFFA), which the sample loader follows,
  SOUND_DIRECTORY = [0, 1, 2].map((n) => ROM_MEMORY.read8(0x98fffa + n)),
  ROOMS = 498,
  // The scripts of the table (00 to 03A8, the highest an actor starts).
  SCRIPTS = 0x3a9,
  DP_SCRIPT_LIST = 0x9d,
  DP_ROOM_HEADER = 0x86,
  // Jake's figure, and the only actor of the table whose flags are zero.
  JAKE_KIND = 0x0b,
  ZERO_FLAGS_ACTOR = Array.from({ length: ACTORS }, (_, n) => ACTOR_BYTES * n).find(
    (at) => ROM_MEMORY.read8(ACTOR_TABLE + at) === 0,
  ),
  // A synthetic room header in WRAM for the actors alone.
  HEADER = 0x7e3000,
  HEADER_ACTORS = 4,
  // The main stack of the game (the harness's own stack at 01C9 lies on the screen
  // shadows that the entry writes).
  GAME_STACK = 0x1ef0,
  // Not produced by the lifted code: direct page scratch (the start words are
  // recorded at the group call instead) and the stack. The unpacker state (00DB to
  // 00F2) is compared: the lifted unpackers leave it as the original.
  IGNORED = [
    [0x0000, 0x0034],
    [0x1e80, GAME_STACK],
  ];
// The routines called through their frames, long (RTL) or not, and the direct page
// words a stub records.
const STUBS = [[0x81b0a1, true, []]];

// The object creation's inputs on both sides: object slots, half of them free, or one
// (often the first); a draw
// list of up to 20 objects; a heap of blocks of up to 0100 bytes, a third of them
// used, over the game's 07CC bytes from 03D2; task slots, three quarters of them on
// the free list in random order, or (rarely) none free, and a task list head.
const OBJECT_SLOTS = 0x2c,
  HEAP_BYTES = 0x7cc;
function objectTables(wram, rnd, pick) {
  const put = (at, value) => {
    wram[at] = value & 0xff;
    wram[at + 1] = (value >>> 8) & 0xff;
  };
  const only = pick([-1, -1, 0, 2 * rnd(OBJECT_SLOTS)]);
  for (let x = 0; x < 2 * OBJECT_SLOTS; x += 2)
    put(OBJECT_KIND + x, (only < 0 ? rnd(2) : x === only) ? 0x8000 | rnd(0x8000) : rnd(0x100));
  put(DRAW_LIST_INDEX, pick([0xfffe, 2 * rnd(20)]));
  for (let x = 0; ;) {
    const left = HEAP_BYTES - x,
      size = left < 0x110 ? left : 1 + rnd(0x100);
    put(HEAP_SIZE_WORD + x, size | (rnd(3) ? 0 : HEAP_USED));
    if (size === left) {
      put(HEAP_NEXT_WORD + x, 0);
      break;
    }
    put(HEAP_NEXT_WORD + x, x + 4 + size);
    x += 4 + size;
  }
  const slots = Array.from({ length: 48 }, (_, n) => 2 * n);
  for (let n = slots.length - 1; n > 0; n--) {
    const m = rnd(n + 1);
    [slots[n], slots[m]] = [slots[m], slots[n]];
  }
  const free = rnd(32) ? slots.filter(() => rnd(4)) : [];
  put(TASK_FREE_LIST, free.length ? free[0] : 0xffff);
  free.forEach((x, n) => put(TASK_NEXT + x, n + 1 < free.length ? free[n + 1] : 0xffff));
  put(TASK_LIST_HEAD, pick([0xffff, slots.find((x) => !free.includes(x)) ?? 0xffff]));
}

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  wram.set(SOUND_DIRECTORY, 0x8c);
  const setWord = (at, value) => {
    wram[at] = value & 0xff;
    wram[at + 1] = value >>> 8;
  };
  // Both music branches: the option, a running fight, no music or the fight's music.
  setWord(GAME_OPTIONS, pick([0, OPTION_MUSIC_RESTORE, rnd(0x10000)]));
  setWord(FIGHT_LIST_INDEX, pick([0xfffe, rnd(0x80)]));
  setWord(MUSIC, pick([0xffff, rnd(0x20), rnd(0x10000)]));
  setWord(FIGHT_MUSIC, pick([0xffff, rnd(0x20)]));
  // The script list pointer, which the stubbed callees would set: in the room data.
  setWord(DP_SCRIPT_LIST, 0x8000 + rnd(0x2000));
  // A group of up to four runners (the group holds runners only), or none; Jake's
  // figure with and without dermal armour.
  setWord(GROUP_INDEX, pick([0xffff, 0, 2, 4, 6]));
  for (let n = 0; n < 4; n++) {
    const at = RUNNER_TABLE + 2 * rnd(RUNNERS);
    setWord(GROUP_NUMBERS + 2 * n, ROM_MEMORY.read8(at) | (ROM_MEMORY.read8(at + 1) << 8));
    setWord(GROUP_OBJECTS + 2 * n, pick([JAKE_KIND, rnd(0x40)]));
  }
  wram[JAKE_DERMAL_ARMOUR] = pick([0, rnd(0x100)]);
  // Actors gated by their flags alone, or by the story stage too.
  setWord(STORY_STAGE, pick([0, rnd(0x10000)]));
  // The camera box: none, a box in bank 7F (any limits, or none at its first word),
  // clear of the game state the entry reads, or any pointer.
  const box = 0x18000 + rnd(0x1000);
  if (rnd(2)) setWord(box + 1, 0xffff);
  wram[CAMERA_BOX] = box & 0xff;
  setWord(CAMERA_BOX + 1, pick([0, 0x7f00 | ((box >>> 8) & 0xff), rnd(0x10000)]));
  tileStacks(wram, rnd, pick);
  windowMapSource(wram, ROM_MEMORY);
  windowTables(wram, rnd, pick);
  objectTables(wram, rnd, pick);
  return { seed, wram, rnd, pick };
}

// Tile stacks: mostly empty; the others draw from 80 streams of the cartridge (more
// than the 64 cache entries), any tile of a stream, flipped either way, with up to
// two tiles over it.
const TILE_POOL = 80,
  TILE_SHARE = 8;
function tileStacks(wram, rnd, pick) {
  const pool = Array.from({ length: TILE_POOL }, () => rnd(TILE_STREAMS) << 2),
    id = () => pick(pool) | rnd(4) | pick([0, 0x4000, 0x8000, 0xc000]),
    put = (at, value) => {
      wram[at] = value & 0xff;
      wram[at + 1] = value >>> 8;
    };
  for (let x = 0; x <= TILE_STACK_LAST; x += 2) {
    const used = rnd(TILE_SHARE) === 0;
    put(TILE_STACK_USES + x, used ? rnd(0x10) : 0x8000 | rnd(0x8000));
    put(TILE_STACK_FIRST + x, id());
    put(TILE_STACK_SECOND + x, pick([0, 0, id()]));
    put(TILE_STACK_THIRD + x, pick([0, id()]));
  }
}

function stubbedRoutines() {
  const routines = new Map([...MAIN_START_ROUTINES, ...TRANSITION_ROUTINES]);
  for (const [target, long, words, readsA] of STUBS)
    routines.set(target, (h) => {
      const { ctx } = h,
        wram = h.a.mem.wram;
      (h.a.callLog ??= []).push(
        [
          target,
          h.a.stackWord(),
          ctx.bank,
          ...(readsA ? [ctx.a] : []),
          ...words.map((at) => wram[at] | (wram[at + 1] << 8)),
          // The words the caller pushed around the frame wait.
          ...(target === 0x81b0a1 ? [3, 5, 7].map((n) => h.a.stackWord(n)) : []),
        ]
          .map((v) => v.toString(HEX))
          .join(':'),
      );
      // The callees leave other registers.
      ctx.a = 0xbeef;
      return long ? h.rtl() : h.rts();
    });
  return routines;
}
const side = (s) => {
  const state = createSide(s, stubbedRoutines());
  state.a.routines = state.routines;
  return state;
};
const summary = (h) =>
  [...(h.a.callLog ?? []), ['bank', 's', 'pc'].map((r) => h.ctx[r].toString(HEX)).join()].join(' ');

const CASES = [
  {
    name: 'room entry 80:A4BF',
    entry: 0x80a4bf,
    samples: 200,
    prepare: (s) => {
      // The object lists the stubbed scene load would leave for the collision grid.
      gridLists(s);
      return {
        // Rooms of the table, and any word: it reads on past the table, reaching the
        // carry of room * 9 and start positions beyond the camera row base.
        a: s.pick([s.rnd(ROOMS), s.rnd(ROOMS), 3, 0xab, s.rnd(0x10000), s.rnd(0x10000)]),
        bank: 0x80,
        s: GAME_STACK,
      };
    },
    events: uploadEvents,
    reference: (h, e, r) => enterRoomReference(h, e, r),
    result: summary,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.ctx.programBank = 0x80;
      h.push(0x1234, 2);
      enterRoom(h, uploadEvents(), h.a.routines);
      return summary(h);
    },
  },
];

// The camera box clamp alone, any camera position (direct page 0E and 11).
// They write the direct page words the original uses as locals, which the Mesen
// oracle compares, so only the unpacker state and the stack are ignored.
const ALONE = [];
ALONE.push({
  name: 'camera box clamp 81:8A05',
  entry: 0x818a05,
  long: true,
  samples: 400,
  prepare: () => ({ bank: 0x80 }),
  // The same caller frame as the reference (long, bank 81, return word 1234).
  lifted: (h) => {
    h.pushByte(0x81);
    h.push(0x1234, 2);
    clampToCameraBox(h.a.mem, h.a.mem.wram);
  },
});

// The tile buffers and the map edges alone: camera positions in range or any word,
// speeds of the camera jump and the main loop camera (steps of 4 up to 20) or any
// word, often zero or a step onto the limit, and marked or unmarked edges.
function cameraState(s) {
  const put = (at, value) => {
    s.wram[at] = value & 0xff;
    s.wram[at + 1] = (value >>> 8) & 0xff;
  };
  const speed = () => s.pick([0, 0, 4 * (s.rnd(0x11) - 8), 0x20, 0xffe0, s.rnd(0x10000)]);
  put(CAMERA_X, s.pick([s.rnd(0x801), s.rnd(0x801), s.pick([0, 0x800]), s.rnd(0x10000)]));
  put(CAMERA_Y, s.pick([s.rnd(0x47d), s.rnd(0x47d), s.pick([0, 0x47c]), s.rnd(0x10000)]));
  put(CAMERA_SPEED_X, speed());
  put(CAMERA_SPEED_Y, speed());
  // Often a step that lands exactly on the limit.
  for (const [at, speedAt, maximum] of [
    [CAMERA_X, CAMERA_SPEED_X, 0x800],
    [CAMERA_Y, CAMERA_SPEED_Y, 0x47c],
  ])
    if (s.rnd(3) === 0) {
      put(speedAt, 4 * (1 + s.rnd(8)));
      put(at, maximum - (s.wram[speedAt] | (s.wram[speedAt + 1] << 8)));
    }
  put(MAP_COLUMN_UPLOAD, s.pick([0, s.rnd(0x10000)]));
  put(MAP_ROW_UPLOAD, s.pick([0, s.rnd(0x10000)]));
  return { bank: 0x80, s: GAME_STACK };
}
ALONE.push(
  {
    name: 'tile buffers 81:8A91',
    entry: 0x818a91,
    long: true,
    samples: 400,
    prepare: cameraState,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.pushByte(0x81);
      h.push(0x1234, 2);
      updateTileBuffers(h.a.mem.wram);
    },
  },
  {
    name: 'map edges 81:8954',
    entry: 0x818954,
    long: true,
    samples: 300,
    prepare: cameraState,
    lifted: (h, input) => {
      Object.assign(h.ctx, input);
      h.pushByte(0x81);
      h.push(0x1234, 2);
      uploadMapEdges(h.a.mem.wram, sceneRuntime(h).video);
    },
  },
);

// The group and the actors alone, called from bank 80 with the same caller frame on
// both sides (return word 1234).
const calls = (h) => (h.a.callLog ?? []).join(' ');
function liftedAlone(sequence) {
  return (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(sequence(h));
    h.a.pullWord();
    return calls(h);
  };
}
ALONE.push(
  {
    name: 'group 80:A2FA',
    entry: 0x80a2fa,
    // Mostly four free object slots or more, as the room entry leaves them (it frees
    // all); otherwise a member may find none, and the turn then reads the kind as slot.
    prepare: (s) => {
      if (s.rnd(4))
        for (let n = 0; n < 4; n++) {
          const at = OBJECT_KIND + 2 * s.rnd(OBJECT_SLOTS);
          s.wram[at + 1] |= 0x80;
        }
      return { bank: 0x80, s: GAME_STACK };
    },
    events: () => ({ calls: [] }),
    result: calls,
    lifted: liftedAlone(createGroupSequence),
  },
  {
    name: 'actors 80:A3B6',
    entry: 0x80a3b6,
    samples: 400,
    // Up to eight actors of the whole table, the one with zero flags often.
    prepare: (s) => {
      const w = s.wram,
        at = HEADER & 0xffff,
        count = s.rnd(9);
      w[DP_ROOM_HEADER] = at & 0xff;
      w[DP_ROOM_HEADER + 1] = at >>> 8;
      w[DP_ROOM_HEADER + 2] = HEADER >>> 16;
      w[at + HEADER_ACTORS] = count;
      for (let n = 0; n < count; n++) {
        const actor = s.pick([ACTOR_BYTES * s.rnd(ACTORS), ZERO_FLAGS_ACTOR]),
          entry = at + HEADER_ACTORS + 1 + 6 * n + 4;
        w[entry] = actor & 0xff;
        w[entry + 1] = actor >>> 8;
      }
      return { bank: 0x80, s: GAME_STACK };
    },
    events: () => ({ calls: [] }),
    result: calls,
    lifted: liftedAlone(placeRoomActorsSequence),
  },
);

// The collision grid alone: two object lists in bank 7F (objects of every type,
// flipped, without boxes by position or height) and three room lists (boxes of up to
// four cells per side, the last two with a data word).
const OBJECT_LISTS = 0x19000,
  ROOM_LISTS = 0x1a000,
  DP_OBJECT_LISTS = 0x77,
  DP_ROOM_LISTS = 0x9a;
function gridLists(s) {
  const w = s.wram;
  let at = OBJECT_LISTS;
  const byte = (v) => (w[at++] = v & 0xff),
    wordAt = (v) => {
      byte(v);
      byte(v >>> 8);
    };
  for (const [dp, start] of [
    [DP_OBJECT_LISTS, OBJECT_LISTS],
    [DP_ROOM_LISTS, ROOM_LISTS],
  ]) {
    w[dp] = start & 0xff;
    w[dp + 1] = (start >>> 8) & 0xff;
    w[dp + 2] = 0x7e + (start >>> 16);
  }
  for (let list = 0; list < 2; list++) {
    const count = s.rnd(7);
    byte(count);
    for (let n = 0; n < count; n++) {
      wordAt(s.rnd(OBJECT_TYPES) | s.pick([0, 0, 0x8000, 0x2000, 0x4000]));
      byte(s.pick([s.rnd(0x80), s.rnd(0x80), 0x80 + s.rnd(0x80)]));
      byte(s.rnd(0x100));
      byte(s.rnd(0x100));
    }
  }
  at = ROOM_LISTS;
  for (let list = 0; list < 3; list++) {
    const count = s.rnd(5);
    byte(count);
    for (let n = 0; n < count; n++) {
      const x = s.rnd(0x400),
        y = s.rnd(0x400),
        z = s.rnd(0x100);
      for (const v of [x, y, z, x + s.rnd(0x100), y + s.rnd(0x100), z + s.rnd(0x40)]) wordAt(v);
      if (list) wordAt(s.rnd(0x10000));
    }
  }
}
ALONE.push({
  name: 'collision grid 81:8756',
  entry: 0x818756,
  long: true,
  prepare: (s) => {
    gridLists(s);
    return { bank: 0x80, s: GAME_STACK };
  },
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.pushByte(0x81);
    h.push(0x1234, 2);
    buildCollisionGrid(h.a.mem, h.a.mem.wram);
  },
});

ALONE.push({
  name: 'scene tiles 81:9AE6',
  entry: 0x819ae6,
  long: true,
  samples: 60,
  prepare: () => ({ bank: 0x80, s: GAME_STACK }),
  events: () => ({ calls: [] }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x81;
    h.pushByte(0x81);
    h.push(0x1234, 2);
    drainNativeSequence(uploadSceneTilesSequence(h));
  },
});

// The scene load alone, any scene; the lifted side's JSL frame is the harness's caller
// frame (bank 81, return word 1234).
const HARNESS_CALL_SITE = 0x1231;
ALONE.push({
  name: 'scene load 81:A117',
  entry: 0x81a117,
  long: true,
  samples: 2 * SCENES,
  prepare: (s) => ({ a: s.rnd(SCENES), bank: 0x80, s: GAME_STACK }),
  events: () => ({ calls: [] }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x81;
    drainNativeSequence(loadSceneSequence(h, input.a, HARNESS_CALL_SITE));
  },
});

// The glove and the notice windows alone, called from bank 80 (return word 1234) with
// the stack compared from the upload wait's frame (1EE2) up: the pushed slot index and
// the return words of their JSRs lie above it. Below it lies the residue of the
// register-level window map 81:A9B2 (the low byte of its JSL frame for the state bar,
// at 1EE1) and window drawing 81:ACCF, whose frames the lifted window list does not
// reproduce: neither waits.
const RELEASES = [
  ['glove 80:BCB2', 0x80bcb2, putGloveAwaySequence],
  ['notice windows 80:FF79', 0x80ff79, releaseNoticeWindowsSequence],
].map(([name, entry, sequence]) => ({
  name,
  entry,
  prepare: () => ({ bank: 0x80, s: GAME_STACK }),
  events: uploadEvents,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    drainNativeSequence(sequence(h, uploadEvents()));
    h.a.pullWord();
  },
}));

// The object creation alone, called from bank 80 (return word 1234) with the stack
// compared too: any kind, a position, any script of the table or none, the
// arguments in the direct page words.
const OBJECT_CREATION = {
  name: 'object creation 80:A835',
  entry: 0x80a835,
  samples: 400,
  prepare: (s) => {
    const put = (at, value) => {
      s.wram[at] = value & 0xff;
      s.wram[at + 1] = (value >>> 8) & 0xff;
    };
    put(DP_OBJECT_KIND, s.pick([s.rnd(0x100), s.rnd(0x10000)]));
    put(DP_OBJECT_SCRIPT, s.pick([0xffff, s.rnd(SCRIPTS), s.rnd(SCRIPTS)]));
    return { bank: 0x80, s: GAME_STACK };
  },
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    createObject(h.a.mem, h.a.mem.wram, h.a);
    h.a.pullWord();
  },
};
// The script task append alone, called with JSR from bank 80 (return word 1234) with
// the stack compared too: any script of the table in X, the arguments in the direct
// page words, the heap and task slots of the object creation; A, X, Y, sign,
// overflow, zero and carry as the original leaves them (src/task/task-append.mjs).
const TASK_APPEND = {
  name: 'task append 80:C34A',
  entry: 0x80c34a,
  samples: 600,
  prepare: (s) => ({
    bank: 0x80,
    s: GAME_STACK,
    x: s.rnd(SCRIPTS),
    a: s.rnd(0x10000),
    y: s.rnd(0x10000),
    status: s.rnd(0x100) & 0xc3,
  }),
  reference: (h) => appendScriptTaskReference(h.a, false),
  result: (h) =>
    [h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status, h.ctx.pc].map((v) => v.toString(16)).join(),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    appendScriptTaskCall(h.a);
    return [h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status, h.ctx.pc].map((v) => v.toString(16)).join();
  },
};
// The turn alone, called from bank 80 (return word 1234) with the stack compared too:
// a game slot (sometimes odd or past the slots), a direction or any word, the slot's
// kind of the action table or any word, a short animation (or 0 or 80 frames) on a
// real record's direction offsets or any frame count, and a selection of the kind's list, none or
// any word.
const ACTION_KINDS = 275,
  ACTION_LIST = 0x8ced8a;
const romWord = (at) => ROM_MEMORY.read8(at) | (ROM_MEMORY.read8(at + 1) << 8);
const OBJECT_TURN = {
  name: 'turn 80:AAAF',
  entry: 0x80aaaf,
  samples: 500,
  prepare: (s) => {
    const put = (at, value) => {
      s.wram[at] = value & 0xff;
      s.wram[at + 1] = (value >>> 8) & 0xff;
    };
    const slot = s.pick([2 * s.rnd(OBJECT_SLOTS), 2 * s.rnd(OBJECT_SLOTS), s.rnd(0x60)]),
      kind = s.rnd(ACTION_KINDS),
      selection = s.rnd(4);
    put(0, slot);
    put(2, s.pick([s.rnd(8), s.rnd(8), s.rnd(0x10000)]));
    put(OBJECT_DIRECTION + slot, s.pick([s.rnd(8), s.rnd(8), s.rnd(0x10000)]));
    if (s.rnd(4)) put(OBJECT_KIND + slot, kind);
    const record = romWord(0x8c0000 | (romWord(ACTION_LIST + 2 * kind) + 2 * selection));
    if (s.rnd(2)) {
      put(OBJECT_FRAME_COUNT + slot, s.pick([1 + s.rnd(0x7f), 1 + s.rnd(0x7f), 0, 0x80]));
      put(OBJECT_ACTION_DIRECTIONS + slot, s.pick([record + 8, s.rnd(0x10000)]));
    }
    put(OBJECT_SELECTION + slot, s.pick([0xffff, selection, selection | 0x8000, s.rnd(0x10000)]));
    return { bank: 0x80, s: GAME_STACK };
  },
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    turnObject(h.a.mem, h.a.mem.wram, h.a);
    h.a.pullWord();
  },
};
// The turn as the walk towards a target calls it (JSR, return word 1234), against the
// register-level turn: the same states, with A, X, Y, sign, overflow, zero and carry
// compared (src/task/native-object-turn.mjs).
const registerWords = (h) =>
  [h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status, h.ctx.pc].map((v) => v.toString(16)).join();
const TURN_REGISTERS = {
  ...OBJECT_TURN,
  name: 'turn 80:AAAF with registers',
  prepare: (s) => ({
    ...OBJECT_TURN.prepare(s),
    a: s.rnd(0x10000),
    x: s.rnd(0x10000),
    y: s.rnd(0x10000),
    status: s.rnd(0x100) & 0xc3,
  }),
  reference: (h) => setObjectDirection(h.a, false),
  result: registerWords,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = 0x80;
    h.push(0x1234, 2);
    turnObjectRoutine(h);
    return registerWords(h);
  },
};
// A full heap or no free task slot stops the lifted creation at a frontier; a slot
// past the object tables (a failed creation turned through the selection path) the
// group and the turn.
const FRONTIERS = new Set(['task_heap_required', 'task_slot_required', 'object_slot_required']);

registerCases(CASES, { sample, side, runtime: (h) => h, ignored: IGNORED, outside: FRONTIERS });
registerCases([OBJECT_CREATION, OBJECT_TURN, TURN_REGISTERS, TASK_APPEND], {
  sample,
  side,
  runtime: (h) => h,
  ignored: [],
  outside: FRONTIERS,
});
registerCases(RELEASES, {
  sample,
  side,
  runtime: (h) => h,
  ignored: [IGNORED[0], [0x1e80, 0x1ee2]],
});
registerCases(ALONE, {
  sample,
  side,
  runtime: (h) => h,
  ignored: IGNORED.slice(1),
  outside: FRONTIERS,
});
