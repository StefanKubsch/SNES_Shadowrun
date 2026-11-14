// Random per-function tests of the lifted hit (src/game/object-hit.mjs) against the
// register-level hit 80:8691 with the player hit 80:881C (src/task/native-object-hit.mjs).
// Both sides run their real random number 80:C51F, object slots 80:A835 (with the task
// append on free heap blocks) and sound 80:C46E; the notices' window 80:F963, text
// 80:FE69, word wait 81:B0A1, confirm key 80:F953 and release 80:FA3E and the window list
// 81:AD92 are shared stand-ins that record their inputs (calleeRecord: the window's direct
// page words, the text pointer, the window to release and X during the word waits) and
// leave a window in DP 00. Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside
// the stacks, the device writes, the stand-in calls and the return must be equal; the
// registers the hit leaves are not compared (its callers restore their own).
import { prng } from './task-native-dialog-harness.mjs';
import { calleeRecord, createSide, registerCases } from './lift-function-harness.mjs';
import { hitObject } from '../src/task/native-object-hit.mjs';
import { hitObjectSequence } from '../src/game/object-hit.mjs';
import {
  DRAW_LIST_INDEX,
  HARMLESS_HITS,
  KARMA,
  OBJECT_ARMOUR,
  OBJECT_BOX_HEIGHT,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_RECORD,
  OBJECT_TASK,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
} from '../src/task/wram.mjs';
import {
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
  TASK_WAIT,
} from '../src/vm/layout.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  DAMAGEABLE = 0x2000,
  HITTABLE = 0x8000,
  // The task slots (48 words) and two free heap blocks for the new objects' tasks.
  TASK_SLOTS = 0x30,
  HEAP_BLOCK = 0x400,
  DRAW_LIST_OBJECTS = 40,
  // A record in low WRAM (its count byte at +2).
  RECORD_AREA = 0x2000,
  // The stand-ins' callees: the long ones return with RTL.
  WINDOW = 0x80f963,
  TEXT = 0x80fe69,
  WORD_WAIT = 0x81b0a1,
  CONFIRM_KEY = 0x80f953,
  RELEASE = 0x80fa3e,
  WINDOW_LIST = 0x81ad92,
  LONG_CALLEES = new Set([WORD_WAIT, WINDOW_LIST]),
  RECORDED = new Map([
    [WINDOW, { dp: [0, 2, 4, 6, 8] }],
    [TEXT, { dp: [2] }],
    [WORD_WAIT, { registers: ['x'] }],
    [CONFIRM_KEY, {}],
    [RELEASE, { dp: [0] }],
    [WINDOW_LIST, {}],
  ]);

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const word = (w, at) => w[at] | (w[at + 1] << 8);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const slot = () => rnd(0x2c) * 2,
    target = slot(),
    shooter = rnd(3) ? slot() : 0x8000 | rnd(WORD),
    damage = rnd(4) ? rnd(0x20) : rnd(WORD);
  // The target's flags: damageable, harmless (hittable) or neither.
  const kind = rnd(4),
    flags = word(wram, OBJECT_FLAGS + target) & ~(DAMAGEABLE | HITTABLE);
  setWord(
    wram,
    OBJECT_FLAGS + target,
    kind < 2 ? flags | DAMAGEABLE : kind === 2 ? flags | HITTABLE : flags,
  );
  // Harmless hits just below a notice, karma above or below the penalty.
  setWord(wram, HARMLESS_HITS, [3, 7, 2, rnd(WORD)][rnd(4)]);
  setWord(wram, KARMA, [7, 8, rnd(0x10), rnd(WORD)][rnd(4)]);
  wram[OBJECT_ARMOUR + target] = rnd(3) ? rnd(8) : rnd(BYTE);
  // A record (or none) with a small count; the target's task, its wait chain or none.
  const record = rnd(3) ? RECORD_AREA + rnd(0x1000) : 0;
  setWord(wram, OBJECT_RECORD + target, record);
  if (record) wram[record + 2] = rnd(4) ? rnd(0x20) : rnd(BYTE);
  for (let t = 0; t < TASK_SLOTS * 2; t += 2) wram[TASK_WAIT + t + 1] &= 0x7f;
  let task = 2 * rnd(TASK_SLOTS);
  setWord(wram, OBJECT_TASK + target, rnd(6) ? task : 0x8000 | rnd(WORD));
  for (let n = rnd(3); n > 0; n--) {
    const previous = 2 * rnd(TASK_SLOTS);
    if (previous === task) break;
    wram[TASK_WAIT + task + 1] |= 0x80;
    setWord(wram, TASK_PREVIOUS + task, previous);
    task = previous;
  }
  // The player figure, mostly the target; the shooter's facing in the impact tables.
  setWord(wram, PLAYER_OBJECT, rnd(2) ? target : slot());
  if (!(shooter & 0x8000)) setWord(wram, OBJECT_DIRECTION + shooter, rnd(8) ? rnd(8) : rnd(WORD));
  for (const offset of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT, OBJECT_BOX_HEIGHT])
    if (rnd(2)) setWord(wram, offset + target, rnd(0x4000));
  // Free object slots, the draw list and two free task slots with a heap block each.
  for (let n = 0; n < 4; n++) wram[OBJECT_KIND + slot() + 1] |= 0x80;
  setWord(wram, DRAW_LIST_INDEX, 2 * rnd(DRAW_LIST_OBJECTS));
  setWord(wram, HEAP_SIZE_WORD, HEAP_BLOCK);
  setWord(wram, HEAP_NEXT_WORD, 0);
  const free = 2 * rnd(TASK_SLOTS),
    second = (free + 2 + 2 * rnd(TASK_SLOTS - 1)) % (TASK_SLOTS * 2),
    head = 2 * rnd(TASK_SLOTS);
  setWord(wram, TASK_FREE_LIST, free);
  setWord(wram, TASK_NEXT + free, second);
  setWord(wram, TASK_NEXT + second, 0xffff);
  setWord(wram, TASK_LIST_HEAD, head === free || head === second ? 0xffff : head);
  return { seed, wram, rnd, damage, target, shooter };
}

// The stand-ins of one side; both sides draw the same windows.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    calls = [],
    routines = new Map();
  for (const [target, recorded] of RECORDED)
    routines.set(target, (h) => {
      calls.push(calleeRecord(target, h, recorded));
      if (target === WINDOW) setWord(h.a.mem.wram, 0, Math.floor(random() * 0x40) * 2);
      return { rawReturnWord: LONG_CALLEES.has(target) ? h.rtl() : h.rts() };
    });
  return { routines, calls };
}
const returned = (h, calls) => [h.ctx.pc.toString(HEX), h.ctx.s.toString(HEX), ...calls].join(' ');
let referenceCalls, current;
registerCases(
  [
    {
      name: 'hitObject 80:8691',
      entry: 0x808691,
      samples: 600,
      prepare: (s) => {
        current = s;
        return { bank: CODE_BANK, a: s.damage, x: s.target, y: s.shooter, status: 0 };
      },
      reference: (h) => {
        const { routines, calls } = standIns(current);
        referenceCalls = calls;
        hitObject(h.a, { calls: [] }, false, routines);
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(hitObjectSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
