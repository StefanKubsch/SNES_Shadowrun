import '../proof/system/recorded-routines.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneLoadSpecs } from './main-scene-load-source.mjs';
import { sceneGraphicsSpecs } from './main-scene-graphics-source.mjs';
import { mainInitializeSpecs } from './main-initialize-source.mjs';
import { taskUnpackWindows } from './task-native-unpack-spec.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { SCENE_GRAPHICS_ROUTINES } from '../proof/system/main-scene-graphics.mjs';
import { loadScene } from '../proof/system/main-scene-load.mjs';
import { finishInterruptObservations } from '../proof/system/main-wait-interrupt.mjs';

const portrait = JSON.parse(readFileSync(new URL('../analysis/render-9f6d.json', import.meta.url)))
  .windows.filter((w) => ['unpack9F6D', 'bit9E65'].includes(w.name))
  .map((w) => ({ start: parseInt(w.entry.replace(':', ''), 16), hex: w.machine_bytes }));
const unpack = decodeWindows([
  ...taskUnpackWindows.slice(0, 3),
  ...portrait,
  ...sceneGraphicsSpecs.find((s) => s.entry === 0x809e7e).windows,
]);
const graph = decodeWindows(
  [
    ...sceneLoadSpecs,
    ...sceneGraphicsSpecs,
    ...mainInitializeSpecs.filter((s) => [0x818cb9, 0x818000].includes(s.entry)),
  ].flatMap((s) => s.windows),
);
for (const [pc, i] of unpack) graph.set(pc, i);
const sites = new Set([
  ...unpack.keys(),
  0x809f69,
  0x809f6c,
  0x818fcb,
  0x819025,
  0x819028,
  0x819039,
  0x819247,
  0x819381,
  0x819438,
  0x818e96,
  0x818ea2,
  0x8191d4,
  0x818e5e,
  0x8191ec,
  0x8191d6,
  0x818ebe,
  0x81a1fc,
  0x819d10,
  0x819cfa,
  0x819b17,
  0x819f4f,
  0x81a21d,
]);
const snapshot = (v) => ({
  ctx: { ...v.a.ctx },
  scratch: Buffer.from(v.mem.wram.subarray(0, 0x100)),
  stack: Buffer.from(v.mem.wram.subarray(0x1ea0, 0x1ef1)),
});
function side(entry, wram = null) {
  const mem = new DialogTestMemory(wram ?? new Uint8Array(0x20000), null, rom);
  const a = new TaskAccessor({
    mem,
    a: 3,
    x: 0,
    y: 0,
    s: 0x1ef0,
    d: 0,
    dbr: 0x80,
    p: 4,
    pc: entry & 65535,
  });
  a.load();
  a.ctx.programBank = entry >>> 16;
  a.trace = [];
  a.devices = { write() {} };
  const h = dialogAccess(a);
  h.pushByte(0x80);
  h.push(0x1234, 2);
  return { mem, a, h };
}

test('first scene continuations match original registers, scratch and live stack at every selected instruction', () => {
  const reached = new Set();
  // Original ROM data; synthetic initial WRAM is only a differential fixture.
  // The independent Mesen test establishes the actual cold boot chronology.
  for (const entry of [0x81a117, 0x819ae6]) {
    const base = side(0x81a117);
    if (entry === 0x819ae6) loadScene(base.h, null, SCENE_GRAPHICS_ROUTINES);
    const r = side(entry, base.mem.wram.slice()),
      n = side(entry, base.mem.wram.slice()),
      records = [],
      states = [];
    const before = new Map(
      [...sites]
        .filter((pc) => graph.has(pc))
        .map((pc) => [
          pc,
          () => {
            r.a.ctx.pc = pc & 65535;
            r.a.ctx.programBank = pc >>> 16;
            records.push(Object.freeze({ pc, nmi: false }));
            states.push(snapshot(r));
            reached.add(pc);
          },
        ]),
    );
    runReference(graph, r.mem, r.a.ctx, {
      entry,
      root: 'RTL',
      before,
      repeatBlockMoves: true,
      limit: 4_000_000,
    });
    let index = 0;
    const events = {
      startupInterrupts: true,
      interrupts: Object.freeze(records),
      get interruptIndex() {
        return index;
      },
      set interruptIndex(next) {
        assert.deepEqual(
          snapshot(n),
          states[next - 1],
          `before ${records[next - 1].pc.toString(16)}`,
        );
        index = next;
      },
    };
    SCENE_GRAPHICS_ROUTINES.get(entry)(n.h, events, SCENE_GRAPHICS_ROUTINES);
    finishInterruptObservations(events);
    assert.deepEqual(n.a.ctx, r.a.ctx);
    assert.deepEqual(n.mem.wram, r.mem.wram);
  }
  for (const pc of [
    0x818fcb, 0x819025, 0x819028, 0x819039, 0x819247, 0x819381, 0x819438, 0x818e96, 0x818ea2,
    0x8191d4, 0x818e5e, 0x8191ec, 0x8191d6, 0x818ebe, 0x81a1fc, 0x819d10, 0x819cfa, 0x819b17,
    0x819f4f, 0x81a21d,
  ])
    assert.ok(reached.has(pc), pc.toString(16));
});
