import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame, SNES_VIDEO } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { startupWithEntryContext } from './startup-entry-adapter.mjs';
import { MainStartupContinuation, MAIN_STARTUP_ROUTINES } from '../proof/script/live-startup.mjs';
import { runMainReset, runMainSoftwareReset } from '../proof/replay/main-reset.mjs';
import { WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { NMI_SAVED_A, SETTINGS_CHECKSUM, SETTINGS_STEREO } from '../src/data/wram.mjs';
import { BANK_SIZE } from '../src/constants/bits.mjs';

// Compare the boot state at every NMI and after return. The old caller uses address
// dispatch and the original's frames; the new caller invokes the screens directly,
// without the JSR and JSL frames. Game state only (user decision 2026-11-17): A, X, Y,
// P, S, the CPU stacks (main 7E:0100-01C9, NMI 7E:1C7C-1CBB) and the interrupted A
// and S the NMI saves (7E:1C78, 1C7A) are left out, as in main-owner-caller.test.mjs;
// the return point, S and the data bank are checked after return.
const CPU_STACKS = [
  [0x0100, 0x01ca],
  [NMI_SAVED_A, 0x1cbc],
];
function snapshot(game, inFrame = false) {
  const { ppu } = game.bus,
    { a, x, y, status, s, pc, programBank, ...context } = game.loop.accessor.ctx,
    wram = game.memory.wram.slice();
  // Interrupt PCs belong to the reference adapter. Completed caller return
  // points remain checked here and by the explicit return assertions below.
  if (!inFrame) Object.assign(context, { pc, programBank });
  for (const [from, to] of CPU_STACKS) wram.fill(0, from, to);
  return {
    context,
    wram,
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
      const games = [
        new LiveGame(cartridge, { sram, video: SNES_VIDEO }),
        new LiveGame(cartridge, { sram, video: SNES_VIDEO }),
      ];
      // Retain only one side's snapshots until the second side reaches that NMI.
      const frames = [];
      let compared = 0;
      for (const [side, game] of games.entries()) {
        const onNmi = game.frames.onNmi;
        game.frames.onNmi = (k) => {
          onNmi(k);
          if (side === 0) frames.push(snapshot(game, true));
          else assert.deepEqual(snapshot(game, true), frames[compared++], `NMI ${k}`);
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
          // The direct caller selects startup without inspecting its entry PC.
          if (side === 1) a.ctx.pc = 0x1234;
          const call =
            side === 0
              ? new MainStartupContinuation(a, events)
              : new NativeCallContinuation(a, startupWithEntryContext(dialogAccess(a), events));
          let status;
          do {
            a.resetAccessBudget();
            status = call.run(budget);
          } while (status !== WAIT_RETURNED);
          assert.equal(a.ctx.pc, 0xa139);
          assert.equal(a.ctx.s, 0x13f);
          assert.equal(a.ctx.bank, 0x80);
          // The owner takes A = 1 from its entry point (user decision 2026-11-17).
          if (side === 0) assert.equal(a.ctx.a, 1);
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
