import test from 'node:test';
import assert from 'node:assert/strict';
import { mainSceneSpecs } from './main-scene-source.mjs';
import { sceneIntroSpecs } from './main-scene-intro-source.mjs';
import { sceneAnimationSpecs } from './main-scene-animation-source.mjs';
import { matrixNmiSpecs } from './main-matrix-nmi-source.mjs';
import { introNmiSpecs } from './main-intro-nmi-source.mjs';
import { matrixSetupSpecs } from './main-scene-matrix-source.mjs';
import { inputApuWindows } from './render-task-native-input-apu-source-proof.mjs';
import { decodeWindows, DialogTestMemory, rom, window } from './task-native-dialog-harness.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
// Registers the continuations of the scene routines (the brightness loops EEDD, EEF1).
import '../proof/scene-reference-routines.mjs';
import { finishInterruptObservations } from '../proof/system/main-wait-interrupt.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';

const spec = (list, name) => list.find((s) => s.name === name);
const inputWindow = { start: 0x809e1a, hex: inputApuWindows[0].hex.slice(0, 0x23 * 2) };
const commonWindows = [
  ...spec(mainSceneSpecs, 'f298').windows,
  ...spec(sceneAnimationSpecs, 'eebb').windows,
  inputWindow,
];
const outerWindows = [
  ...spec(mainSceneSpecs, 'cdf8').windows,
  ...spec(mainSceneSpecs, 'c3ca').windows,
  ...spec(sceneIntroSpecs, 'dfe7').windows,
  ...matrixSetupSpecs
    .filter((s) => ['bfd8', 'bff8', 'c029'].includes(s.name))
    .flatMap((s) => s.windows),
  ...spec(sceneAnimationSpecs, 'eedd').windows,
  ...spec(sceneAnimationSpecs, 'eef1').windows,
  ...commonWindows,
];
const outer = decodeWindows(outerWindows),
  observations = decodeWindows([...spec(sceneAnimationSpecs, 'eebb').windows, inputWindow]);
for (const pc of [0x81cf4c, 0x81cf4f]) observations.set(pc, outer.get(pc));
const freeze = (rows) => Object.freeze(rows.map((o) => Object.freeze({ ...o })));
const expand = (trace) =>
  trace.flatMap((o) =>
    o.width === 2
      ? [
          { ...o, width: 1, value: o.value & 255 },
          { ...o, width: 1, address: o.address + 1, value: o.value >>> 8 },
        ]
      : [{ ...o, width: 1 }],
  );
function side(kind, option) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom);
  const a = new TaskAccessor({
    mem,
    a: kind === 'intro' ? 0x14 : 0,
    x: 0,
    y: 0,
    s: 0x1ef0,
    d: 0,
    dbr: 0x80,
    p: 0x43,
    pc: kind === 'intro' ? 0xcdf8 : 0xc3ca,
  });
  a.load();
  a.ctx.programBank = 0x81;
  a.trace = [];
  a.io = [];
  a.devices = { write() {} };
  const h = dialogAccess(a);
  h.pushByte(0x80);
  h.push(0x1234, 2);
  if (kind === 'matrix') {
    mem.write16(0x1d90, option);
    mem.write16(0x1d8e, 0xfe);
    mem.write8(0x1d8f, 0);
    mem.wram.set(Buffer.from(window(0x98fffa, 0x98fffd).hex, 'hex'), 0x8c);
  }
  return { mem, a, h, installed: [], callbacks: [] };
}
function referenceIo(v) {
  let byte = 0;
  const read = v.mem.read8.bind(v.mem);
  v.mem.read8 = (address) => {
    const o = v.a.io[v.a.ioIndex];
    if (o && address === o.address + byte) {
      const value = (o.value >>> (byte++ * 8)) & 255;
      if (byte === o.width) {
        v.a.ioIndex++;
        byte = 0;
      }
      return value;
    }
    return read(address);
  };
}
test('combined scene and callback execution retains each pinned original root', () => {
  // EEBB appears with multiple incoming M/X states in its callers. Pin each
  // original window separately rather than conflating their decoder metadata.
  for (const windows of [
    ...mainSceneSpecs.map((s) => s.windows),
    ...sceneIntroSpecs.map((s) => s.windows),
    ...sceneAnimationSpecs.map((s) => s.windows),
    ...matrixSetupSpecs
      .filter((s) => ['bfd8', 'bff8', 'c029'].includes(s.name))
      .map((s) => s.windows),
    ...matrixNmiSpecs.map((s) => s.windows),
    ...introNmiSpecs.map((s) => s.windows),
    [inputWindow],
  ])
    assertPinnedTaskSource(decodeWindows(windows), windows);
});
test('both resumable brightness loops retain BYTE hardware polls and their actual PHP/PLP frames', () => {
  for (const name of ['eedd', 'eef1']) {
    const s = spec(sceneAnimationSpecs, name),
      wait = decodeWindows(spec(sceneAnimationSpecs, 'eebb').windows);
    const graph = decodeWindows([...s.windows, ...spec(sceneAnimationSpecs, 'eebb').windows]);
    const n = side('matrix', 0),
      r = side('matrix', 0),
      records = [];
    let polls = 0;
    for (const v of [n, r]) {
      v.a.ctx.pc = s.entry & 65535;
      v.a.ctx.a = 0xa55a;
      v.mem.write8(0x30, 0);
    }
    referenceIo(r);
    const before = new Map(
      [...wait.keys()].map((pc) => [
        pc,
        () => {
          records.push({ pc, nmi: false });
          if (pc === 0x81eec2)
            r.a.io.push({ pc, address: 0x804212, width: 1, value: ++polls % 3 ? 0x80 : 0 });
        },
      ]),
    );
    runReference(graph, r.mem, r.a.ctx, { entry: s.entry, root: 'RTL', before, io: r.a.trace });
    n.a.io = r.a.io;
    const events = { interrupts: freeze(records), interruptIndex: 0 };
    const c = NATIVE_CALL_CONTINUATIONS.get(s.entry).create({ h: n.h, events }),
      wram = n.mem.wram.slice();
    assert.equal(c.run(0), WAIT_PAUSED);
    assert.deepEqual(n.mem.wram, wram);
    let pauses = 0;
    while (c.run(1) === WAIT_PAUSED) assert.ok(++pauses < records.length * 4 + 100);
    finishInterruptObservations(events);
    assert.deepEqual(n.a.ctx, r.a.ctx);
    assert.deepEqual(n.mem.wram, r.mem.wram);
    assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
    assert.equal(n.a.ioIndex, 48);
    assert.equal(n.mem.read16(0x1c76), 0);
    assert.equal(n.a.ctx.status, 0x43);
  }
});
