// Random per-function tests of the lifted start of a game (src/game/game-start.mjs)
// against the frozen outcomes (tools/lift-vectors/) of the former register-level
// reference (retired with proof/): the new game state 80:98E9, the new game 80:960D,
// the save load 81:B198 for every slot, and the main start 80:9688 with both choices
// (docs/MATRIX-LIFT.md). The main start runs the lifted game screen set-up, room entry
// and fixed colour directly; the glove 80:BCB2 and the notice windows 80:FF79 release
// real windows, the object creation 80:A835 creates real objects and tasks, and the
// turn 80:AAAF turns them. Its frame waits (81:B0A1) see the frame counter advance.
// The outcomes are game state only (user decision 2026-11-17): WRAM outside the
// scratch, SRAM and device writes.
//
// Re-keyed on 2026-11-27 from the register-level caller forms of proof/caller: each
// sample's former outcome confirmed its old vector, and the lifted outcome left the
// same game state as the former one outside the sample loader state 7E:0089-008B and
// 008F-0099 (docs/MATRIX-LIFT.md); for the main start the former form's frame wait
// stub advanced the frame counter for that comparison.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  liveWindowEvents,
  uploadEvents,
  windowMapSource,
  windowTables,
} from './lift-window-samples.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import {
  gameStartSequence,
  loadSavedGame,
  setUpNewGameState,
  startNewGame,
} from '../src/game/game-start.mjs';
import { drainNativeSequence } from './register-forms/native-call-continuation.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';
import {
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  HEAP_USED,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
} from '../src/vm/layout.mjs';
import {
  RANDOM_STATE,
  DRAW_LIST_INDEX,
  OBJECT_KIND,
  TILE_STACK_LAST,
  TILE_STACK_USES,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The frame wait 81:B0A1 blocks at its branch 81:B0A9 until the counter changes.
const COUNTER_BRANCH = 0x81b0a9;
const WRAM_BYTES = 0x20000,
  // Every case runs on the main stack of the game (the harness's own stack at 01C9
  // lies on the screen shadows 01BC-01C7 that the game screen set-up writes).
  GAME_STACK = 0x1ef0,
  // The game's sound directory pointer (98:FFFA), which the sample loader follows,
  // and the room entry's script list pointer, which its stubbed callees would set.
  SOUND_DIRECTORY = [0, 1, 2].map((n) =>
    new DialogTestMemory(new Uint8Array(WRAM_BYTES)).read8(0x98fffa + n),
  ),
  DP_SCRIPT_LIST = 0x9d,
  DP_OBJECT_LISTS = 0x77,
  OBJECT_LISTS = 0x19000,
  // Not produced by the lifted code: direct page scratch (the save slot 7E:000E
  // included), the unpacker state and the stacks (docs/MATRIX-LIFT.md).
  IGNORED = [
    [0x0000, 0x0034],
    [0x00db, 0x00f3],
    [0x1e80, GAME_STACK],
  ];

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
    wram = new Uint8Array(WRAM_BYTES),
    sram = new Uint8Array(SRAM_SIZE);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  for (let i = 0; i < sram.length; i++) sram[i] = rnd(256);
  wram.set(SOUND_DIRECTORY, 0x8c);
  const scriptList = 0x8000 + rnd(0x2000);
  wram[DP_SCRIPT_LIST] = scriptList & 0xff;
  wram[DP_SCRIPT_LIST + 1] = scriptList >>> 8;
  // Two empty object lists at 7F:9000, which the stubbed scene load would leave for
  // the collision grid (tools/room-entry-lift-functions.test.mjs draws full ones).
  wram.set([0x00, 0x90, 0x7f], DP_OBJECT_LISTS);
  wram[OBJECT_LISTS] = 0;
  wram[OBJECT_LISTS + 1] = 0;
  // Empty tile stacks for the scene tiles (the room entry's test draws real ones).
  for (let x = 0; x <= TILE_STACK_LAST; x += 2) wram[TILE_STACK_USES + x + 1] |= 0x80;
  windowMapSource(wram, new DialogTestMemory(new Uint8Array(WRAM_BYTES)));
  windowTables(wram, rnd, pick);
  objectTables(wram, rnd, pick);
  // The new game choice or a save slot in direct page word 0.
  const choice = pick([0xffff, 0x8000, 0, 1]);
  wram[0] = choice & 0xff;
  wram[1] = choice >>> 8;
  return { seed, wram, sram, rnd, pick };
}

const side = (s) => createSide(s, new Map());

// The lifted forms with the frames of their original callers.
const lift = (run, long) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = input.programBank ?? 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, uploadEvents());
};
const NEW_GAME_STATE = (h) => {
    setUpNewGameState(h.a);
    return h.rts();
  },
  NEW_GAME = (h) => {
    startNewGame(h.a);
    return h.rts();
  },
  SAVE_LOAD = (h) => {
    loadSavedGame(h.a, h.ctx.a & WORD_MASK);
    return h.rtl();
  },
  GAME_START = (h) => drainNativeSequence(gameStartSequence(h, frameEvents(h)));
// The room entry's frame waits (81:B0A1) see the frame counter advance once each; the
// window uploads are serviced.
function frameEvents(h) {
  const events = liveWindowEvents(h),
    frames = events.interrupts,
    service = frames.textWait;
  frames.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== COUNTER_BRANCH) return service(callee, frameEvents, status, pc);
    h.a.mem.write16(RANDOM_STATE, (h.a.mem.read16(RANDOM_STATE) + 1) & WORD_MASK);
    return true;
  };
  return events;
}

const CASES = [
  {
    name: 'new game state 80:98E9',
    entry: 0x8098e9,
    samples: 40,
    prepare: () => ({ bank: 0x80, s: GAME_STACK }),
    lifted: lift(NEW_GAME_STATE, false),
  },
  {
    name: 'new game 80:960D',
    entry: 0x80960d,
    samples: 40,
    prepare: () => ({ bank: 0x80, s: GAME_STACK }),
    lifted: lift(NEW_GAME, false),
  },
  {
    name: 'save load 81:B198',
    entry: 0x81b198,
    long: true,
    prepare: (s) => ({
      a: s.pick([0, 1]),
      bank: s.pick([0x80, 0x81]),
      status: s.pick([0, 0x43]),
      s: GAME_STACK,
    }),
    lifted: (h, input) => lift(SAVE_LOAD, true)(h, { ...input, programBank: 0x81 }),
  },
  {
    name: 'main start 80:9688',
    entry: 0x809688,
    samples: 60,
    prepare: () => ({ pc: 0x9688, bank: 0x80, s: GAME_STACK }),
    lifted: lift(GAME_START, false),
  },
];

// A full heap or no free task slot stops the lifted object creation at a frontier, a
// slot past the object tables (a failed creation turned through the selection path)
// the group.
registerCases(CASES, {
  sample,
  side,
  runtime: (h) => h,
  ignored: IGNORED,
  outside: new Set(['task_heap_required', 'task_slot_required', 'object_slot_required']),
});
