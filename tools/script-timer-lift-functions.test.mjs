// Random per-function tests of the lifted time limit natives (src/game/time-limit.mjs
// through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/script-timer.mjs): 80:E255 (start), 80:E24E (stop) and 80:E262
// (running). Both sides run the native from its script call (data bank 80, direct page
// 0, the RTS frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the
// stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { startTimer as startTimerLifted } from '../src/script/native-timer-start.mjs';
import { stopTimer as stopTimerLifted } from '../src/script/native-timer-stop.mjs';
import { isTimerRunning as isTimerRunningLifted } from '../src/script/native-timer-running.mjs';
import { TIMER, TIMER_FRAMES } from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const startTimer = leafRts(startTimerLifted);
const stopTimer = leafRts(stopTimerLifted);
const isTimerRunning = leafRts(isTimerRunningLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // The hours and the frames each zero in half the samples.
  for (const at of [TIMER, TIMER_FRAMES])
    if (rnd(2)) {
      wram[at] = 0;
      wram[at + 1] = 0;
    }
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const timer = (name, entry, run) => ({
  name,
  entry,
  samples: 200,
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
    timer('startTimer 80:E255', 0x80e255, startTimer),
    timer('stopTimer 80:E24E', 0x80e24e, stopTimer),
    timer('isTimerRunning 80:E262', 0x80e262, isTimerRunning),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
