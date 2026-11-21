import test from 'node:test';
import assert from 'node:assert/strict';
import { gameStartSequence } from '../src/game/game-start.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { toWram } from '../proof/state/to-wram.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';

for (const choice of [0xffff, 0, 1])
  test(`game setup uses explicit choice ${choice} despite a stale direct-page value`, () => {
    const games = [0, 1].map(() => new LiveGame(cartridge, { sram: loadSave('apartment') }));
    games[0].memory.write16(0, choice);
    games[1].memory.write16(0, choice === 0xffff ? 0 : 0xffff);
    for (const [side, game] of games.entries()) {
      const h = { a: game.loop.accessor };
      const setup = side === 0 ? gameStartSequence(h, null) : gameStartSequence(h, null, choice);
      // Only the complete state setup segment; room rendering starts afterwards.
      setup.next().value();
      setup.return();
    }
    // Direct page is workspace; every game field and serialized byte must agree.
    assert.deepEqual(toWram(games[1].memory).slice(0x34), toWram(games[0].memory).slice(0x34));
    assert.deepEqual(games[1].memory.sram, games[0].memory.sram);
  });
