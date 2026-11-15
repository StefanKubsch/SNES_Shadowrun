import test from 'node:test';
import assert from 'node:assert/strict';
import * as live from '../src/game/window-list.mjs';
import * as previous from '../proof/caller/window-list.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { createSide } from './lift-function-harness.mjs';
import { windowMapSource, windowTables } from './lift-window-samples.mjs';
import { prng } from './task-native-dialog-harness.mjs';

// Isolate the upload boundary without replacing drawing or unpacking. Integration
// tests service the same requests through real NMIs and compare all device state.
function run(module, name, seed, budget, initialRequest) {
  const side = createSide({ seed, wram: new Uint8Array(0x20000) }, new Map()),
    { mem, a, h } = side,
    random = prng(seed),
    rnd = (n) => Math.floor(random() * n);
  windowMapSource(mem.wram, mem);
  windowTables(mem.wram, rnd, (values) => values[rnd(values.length)]);
  mem.write16(0x1f8, initialRequest);
  mem.write16(0x1cc, 0);
  Object.assign(a.ctx, { programBank: 0x80, bank: 0x80, pc: 0xcdad });
  h.pushByte(0x80);
  h.push(0x1234, 2);
  const uploads = [],
    frames = new LagFreeFrames({ nmitimen: 0x80 }),
    events = { interrupts: frames };
  frames.textWait = (_h, _events, _status, pc) => {
    assert.equal(pc, 0x81acb2);
    uploads.push(mem.wram.slice(0x1cc));
    mem.write16(0x1f8, 0);
    return true;
  };
  const sequence =
      name === 'requestUploadCall'
        ? module[name](h, events, 0x80fa39)
        : name === 'drawWindowListSequence'
          ? module[name](h, events, 0x80cdad)
          : (function* () {
              yield () => module[name](h, events);
            })(),
    continuation = new NativeCallContinuation(a, sequence);
  const before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before, 'zero budget leaves memory unchanged');
  let passes = 0;
  while (continuation.run(budget) === WAIT_PAUSED)
    assert.ok(++passes < 1000, 'bounded upload continuation');
  // CPU stacks and saved interrupt registers are outside the game-state contract.
  mem.wram.fill(0, 0x100, 0x1ca);
  mem.wram.fill(0, 0x1c78, 0x1cbc);
  return { wram: mem.wram, uploads, result: continuation.result };
}

for (const budget of [1, 7])
  for (const name of ['requestUploadCall', 'drawWindowListSequence', 'runResetWindowList'])
    test(`live window caller matches former ${name}, budget ${budget}`, () => {
      for (let seed = 1; seed <= 40; seed++)
        for (const request of [0, 0xfffe, 0xffff])
          assert.deepEqual(
            run(live, name, seed, budget, request),
            run(previous, name, seed, budget, request),
          );
    });
