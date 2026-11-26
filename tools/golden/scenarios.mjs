// Scenarios of the golden traces (docs/STATE-MODEL-REBUILD.md). Each one names the
// LiveGame start options a replay needs (options) and how it was first played
// (record): the existing closed plans of the live tests. Their drivers read WRAM, which
// is why the trace keeps the inputs they produced instead of the plans.
import { LiveGame } from '../../src/video/live-game.mjs';
import { counterBytes } from '../../src/vm/frame-events.mjs';
import { loadSave, ALLEY_PLAN as ALLEY_PLAN_FROM_ROOM } from '../mesen-plans.mjs';
import { livePlanDriver } from '../live-plan-driver.mjs';
import { exploreLive } from '../explore-live.mjs';
import { BADGE_BUY_LIVE_PLAN } from '../live-plans.mjs';
import { PLAN as ALLEY_PLAN } from '../live-alley-plan.mjs';
import { PLAN as MATRIX_PLAN } from '../live-matrix-plan.mjs';
import { CUTSCENE_PLAN } from '../live-cutscene-plan.mjs';
import { INTRO_PLAN } from '../live-intro-plan.mjs';
import { ORIGINAL_GAMEPLAY } from '../../src/game/bugfixes.mjs';
import { KARMA } from '../../src/data/wram.mjs';
import { WRAM_BASE as WRAM_BANK } from '../../src/constants/memory-map.mjs';

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
  PLAN_SKIP = 3,
  PRESS_NMIS = 4;
const TITLE = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : k >= 3150 && k < 3154
      ? DOWN
      : 0;

// Game Over: the new game route of BENCHMARK_ROUTE up to the walk, then ALLEY_PLAN of
// tools/mesen-plans.mjs (out of the morgue, along the street into the alley), where
// the orc assassin shoots Jake (the owner takes over again near NMI 15760). Without input
// the menu times out to the title, back to the menu, to the attract demo and back to the
// menu again; then Start begins a new game from the menu owner.
const GAME_OVER_PLAN_FROM = 5200,
  GAME_OVER_START = 26600,
  GAME_OVER_NMIS = 28500;
const gameOver = {
  name: 'game-over',
  options: () => ({}),
  record(cartridge, hook) {
    let driver = null;
    const game = new LiveGame(cartridge, {
      counter: counterBytes(COUNTER_SEED),
      pad: (k) => {
        if (k < GAME_OVER_PLAN_FROM) return BENCHMARK_ROUTE(k);
        if (k >= GAME_OVER_START) return k < GAME_OVER_START + PRESS_NMIS ? START : 0;
        driver ??= livePlanDriver(ALLEY_PLAN_FROM_ROOM, game.memory.wram, () => game.loop.rounds);
        return driver.done() ? 0 : driver.pad(k);
      },
    });
    hook(game);
    while (game.nmis < GAME_OVER_NMIS) game.step();
  },
};

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

// Continue with the apartment save, then once prepare(memory) (its writes become the
// trace's pokes) and play the plan segments one after another (tools/live-plan-driver.mjs).
// gameplay: LiveGame's gameplay options.
const continued = (name, segments, { prepare = () => {}, gameplay = ORIGINAL_GAMEPLAY } = {}) => ({
  name,
  options: () => ({ ...apartment(), gameplay }),
  record(cartridge, hook) {
    let driver = null,
      next = 0;
    const game = new LiveGame(cartridge, {
      ...apartment(),
      gameplay,
      counter: counterBytes(COUNTER_SEED),
      pad: (k) => {
        if (k < PLAN_START) return TITLE(k);
        if (!driver) prepare(game.memory);
        while ((!driver || driver.done()) && next < segments.length)
          driver = livePlanDriver(segments[next++], game.memory.wram, () => game.loop.rounds);
        return driver.done() ? 0 : driver.pad(k);
      },
    });
    hook(game);
    while (!driver?.done() || next < segments.length) game.step();
  },
});

// Status screen: each submenu (Items, Weapon, Armour, Skills, Cyber) in a session of its
// own, which Select ends; Select twice more shows and hides the party status in the room.
// Then Magic, Heal as the X spell and its cast at Me (tools/live-spell.test.mjs: Magic 3,
// six spell levels and 30 magic points for Jake), with instant text.
const STATUS_BROWSE = [
    ['press', 'start', 150],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'start', 150],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'start', 150],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'start', 150],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'start', 150],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'select', 120],
    ['press', 'select', 120],
    ['press', 'select', 120],
  ],
  SPELL_SELECT = [
    ['wait', 60],
    ['press', 'start', 150],
    ['wait', 150],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'down', 30],
    ['press', 'down', 30],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['wait', 60],
  ],
  SPELL_CAST = [
    ['press', 'x', 30],
    ['press', 'b', 60],
    ['wait', 200],
  ],
  MAGIC = 3,
  SPELL_LEVELS = [1, 2, 1, 1, 1, 1],
  MAGIC_POINTS = 30,
  JAKE_MAGIC = 0x7e3bfc,
  JAKE_SPELLS = 0x7e3c07,
  JAKE_MAGIC_POINTS = 0x7e3c96;
const prepareMagic = (memory) => {
  memory.write8(JAKE_MAGIC, MAGIC);
  SPELL_LEVELS.forEach((value, i) => memory.write8(JAKE_SPELLS + i, value));
  memory.write16(JAKE_MAGIC_POINTS, MAGIC_POINTS);
};
// The bed in the apartment (tools/live-save.test.mjs): its menu, then save game 2.
const BED_SAVE = [
  ['press', 'b'],
  ['glove', 122, 155],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 400],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 60],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['wait', 60],
];
// Then the main menu's third entry, Use karma (the cursor is back on Exit): a category,
// steps bought until the karma runs out (Not enough karma, closed by the next key), and
// out again with Select (the menu choice's cancel bit 2000).
const BED_KARMA = [
    ['press', 'down', 20],
    ['press', 'down', 20],
    ['press', 'b', 150],
    ['press', 'down', 20],
    ['press', 'b', 120],
    ['press', 'down', 20],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'select', 120],
    ['press', 'select', 120],
    ['press', 'select', 120],
    ['wait', 120],
  ],
  KARMA_POINTS = 160,
  prepareKarma = (memory) => memory.write16(WRAM_BANK + KARMA, KARMA_POINTS);

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
  // The status screen, a spell choice and its cast, with instant text.
  continued('spell', [STATUS_BROWSE, SPELL_SELECT, SPELL_CAST], {
    prepare: prepareMagic,
    gameplay: { ...ORIGINAL_GAMEPLAY, instantText: true },
  }),
  // The bed menu and a save.
  continued('bed', [BED_SAVE, BED_KARMA], { prepare: prepareKarma }),
  // Cutscenes 0-4, mirrored, ended with B, and the credits (tools/live-cutscene-plan.mjs).
  explored('cutscenes', CUTSCENE_PLAN),
  // Two intros (81:DFE7) with the credits after them, one ended with A (tools/live-intro-plan.mjs).
  explored('intro', INTRO_PLAN),
  // Death in the alley, the menu timeout through title and attract demo, Start.
  gameOver,
]);
export const scenario = (name) => {
  const found = SCENARIOS.find((s) => s.name === name);
  if (!found) throw Error(`Unknown golden scenario ${name}`);
  return found;
};
