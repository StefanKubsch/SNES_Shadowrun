// Random per-function tests of the lifted start of a game (src/game/game-start.mjs)
// against the register-level reference (proof/game-reference/game-start.mjs): the
// new game state 80:98E9, the new game 80:960D, the save load 81:B198 for every
// slot, and the main start 80:9688 with both choices (docs/MATRIX-LIFT.md). The
// reference calls the register-level game screen set-up 80:9629, room entry 80:A4BF
// and fixed colour 81:8861 through their original frames, the lifted start calls
// their lifted functions directly. The routines the room entry still calls through
// their frames answer as stubs (the glove 80:BCB2 and the notice windows 80:FF79
// release real windows on both sides) that record each call (target, return address, data
// bank, and A for the scene load 81:A117); the object creation 80:A835 creates real
// objects and tasks on both sides, and the turn 80:AAAF turns them.
// Both sides must leave the same WRAM outside the scratch, the same SRAM, device
// writes and the registers their callers read.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { uploadEvents, windowMapSource, windowTables } from './lift-window-samples.mjs';
import { MAIN_START_ROUTINES } from '../src/task/main-start.mjs';
import { GAME_START_REFERENCE_ENTRIES } from '../proof/game-reference/game-start.mjs';
import { GAME_SCREEN_REFERENCE_ENTRIES } from '../proof/game-reference/game-screen.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from '../proof/game-reference/room-entry.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { runGameStart, runNewGame, runNewGameState, runSaveLoad } from '../src/game/game-start.mjs';
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
  DRAW_LIST_INDEX,
  OBJECT_KIND,
  TILE_STACK_LAST,
  TILE_STACK_USES,
} from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
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
const reference = new Map(GAME_START_REFERENCE_ENTRIES);

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

// The routines the room entry calls through their frames, long (RTL) or not, and
// whether the stub records A.
const STUBS = [[0x81b0a1, true]];
function stubbedRoutines() {
  // The reference's own callees (98E9, B198, 9629, A4BF) are references too; the
  // lifted start calls its functions directly.
  const routines = new Map([
    ...MAIN_START_ROUTINES,
    ...GAME_START_REFERENCE_ENTRIES,
    ...GAME_SCREEN_REFERENCE_ENTRIES,
    ...ROOM_ENTRY_REFERENCE_ENTRIES,
  ]);
  for (const [target, long, readsA] of STUBS)
    routines.set(target, (h) => {
      const { ctx } = h;
      (h.a.callLog ??= []).push(
        [target, h.a.stackWord(), ctx.bank, ...(readsA ? [ctx.a] : [])]
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
const summary = (registers) => (h) =>
  [
    ...(h.a.callLog ?? []),
    [...registers, 'bank', 's'].map((r) => h.ctx[r].toString(HEX)).join(),
  ].join(' ');
// The lifted side starts with the reference's registers and caller frame.
const lifted = (run, long, registers) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = input.programBank ?? 0x80;
  if (long) h.pushByte(0x81);
  h.push(0x1234, 2);
  run(h, uploadEvents(), h.a.routines);
  return summary(registers)(h);
};

const CASES = [
  {
    name: 'new game state 80:98E9',
    entry: 0x8098e9,
    samples: 40,
    prepare: () => ({ bank: 0x80, s: GAME_STACK }),
    reference: (h, e, r) => reference.get(0x8098e9)(h, e, r),
    result: summary([]),
    lifted: lifted(runNewGameState, false, []),
  },
  {
    name: 'new game 80:960D',
    entry: 0x80960d,
    samples: 40,
    prepare: () => ({ bank: 0x80, s: GAME_STACK }),
    reference: (h, e, r) => reference.get(0x80960d)(h, e, r),
    result: summary(['a']),
    lifted: lifted(runNewGame, false, ['a']),
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
    reference: (h, e, r) => reference.get(0x81b198)(h, e, r),
    result: summary(['status']),
    lifted: (h, input) => lifted(runSaveLoad, true, ['status'])(h, { ...input, programBank: 0x81 }),
  },
  {
    name: 'main start 80:9688',
    entry: 0x809688,
    samples: 60,
    prepare: () => ({ pc: 0x9688, bank: 0x80, s: GAME_STACK }),
    // The room entry passes its frame events on to its callees.
    events: uploadEvents,
    reference: (h, e, r) => reference.get(0x809688)(h, e, r),
    result: summary(['pc']),
    lifted: lifted(runGameStart, false, ['pc']),
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
