import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave, MORGUE_DOOR_PLAN } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import {
  DEBUG_ROOM_ENTRY,
  debugRoomReachable,
  warpToDebugRoom,
} from '../src/browser/debug-room.mjs';

// The page's debug room warp (src/browser/debug-room.mjs, docs/TCRF-NOTES.md), live from the
// apartment save game: with the item list (Y) open the warp is refused; after closing it, the warp
// at a pad read saves entry 159 in script word $1A and the main loop changes to room entry D2.
// Walking into the script box of room 114 (x 356-388, y 396-443) starts script $2F9, which returns
// to entry 159 at Jake's position before the warp (391, 281).
const TITLE = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? 0x1000
    : k >= 3150 && k < 3154
      ? 0x0400
      : 0;
const word = (w, a) => w[a] | (w[a + 1] << 8);
test(
  'the debug room warp goes there only while Jake moves freely, and its exit returns',
  { timeout: 900000 },
  () => {
    let driver = null,
      menuRefused = null,
      warpedAt = null,
      phase = 'menu';
    const MENU = [
        ['wait', 60],
        ['press', 'y', 120],
      ],
      CLOSE = [
        ['press', 'b', 90],
        ['wait', 60],
      ];
    const WALK = [
      ['wait', 100],
      ['walk', 'down+right', 372, 394],
      ['hold', 'up+right', 8],
      ['wait', 300],
    ];
    const game = new LiveGame(cartridge, {
      sram: new Uint8Array(loadSave('apartment')),
      pad: (k) => {
        if (k < 5000) return TITLE(k);
        const wram = game.memory.wram,
          rounds = () => game.driver.roundsCompleted;
        if (!driver) driver = livePlanDriver(MENU, wram, rounds);
        if (driver.done() && phase === 'menu') {
          menuRefused = !debugRoomReachable(game);
          phase = 'close';
          driver = livePlanDriver(CLOSE, wram, rounds);
        }
        if (driver.done() && phase === 'close' && debugRoomReachable(game)) {
          warpToDebugRoom(wram);
          warpedAt = k;
          phase = 'walk';
          driver = livePlanDriver(WALK, wram, rounds);
        }
        return driver.pad(k);
      },
    });
    const rooms = [];
    let room = -1;
    while (!(phase === 'walk' && driver.done()) && game.nmis < 9000) {
      game.step();
      const w = game.memory.wram;
      if (word(w, 0x2de2) !== room) {
        room = word(w, 0x2de2);
        const slot = word(w, 0xcc2) & 0x7fff;
        rooms.push([room, word(w, 0xe28 + slot) >> 2, word(w, 0xe80 + slot) >> 2]);
      }
    }
    assert.equal(menuRefused, true, 'refused with the item list open');
    assert.ok(warpedAt, 'warped after closing the list');
    assert.deepEqual(
      rooms.map((r) => r[0]),
      [0, 0x159, DEBUG_ROOM_ENTRY, 0x159],
      JSON.stringify(rooms),
    );
    const w = game.memory.wram,
      slot = word(w, 0xcc2) & 0x7fff;
    assert.equal(word(w, 0x3bd5), 0x159, 'return entry in script word $1A');
    assert.deepEqual(
      [word(w, 0xe28 + slot) >> 2, word(w, 0xe80 + slot) >> 2],
      [391, 281],
      'back at the position before the warp',
    );
  },
);

test(
  'the original morgue return recreates the morticians without resetting their story records',
  { timeout: 900000 },
  () => {
    let driver,
      phase = 'door',
      departed;
    const activeMorticians = () => {
      const w = game.memory.wram,
        actors = [];
      for (let slot = 0; slot < 0x58; slot += 2)
        if (word(w, 0x3f28 + slot) < 0x8000 && [0x7ee, 0x7fc].includes(word(w, 0x150a + slot)))
          actors.push(word(w, 0x150a + slot));
      return actors.sort((a, b) => a - b);
    };
    const game = new LiveGame(cartridge, {
      pad: (k) => {
        if (k < 5000) return k >= 3000 && k < 3400 && k % 150 < 4 ? 0x1000 : 0;
        const w = game.memory.wram,
          rounds = () => game.driver.roundsCompleted;
        driver ??= livePlanDriver([...MORGUE_DOOR_PLAN, ['wait', 500]], w, rounds);
        if (driver.done() && phase === 'door' && debugRoomReachable(game)) {
          assert.deepEqual(activeMorticians(), [], 'both morticians have actually fled');
          departed = w.slice(0x2e69, 0x2e73);
          assert.equal(departed[1] & 1, 1, 'first mortician remembers the opening scene');
          assert.equal(departed[6] & 1, 1, 'second mortician remembers the opening scene');
          assert.equal(word(departed, 3), 0xffff, 'first holder permits reentry');
          assert.equal(word(departed, 8), 0xffff, 'second holder permits reentry');
          warpToDebugRoom(w);
          phase = 'return';
          driver = livePlanDriver(
            [
              ['wait', 100],
              ['walk', 'down+right', 372, 394],
              ['hold', 'up+right', 8],
              ['wait', 300],
            ],
            w,
            rounds,
          );
        }
        return driver.pad(k);
      },
    });
    while (!(phase === 'return' && driver.done()) && game.nmis < 9000) game.step();
    assert.equal(phase, 'return');
    assert.equal(driver.done(), true);
    assert.equal(word(game.memory.wram, 0x2de2), 3, 'back in the morgue');
    assert.deepEqual(
      activeMorticians(),
      [0x7ee, 0x7fc],
      'the source room initializer recreates both',
    );
    assert.deepEqual(
      game.memory.wram.slice(0x2e69, 0x2e73),
      departed,
      'their persistent records were not reset',
    );
  },
);
