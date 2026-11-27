// The live reset and startup take game services only (docs/BOOT-SERVICE-COMPOSITION.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveGame } from '../src/video/live-game.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { resetHardware } from '../src/system/main-reset.mjs';
import { mainStartupSequence } from '../src/system/main-startup.mjs';
import { accessorPort } from '../src/system/hardware-port.mjs';
import { SequenceRunner, NATIVE_CALL_CONTINUATIONS } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

// The register-level reset reference (proof/replay/main-reset.mjs) was retired on
// 2026-11-25; the golden traces start from this reset.
test('the reset service runs on an accessor without a CPU context', () => {
  const game = new LiveGame(cartridge),
    a = game.loop.accessor;
  assert.equal('ctx' in a, false);
  resetHardware(accessorPort(a), a.mem);
  assert.equal('ctx' in a, false);
});

for (const budget of [1, 7])
  test(`live startup completes without CPU context at budget ${budget}`, () => {
    const game = new LiveGame(cartridge),
      a = game.loop.accessor,
      events = game.loop.interval(0x80e382);
    assert.ok(events.frameJobs, 'live startup runs with frame jobs');
    resetHardware(accessorPort(a), a.mem);
    assert.equal('ctx' in a, false, 'the live accessor carries no CPU registers');
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
      call = new SequenceRunner(mainStartupSequence(h, events), NATIVE_CALL_CONTINUATIONS);
    let pauses = 0;
    for (let status; (status = call.run(budget)) !== WAIT_RETURNED;) {
      assert.equal(status, WAIT_PAUSED);
      pauses++;
    }
    // Two screens held for 150 and 180 frames, with their fades.
    assert.ok(game.frames.nmis - nmis > 330, 'both boot screens ran');
    assert.ok(pauses > 330);
    assert.equal('ctx' in a, false);
    game.loop.closeInterval();
  });
