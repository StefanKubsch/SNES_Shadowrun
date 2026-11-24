// Live play passes game services only (docs/LIVE-LOOP-SERVICES.md): from the reset
// through the boot screens, title, menu and game start into the main loop, no phase
// reads the caller beyond its game services or writes the CPU context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { STARTUP_CONTEXT } from '../src/script/game-loop.mjs';
import { MAIN_LOOP_EXIT } from '../src/data/wram.mjs';

// The benchmark route's opening: Start on the title and in the menu (a new game),
// then A taps through the opening dialog.
const START = 0x1000,
  CONFIRM = 0x0080;
const pad = (k) =>
  k >= 3000 && k < 3400 ? (k % 150 < 4 ? START : 0) : k >= 3400 && k % 60 < 4 ? CONFIRM : 0;
const GAME_NMIS = 4200;

for (const budget of [1, 7])
  test(`live play needs no CPU context up to the main loop, budget ${budget}`, () => {
    const game = new LiveGame(cartridge, { pad });
    const loop = game.loop,
      a = loop.accessor;
    loop.services = new Proxy(
      { a },
      {
        get: (target, key) =>
          key === 'a' ? target.a : assert.fail(`live play read h.${String(key)}`),
      },
    );
    // The first step runs the reset service; then the context stays frozen.
    game.step({ budget: 1 });
    assert.deepEqual({ ...a.ctx }, STARTUP_CONTEXT);
    Object.freeze(a.ctx);
    let steps = 0;
    while (game.nmis < GAME_NMIS) {
      game.step({ budget });
      assert.ok(++steps < 10_000_000, 'live play must reach the game');
    }
    assert.ok(loop.ownsGame, 'the game started');
    assert.ok(loop.rounds > 0, 'main loop rounds ran');
    assert.equal(game.memory.read16(0x7e0000 + MAIN_LOOP_EXIT), 0);
    assert.deepEqual({ ...a.ctx }, STARTUP_CONTEXT, 'live play left the CPU context alone');
  });
