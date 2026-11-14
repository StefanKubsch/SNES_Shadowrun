import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matrixControlSpecs,
  proveMatrixControl,
  matrixControlTables,
} from './main-matrix-control-source.mjs';
import {
  compareDialog,
  decodeWindows,
  prng,
  window,
  DialogTestMemory,
} from './task-native-dialog-harness.mjs';
import {
  MATRIX_CONTROL_ROUTINES,
  placeRoomIcObjects,
  storeDownloadedData,
  randomBelowLong,
} from '../proof/matrix-reference/main-matrix-control.mjs';
import { stepMatrixState } from '../proof/matrix-reference/main-matrix-movement.mjs';
import {playMatrixScene} from '../proof/matrix-reference/matrix-scene-loop.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import { mainSceneSpecs } from './main-scene-source.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { NATIVE_ACCESS_LIMIT } from '../src/vm/task-accessor.mjs';
const maps = matrixControlSpecs.map((s) => decodeWindows(s.windows));
const specFor = (name) => matrixControlSpecs.find((s) => s.name === name);
const tiles = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 23, 24, 31, 32, 33, 39, 40, 0x40, 0x50, 0x58, 0x59,
];
test('Matrix control pins complete own code and the actual state, input and track dispatch tables', () => {
  matrixControlSpecs.forEach((s, i) => proveMatrixControl(maps[i], s));
  for (const t of matrixControlTables)
    assert.equal(window(t.start, t.start + t.hex.length / 2).hex, t.hex);
  const s = specFor('bd44'),
    map = decodeWindows(s.windows);
  assert.throws(
    () => proveWordStack(map, s.entry, 'RTS', { externalReturns: new Map(s.externalReturns) }),
    /Unproved indirect call/,
  );
  for (const [pc, table, indexes] of [
    [0x81bd52, 0x81bd56, [0, 2, 4, 6, 8, 10]],
    [0x81ba93, 0x81bb56, Array.from({ length: 16 }, (_, i) => i * 2)],
    [0x81bc09, 0x81bc1b, [0, 4, 8, 12]],
  ]) {
    const raw = Buffer.from(window(table, table + Math.max(...indexes) + 2).hex, 'hex');
    assert.deepEqual(
      [...new Set(indexes.map((i) => 0x810000 | raw.readUInt16LE(i)))].sort(),
      [...s.indirectCalls.find(([at]) => at === pc)[1]].sort(),
    );
  }
  // Odd half-turn directions point at zero, rather than an invented track handler.
  assert.equal(window(0x81bc1d, 0x81bc1f).hex, '0000');
  for (const [target, run] of MATRIX_CONTROL_ROUTINES)
    assert.equal(MAIN_SCENE_ROUTINES.get(target), run);
  for (const t of [0x81bec3, 0x81b1e2]) assert.equal(MAIN_SCENE_ROUTINES.has(t), true);
});
function sample(entry, seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(0x20000);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  const s = {
    entry,
    wram,
    a: rnd(65536),
    x: (seed % 8) * 2,
    y: (seed % 8) * 2,
    dbr: 0x81,
    p: rnd(256) & 0xc7,
    word,
    seed,
  };
  word(0x173e, (seed % 6) * 2);
  word(0x1740, seed % 7 === 0 ? 0 : 1);
  word(0x1742, 1 + (seed % 5));
  word(0x141c, (seed % 8) * 2);
  word(0x145e, (Math.floor(seed / 8) % 4) * 4);
  word(0x1524, seed % 19 === 0 ? 0x31 : 0x30);
  word(0x1566, seed % 23 === 0 ? 0x41 : 0x40);
  word(0x1ca, (Math.floor(seed / 6) % 16) << 8);
  word(0x16b0, (Math.floor(seed / 6) % 3) - 1);
  word(0x1c76, Math.floor(seed / 18) % 2);
  word(0x1398, seed % 2 ? 0x8001 : 0);
  word(0x1746, seed % 2);
  word(0x1750, [0, 3, 0x3e, 0xffff][seed % 4]);
  word(0x174c, [8, 0x40, 0x100][Math.floor(seed / 4) % 3]);
  word(0x1754, seed % 3 ? 100 : 0);
  word(0x1756, seed % 2 ? 0 : 0xfe);
  word(0x1d8c, seed % 2 ? 8 : 0);
  word(0x175c, 0x2000);
  word(0x1ce, 0x8080);
  word(0x1710, (seed % 8) * 4);
  if (entry === 0x81b1b5) s.a = seed % 3 ? 0x65 : 0;
  if (entry === 0x81b8ad) {
    s.a = seed % 2 ? 0xbe69 : 0xbe6d;
    word(0x15a8, 0xbe69);
  }
  if (entry === 0x81bd44 && seed % 6 === 2) word(0x141c, (Math.floor(seed / 6) % 4) * 4);
  if (entry === 0x81c25c) {
    s.a = [0, 1, 7, 0x40, 0xff, 0x100, 0xffff][Math.floor(seed / 12) % 7];
  }
  if (entry === 0x81c111 || entry === 0x81c28c) {
    word(0x173e, seed % 29 ? 2 : 0);
    if (seed % 31 === 0) word(0x1ce, 0);
  }
  if (entry === 0x81b71f) {
    // Synthetic rectangular room with a zero border; exercise both backward
    // searches, WORD horizontal/vertical scans, and every object tile range.
    wram.fill(0, 0x12000, 0x12800);
    const width = 2 + (seed % 5),
      height = 2 + (Math.floor(seed / 5) % 4);
    for (let y = 1; y <= height; y++)
      for (let x = 1; x <= width; x++)
        word(0x12000 + (y * 32 + x) * 2, [3, 8, 15, 16][(x + y + seed) % 4]);
    word(0x1524, (1 + (seed % width)) * 16);
    word(0x1566, (1 + (seed % height)) * 16);
  }
  return s;
}
// These stubs isolate each graph's own equations. Shared real compositions and
// device observations are checked separately below, not inferred from fixtures.
function routines(h, s) {
  let reads = 0;
  const r = new Map(MAIN_SCENE_ROUTINES);
  const record = (t) =>
    h.a.trace.push({
      kind: 'matrix-control-call',
      pc: t,
      address: h.ctx.x,
      value: h.ctx.y * 65536 + h.ctx.a,
    });
  for (const t of [
    0x81b959, 0x81b9d0, 0x81b69d, 0x81b609, 0x81b71f, 0x81b56f, 0x81b8c8, 0x81b1c6, 0x81b696,
    0x81b6a6, 0x81f007, 0x80f2a8, 0x80c51f,
  ])
    r.set(t, (h) => {
      record(t);
      if (t === 0x81b69d) {
        const n = reads++;
        h.load(
          s.tiles
            ? s.tiles[n % s.tiles.length]
            : s.entry === 0x81b609
              ? s.seed % 2
                ? h.read(h.abs(0xb65a) + h.ctx.y)
                : 0
              : tiles[(Math.floor(s.seed / (s.entry === 0x81bd44 ? 6 : 1)) + n) % tiles.length],
        );
      } else if ([0x81b609, 0x81b71f, 0x81b56f].includes(t)) h.load(s.seed % 2);
      else if (t === 0x80f2a8 || t === 0x80c51f) {
        h.dpWrite(0, s.seed % 2 ? 0 : 6);
        h.load(s.seed * 3);
        h.index('x', 4);
        h.index('y', 6);
      }
      return t === 0x81f007 || t === 0x80f2a8 ? h.rtl() : h.rts();
    });
  return r;
}
const calls = (h, e, r, map) =>
  new Map(
    [...r]
      .filter(([t]) => !map.has(t))
      .map(([t, run]) => [
        t,
        () => {
          const value = run(h, e, r);
          return { rawReturnWord: value?.rawReturnWord ?? value };
        },
      ]),
  );
matrixControlSpecs.forEach((spec, i) =>
  test(`${spec.name}: all Matrix control/action equations agree with original instructions`, () => {
    const scenarios = Array.from({ length: 720 }, (_, i) => sample(spec.entry, i + 1));
    if (spec.name === 'bd44') {
      for (const [input, face] of [
        [1, 4],
        [2, 12],
        [4, 8],
        [8, 0],
      ])
        for (const tile of tiles) {
          const s = sample(spec.entry, 1);
          s.tiles = [tile];
          s.word(0x173e, 2);
          s.word(0x141c, face);
          s.word(0x1ca, input << 8);
          scenarios.push(s);
        }
      const s = sample(spec.entry, 1);
      s.word(0x173e, 6);
      s.word(0x141c, 0);
      s.word(0x145e, 0);
      scenarios.push(s);
    }
    const covered = new Set();
    for (const s of scenarios) {
      const result = compareDialog(maps[i], s, {
        root: spec.rootReturn,
        native: (h, e) => MATRIX_CONTROL_ROUTINES.get(spec.entry)(h, e, routines(h, s)),
        calls: (a, e) => {
          const h = dialogAccess(a);
          return calls(h, e, routines(h, s), maps[i]);
        },
      });
      assert.deepEqual(result.differences, [], `seed ${s.seed}, tiles ${s.tiles}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...maps[i].keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
      [],
    );
  }),
);
function side(s) {
  const mem = new DialogTestMemory(s.wram),
    a = new TaskAccessor({
      mem,
      a: s.a,
      x: s.x,
      y: s.y,
      s: 0x1ef0,
      d: 0,
      dbr: s.dbr,
      p: s.p,
      pc: s.entry & 65535,
    });
  a.load();
  a.ctx.programBank = s.entry >>> 16;
  a.devices = { write() {} };
  a.trace = [];
  return { mem, a, h: dialogAccess(a) };
}

test('dispatch uses program-bank words, rejects invalid states and half-turn track slots before their frame', () => {
  for (const dbr of [0, 0x80, 0x81, 0x7e]) {
    const s = sample(0x81bd44, 1);
    s.dbr = dbr;
    s.word(0x173e, 0);
    const { h } = side(s);
    h.push(0x1234, 2);
    stepMatrixState(h, null, MAIN_SCENE_ROUTINES);
    assert.equal(h.read(h.abs(0x173e)), 2);
    assert.equal(h.ctx.s, 0x1ef0);
  }
  for (const [state, face, target] of [
    [12, 0, null],
    [0xffff, 0, null],
    [4, 2, 0x810000],
  ]) {
    const s = sample(0x81bd44, 1);
    s.word(0x173e, state);
    s.word(0x141c, face);
    const { h } = side(s),
      stack = h.ctx.s;
    assert.throws(
      () => stepMatrixState(h, null, MAIN_SCENE_ROUTINES),
      (e) =>
        e.taskBoundary &&
        e.reason === 'matrix_control_dispatch_frontier' &&
        (target === null || e.target === target),
    );
    assert.equal(h.ctx.s, stack - (state === 4 ? 2 : 0));
  }
});
test('C25C rereads the saved WORD index and has the original inclusive capacity boundary', () => {
  for (const [used, cost, capacity, full] of [
    [0, 7, 8, false],
    [1, 7, 8, true],
    [0x3e, 1, 0x100, false],
    [0x3f, 1, 0x100, true],
    [0xffff, 1, 8, false],
  ]) {
    const s = sample(0x81c25c, 1);
    s.a = cost;
    s.x = 0xcdef;
    s.word(0x1750, used);
    s.word(0x174c, capacity);
    const bind = (h) =>
      new Map([
        [
          0x81b282,
          (h) => {
            h.write((h.ctx.s + 3) & 65535, 0x1234, 2);
            return h.rts();
          },
        ],
      ]);
    assert.deepEqual(
      compareDialog(decodeWindows(specFor('c25c').windows), s, {
        native: (h, e) => {
          storeDownloadedData(h, e, bind(h));
          assert.equal(h.ctx.x, 0x1234);
          assert.equal(Boolean(h.ctx.status & 1), full);
          assert.equal(h.read(h.abs(0x1750)), full ? used : (used + cost) & 65535);
        },
        calls: (a, e) => {
          const h = dialogAccess(a);
          return calls(h, e, bind(h), new Map());
        },
      }).differences,
      [],
    );
  }
});
test('an unterminated room search stops only at the existing diagnostic access limit', () => {
  const s = sample(0x81b71f, 1);
  for (let at = 0x10000; at < 0x20000; at += 2) s.word(at, 3);
  const { h, a } = side(s);
  a.accesses = NATIVE_ACCESS_LIMIT - 1000;
  assert.throws(
    () => placeRoomIcObjects(h, null, MAIN_SCENE_ROUTINES),
    (e) => e.reason === 'native_access_limit',
  );
});
const realCalls = (h, e, map = new Map()) => calls(h, e, MAIN_SCENE_ROUTINES, map);
function randomScenario(limit) {
  const s = sample(0x80f2a8, 1);
  s.word(0, limit);
  s.word(0x1ce8, 0);
  s.word(0x1c76, 0x1a00);
  s.io = limit
    ? [
        { pc: 0x80c566, address: 0x002137, width: 1, value: 0x7b },
        { pc: 0x80c572, address: 0x00213c, width: 1, value: 0 },
        { pc: 0x80c57f, address: 0x00213d, width: 1, value: 0 },
      ]
    : [];
  return s;
}
test('F2A8 runs the proved random graph in DBR00 and requires correctly addressed BYTE observations', () => {
  for (const dbr of [0, 0x80, 0x81, 0x7e])
    for (const limit of [0, 1, 6, 7, 48]) {
      const s = randomScenario(limit);
      s.dbr = dbr;
      assert.deepEqual(
        compareDialog(decodeWindows(specFor('f2a8').windows), s, {
          root: 'RTL',
          native: (h, e) => {
            randomBelowLong(h, e, MAIN_SCENE_ROUTINES);
            assert.equal(h.ctx.bank, dbr);
            assert.ok(limit ? h.dp(0) < limit : h.dp(0) === 0);
          },
          calls: (a, e) => realCalls(dialogAccess(a), e),
        }).differences,
        [],
      );
    }
  for (const io of [
    [],
    [{ pc: 0x80c566, address: 0x002137, width: 2, value: 0 }],
    randomScenario(7).io.map((o) => ({ ...o, address: o.address | 0x800000 })),
  ]) {
    assert.throws(
      () =>
        compareDialog(
          decodeWindows(specFor('f2a8').windows),
          { ...randomScenario(7), io },
          { root: 'RTL', native: (h, e) => randomBelowLong(h, e, MAIN_SCENE_ROUTINES) },
        ),
      (e) => e.reason === 'device_observation_required',
    );
  }
});
function matchingAck(h) {
  const read = h.a.absoluteRead;
  h.a.absoluteRead = (offset, width, pc) => {
    if (offset !== 0x2140) return read(offset, width, pc);
    assert.equal(width, 1);
    assert.ok([0x81f00e, 0x81f046].includes(pc));
    const value = h.read(h.abs(0x1ce4), 1);
    h.a.trace.push({ kind: 'read', pc, address: h.abs(offset), width, value });
    return value;
  };
}
function syntheticReplies(h) {
  matchingAck(h);
  const read = h.a.absoluteRead;
  h.a.absoluteRead = (offset, width, pc) => {
    const value = new Map([
      [0x2137, 0x7b],
      [0x213c, 0],
      [0x213d, 0],
    ]).get(offset);
    if (value === undefined) return read(offset, width, pc);
    assert.equal(width, 1);
    h.a.trace.push({ kind: 'read', pc, address: h.abs(offset), width, value });
    return value;
  };
}
test('Matrix actions and dispatch compose with the real map, queue, allocation, audio and random helpers', () => {
  for (const [name, tile] of [
    ['b609', 0x3f],
    ['b71f', 8],
    ['b959', 8],
    ['b9d0', 8],
    ['bd44', 3],
    ['bd44', 8],
    ['c111', 7],
    ['c111', 8],
    ['c111', 0x20],
    ['c111', 0x40],
    ['c28c', 0x10],
    ['c28c', 0x18],
    ['c28c', 0x20],
  ]) {
    const spec = specFor(name),
      map = decodeWindows(spec.windows),
      s = sample(spec.entry, 1);
    s.p = 0;
    s.a = 0;
    s.x = 0;
    s.y = 0;
    s.word(0x173e, 2);
    s.word(0x1740, 1);
    s.word(0x141c, 4);
    s.word(0x1524, 32);
    s.word(0x1566, 32);
    s.word(0x1ca, 0x100);
    s.word(0x1ce, 0x8080);
    s.word(0x1746, 0);
    s.word(0x1750, 0);
    s.word(0x174c, 0x40);
    s.word(0x1d8c, 8);
    s.word(0x1c76, 0x1a00);
    s.word(0x1ce8, 0);
    s.wram[0x1ce4] = 0;
    s.word(0x16f2, 0xffff);
    s.word(0x173c, 0);
    s.word(0x1748, 0);
    s.word(0x174a, 0);
    s.wram.fill(0, 0x12000, 0x12800);
    for (let y = 1; y <= 4; y++)
      for (let x = 1; x <= 4; x++) s.word(0x12000 + (y * 32 + x) * 2, tile);
    for (let x = 0; x < 0x42; x += 2) {
      s.word(0x1356 + x, x === 0 ? 1 : 0);
      s.word(0x1398 + x, 0x8001);
      s.word(0x14a0 + x, 0);
      s.word(0x14e2 + x, 0);
    }
    assert.deepEqual(
      compareDialog(map, s, {
        native: (h, e) => {
          syntheticReplies(h);
          MATRIX_CONTROL_ROUTINES.get(spec.entry)(h, e, MAIN_SCENE_ROUTINES);
        },
        calls: (a, e) => {
          const h = dialogAccess(a);
          syntheticReplies(h);
          return realCalls(h, e, map);
        },
      }).differences,
      [],
      `${name}, tile ${tile}`,
    );
  }
});
test('C3CA returns through actual Matrix control, actions, object and sprite graphs without executing BEC3', () => {
  const s = sample(0x81c3ca, 8);
  s.dbr = 0x80;
  s.p = 0x43;
  s.word(0x1d90, 1);
  s.word(0x1d8e, 0xfe);
  s.wram[0x1d8f] = 0;
  s.wram[0x1ce4] = 0;
  s.wram.set(Buffer.from(window(0x98fffa, 0x98fffd).hex, 'hex'), 0x8c);
  s.word(0x1ca, 0);
  s.word(0x1cc, 0);
  s.inputs = [{ pc: 0x809e1a, address: 0x8101ca, width: 2, value: 0x40 }];
  const map = decodeWindows(mainSceneSpecs.find((s) => s.name === 'c3ca').windows);
  let counter = 0;
  const result = compareDialog(map, s, {
    root: 'RTL',
    feed: () => ++counter & 255,
    native: (h, e) => {
      matchingAck(h);
      playMatrixScene(h, e, MAIN_SCENE_ROUTINES);
      assert.equal(h.ctx.s, 0x1ef0);
      assert.equal(h.ctx.bank, 0x80);
      assert.equal(h.ctx.status, 0x43);
      assert.equal(h.dp(0x6e, 2), 0xbec3);
      assert.equal(e.inputIndex, 1);
    },
    calls: (a, e) => {
      const h = dialogAccess(a);
      matchingAck(h);
      return realCalls(h, e);
    },
  });
  assert.deepEqual(result.differences, []);
  assert.equal(result.events.waitIndex, s.waits.length);
  assert.ok(s.waits.length > 128);
  for (const pc of [0x81c4b4, 0x81c4b7, 0x81c4ba, 0x81c4ea, 0x81c4fa])
    assert.ok(result.visited.has(pc));
});
