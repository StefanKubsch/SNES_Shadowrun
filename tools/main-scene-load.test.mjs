import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneLoadSpecs, proveSceneLoad } from './main-scene-load-source.mjs';
import { compareDialog, decodeWindows, prng } from './task-native-dialog-harness.mjs';
import { SCENE_LOAD_ROUTINES, loadScene } from '../proof/system/main-scene-load.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { rom } from './task-native-dialog-harness.mjs';
import { cpuToOffset } from './rom.mjs';
import { runReference } from './w65c816-reference.mjs';
import { mainInitializeSpecs } from './main-initialize-source.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { MAIN_SCENE_ROUTINES } from '../proof/replay/main-scene.mjs';
const maps = sceneLoadSpecs.map((s) => decodeWindows(s.windows));
const union = new Map(maps.flatMap((m) => [...m]));
const external = (a, e, map, r) =>
  new Map(
    [...r]
      .filter(([target]) => !map.has(target))
      .map(([target, run]) => [
        target,
        () => {
          const v = run(dialogAccess(a), e, r);
          return { rawReturnWord: v?.rawReturnWord ?? v };
        },
      ]),
  );
function base(entry, seed = 1) {
  const wram = new Uint8Array(0x20000),
    word = (at, v) => {
      wram[at] = v & 255;
      wram[at + 1] = (v >>> 8) & 255;
    };
  return { entry, wram, word, a: 0, x: 0, y: 0, dbr: 0x7e, p: seed & 0xc7 };
}
test('scene loader pins all reachable bytes, frames and mode restoration', () => {
  sceneLoadSpecs.forEach((s, i) => {
    assert.equal(proveSceneLoad(maps[i], s).reachable_instructions, maps[i].size);
    assert.equal(MAIN_SCENE_ROUTINES.get(s.entry), SCENE_LOAD_ROUTINES.get(s.entry));
  });
  const layer = sceneLoadSpecs.find((s) => s.entry === 0x81903e),
    fullLayer = decodeWindows([...layer.windows, ...layer.unreachableWindows]);
  assert.equal(fullLayer.size, 464);
  assert.equal(
    proveWordStack(fullLayer, layer.entry, 'RTS', {
      externalReturns: new Map(layer.externalReturns),
    }).reachable_instructions,
    452,
  );
  const s = sceneLoadSpecs[1],
    m = maps[1];
  assert.throws(() => proveWordStack(m, s.entry, s.rootReturn), /Mode mismatch/);
  assert.throws(
    () => proveWordStack(m, s.entry, s.rootReturn, { statusRestoreJoins: new Set([0x81802b]) }),
    /Invalid status restore/,
  );
  // PLB remains width independent; PLP must still consume the saved PHP.
  const broken = new Map(m);
  broken.set(0x81801a, { ...broken.get(0x81801a), mnemonic: 'NOP' });
  assert.throws(
    () =>
      proveWordStack(broken, s.entry, s.rootReturn, {
        statusRestoreJoins: new Set(s.statusRestoreJoins),
      }),
    /Stack mismatch/,
  );
  const graph = new Map(union);
  for (const s of mainInitializeSpecs.filter((s) => [0x818cb9, 0x818000].includes(s.entry)))
    for (const item of decodeWindows(s.windows)) graph.set(...item);
  const proof = proveWordStack(graph, 0x81a117, 'RTL', {
    measureStack: true,
    externalReturns: new Map([[0x809f6d, 'RTS']]),
    statusRestoreJoins: new Set([0x818073, 0x818074]),
    indexPulls: new Set([0x818efc]),
  });
  assert.equal(proof.external_return_assumptions, 1);
  assert.equal(proof.minimum_protected_stack_bytes, 21);
  assert.deepEqual(proof.returns, [{ at: '81:A1BB', m: 0, x: 0, dbr: 'entry' }]);
});
test('A117 composes original scene data with every native loader and palette helper', () => {
  for (let scene = 0; scene < 16; scene++) {
    const s = base(0x81a117, scene);
    s.a = scene;
    s.dbr = [0x80, 0x81, 0x7e, 0][scene % 4];
    const result = compareDialog(union, s, {
      root: 'RTL',
      referenceLimit: 4_000_000,
      native: (h, e) => loadScene(h, e),
      calls: (a, e) => external(a, e, union, SCENE_LOAD_ROUTINES),
    });
    assert.deepEqual(result.differences, [], `scene ${scene}`);
  }
});
function synthetic(spec, seed) {
  const s = base(spec.entry, seed),
    { word, wram } = s,
    random = prng(seed),
    rnd = (n) => Math.floor(random() * n);
  // Synthetic WRAM only; no fixture is an observed scene/frame.
  for (let n = 0; n < 0x2000; n++) wram[n] = rnd(256);
  s.a = rnd(65536);
  s.x = [0, 0x7e, 0x80, 0xffe, 0xfff, 0xfffe][seed % 6];
  s.y = rnd(65536);
  word(0x17, seed % 4);
  word(0x20, 0x40);
  word(0x23, rnd(0x10000));
  word(0x26, [0xffff, 0, 1, 5][seed % 4]);
  word(0x29, seed % 3);
  word(0x2c, seed % 3);
  word(0xe, 0xf000);
  wram[0x10] = 0x7f;
  word(0x11, 0xf800);
  wram[0x13] = 0x7f;
  word(0x14, 0xf900);
  wram[0x16] = 0x7f;
  word(0xd10, seed % 4);
  word(0x1cbc, (seed % 3) * 2);
  const entries = [0x12, 0x4012, 0x8012, 0xc012];
  for (let i = 0; i < 8; i++) {
    word(0x1f000 + 5 * i, entries[(seed + i) % 4]);
    word(0x1f002 + 5 * i, 0x0101);
    word(0x1f003 + 5 * i, 0x0101);
  }
  for (let i = 0; i < 8; i++) word(0x1f800 + i * 2, (seed + i) % 3 ? i + 1 : 0);
  wram[0x1f900 + 0x101] = seed % 7;
  if (spec.entry === 0x81801a) {
    s.a = seed % 2 ? rom[cpuToOffset(0x8bfd75 + (seed % 6) * 3, rom.length)] : 0xfe;
    s.y = seed;
  }
  if (spec.entry === 0x818ce0) {
    s.a = seed % 4;
    word(0x1c980 + s.a * 2, seed & 1 ? seed % 4 : 0xffff);
  }
  if (spec.entry === 0x818e57) {
    const triples = [
        [0, 0, 0],
        [0x123, 0, 0],
        [0x123, 0x456, 0],
        [0x123, 0x456, 0x789],
        [0xffff, 0xffff, 0xffff],
      ],
      v = triples[seed % 5];
    v.forEach((n, i) => word(0x1a + 2 * i, n));
    word(0xd6e8, 0x40);
    for (let i = 0; i < 256; i++) word(0x1c780 + 2 * i, 0xffff);
    let sum = v[0] + v[1];
    sum = (sum & 65535) + v[2] + Number(sum > 65535);
    const hash = (sum & 255) * 2;
    if (seed % 7) {
      word(0x1c780 + hash, 0);
      const flip = seed & 1 ? 0x4000 : 0;
      for (let n = 0; n < 2; n++) {
        v.forEach((value, i) =>
          word(
            [0xa6a8, 0xaea8, 0xb6a8][i] + 2 * n,
            value ^ flip ^ (n === 0 && i === seed % 3 && seed % 7 > 1 ? 1 : 0),
          ),
        );
        word(0xbea8 + 2 * n, n === 0 && seed % 7 < 6 ? 2 : 0xffff);
        word(0xcea8 + 2 * n, seed);
      }
    }
  }
  if (spec.entry === 0x818edf) {
    for (const x of [0, 2, 0x80, 0x100, 0xbbe]) word(0x1ce14 + x, 0x101);
  }
  if (spec.entry === 0x81940a) {
    for (let x = 0; x < 0xc00; x += 2) word(0x10000 + x, 0xffff);
    for (const x of [0, 2, 0xbfe]) word(0x10000 + x, x % 0x18);
    for (const y of [0, 2, 4, 6, 0x2ff8, 0x2ffa, 0x2ffc, 0x2ffe])
      word(0x46a8 + y, (seed % 3 ? 1 : 0) | (seed & 1 ? 0xc000 : 0));
    for (let i = 0; i < 8; i++) {
      word(0xaea8 + i * 2, seed % 3 ? seed % 5 : 0);
      word(0xb6a8 + i * 2, seed % 4 ? seed % 5 : 0);
    }
  }
  if (spec.entry === 0x81a117) {
    s.a = seed % 8;
    word(0x1da14, seed);
    wram[0x1da16] = seed % 6;
    wram[0x1da17] = seed % 2;
    wram[0x1da18] = seed % 2;
    wram[0x1da19] = seed % 2;
  }
  return s;
}
const stubRoutines = (spec, seed) =>
  new Map(
    spec.externalReturns.map(([target, op]) => [
      target,
      (h) => {
        h.a.trace.push({
          kind: 'scene-call',
          pc: target,
          address: h.ctx.x,
          value: h.ctx.a + h.ctx.y * 65536,
        });
        h.load(seed % 7);
        return op === 'RTL' ? h.rtl() : h.rts();
      },
    ]),
  );
for (const [i, spec] of sceneLoadSpecs.entries())
  if (spec.entry !== 0x81903e)
    test(`${spec.name}: synthetic branch equations and every own instruction`, () => {
      const covered = new Set();
      for (let seed = 0; seed < 96; seed++) {
        const s = synthetic(spec, seed),
          r = stubRoutines(spec, seed),
          result = compareDialog(maps[i], s, {
            root: spec.rootReturn,
            native: (h, e) => SCENE_LOAD_ROUTINES.get(spec.entry)(h, e, r),
            calls: (a, e) => external(a, e, maps[i], r),
          });
        assert.deepEqual(result.differences, [], `seed ${seed}`);
        for (const pc of result.visited) covered.add(pc);
      }
      assert.deepEqual(
        [...maps[i].keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
        [],
      );
    });
function layerFixture(seed) {
  const s = base(0x81903e, seed),
    { word, wram } = s;
  s.rom = rom.slice();
  const put = (at, bytes) => s.rom.set(bytes, cpuToOffset(at, s.rom.length));
  const putWord = (at, n) => put(at, [n & 255, (n >>> 8) & 255]);
  word(0xe, 0xf000);
  wram[0x10] = 0x7f;
  word(0x17, 1 + ((seed >>> 8) % 2));
  word(0x5c, 0x46a8);
  word(0x20, 0x40);
  word(0x65, seed & 1 ? 0x2000 : 0);
  // Explicitly synthetic data tables; executable ROM bytes remain unchanged.
  const flags = (seed % 8) * 0x2000;
  word(0x1f000, flags);
  wram[0x1f002] = seed % 9 === 0 ? 0xff : 0;
  wram[0x1f003] = 0;
  wram[0x1f004] = 0;
  wram.set(wram.subarray(0x1f000, 0x1f005), 0x1f005);
  putWord(0x8ac36a, 0xf000);
  put(0x8af000, [(seed >>> 7) % 3]);
  for (const at of [0x8af001, 0x8af003]) putWord(at, [0xef40, 0xcf40, 0x2f40, 0][(seed >>> 3) % 4]);
  putWord(0x8af005, seed % 10);
  for (const at of [0x8af008, 0x8af00d]) {
    putWord(at, seed & 1 ? 0x8000 : 0);
    putWord(at + 2, seed & 2 ? 0x100 : 0);
    put(at + 4, [0]);
  }
  put(0x96c3fa, [0x00, 0xf8, 0x7f]);
  wram[0x1f800] = seed % 3 === 0 ? 0x11 : 0;
  wram[0x1f801] = seed & 4 ? 0x80 : 0;
  let cursor = 0x1f802;
  for (let i = 0; i < 4; i++) {
    if (!(seed & 4)) wram[cursor++] = seed % 10;
    word(cursor, seed % 13 === 0 ? 0 : 0x123 + i);
    cursor += 2;
  }
  for (let at = 0x46a8; at < 0x76a8; at += 2)
    word(at, seed % 7 === 0 ? 0 : 1 | [0, 0x4000, 0xc000][(seed >>> 4) % 3]);
  if (seed % 11 === 0) for (let at = 0x10000; at < 0x10c00; at += 2) word(at, 0xffff);
  for (let at = 0x10c00; at < 0x10c18; at += 6) {
    const depths = [
      [0xffff, 0xffff, 0xffff],
      [0, 0, 0],
      [8, 5, 2],
      [2, 5, 8],
    ][(seed >>> 1) % 4];
    depths.forEach((n, i) => word(at + i * 2, n));
  }
  word(0xa6aa, 0x10);
  word(0xaeaa, (seed >>> 5) % 3 ? 0x20 : 0);
  word(0xb6aa, (seed >>> 5) % 4 ? 0x30 : 0);
  word(0xceaa, seed % 3 === 1 ? 0 : 2);
  word(0xbeaa, seed & 1 ? 0xffff : 4);
  word(0xc6aa, seed & 2 ? 0x8000 : 6);
  return s;
}
test('903E: synthetic clipping, both mirror axes, depth insertion and eviction agree with original instructions', () => {
  const spec = sceneLoadSpecs.find((s) => s.entry === 0x81903e),
    map = maps[sceneLoadSpecs.indexOf(spec)],
    covered = new Set();
  for (let seed = 0; seed < 1024; seed++) {
    const s = layerFixture(seed),
      r = stubRoutines(spec, seed),
      result = compareDialog(map, s, {
        native: (h, e) => SCENE_LOAD_ROUTINES.get(s.entry)(h, e, r),
        calls: (a, e) => external(a, e, map, r),
      });
    assert.deepEqual(result.differences, [], `seed ${seed}`);
    for (const pc of result.visited) covered.add(pc);
  }
  // With 5F=0 the old stack has one or two words (Y=1/2). The search
  // increments X by two at most Y times, so X-56 <=4; CMP #6 cannot
  // fall through to the JMP at 9308. A full three-word stack sets 5F=3
  // and takes the separate eviction branch. This is a value invariant,
  // not a claim that the syntactic branch graph lacks that instruction.
  assert.deepEqual(
    [...map.keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
    ['819308'],
  );
  for (const [pc, op, value] of [
    [0x81926e, 'LDY', 3],
    [0x819271, 'STY', 0x5f],
    [0x819291, 'LDY', 2],
    [0x819294, 'STZ', 0x5f],
    [0x81929c, 'LDY', 1],
    [0x81929f, 'STZ', 0x5f],
    [0x8192ab, 'INX', 0],
    [0x8192ac, 'INX', 0],
    [0x8192ad, 'DEY', 0],
    [0x8192b4, 'LDA', 0x5f],
    [0x819303, 'CMP', 6],
  ]) {
    assert.equal(map.get(pc).mnemonic, op);
    assert.equal(map.get(pc).value, value);
  }
});
test('A117 reads a changed outer return frame freshly and its caller rejects the changed continuation', () => {
  const spec = sceneLoadSpecs[0],
    s = synthetic(spec, 1),
    mem = new DialogTestMemory(s.wram.slice()),
    a = new TaskAccessor({
      mem,
      a: s.a,
      x: s.x,
      y: s.y,
      s: 0x1ef0,
      d: 0,
      dbr: 0x80,
      p: 0,
      pc: 0xa518,
    });
  a.load();
  a.ctx.programBank = 0x80;
  a.trace = [];
  a.devices = { write() {} };
  const h = dialogAccess(a),
    r = stubRoutines(spec, 1);
  r.set(0x81940a, (h) => {
    h.write((h.ctx.s + 4) & 65535, 0x1111, 2);
    return h.rts();
  });
  assert.throws(
    () => h.call(0x80a518, 0x81a117, () => loadScene(h, null, r), true),
    (e) => e.reason === 'task_native_helper_return_required' && e.returnPc === 0x1112,
  );
  assert.equal(h.ctx.s, 0x1ef0);
  assert.equal(h.ctx.programBank, 0x80);
});
test('reference memory BIT takes N/V from the operand at its actual width; immediate BIT preserves N/V', () => {
  const bit = union.get(0x81913d),
    immediate = union.get(0x81907e),
    ret = union.get(0x819409);
  for (const [instruction, status, value, a, expected] of [
    [bit, 1, 0xc000, 1, 0xc3],
    [bit, 0x21, 0xc000, 1, 0x23],
    [bit, 0x21, 0xc0, 1, 0xe3],
    [bit, 0xc1, 1, 1, 1],
    [immediate, 0xc1, 0, 0, 0xc3],
    [immediate, 0xc1, 0, 0x80, 0xc1],
  ]) {
    const mem = new DialogTestMemory(new Uint8Array(0x20000));
    mem.write16(instruction.value, value);
    mem.write16(0x1eef, 0x1234);
    const ctx = { a, x: 0, y: 0, s: 0x1eee, d: 0, bank: 0x7e, status, programBank: 0x81 };
    const map = new Map([
      [instruction.cpu, instruction],
      [instruction.next, { ...ret, cpu: instruction.next, next: instruction.next + 1 }],
    ]);
    runReference(map, mem, ctx, { entry: instruction.cpu, root: 'RTS' });
    assert.equal(ctx.status, expected);
  }
});
