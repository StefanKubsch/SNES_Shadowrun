import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { BADGE_BUY_LIVE_PLAN } from './live-plans.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { applyCheats } from '../src/game/cheats.mjs';
import { CHEAT_MASK } from '../src/game/cheat-settings.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';

test(
  'enabling all cheats during play keeps every real gunshot at full Stamina',
  { timeout: 180000 },
  () => {
    // The established apartment-to-alley route, ending under the orc's fire.
    // No injected hit result: count the real 8691 stores from enemy shooting.
    const plan = [...BADGE_BUY_LIVE_PLAN.slice(3, 39), ['wait', 1500]];
    let game, driver;
    game = new LiveGame(cartridge, {
      sram: new Uint8Array(loadSave('apartment')),
      counter: counterBytes(0x1234567),
      pad: (k) => {
        game.vm.cheats = k < 5000 ? 0 : CHEAT_MASK;
        applyCheats(game);
        if (k < 5000)
          return [3000, 3300, 3600].some((at) => k >= at && k < at + 4)
            ? 0x1000
            : k >= 3150 && k < 3154
              ? 0x0400
              : 0;
        driver ??= livePlanDriver(plan, game.memory.wram, () => game.driver.roundsCompleted);
        return driver.pad(k);
      },
    });
    const hits = [];
    const write = game.memory.write8.bind(game.memory);
    game.memory.write8 = (address, value) => {
      if (game.nmis >= 5000 && address === 0x7e33de) hits.push(value);
      write(address, value);
    };
    while (!driver?.done() && game.nmis < 18000) game.step();
    assert.ok(driver?.done(), 'the live route completes');
    assert.ok(hits.length >= 3, 'several enemy shots actually reach the damage store');
    assert.ok(
      hits.every((value) => value === 200),
      `all actual hit results remain full: ${hits}`,
    );
    assert.equal(game.memory.wram[0x33de], 200);
    assert.equal(game.vm.cheats, CHEAT_MASK);
  },
);
