import test from 'node:test';
import assert from 'node:assert/strict';
import { gameNmiSpecs, proveGameNmi } from './main-game-nmi-source.mjs';
import { matrixNmiSpecs } from './main-matrix-nmi-source.mjs';
import {
  compareDialog,
  decodeWindows,
  prng,
  DialogTestMemory,
  rom,
} from './task-native-dialog-harness.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { runReference } from './w65c816-reference.mjs';
import {
  GAME_NMI_ROUTINES,
  handleGameNmi,
  runObservedGameNmi,
} from '../src/task/main-game-nmi.mjs';
import { SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES } from '../proof/scene-reference-routines.mjs';
import { initializeGameScreen } from '../proof/game-reference/game-screen.mjs';
import { loadScene } from '../src/task/main-scene-load.mjs';
import { setBrightnessFadeSpeed, requestScenePaletteUpload } from '../src/task/main-transition.mjs';
import { TaskAccessor, NATIVE_ACCESS_LIMIT } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
const maps = gameNmiSpecs.map((s) => decodeWindows(s.windows)),
  union = new Map(maps.flatMap((m) => [...m]));
const expand = (t) =>
  t.flatMap((e) =>
    e.width === 2
      ? [
          { ...e, width: 1, value: e.value & 255 },
          { ...e, width: 1, address: e.address + 1, value: e.value >>> 8 },
        ]
      : [{ ...e, width: 1 }],
  );
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
    seed,
    wram,
    word,
    a: rnd(65536),
    x: rnd(65536),
    y: rnd(65536),
    dbr: [0, 0x80, 0x81, 0x7e][seed % 4],
    p: rnd(256) & 0xc7,
  };
  word(0xcd8, seed % 3 === 0 ? 1 : 0);
  word(0x1562, seed % 3 === 1 ? 0 : 1);
  word(0xcd0, seed & 1);
  word(0xcd6, seed & 2);
  word(0xd0e, seed & 1);
  word(0xd10, seed % 5);
  word(0x1cda, seed & 2);
  word(0x1cdc, seed % 8);
  word(0x17d4, (seed % 5) * 2);
  word(0x82, [0xfffe, 0, 2, 4, 6][seed % 5]);
  word(0x140, [0xffff, 0, 1, 0x7fff][seed % 4]);
  word(0xf6, [0xfffc, 0xfffd, 0xffff, 0][seed % 4]);
  word(0x1e8, [0, 1, 0xfffe, 0xfffd, 0xffff][seed % 5]);
  word(0x1d8, seed & 1);
  word(0x1c6, [0, 1, 0xffff, 0x8000, 0x7fff][seed % 5]);
  word(0x1c8, [0, 1, 2][Math.floor(seed / 5) % 3]);
  word(0x1bc, [0, 15, 0x80, 0x8f, 0x85, 0xff][Math.floor(seed / 15) % 6]);
  word(0x1f6, seed & 1);
  word(0x1f8, seed & 2);
  word(0x1fa, seed & 4);
  word(0x1fc, seed & 8);
  word(0x20c, [0, 0x1400, 0x1401, 0xffff][seed % 4]);
  word(0x4212, 0);
  word(0x4218, rnd(65536));
  s.io = [];
  if (s.dbr !== 0x7e) {
    if ([0x80c152, 0x81a9e1].includes(entry) && seed & 8)
      s.io.push({ pc: 0x81aa8e, address: (s.dbr << 16) | 0x213a, width: 1, value: seed & 255 });
    if ([0x80c152, 0x809e0b].includes(entry))
      s.io.push(
        { pc: 0x809e0b, address: (s.dbr << 16) | 0x4212, width: 2, value: 1 },
        { pc: 0x809e0b, address: (s.dbr << 16) | 0x4212, width: 2, value: 0 },
        { pc: 0x809e13, address: (s.dbr << 16) | 0x4218, width: 2, value: (seed * 123) & 65535 },
      );
  }
  return s;
}
function side(s) {
  const mem = new DialogTestMemory(s.wram.slice(), null, rom),
    a = new TaskAccessor({
      mem,
      a: s.a,
      x: s.x,
      y: s.y,
      s: s.s ?? 0x1ef0,
      d: 0,
      dbr: s.dbr,
      p: s.p,
      pc: s.entry & 65535,
    });
  a.load();
  a.ctx.programBank = s.entry >>> 16;
  a.trace = [];
  a.io = s.io;
  a.devices = { write() {} };
  return { mem, a, h: dialogAccess(a) };
}
test('game NMI pins all 1027 bytes, eleven real calls, closed six-byte stack and shared bindings', () => {
  gameNmiSpecs.forEach((s, i) => {
    proveGameNmi(maps[i], s);
    assert.equal(MAIN_SCENE_ROUTINES.get(s.entry), GAME_NMI_ROUTINES.get(s.entry));
  });
  const p = proveWordStack(union, 0x80c152, 'RTL', { measureStack: true });
  assert.equal(p.external_return_assumptions, 0);
  assert.equal(p.reachable_instructions, 419);
  assert.equal(p.minimum_protected_stack_bytes, 6);
  assert.deepEqual(p.returns, [{ at: '80:C1A5', m: 0, x: 0, dbr: 'entry' }]);
  assert.equal(
    gameNmiSpecs.flatMap((s) => s.windows).reduce((n, w) => n + w.hex.length / 2, 0),
    1027,
  );
  assert.deepEqual(
    [...maps[0].values()].filter((i) => ['JSR', 'JSL'].includes(i.mnemonic)).map((i) => i.target),
    gameNmiSpecs.slice(1).map((s) => s.entry),
  );
});
gameNmiSpecs.forEach((spec, i) =>
  test(`${spec.name}: native equations match every original instruction`, () => {
    const covered = new Set();
    for (let seed = 1; seed <= 180; seed++) {
      const s = sample(spec.entry, seed),
        r = new Map(GAME_NMI_ROUTINES);
      if (i === 0) {
        s.io = [];
        for (const [target, kind] of spec.externalReturns)
          r.set(target, (h) => {
            h.load(h.ctx.a + target);
            h.ctx.status ^= 0x41;
            return kind === 'RTL' ? h.rtl() : h.rts();
          });
      }
      const result = compareDialog(maps[i], s, {
        root: spec.rootReturn,
        native: (h, e) => r.get(spec.entry)(h, e, r),
        calls: (a) =>
          new Map(
            spec.externalReturns.map(([target]) => [
              target,
              () => {
                const rawReturnWord = r.get(target)(dialogAccess(a));
                return { rawReturnWord };
              },
            ]),
          ),
      });
      assert.deepEqual(result.differences, [], `seed ${seed}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...maps[i].keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
      [],
    );
  }),
);
test('C152 composes all eleven original children in order on shared WRAM', () => {
  const covered = new Set();
  for (let seed = 1; seed <= 180; seed++) {
    const s = sample(0x80c152, seed),
      r = compareDialog(union, s, { root: 'RTL', native: (h, e) => handleGameNmi(h, e) });
    assert.deepEqual(r.differences, [], `seed ${seed}`);
    for (const pc of r.visited) covered.add(pc);
  }
  assert.deepEqual(
    [...union.keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
    [],
  );
});
test('game NMI restores the interrupted frame through the complete original callback and RTI', () => {
  const map = new Map([...decodeWindows(matrixNmiSpecs[2].windows), ...union]);
  for (let seed = 1; seed <= 48; seed++) {
    const s = sample(0x80c152, seed);
    s.dbr = [0, 0x80, 0x81][seed % 3];
    s.word(0x6e, 0xc152);
    s.wram[0x70] = 0x80;
    s.p = (seed * 13) & 255;
    if (s.p & 0x10) {
      s.x &= 255;
      s.y &= 255;
    }
    s.s = seed % 2 ? 3 : 0x1ef0;
    // The handler establishes DBR00 before the callback, regardless of the interrupted DBR.
    s.io = [
      { pc: 0x00c118, address: (s.dbr << 16) | 0x4210, width: 2, value: seed * 123 },
      ...(seed & 8 ? [{ pc: 0x81aa8e, address: 0x213a, width: 1, value: seed & 255 }] : []),
      { pc: 0x809e0b, address: 0x4212, width: 2, value: 1 },
      { pc: 0x809e0b, address: 0x4212, width: 2, value: 0 },
      { pc: 0x809e13, address: 0x4218, width: 2, value: seed * 17 },
    ];
    const n = side(s),
      r = side(s);
    for (const v of [n, r]) {
      v.a.ctx.d = seed * 257;
      v.a.ctx.pc = 0x96c3;
      v.a.ctx.programBank = 0x80;
    }
    let byte = 0;
    const read = r.mem.read8.bind(r.mem);
    r.mem.read8 = (address) => {
      const o = s.io[r.a.ioIndex];
      if (o && address === o.address + byte) {
        const value = (o.value >>> (8 * byte++)) & 255;
        if (byte === o.width) {
          r.a.ioIndex++;
          byte = 0;
        }
        return value;
      }
      return read(address);
    };
    const before = { ...n.a.ctx };
    runObservedGameNmi(n.a);
    const { h, a } = r;
    h.pushByte(a.ctx.programBank);
    h.push(a.ctx.pc, 2);
    h.pushByte(a.ctx.status);
    a.ctx.status = (a.ctx.status | 4) & ~8;
    a.ctx.programBank = 0;
    runReference(map, r.mem, a.ctx, { entry: 0x00c112, root: 'RTI', io: a.trace });
    assert.deepEqual(n.a.ctx, a.ctx, `seed ${seed}`);
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(expand(n.a.trace), expand(a.trace));
    assert.deepEqual(n.a.ctx, before);
    assert.equal(n.a.ioIndex, s.io.length);
    assert.equal(a.ioIndex, s.io.length);
  }
});
test('real initialization installs C152; original fade and palette producers advance on the same memory', () => {
  const s = sample(0x809629, 1);
  s.wram.fill(0);
  s.dbr = 0x80;
  s.io = [];
  const { a, h, mem } = side(s);
  h.call(0x801000, 0x809629, () => initializeGameScreen(h));
  assert.equal(h.pointer(0x6e), 0x80c152);
  h.load(0);
  h.call(0x801010, 0x81a117, () => loadScene(h), true);
  h.load(1);
  h.call(0x801004, 0x81b0ac, () => setBrightnessFadeSpeed(h), true);
  h.call(0x801008, 0x818d05, () => requestScenePaletteUpload(h), true);
  assert.equal(mem.read16(0xd0e), 1);
  const count = mem.read16(0xd10);
  assert.ok(count > 0);
  assert.equal(mem.read16(0x1c8), 9);
  for (let i = 0; i < 9; i++) {
    a.io = [
      { pc: 0x00c118, address: 0x804210, width: 2, value: 0 },
      { pc: 0x809e0b, address: 0x4212, width: 2, value: 0 },
      { pc: 0x809e13, address: 0x4218, width: 2, value: 0x1234 },
    ];
    a.ioIndex = 0;
    const before = { ...a.ctx };
    runObservedGameNmi(a);
    assert.deepEqual(a.ctx, before);
    assert.equal(a.ioIndex, 3);
    assert.equal(mem.read16(0xd0e), 0);
    assert.equal(mem.read16(0x1ca), 0x1234);
  }
  assert.equal(mem.read8(0x1bc), 1);
  assert.equal(mem.read16(0x1c6), 1);
  assert.equal(mem.read16(0x1c8), 1);
  assert.equal(a.trace.filter((o) => o.pc === 0x8099cb).length, count);
  assert.equal(a.trace.filter((o) => o.pc === 0x80c156).length, 9);
});
test('missing child stops before its frame; missing or wrong device reads stop before later callback phases', () => {
  const s = sample(0x80c152, 1);
  s.io = [];
  const v = side(s),
    r = new Map(GAME_NMI_ROUTINES);
  r.delete(0x818949);
  v.h.pushByte(0x80);
  v.h.push(0x1234, 2);
  const stack = v.a.ctx.s;
  assert.throws(
    () => handleGameNmi(v.h, null, r),
    (e) => e.reason === 'main_loop_frontier' && e.target === 0x818949,
  );
  assert.equal(v.a.ctx.s, stack);
  for (const io of [
    [],
    [{ pc: 0x809e0b, address: 0x814212, width: 2, value: 0 }],
    [{ pc: 0x809e0b, address: 0x804212, width: 1, value: 0 }],
  ]) {
    const s = sample(0x80c152, 1);
    s.io = io;
    const { h, a } = side(s);
    h.pushByte(0x80);
    h.push(0x1234, 2);
    assert.throws(
      () => handleGameNmi(h),
      (e) => e.reason === 'device_observation_required',
    );
    assert.equal(
      a.trace.some((o) => o.pc === 0x80c0cf),
      false,
    );
  }
});
test('nonterminating original poll stops only at a missing observation', () => {
  const s = sample(0x809e0b, 1);
  s.io = [{ pc: 0x809e0b, address: 0x804212, width: 2, value: 1 }];
  const { h, a } = side(s);
  h.push(0x1234, 2);
  assert.throws(
    () => GAME_NMI_ROUTINES.get(s.entry)(h),
    (e) => e.reason === 'device_observation_required' && e.details.observationIndex === 1,
  );
  assert.equal(
    a.trace.some((o) => o.pc === 0x809e13),
    false,
  );
});
test('zero after initial palette ASL retains its WORD do-loop', () => {
  const s = sample(0x80999a, 1);
  s.word(0xd10, 0x8000);
  const { h, a } = side(s);
  h.push(0x1234, 2);
  a.accesses = NATIVE_ACCESS_LIMIT - 40;
  assert.throws(
    () => GAME_NMI_ROUTINES.get(s.entry)(h),
    (e) => e.reason === 'native_access_limit',
  );
  assert.notEqual(h.ctx.y, 0);
});
test('physical port stores are read freshly by an aliased palette source index', () => {
  const s = sample(0x8180c4, 1);
  s.dbr = 0x7e;
  s.word(0x1cda, 1);
  s.word(0x1cdc, 0x263a);
  s.word(0x4300, 0xffff);
  s.io = [];
  assert.deepEqual(
    compareDialog(maps[4], s, {
      root: 'RTL',
      native: (h) => {
        GAME_NMI_ROUTINES.get(s.entry)(h);
        assert.equal(h.read(0x7e4300, 2), 0x2200);
        assert.equal(h.read(0x7e2121, 1), 0);
      },
    }).differences,
    [],
  );
});
test('palette indexed source carries into the next physical bank', () => {
  const s = sample(0x8180c4, 1);
  s.dbr = 0x7e;
  s.word(0x1cda, 1);
  s.word(0x1cdc, 0xffff);
  s.wram[0x11cc5] = 0xbe;
  s.io = [];
  assert.deepEqual(
    compareDialog(maps[4], s, {
      root: 'RTL',
      native: (h) => {
        GAME_NMI_ROUTINES.get(s.entry)(h);
        assert.equal(h.read(0x7e2121, 1), 0xbe);
      },
    }).differences,
    [],
  );
});
test('game NMI rejects a callback outside its supplied map before interrupt effects', () => {
  const s = sample(0x80c152, 1);
  s.word(0x6e, 0xdad6);
  s.wram[0x70] = 0x81;
  const { a, mem } = side(s),
    before = { ...a.ctx },
    wram = mem.wram.slice();
  assert.throws(
    () => runObservedGameNmi(a),
    (e) => e.reason === 'observed_nmi_callback_frontier' && e.target === 0x81dad6,
  );
  assert.deepEqual(a.ctx, before);
  assert.deepEqual(mem.wram, wram);
  assert.deepEqual(a.trace, []);
});
test('hardware frame alias cannot turn a registered C152 callback into a helper entry', () => {
  const s = sample(0x80c152, 1);
  s.word(0x6e, 0xc152);
  s.wram[0x70] = 0x80;
  s.s = 0x70;
  s.io = [{ pc: 0x00c118, address: 0x804210, width: 2, value: 0 }];
  const { a } = side(s);
  a.ctx.pc = 0xc06b;
  const seen = [],
    r = new Map(GAME_NMI_ROUTINES);
  r.set(0x80c06b, () => seen.push(true));
  assert.throws(
    () => runObservedGameNmi(a, null, r),
    (e) => e.reason === 'observed_nmi_callback_frontier' && e.target === 0x80c06b,
  );
  assert.deepEqual(seen, []);
  assert.equal(a.ioIndex, 1);
});
