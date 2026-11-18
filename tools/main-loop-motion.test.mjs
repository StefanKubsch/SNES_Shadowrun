import test from 'node:test';
import assert from 'node:assert/strict';
import { mainLoopMotionSpecs, proveMainLoopMotionSource } from './main-loop-motion-source.mjs';
import { compareDialog, decodeWindows, prng } from './task-native-dialog-harness.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { MAIN_MOTION_ROUTINES, moveAndAnimateObjects } from '../proof/replay/main-loop-motion.mjs';
import { shakeHitPlayer } from '../proof/game-reference/main-upkeep.mjs';
import { runHitShake } from '../src/game/main-upkeep.mjs';
import { processSceneRequest } from '../proof/caller/live-loop-routines.mjs';
import { processSceneRequestReference } from '../proof/game-reference/scene-request.mjs';
import { MAIN_LOOP_ROUTINES } from '../proof/caller/live-loop-routines.mjs';
import { MAIN_LOOP_ROUTINES as REPLAY_LOOP_ROUTINES } from '../proof/vm/main-loop.mjs';
import { runObjectMotion } from '../src/game/main-upkeep.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';

// The scene request's and the hit shake's own instructions are the register-level
// references'; the main loop binds the lifted ones (src/game).
const implementations = [processSceneRequestReference, shakeHitPlayer, moveAndAnimateObjects];
const bound = [processSceneRequest, runHitShake, runObjectMotion];
const maps = mainLoopMotionSpecs.map((spec) => decodeWindows(spec.windows));

test('main-loop scene gate, movement prefix and movement graph pin every own instruction and return', () => {
  mainLoopMotionSpecs.forEach((spec, i) => {
    const proof = proveMainLoopMotionSource(maps[i], spec);
    assert.equal(proof.reachable_instructions, [32, 20, 537][i]);
    assert.equal(MAIN_LOOP_ROUTINES.get(spec.entry), bound[i]);
  });
  assert.equal(REPLAY_LOOP_ROUTINES.get(0x80cc4b), processSceneRequestReference);
});

// External routines are identical stubs on both sides, with real call frames. They vary A/flags,
// touch shared scratch and leave X/Y intact, as the motion helper contracts require.
function stub(h, target, seed, long) {
  h.a.trace.push({ kind: 'call', target, a: h.ctx.a, x: h.ctx.x, y: h.ctx.y, s: h.ctx.s });
  h.load((seed + target) % 9);
  h.ctx.status = (h.ctx.status & ~0x41) | (seed & 1) | (seed & 2 ? 0x40 : 0);
  h.dpWrite(0x6b, (seed * 13) & 0xffff);
  const rawReturnWord = long ? h.rtl() : h.rts();
  return { rawReturnWord };
}
function routinesFor(spec, seed) {
  const routines = new Map(MAIN_MOTION_ROUTINES);
  for (const [target, op] of spec.externalReturns)
    routines.set(target, (h) => stub(h, target, seed, op === 'RTL'));
  return routines;
}
function scenario(spec, seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(0x20000);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, value) => {
    wram[at] = value & 255;
    wram[at + 1] = (value >>> 8) & 255;
  };
  if (spec.entry === 0x80cc4b) {
    word(0x1ce9, [0xffff, 0x7fff, 0xfffe, 0, 7, 0x8000][seed % 6]);
    word(0x1d93, rnd(0x100) * 2);
  } else if (spec.entry === 0x80de94) {
    word(0xcc2, seed % 5 === 0 ? 0x8000 : rnd(44) * 2);
    word(0x1d65, [0, 1, 2, 3, 4, 0x7fff, 0x8000, 0xffff][seed % 8]);
  } else {
    const count = seed % 7;
    word(0x14b0, count * 2 - 2);
    word(0xdeaa, rnd(16) * 2);
    for (let i = 0; i < count; i++) {
      const x = i * 2;
      word(0x14b2 + x, x);
      word(0x1458 + x, [0x100, 0x120, 0x140, 0x160, 0x400, 0, 0x40, 0x20][rnd(8)] | (rnd(2) * 8));
      for (const f of [0xe28, 0xe80]) word(f + x, rnd(0x1000));
      word(0xed8 + x, [0, 0xfc, 0x100, 0x180, 0x7fff, 0xfffc][rnd(6)]);
      for (const f of [0xd20, 0xd78, 0xdd0]) word(f + x, [0, 0, 1, 4, 0xfffc, 0x8000][rnd(6)]);
      for (const f of [0x4240, 0x4298, 0x42f0, 0x4348, 0x43a0]) word(f + x, rnd(0x60));
      word(0x40e0 + x, rnd(4) === 0 ? rnd(0x100) + 1 : 0);
    }
  }
  return {
    entry: spec.entry,
    wram,
    a: rnd(65536),
    x: rnd(65536),
    y: rnd(65536),
    dbr: [0x80, 0, 0x7e][seed % 3],
    p: rnd(256) & 0xc7,
  };
}

mainLoopMotionSpecs.forEach((spec, i) =>
  test(`${spec.name}: equations match original bytes, all own instructions reached`, () => {
    const covered = new Set();
    for (let seed = 1; seed <= 700; seed++) {
      const routines = routinesFor(spec, seed);
      const result = compareDialog(maps[i], scenario(spec, seed), {
        native: (h, events) => implementations[i](h, events, routines),
        calls: (acc, events) =>
          new Map(
            spec.externalReturns.map(([target]) => [
              target,
              () => routines.get(target)(dialogAccess(acc), events),
            ]),
          ),
      });
      assert.deepEqual(result.differences, [], `seed ${seed}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...maps[i].keys()].filter((pc) => !covered.has(pc)),
      [],
    );
  }),
);

test('CC4B uses the recorded counter observations without supplying a frame tick', () => {
  const spec = mainLoopMotionSpecs[0],
    s = scenario(spec, 1),
    routines = routinesFor(spec, 1);
  s.wram[0x1ce9] = 2;
  s.wram[0x1cea] = 0;
  s.wram[0x1c76] = 0;
  s.wram[0x1c77] = 0;
  routines.set(0x81b0a1, MAIN_MOTION_ROUTINES.get(0x81b0a1));
  const compare = () =>
    compareDialog(maps[0], s, {
      native: (h, events) => processSceneRequestReference(h, events, routines),
      calls: (acc, events) =>
        new Map(
          spec.externalReturns.map(([target]) => [
            target,
            () => routines.get(target)(dialogAccess(acc), events),
          ]),
        ),
    });
  assert.throws(
    compare,
    (e) => e.taskBoundary && e.reason === 'task_wait_observation_required' && e.pc === 0x81b0a5,
  );
  s.waits = [0, 1].map((value) => ({ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value }));
  const result = compare();
  assert.deepEqual(result.differences, []);
  assert.equal(result.events.waitIndex, 2);
  assert.equal(result.events.waitEvents.length, 2);
});
test('CC4B continuation preserves each original scene branch and its separate child routine tables', () => {
  const spec = mainLoopMotionSpecs[0],
    factory = NATIVE_CALL_CONTINUATIONS.get(processSceneRequestReference);
  assert.equal(factory.run, processSceneRequestReference);
  for (let seed = 1; seed <= 36; seed++) {
    const routines = routinesFor(spec, seed);
    const result = compareDialog(maps[0], scenario(spec, seed), {
      native: (h, events) => {
        const c = factory.create({ h, events, routines });
        let pauses = 0;
        while (c.run(1) === WAIT_PAUSED) assert.ok(++pauses < 100);
        return c.result;
      },
      calls: (acc, events) =>
        new Map(
          spec.externalReturns.map(([target]) => [
            target,
            () => routines.get(target)(dialogAccess(acc), events),
          ]),
        ),
    });
    assert.deepEqual(result.differences, [], `seed ${seed}`);
  }
});

test('unbound scenes and deliberately removed motion calls stop before adding a child frame', () => {
  for (const [entry, changes, target] of [
    [0x80cc4b, [[0x1ce9, 0x7fff]], 0x80a4bf],
    [0x80cc4b, [[0x1ce9, 0xfffe]], 0x81c3ca],
    [0x80cc4b, [[0x1ce9, 2]], 0x81cdf8],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0],
        [0x40e0, 1],
      ],
      0x80c9e0,
    ],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0x40],
        [0xd20, 4],
        [0xe28, 0x100],
      ],
      0x8080b2,
    ],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0x40],
        [0xd20, 0xfffc],
        [0xe28, 0x100],
      ],
      0x808133,
    ],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0x40],
        [0xd78, 4],
        [0xe80, 0x100],
      ],
      0x8081b4,
    ],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0x40],
        [0xd78, 0xfffc],
        [0xe80, 0x100],
      ],
      0x808238,
    ],
    [
      0x80afc4,
      [
        [0x14b0, 0],
        [0x14b2, 0],
        [0x1458, 0x40],
        [0xdd0, 4],
        [0xed8, 0x100],
      ],
      0x8082bc,
    ],
  ]) {
    const spec = mainLoopMotionSpecs.find((s) => s.entry === entry),
      s = scenario(spec, 1);
    s.wram.fill(0);
    for (const [at, value] of changes) {
      s.wram[at] = value & 255;
      s.wram[at + 1] = value >>> 8;
    }
    // Reuse the differential harness to supply a genuine accessor; this native path intentionally stops.
    assert.throws(
      () =>
        compareDialog(maps[entry === 0x80cc4b ? 0 : 2], s, {
          native: (h, events) => {
            const routines = new Map(MAIN_MOTION_ROUTINES);
            routines.delete(target);
            routines.set(0x81b0a1, (wait) => ({ rawReturnWord: wait.rtl() }));
            try {
              implementations[entry === 0x80cc4b ? 0 : 2](h, events, routines);
            } catch (error) {
              // CC4B stops with its caller frame; AFC4 has also saved Y around AB26.
              assert.equal(h.ctx.s, 0x1ef0 - (entry === 0x80cc4b ? 2 : 6));
              throw error;
            }
          },
        }),
      (error) =>
        error.taskBoundary && error.reason === 'main_loop_frontier' && error.target === target,
    );
  }
});
