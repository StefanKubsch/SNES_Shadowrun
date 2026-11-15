import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { mainStartupSequence } from '../src/system/main-startup.mjs';
import { MainStartupContinuation, MAIN_STARTUP_ROUTINES } from '../proof/script/live-startup.mjs';
import { runMainReset, runMainSoftwareReset } from '../proof/replay/main-reset.mjs';
import { WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { SETTINGS_CHECKSUM, SETTINGS_STEREO } from '../src/data/wram.mjs';
import { BANK_SIZE } from '../src/constants/bits.mjs';

// Compare all boot state, including stack bytes, at every NMI and after return.
// The old caller uses address dispatch; the new caller invokes the screens directly.
function snapshot(game) {
  const { ppu } = game.bus;
  return {
    context: { ...game.loop.accessor.ctx },
    wram: game.memory.wram.slice(),
    sram: game.memory.sram.slice(),
    video: Object.fromEntries(
      ['vram', 'cgram', 'oam', 'registers', 'scroll'].map((key) => [key, ppu[key].slice()]),
    ),
    writes: game.bus.ppuWrites,
    sound: game.apu.ram.slice(),
  };
}

for (const valid of [true, false])
  for (const budget of [1, 7])
    test(`direct startup matches address dispatch: valid settings ${valid}, budget ${budget}`, () => {
      const sram = new Uint8Array(loadSave('apartment'));
      if (!valid) {
        sram[SETTINGS_STEREO % BANK_SIZE] = 0;
        sram[SETTINGS_CHECKSUM % BANK_SIZE] ^= 1;
      }
      const games = [new LiveGame(cartridge, { sram }), new LiveGame(cartridge, { sram })];
      // Retain only one side's snapshots until the second side reaches that NMI.
      const frames = [];
      let compared = 0;
      for (const [side, game] of games.entries()) {
        const onNmi = game.frames.onNmi;
        game.frames.onNmi = (k) => {
          onNmi(k);
          if (side === 0) frames.push(snapshot(game));
          else assert.deepEqual(snapshot(game), frames[compared++], `NMI ${k}`);
        };
      }
      // A software restart abandons its old call stack and reaches the same startup
      // on populated memory. This reset remains the unchanged proof implementation.
      for (const restart of [false, true]) {
        for (const [side, game] of games.entries()) {
          const a = game.loop.accessor;
          const events = game.loop.interval(restart ? 0x809e3d : 0x80e382);
          if (restart) {
            a.ctx.pc = 0x9e3d;
            runMainSoftwareReset(a, events, MAIN_STARTUP_ROUTINES);
          } else runMainReset(a);
          const call =
            side === 0
              ? new MainStartupContinuation(a, events)
              : new NativeCallContinuation(a, mainStartupSequence(dialogAccess(a), events));
          let status;
          do {
            a.resetAccessBudget();
            status = call.run(budget);
          } while (status !== WAIT_RETURNED);
          assert.equal(a.ctx.pc, 0xa139);
          assert.equal(a.ctx.s, 0x13f);
          assert.equal(a.ctx.a, 1);
        }
        assert.deepEqual(
          snapshot(games[1]),
          snapshot(games[0]),
          restart ? 'restart return' : 'cold return',
        );
        assert.equal(compared, frames.length);
      }
      assert.ok(compared > 700, `NMIs compared: ${compared}`);
    });
