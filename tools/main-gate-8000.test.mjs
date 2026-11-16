import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { mainGate8000Spec, proveMainGate8000Source } from './main-gate-8000-source.mjs';
import { runReference } from './w65c816-reference.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { checkPlayerZones } from '../proof/replay/main-zone-gate.mjs';
import { MAIN_LOOP_ROUTINES } from '../src/vm/main-loop.mjs';
import { MAIN_LOOP_ROUTINES as REPLAY_LOOP_ROUTINES } from '../proof/vm/main-loop.mjs';
import { runPlayerZones } from '../src/game/main-upkeep.mjs';
import { playerZonesSequence as formerZones } from '../proof/caller/player-zones.mjs';
import { drainNativeSequence } from '../src/system/native-call-continuation.mjs';

// Main loop $8000/$803B: pinned local code with stack proof and equations against the original instructions.
// $C34A and $A4BF run as the same stub on both sides with real frames.
const { bytes } = inspectRom(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url))),
  rom = new Uint8Array(bytes);
const { map } = decodeTaskWindows(bytes, mainGate8000Spec.windows);

test('8000 pinned own code: 103 instructions, external returns C34A and A4BF, bound in the main loop', () => {
  const proof = proveMainGate8000Source(map);
  assert.equal(proof.reachable_instructions, 103);
  assert.deepEqual(proof.external_returns, ['80:A4BF', '80:C34A']);
  // The main loop runs the lifted zones (src/game/player-zones.mjs).
  assert.equal(MAIN_LOOP_ROUTINES.get(0x808000), runPlayerZones);
  assert.equal(REPLAY_LOOP_ROUTINES.get(0x808000), checkPlayerZones);
});

const stub = (a, target) => {
  const raw = a.pullWord();
  a.ctx.pc = (raw + 1) & 0xffff;
  a.trace.push({
    kind: 'call',
    pc: target,
    a: a.ctx.a,
    x: a.ctx.x,
    y: a.ctx.y,
    s: a.ctx.s,
    status: a.ctx.status,
  });
  a.writeWord(0x1d8, target & 0xffff, 24);
  a.ctx.x = 0x4321;
  a.ctx.status = (a.ctx.status & ~0x83) | 0x81;
  return { rawReturnWord: raw };
};
// Random player and two zone lists at [$9D] (bank $7E), with some zones around the player to exercise every branch.
function setup(seed) {
  let r = (seed * 2654435761) >>> 0;
  const rnd = (n) => {
    r = (r * 1103515245 + 12345) >>> 0;
    return (r >>> 8) % n;
  };
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < 0x2000; n++) wram[n] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  const slot = rnd(8) === 0 ? 0x8000 | (rnd(0x100) * 2) : rnd(0x2c) * 2;
  word(0x0cc2, slot);
  const pos = [rnd(0x400), rnd(0x400), rnd(0x100)];
  if (!(slot & 0x8000)) {
    word(0x0e28 + slot, (pos[0] << 2) | rnd(4));
    word(0x0e80 + slot, (pos[1] << 2) | rnd(4));
    word(0x0ed8 + slot, (pos[2] << 2) | rnd(4));
  }
  const list = 0x3000 + rnd(0x100);
  word(0x9d, list);
  wram[0x9f] = 0x7e;
  let at = list;
  for (let l = 0; l < 2; l++) {
    const count = rnd(4);
    wram[at++] = count;
    for (let z = 0; z < count; z++) {
      const near = rnd(3) !== 0;
      for (let c = 0; c < 3; c++) {
        const p = pos[c],
          lo = near ? Math.max(0, p - rnd(4) + (rnd(5) === 0 ? 2 : 0)) : rnd(0x400);
        word(at + 2 * c, lo);
      }
      for (let c = 0; c < 3; c++) {
        const p = pos[c],
          hi = near ? p + rnd(4) - (rnd(5) === 0 ? 2 : 0) : rnd(0x400);
        word(at + 6 + 2 * c, hi & 0xffff);
      }
      word(at + 12, rnd(0x3a0));
      at += 14;
    }
  }
  const mem = new VmMemory(rom, wram);
  const vm = {
    mem,
    a: rnd(65536),
    x: rnd(65536),
    y: rnd(65536),
    s: 0x1ef0,
    d: 0,
    dbr: 0x80,
    p: rnd(256) & 0xc3,
    pc: 0x8000,
  };
  mem.write8(vm.s, 0x96);
  vm.s = (vm.s - 1) & 0xffff;
  mem.write8(vm.s, 0xc5);
  vm.s = (vm.s - 1) & 0xffff;
  const acc = new TaskAccessor(vm);
  acc.load();
  acc.ctx.pc = 0x8000;
  acc.trace = [];
  return { mem, acc };
}
// The register-level equations (the reference) and the lifted zones each against the original instructions.
for (const [name, run] of [
  ['equations', checkPlayerZones],
  [
    'former lifted zones',
    (h, events, routines) => drainNativeSequence(formerZones(h, events, routines)),
  ],
])
  test(`8000 ${name} match the original instructions`, () => {
    const covered = new Set(),
      outcomes = new Set();
    for (let seed = 1; seed <= 600; seed++) {
      const native = setup(seed),
        a = native.acc;
      run(dialogAccess(a), null, {
        c34a: (x) => stub(x, 0x80c34a),
        a4bf: (h) => stub(h.a, 0x80a4bf),
      });
      const ref = setup(seed),
        r = ref.acc;
      const original = runReference(map, ref.mem, r.ctx, {
        entry: 0x808000,
        root: 'RTS',
        io: r.trace,
        calls: new Map([
          [0x80c34a, () => stub(r, 0x80c34a)],
          [0x80a4bf, () => stub(r, 0x80a4bf)],
        ]),
      });
      for (const k of ['a', 'x', 'y', 's', 'status', 'pc', 'programBank', 'bank', 'd'])
        assert.equal(a.ctx[k], r.ctx[k], `${k} seed ${seed}`);
      assert.deepEqual(a.trace, r.trace, `calls seed ${seed}`);
      assert.ok(
        Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),
        `wram seed ${seed}`,
      );
      outcomes.add(a.trace.map((c) => c.pc.toString(16)).join() + (a.ctx.status & 1));
      for (const pc of original.visited) covered.add(pc);
    }
    assert.ok(outcomes.size >= 4, [...outcomes].join(' '));
    assert.deepEqual(
      [...map.keys()].filter((pc) => !covered.has(pc)),
      [],
    );
  });
