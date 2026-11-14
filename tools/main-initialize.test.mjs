import test from 'node:test';
import assert from 'node:assert/strict';
import { mainInitializeSpecs, proveMainInitialize } from './main-initialize-source.mjs';
import {
  compareDialog,
  decodeWindows,
  prng,
  rom,
  DialogTestMemory,
} from './task-native-dialog-harness.mjs';
import { sceneVideoSpecs } from './main-scene-video-source.mjs';
import { MAIN_INITIALIZE_ROUTINES, loadWindowStyleTiles } from '../src/task/main-initialize.mjs';
import { initializeGameScreen } from '../proof/game-reference/game-screen.mjs';
import { MAIN_SCENE_ROUTINES } from '../src/task/main-scene.mjs';
import { GAME_NMI_LIFTED_JOBS } from '../src/game/game-nmi.mjs';
import { MAIN_MOTION_ROUTINES } from '../src/task/main-loop-motion.mjs';
import { processSceneRequestReference } from '../proof/game-reference/scene-request.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { runObservedIntroNmi } from '../src/task/main-intro-nmi.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { cpuToOffset } from './rom.mjs';
import { runReference } from './w65c816-reference.mjs';
const maps = mainInitializeSpecs.map((s) => decodeWindows(s.windows));
const union = new Map(maps.flatMap((m) => [...m]));
const c109 = sceneVideoSpecs.find((s) => s.entry === 0x80c109);
for (const item of decodeWindows(c109.windows)) union.set(...item);
const external = (h, e, map, r) =>
  new Map(
    [...r]
      .filter(([target]) => !map.has(target))
      .map(([target, run]) => [
        target,
        () => {
          const value = run(h, e, r);
          return { rawReturnWord: value?.rawReturnWord ?? value };
        },
      ]),
  );
function scenario(entry, seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(0x20000);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  word(0x1d61, 0);
  word(0x214, seed % 3 ? 0xffff : 0);
  word(0x1f6, seed & 1);
  word(0x1f8, seed & 2);
  word(0x1fa, seed & 4);
  word(0x1fc, seed & 8);
  word(0x20c, [0, 1, 0x1400, 0x1401, 0xffff][seed % 5]);
  word(0x20a, [0, 0xf600, 0xffff][seed % 3]);
  const dbr = [0x80, 0x81, 0, 0x7e][seed % 4];
  return {
    entry,
    seed,
    word,
    wram,
    a: entry === 0x81aa9c ? 0 : rnd(65536),
    x: rnd(65536),
    y: rnd(65536),
    dbr,
    p: rnd(256) & 0xc7,
    io:
      entry === 0x81a9e1 && seed & 8 && dbr !== 0x7e
        ? [{ pc: 0x81aa8e, address: (dbr << 16) | 0x213a, width: 1, value: seed & 255 }]
        : [],
  };
}
function stubs(spec, seed) {
  return new Map(
    spec.externalReturns.map(([target, op]) => [
      target,
      (h) => {
        h.a.trace.push({
          kind: 'initialize-call',
          pc: target,
          address: h.ctx.x,
          value: h.ctx.a + h.ctx.y * 65536,
        });
        h.dpWrite(0x6b, seed * 17);
        h.load(seed * 31);
        h.ctx.status ^= 0x41;
        return op === 'RTL' ? h.rtl() : h.rts();
      },
    ]),
  );
}
test('initialization pins every own byte, WORD/DBR returns and actual binding', () => {
  mainInitializeSpecs.forEach((s, i) => {
    proveMainInitialize(maps[i], s);
    // The game NMI job 81:A9E1 is bound lifted (src/game/game-nmi.mjs).
    assert.equal(
      MAIN_SCENE_ROUTINES.get(s.entry),
      GAME_NMI_LIFTED_JOBS.get(s.entry) ?? MAIN_INITIALIZE_ROUTINES.get(s.entry),
    );
  });
  assert.equal(MAIN_MOTION_ROUTINES.get(0x809629), MAIN_INITIALIZE_ROUTINES.get(0x809629));
  const map = maps[10];
  assert.equal(map.get(0x81aaab).mnemonic, 'ADC');
  assert.equal(map.get(0x81aaaa).mnemonic, 'ASL');
  // The symbolic palette bank is derived only from these pinned WORD bytes.
  for (const [pc, op] of [
    [0x81aadd, 'LDA'],
    [0x81aae1, 'AND'],
    [0x81aae4, 'STA'],
    [0x81aae7, 'XBA'],
    [0x81aae8, 'PHA'],
    [0x81aae9, 'PLB'],
    [0x81aaea, 'PLB'],
  ])
    assert.equal(map.get(pc).mnemonic, op);
  assert.equal(map.get(0x81aae1).value, 255);
  assert.equal(map.get(0x81aae4).value, 0x1f4);
  const closed = proveWordStack(union, 0x809629, 'RTS', {
    measureStack: true,
    externalReturns: new Map([
      [0x809f49, 'RTL'],
      [0x81a9b2, 'RTL'],
    ]),
    wordPushes: new Map(mainInitializeSpecs[10].wordPushes),
  });
  assert.equal(closed.external_return_assumptions, 2);
  assert.equal(closed.minimum_protected_stack_bytes, 11);
  assert.deepEqual(closed.returns, [{ at: '80:9687', m: 0, x: 0, dbr: 'entry' }]);
});
mainInitializeSpecs.forEach((spec, i) =>
  test(`${spec.name}: original equations and all own instructions`, () => {
    const covered = new Set();
    for (let seed = 1; seed <= 80; seed++) {
      const s = scenario(spec.entry, seed),
        r = stubs(spec, seed),
        result = compareDialog(maps[i], s, {
          root: spec.rootReturn,
          native: (h, e) =>
            (spec.entry === 0x809629
              ? initializeGameScreen
              : MAIN_INITIALIZE_ROUTINES.get(spec.entry))(h, e, r),
          calls: (a, e) => external(dialogAccess(a), e, maps[i], r),
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
test('9629 composes every real reset, original font streams, conversion and callback registration', () => {
  for (let seed = 1; seed <= 16; seed++) {
    const s = scenario(0x809629, seed);
    s.io = [];
    const r = compareDialog(union, s, {
      native: (h, e) => initializeGameScreen(h, e),
      calls: (a, e) => external(dialogAccess(a), e, union, MAIN_INITIALIZE_ROUTINES),
    });
    assert.deepEqual(r.differences, [], `seed ${seed}`);
    assert.equal(r.events.waitIndex, 0);
  }
});
function side(s) {
  const mem = new DialogTestMemory(s.wram.slice(), null, s.rom ?? rom),
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
test('real initialization resets task/list owners, preserves unrelated memory and installs C152 before enabling NMI', () => {
  const s = scenario(0x809629, 1);
  s.dbr = 0x80;
  s.io = [];
  const { mem, a, h } = side(s);
  h.push(0x1234, 2);
  initializeGameScreen(h);
  assert.equal(h.pointer(0x6e), 0x80c152);
  assert.equal(h.ctx.s, 0x1ef0);
  assert.equal(h.ctx.pc, 0x1235);
  assert.equal(h.ctx.bank, 0x80);
  for (const [at, value] of [
    [0xcc2, 0xffff],
    [0x1ce9, 0xffff],
    [0x24c, 0xffff],
    [0x250, 0xffff],
    [0x24e, 0],
    [0x3d2, 0x7cc],
    [0x3d4, 0],
    [0x1d4, 0x8000],
    [0x1da, 0xffff],
    [0x1be, 0x17],
    [0x14b0, 0xfffe],
    [0x82, 0xfffe],
    [0x1562, 0],
    [0x204, 0xfffe],
    [0x214, 0],
    [0x1fe, 0xff40],
    [0x1f4, 0x81],
  ])
    assert.equal(mem.read16(at), value, at.toString(16));
  assert.equal(mem.read16(0x312), 2);
  assert.equal(mem.read16(0x370), 0xffff);
  assert.equal(mem.read16(0x1870), 0xffff);
  assert.equal(mem.read8(0x1f63), 0);
  assert.equal(mem.read16(0x7fc980), 0xffff);
  assert.equal(mem.read16(0x7fca12), 0xffff);
  assert.equal(mem.read8(0x7e5000), s.wram[0x5000]);
  assert.deepEqual(
    a.trace
      .filter((o) => [0x4200, 0x420c, 0x420d].includes(o.address & 65535))
      .map((o) => [o.pc, o.address, o.width, o.value]),
    [
      [0x80962d, 0x80420d, 1, 1],
      [0x809630, 0x804200, 1, 0],
      [0x809633, 0x80420c, 1, 0],
      [0x809671, 0x804200, 1, 0x81],
    ],
  );
  assert.deepEqual(
    a.trace.slice(-4).map((o) => [o.pc, o.address, o.width, o.value]),
    [
      [0x809679, 0x802112, 1, 0],
      [0x80967c, 0x802112, 1, 0],
      [0x80967f, 0x802111, 1, 0],
      [0x809682, 0x802111, 1, 0],
    ],
  );
  // The intro-only table does not admit the gameplay callback. Registration
  // executes no interrupt; the game table is tested in main-game-nmi.test.mjs.
  const before = mem.wram.slice(),
    stack = h.ctx.s;
  assert.throws(
    () => runObservedIntroNmi(a),
    (e) => e.reason === 'observed_nmi_callback_frontier' && e.target === 0x80c152,
  );
  assert.deepEqual(mem.wram, before);
  assert.equal(h.ctx.s, stack);
});
test('missing initialization callee stops before its frame and late enable stores', () => {
  const s = scenario(0x809629, 1);
  s.dbr = 0x80;
  s.io = [];
  const { a, h } = side(s),
    r = new Map(MAIN_INITIALIZE_ROUTINES);
  r.delete(0x81ab2c);
  h.push(0x1234, 2);
  const stack = h.ctx.s;
  assert.throws(
    () => initializeGameScreen(h, null, r),
    (e) => e.reason === 'main_loop_frontier' && e.target === 0x81ab2c,
  );
  assert.equal(h.ctx.s, stack);
  assert.equal(
    a.trace.some((o) => o.pc === 0x809671),
    false,
  );
});
test('AA9C retains ASL carry and rereads its saved palette index after the first unpack', () => {
  const s = scenario(0x81aa9c, 1);
  s.a = 0xaaaa;
  s.dbr = 0x80;
  s.io = [];
  s.rom = rom.slice();
  s.word(0x214, 0xffff);
  // ((2 * AAAA) + AAAA + carry) = FFFF. Long indexed reads cross into bank 81.
  const put = (address, value) =>
    s.rom.set([value & 255, value >>> 8], cpuToOffset(address, s.rom.length));
  for (const [at, v] of [
    [0x81ffac, 0xff98],
    [0x81ffae, 0x0080],
    [0x81ffaf, 0x6000],
    [0x81ffb1, 0x0081],
  ])
    put(at, v);
  // The overlapping record fields above intentionally share bytes, as in the ROM.
  const spec = mainInitializeSpecs[10],
    r = stubs(spec, 1),
    seen = [];
  r.set(0x809f49, (h) => {
    seen.push([h.ctx.a, h.ctx.y, h.ctx.x, h.read((h.ctx.s + 4) & 65535, 2)]);
    h.write((h.ctx.s + 4) & 65535, 0, 2);
    h.load(0x50);
    return h.rtl();
  });
  const result = compareDialog(maps[10], s, {
    root: 'RTL',
    native: (h, e) => loadWindowStyleTiles(h, e, r),
    calls: (a, e) => external(dialogAccess(a), e, maps[10], r),
  });
  assert.deepEqual(result.differences, []);
  assert.deepEqual(seen, [
    [0xff98, 0x80, 0x23a0, 0xffff],
    [0xff98, 0x80, 0x23a0, 0xffff],
  ]);
});
test('CC4B reaches real initialization and stops before a deliberately removed A4BF frame', () => {
  const s = scenario(0x80cc4b, 1);
  s.dbr = 0x80;
  s.io = [];
  s.word(0x1ce9, 0);
  const { h, mem } = side(s);
  h.push(0x1234, 2);
  const r = new Map(MAIN_MOTION_ROUTINES);
  r.set(0x81b0a1, (h) => h.rtl());
  r.set(0x81cdf8, (h) => h.rtl());
  r.delete(0x80a4bf);
  assert.throws(
    () => processSceneRequestReference(h, { waitEvents: [] }, r),
    (e) => e.reason === 'main_loop_frontier' && e.target === 0x80a4bf,
  );
  assert.equal(h.pointer(0x6e), 0x80c152);
  assert.equal(mem.read16(0x1ce9), 0xffff);
  assert.equal(h.ctx.s, 0x1eee);
});
test('A9E1 requires the reached BYTE device read and leaves its final clear behind that boundary', () => {
  for (const io of [
    [],
    [{ pc: 0x81aa8e, address: 0x81213a, width: 1, value: 0 }],
    [{ pc: 0x81aa8e, address: 0x80213a, width: 2, value: 0 }],
  ]) {
    const s = scenario(0x81a9e1, 8);
    s.dbr = 0x80;
    s.io = io;
    const { h, mem } = side(s);
    h.pushByte(0x80);
    h.push(0x1234, 2);
    assert.throws(
      () => MAIN_INITIALIZE_ROUTINES.get(s.entry)(h),
      (e) =>
        e.reason === 'device_observation_required' &&
        e.details?.pc === 0x81aa8e &&
        e.details.width === 1,
    );
    assert.equal(mem.read16(0x1fc), 8);
  }
});
test('C109 can overwrite the initialization caller return; both executions take the fresh word', () => {
  const s = scenario(0x809629, 1);
  s.dbr = 0x80;
  s.io = [];
  s.s = 0x6f;
  const n = side(s),
    r = side(s);
  for (const v of [n, r]) v.h.push(0x1234, 2);
  initializeGameScreen(n.h);
  runReference(union, r.mem, r.a.ctx, {
    entry: s.entry,
    root: 'RTS',
    io: r.a.trace,
    calls: external(r.h, null, union, MAIN_INITIALIZE_ROUTINES),
  });
  for (const key of ['a', 'x', 'y', 's', 'd', 'status', 'pc', 'programBank', 'bank'])
    assert.equal(n.a.ctx[key], r.a.ctx[key], key);
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.equal(n.a.ctx.pc, 0xc153);
  assert.equal(n.a.ctx.s, 0x6f);
  const guarded = side(s);
  assert.throws(
    () => guarded.h.call(0x801234, 0x809629, () => initializeGameScreen(guarded.h)),
    (e) => e.reason === 'task_native_helper_return_required' && e.target === 0x809629,
  );
});
