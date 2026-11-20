// Scenarios of the golden traces (docs/STATE-MODEL-REBUILD.md). Each one names the
// LiveGame start options a replay needs (options) and how it was first played
// (record): the existing closed plans of the live tests. Their drivers read WRAM, which
// is why the trace keeps the inputs they produced instead of the plans.
import { LiveGame } from '../../src/video/live-game.mjs';
import { counterBytes } from '../../src/vm/frame-events.mjs';
import { loadSave } from '../mesen-f390-oracle.mjs';
import { livePlanDriver } from '../live-plan-driver.mjs';
import { exploreLive } from '../explore-live.mjs';
import { BADGE_BUY_LIVE_PLAN } from '../live-plans.mjs';
import { PLAN as ALLEY_PLAN } from '../live-alley-plan.mjs';
import { PLAN as MATRIX_PLAN } from '../live-matrix-plan.mjs';

// As in tools/game-loop.test.mjs.
const COUNTER_SEED = 12345,
  COLD_NMIS = 9000;
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

const apartment = () => ({ sram: new Uint8Array(loadSave('apartment')) });
// A cold start played with pad(k) up to `nmis`.
const cold = (name, pad, nmis) => ({
  name,
  options: () => ({}),
  record(cartridge, hook) {
    const game = new LiveGame(cartridge, { pad, counter: counterBytes(COUNTER_SEED) });
    hook(game);
    while (game.nmis < nmis) game.step();
  },
});
// A closed plan of tools/explore-live.mjs from the apartment save.
const explored = (name, plan) => ({
  name,
  options: apartment,
  record(cartridge, hook) {
    exploreLive(plan, { cartridge, sram: loadSave('apartment'), onGame: hook });
  },
});

export const SCENARIOS = Object.freeze([
  // Logo, intro, title and the attract demo.
  cold('attract', () => 0, COLD_NMIS),
  // New game, the opening dialog and a walk in the first room.
  cold('new-game', BENCHMARK_ROUTE, COLD_NMIS),
  // Continue, then the badge route: rooms, talks, trade, items (tools/live-plans.mjs).
  {
    name: 'badge',
    options: apartment,
    record(cartridge, hook) {
      let plan = null;
      const game = new LiveGame(cartridge, {
        ...apartment(),
        counter: counterBytes(COUNTER_SEED),
        pad: (k) => {
          if (k < PLAN_START) return TITLE(k);
          plan ??= livePlanDriver(
            BADGE_BUY_LIVE_PLAN.slice(PLAN_SKIP),
            game.memory.wram,
            () => game.loop.rounds,
          );
          return plan.done() ? 0 : plan.pad(k);
        },
      });
      hook(game);
      while (!plan?.done()) game.step();
    },
  },
  // The alley fight (tools/live-alley-plan.mjs).
  explored('alley', ALLEY_PLAN),
  // Seven matrix sessions (tools/live-matrix-plan.mjs).
  explored('matrix', MATRIX_PLAN),
]);
export const scenario = (name) => {
  const found = SCENARIOS.find((s) => s.name === name);
  if (!found) throw Error(`Unknown golden scenario ${name}`);
  return found;
};
