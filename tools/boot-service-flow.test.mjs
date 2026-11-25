// The live reset and startup take game services only (docs/BOOT-SERVICE-COMPOSITION.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame, SNES_VIDEO } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { resetHardware } from '../src/system/main-reset.mjs';
import { mainStartupSequence } from '../src/system/main-startup.mjs';
import { accessorPort } from '../src/system/hardware-port.mjs';
import { STARTUP_CONTEXT } from '../src/script/game-loop.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { runMainReset } from '../proof/replay/main-reset.mjs';
import { toWram } from '../proof/state/to-wram.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';

// Device writes by register: the port reaches every system register at bank 00.
const byRegister = (trace) =>
  trace.map(({ kind, pc, address, width, value }) => ({
    kind,
    pc,
    register: address & WORD_MASK,
    width,
    value,
  }));

function resetRun(reset) {
  // The reset compares PPU registers and write counts: the SNES back end.
  const game = new LiveGame(cartridge, { video: SNES_VIDEO }),
    a = game.loop.accessor;
  a.trace = [];
  reset(a);
  return { game, a, trace: byRegister(a.trace) };
}

test('the reset service writes the original registers and stack bytes', () => {
  const reference = resetRun((a) => runMainReset(a)),
    lifted = resetRun((a) => {
      const power = { ...a.ctx };
      Object.freeze(a.ctx);
      resetHardware(accessorPort(a), a.mem);
      assert.deepEqual({ ...a.ctx }, power, 'the reset service leaves the CPU context alone');
    });
  assert.equal(lifted.trace.length, reference.trace.length);
  assert.deepEqual(lifted.trace, reference.trace);
  assert.deepEqual({ ...reference.a.ctx }, STARTUP_CONTEXT, 'startup workspace');
  assert.deepEqual(toWram(lifted.game.memory), toWram(reference.game.memory));
  assert.deepEqual(lifted.game.bus.ppu.registers, reference.game.bus.ppu.registers);
  assert.equal(lifted.game.bus.ppuWrites, reference.game.bus.ppuWrites);
});

for (const budget of [1, 7])
  test(`live startup completes without CPU context at budget ${budget}`, () => {
    const game = new LiveGame(cartridge),
      a = game.loop.accessor,
      events = game.loop.interval(0x80e382);
    assert.ok(events.frameJobs, 'live startup runs with frame jobs');
    resetHardware(accessorPort(a), a.mem);
    const context = { ...a.ctx };
    Object.freeze(a.ctx);
    const h = new Proxy(
      { a },
      {
        get(target, key) {
          if (key !== 'a') assert.fail(`live startup read h.${String(key)}`);
          return target.a;
        },
      },
    );
    const nmis = game.frames.nmis,
      call = new NativeCallContinuation(a, mainStartupSequence(h, events));
    let pauses = 0;
    for (let status; (status = call.run(budget)) !== WAIT_RETURNED;) {
      assert.equal(status, WAIT_PAUSED);
      pauses++;
    }
    // Two screens held for 150 and 180 frames, with their fades.
    assert.ok(game.frames.nmis - nmis > 330, 'both boot screens ran');
    assert.ok(pauses > 330);
    assert.deepEqual({ ...a.ctx }, context, 'startup leaves the CPU context alone');
    game.loop.closeInterval();
  });
