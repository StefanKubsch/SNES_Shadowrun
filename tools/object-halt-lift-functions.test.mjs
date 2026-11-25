// Random per-function tests of the lifted script natives 80:8E96 and 80:8EB8, halting
// and resuming an object and its task (src/game/object-halt.mjs through
// src/script/native-object-halt-set.mjs), against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/object-halt.mjs). Both run from their script call (data bank 80,
// direct page 0, the RTS frame). The object is a game slot (rarely any word) with a task, none
// or rarely any word; the task waits for a child up to three links deep, the links among
// the task slots (or rarely any word). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside
// the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { haltObject, resumeObject } from '../src/script/native-object-halt-set.mjs';
import { OBJECT_TASK } from '../src/data/wram.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../src/vm/layout.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  TASKS = 48;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const object = rnd(32) ? 2 * rnd(SLOTS) : rnd(WORD);
  setWord(wram, 0, object);
  // A word that names no task slot is rare: the task API stops there (task_slot_required).
  let task = rnd(16) ? pick([2 * rnd(TASKS), 2 * rnd(TASKS), 0xffff]) : rnd(WORD);
  if (object < 2 * SLOTS) setWord(wram, OBJECT_TASK + object, task);
  // Waiting for children up to three links deep, then a task not waiting for one.
  if (task < 2 * TASKS)
    for (let depth = rnd(4); ; depth--) {
      if (depth === 0) {
        setWord(wram, TASK_WAIT + task, rnd(0x8000));
        break;
      }
      setWord(wram, TASK_WAIT + task, 0x8000 | rnd(0x8000));
      const previous = rnd(32) ? 2 * rnd(TASKS) : rnd(WORD);
      setWord(wram, TASK_PREVIOUS + task, previous);
      if (previous >= 2 * TASKS) break;
      task = previous;
    }
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, run) => ({
  name,
  entry,
  samples: 500,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    step('haltObject 80:8E96', 0x808e96, haltObject),
    step('resumeObject 80:8EB8', 0x808eb8, resumeObject),
  ],
  {
    sample,
    side: (s) => createSide(s, new Map()),
    runtime: (h) => h,
    ignored: [],
    outside: new Set(['task_slot_required', 'task_chain_unbounded']),
  },
);
