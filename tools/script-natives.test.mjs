// Script VM lift phases 3 and 4 (docs/SCRIPT-VM-LIFT.md): the natives on the JS scheduler,
// game code inside them on the task API.
// Two live games run in lockstep from the reset with the same pad: A with the
// register-level scheduler and native bridge (src/vm/scheduler.mjs, native-call.mjs), B
// with its rounds on the JS scheduler (src/script/scheduler.mjs) and the natives through
// src/script/natives.mjs, attached by proof/script/js-rounds.mjs. At every NMI the WRAM,
// VRAM, CGRAM and OAM of both games must be equal: the task state through the projection
// of the conversion layer, the rest byte for byte outside the interpreter's work bytes.
//
// Routes: the benchmark route (title, menu, opening dialog, walking) with synchronous
// natives; the closed badge route from the apartment save (alley, Grim Reaper Club with
// topic dialogs, enemies that shoot) with natives that pause across steps, as in the
// browser; the attract demo of the title screen, whose rounds the owner runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { BADGE_BUY_LIVE_PLAN } from './live-plans.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { attachJsRounds, SCHEDULER_BYTES } from '../proof/script/js-rounds.mjs';

const COUNTER_SEED = 12345;
// Interpreter and scheduler work bytes outside the projection (as in
// tools/script-scheduler.test.mjs): the argument and result words 00.., the C2C8/C3C9
// direct page words 71-75, the native pointer at A2, the status words of F927, the
// arithmetic scratch with the outer stack word 01F2 and both stack areas: page 1 below
// the dialog flags 01BA (the main program's stack, where the original scheduler leaves
// its return words) and 1B00-1CBB.
const WORK_BYTES = [
  [0x0000, 0x0020],
  [0x0071, 0x0076],
  [0x00a2, 0x00a4],
  [0x0100, 0x01ba],
  [0x01be, 0x01c2],
  [0x01ea, 0x01f4],
  [0x1b00, 0x1cbc],
  SCHEDULER_BYTES,
];
const PPU_MEMORIES = ['vram', 'cgram', 'oam'];

// The route of tools/live-benchmark.mjs: Start on the title and in the menu, A taps
// through the opening dialog, then a walk in a square.
const DIRECTIONS = [0x0800, 0x0100, 0x0400, 0x0200];
const BENCHMARK_ROUTE = (k) =>
  k >= 3000 && k < 3400
    ? k % 150 < 4
      ? 0x1000
      : 0
    : k >= 3400 && k < 5200
      ? k % 60 < 4
        ? 0x0080
        : 0
      : k >= 5200
        ? DIRECTIONS[Math.floor(k / 90) % 4]
        : 0;
// The title of tools/live-talk.test.mjs: Continue with the apartment save.
const START = 0x1000,
  DOWN = 0x0400,
  PLAN_START = 5000,
  PLAN_SKIP = 3;
const TITLE = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : k >= 3150 && k < 3154
      ? DOWN
      : 0;

const hex = (n) => n.toString(16);
const inside = (n, [start, end]) => n >= start && n < end;

function snapshot(game) {
  const { ppu } = game.bus;
  return {
    wram: game.memory.wram.slice(),
    ...Object.fromEntries(PPU_MEMORIES.map((key) => [key, ppu[key].slice()])),
  };
}
function compare(k, a, b, js) {
  for (let n = 0; n < a.wram.length; n++)
    if (a.wram[n] !== b.wram[n] && !WORK_BYTES.some((range) => inside(n, range)))
      throw Error(`NMI ${k}: 7E:${hex(n)} register-level ${a.wram[n]}, JS ${b.wram[n]}`);
  for (const at of js.projection.keys())
    if (a.wram[at] !== b.wram[at])
      throw Error(
        `NMI ${k}: task byte 7E:${hex(at)} register-level ${a.wram[at]}, JS ${b.wram[at]}`,
      );
  for (const key of PPU_MEMORIES)
    assert.equal(Buffer.compare(a[key], b[key]), 0, `NMI ${k}: ${key}`);
}

// Runs A and B until `nmis` or until done(); compares each NMI once both reached it.
// options(side, games) gives the LiveGame options of a side.
function lockstep({ options, nmis, synchronous = false, done = () => false }) {
  const games = {};
  games.a = new LiveGame(cartridge, options(games));
  games.b = new LiveGame(cartridge, options(games));
  const js = attachJsRounds(games.b, { synchronous }),
    pending = [new Map(), new Map()];
  let compared = 0;
  [games.a, games.b].forEach((game, side) => {
    const onNmi = game.frames.onNmi;
    game.frames.onNmi = (k) => {
      onNmi(k);
      // The open round's task state as the original's tables and heap.
      if (side === 1) js.sync();
      const mine = snapshot(game),
        other = pending[1 - side];
      if (!other.has(k)) {
        pending[side].set(k, mine);
        return;
      }
      const theirs = other.get(k);
      other.delete(k);
      if (side === 0) compare(k, mine, theirs, js);
      else compare(k, theirs, mine, js);
      compared++;
    };
  });
  while (games.a.nmis < nmis && !done()) {
    games.a.step();
    while (games.b.nmis < games.a.nmis) games.b.step();
  }
  return { js, compared, nmis: games.a.nmis };
}

const counter = () => counterBytes(COUNTER_SEED);

test(
  'synchronous natives on the JS scheduler match the register-level rounds on the benchmark route',
  { timeout: 600000 },
  () => {
    const { js, compared } = lockstep({
      options: () => ({ pad: BENCHMARK_ROUTE, counter: counter() }),
      nmis: 6000,
      synchronous: true,
    });
    assert.equal(compared, 6000);
    assert.ok(js.paths.driver > 2000, `rounds ${js.paths.driver}`);
    assert.ok(js.calls > 5000, `native calls ${js.calls}`);
    assert.equal(js.pauses, 0);
  },
);

test(
  'pausing natives with nested visits match the register-level rounds on the badge route',
  { timeout: 900000 },
  () => {
    let plan = null;
    const pad = (games) => (k) => {
      if (k < PLAN_START) return TITLE(k);
      plan ??= livePlanDriver(
        BADGE_BUY_LIVE_PLAN.slice(PLAN_SKIP),
        games.a.memory.wram,
        () => games.a.driver.roundsCompleted,
      );
      return plan.done() ? 0 : plan.pad(k);
    };
    const { js } = lockstep({
      options: (games) => ({
        sram: new Uint8Array(loadSave('apartment')),
        pad: pad(games),
        counter: counter(),
      }),
      nmis: Infinity,
      done: () => plan?.done() ?? false,
    });
    assert.ok(plan.done(), 'the badge route ends');
    assert.ok(js.pauses > 1000, `pauses ${js.pauses}`);
    // The topic dialogs append a task (C34A, through the task API) and visit it at once (C1CA).
    assert.ok(js.visits >= 5, `nested visits ${js.visits}`);
    // Enemies shoot (80:8AB5): their projectiles are appended through the task API.
    assert.ok(js.appends.get(0x808ab5) > 0, 'appends inside a native');
  },
);

test(
  'the attract demo runs its owner rounds on the JS scheduler as on the register-level one',
  { timeout: 600000 },
  () => {
    const { js, compared } = lockstep({
      options: () => ({ pad: () => 0, counter: counter() }),
      nmis: 6000,
    });
    assert.equal(compared, 6000);
    assert.ok(js.paths.owner > 100, `owner rounds ${js.paths.owner}`);
    assert.equal(js.paths.driver, 0);
  },
);
