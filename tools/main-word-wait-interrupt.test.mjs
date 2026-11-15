import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wordInterruptWindows,
  wordInterruptRoots,
  proveWordInterrupts,
} from './main-word-wait-interrupt-source.mjs';
import { gameNmiSpecs } from './main-game-nmi-source.mjs';
import { matrixNmiSpecs } from './main-matrix-nmi-source.mjs';
import { taskNativeRenderSpec } from './task-native-render-spec.mjs';
import { proveTaskNativeRender } from './task-native-render-source.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { GAME_NMI_ROUTINES } from '../proof/replay/main-game-nmi.mjs';
import {
  finishInterruptObservations,
  runInterruptWordWait,
  runInterruptRequestWait,
  WordWaitContinuation,
  RequestWaitContinuation,
} from '../src/task/main-wait-interrupt.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/task/native-wait-continuation.mjs';
import { waitForTextMapUpload, requestTextMapUpload } from '../src/task/native-render-compose.mjs';
import { runTaskTextWait } from '../src/task/native-text-prerequisites.mjs';
import { TALK_ROUTINES } from '../proof/replay/native-dialog.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/task/native-call-continuation.mjs';
import { textDma, referenceTextDma } from './main-dma-readback-fixtures.mjs';

const map = decodeWindows(wordInterruptWindows),
  nmi = decodeWindows([...matrixNmiSpecs[2].windows, ...gameNmiSpecs.flatMap((s) => s.windows)]);
const f963 = decodeWindows(taskNativeRenderSpec.windows),
  requests = new Set([0x81acb5, 0x81aef4, 0x81aefc]);
const freeze = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
const expand = (t) =>
  t.flatMap((o) =>
    o.width === 2
      ? [
          { ...o, width: 1, value: o.value & 255 },
          { ...o, width: 1, address: o.address + 1, value: o.value >>> 8 },
        ]
      : [{ ...o, width: 1 }],
  );
function side({ counter = 1, dbr = 0x80, p = 0x41, chunk = 0x1401 } = {}) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom);
  for (const [at, v] of [
    [0x6e, 0xc152],
    [0x1f6, counter],
    [0x1f8, counter],
    [0x1fa, counter],
    [0x1fc, counter],
    [0x20c, chunk],
    [0x140, 0xffff],
    [0xcd8, 1],
  ])
    mem.write16(at, v);
  mem.write8(0x70, 0x80);
  for (let at = 0x2ae0; at < 0x2af0; at++) mem.write8(0x7e0000 + at, at & 255);
  const a = new TaskAccessor({
    mem,
    a: 0xa55a,
    x: 0x1234,
    y: 0xabcd,
    s: 0x1ef0,
    d: 0,
    dbr,
    p,
    pc: 0,
  });
  a.load();
  a.trace = [];
  a.io = [];
  a.devices = { write() {} };
  return { mem, a, h: dialogAccess(a), dma: [] };
}
function addNmiIo(v, readback = v.mem.read16(0x1fc) !== 0) {
  const db = v.a.ctx.bank;
  if (readback) v.dma.push(textDma(v.mem.read16(0x20e), v.dma.length));
  v.a.io.push(
    ...(db === 0x7e
      ? []
      : [{ pc: 0x00c118, address: (db << 16) | 0x4210, width: 2, value: 0xab80 }]),
    ...(readback ? [{ pc: 0x81aa8e, address: 0x213a, width: 1, value: 0 }] : []),
    { pc: 0x809e0b, address: 0x4212, width: 2, value: 0 },
    { pc: 0x809e13, address: 0x4218, width: 2, value: 0x8000 },
  );
}
function originalNmi(v) {
  const { h, a } = v,
    before = { ...a.ctx };
  addNmiIo(v);
  h.pushByte(a.ctx.programBank);
  h.push(a.ctx.pc, 2);
  h.pushByte(a.ctx.status);
  a.ctx.status = (a.ctx.status | 4) & ~8;
  a.ctx.programBank = 0;
  runReference(nmi, v.mem, a.ctx, { entry: 0x00c112, root: 'RTI', io: a.trace });
  assert.deepEqual(a.ctx, before);
}
function referenceIo(v) {
  let byte = 0;
  const read = v.mem.read8.bind(v.mem);
  referenceTextDma(v, v.dma);
  v.mem.read8 = (address) => {
    const o = v.a.io[v.a.ioIndex];
    if (o && address === o.address + byte) {
      const value = (o.value >>> (8 * byte++)) & 255;
      if (byte === o.width) {
        v.a.ioIndex++;
        byte = 0;
      }
      return value;
    }
    return read(address);
  };
}
function compare(entry, options = {}, phase = null, full = false, resumable = false) {
  const r = side(options),
    n = side(options),
    records = [],
    states = [],
    hits = new Map(),
    source = full ? f963 : map;
  referenceIo(r);
  if (full) {
    for (const v of [r, n]) {
      for (const [at, value] of [
        [0, 1],
        [2, 1],
        [4, 4],
        [6, 3],
        [8, 0x800],
        [0x204, 0],
        [0x212, 0x2027],
      ])
        v.mem.write16(at, value);
      for (const at of [0x1f6, 0x1f8, 0x1fa, 0x1fc]) v.mem.write16(at, 0);
      v.a.io.push({ pc: 0x80fa01, address: (options.dbr << 16) | 0x2134, width: 2, value: 2 });
    }
  }
  for (const v of [r, n]) {
    if (!full) v.h.pushByte(0x80);
    v.h.push(0x1234, 2);
    v.a.ctx.programBank = entry >>> 16;
    v.a.ctx.pc = entry & 65535;
  }
  const hooks = new Map(
    [...map.keys()].map((pc) => [
      pc,
      () => {
        const hit = (hits.get(pc) ?? 0) + 1;
        hits.set(pc, hit);
        const nmi =
          (pc === phase && hit === 1) ||
          ([0x81acaf, 0x81acbd, 0x81acc3, 0x81acc9].includes(pc) && hit >= 3);
        records.push({ pc, nmi });
        r.a.ctx.programBank = pc >>> 16;
        r.a.ctx.pc = pc & 65535;
        if (nmi) originalNmi(r);
        if (resumable && nmi)
          states.push({ ctx: { ...r.a.ctx }, wram: r.mem.wram.slice(), io: r.a.ioIndex });
      },
    ]),
  );
  runReference(source, r.mem, r.a.ctx, {
    entry,
    root: full ? 'RTS' : 'RTL',
    io: r.a.trace,
    before: hooks,
  });
  n.a.io = r.a.io;
  const e = {
    mode: 'record-observations',
    values: freeze([]),
    waitIndex: 0,
    waitEvents: [],
    calls: [],
    interrupts: freeze(records),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
    dmaTransfers: Object.freeze(r.dma),
  };
  if (resumable) {
    const factory = NATIVE_CALL_CONTINUATIONS.get(entry);
    if (full) assert.equal(factory.run, TALK_ROUTINES.get(0x80f963));
    const c = full
      ? factory.create({ h: n.h, events: e })
      : new (requests.has(entry) ? RequestWaitContinuation : WordWaitContinuation)(n.h, e, entry);
    const ctx = { ...n.a.ctx },
      wram = n.mem.wram.slice();
    assert.equal(c.run(0), WAIT_PAUSED);
    assert.deepEqual(n.a.ctx, ctx);
    assert.deepEqual(n.mem.wram, wram);
    let pauses = 0,
      matched = 0;
    while (c.run(1) === WAIT_PAUSED) {
      assert.ok(++pauses < 1000);
      const state = states[matched];
      if (
        state &&
        n.a.ctx.pc === state.ctx.pc &&
        n.a.ctx.programBank === state.ctx.programBank &&
        n.a.ioIndex === state.io
      ) {
        assert.deepEqual(n.a.ctx, state.ctx);
        assert.deepEqual(n.mem.wram, state.wram);
        matched++;
      }
    }
    assert.equal(matched, states.length);
    assert.ok(matched > 0);
    assert.equal(c.run(1), WAIT_RETURNED);
  } else if (full) TALK_ROUTINES.get(0x80f963)(n.h, e);
  else if (entry === 0x81acaf) waitForTextMapUpload(n.a, e, false);
  else if (entry === 0x81acb5) requestTextMapUpload(n.a, e, false);
  else if ([0x81acc3, 0x81aef4, 0x81acc9, 0x81aefc].includes(entry))
    runTaskTextWait(
      n.a,
      new Map([
        [0x81acc3, 'ACC3'],
        [0x81aef4, 'AEF4'],
        [0x81acc9, 'ACC9'],
        [0x81aefc, 'AEFC'],
      ]).get(entry),
      { interruptEvents: e },
      false,
    );
  else (requests.has(entry) ? runInterruptRequestWait : runInterruptWordWait)(n.h, e, entry);
  finishInterruptObservations(e);
  assert.deepEqual(n.a.ctx, r.a.ctx);
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
  assert.equal(n.a.ioIndex, r.a.io.length);
  assert.equal(r.a.ioIndex, r.a.io.length);
  assert.equal(e.waitIndex, 0);
  assert.deepEqual(e.waitEvents, []);
  assert.equal(e.dmaIndex ?? 0, r.dma.length);
  return { n, e };
}

test('seven WORD waits/requests pin all 48 bytes, 21 instructions and closed original call stacks', () => {
  assert.equal(proveWordInterrupts(map).length, 7);
  assert.equal(map.size, 21);
  proveTaskNativeRender(f963);
});
for (const resumable of [false, true])
  test(`each original WORD wait/request ${resumable ? 'across finite budgets' : 'synchronously'} matches full NMI/RTI across PC phases, DBR, flags, chunks and INC wrap`, () => {
    for (const entry of wordInterruptRoots)
      for (const counter of [0, 1, 0xffff])
        for (const dbr of [0, 0x80, 0x81, 0x7e])
          for (const phase of [entry, entry + 3, entry + (requests.has(entry) ? 7 : 5)]) {
            compare(
              entry,
              { counter, dbr, p: counter ? 0xc7 : 0x40, chunk: counter ? 0x1401 : 0x2800 },
              phase,
              false,
              resumable,
            );
          }
  });
for (const resumable of [false, true])
  test(`complete F963 allocation ${resumable ? 'across finite budgets keeps' : 'consumes'} both original wait frames and request wrapper on shared NMI memory`, () => {
    for (const dbr of [0, 0x80, 0x81])
      for (const phase of [null, 0x81acbd, 0x81acb8, 0x81acb2]) {
        const { n } = compare(0x80f963, { dbr, p: 0x45 }, phase, true, resumable);
        assert.equal(n.mem.read16(0x1f6), 0);
        assert.equal(n.mem.read16(0x1f8), 0);
        assert.equal(n.mem.read16(0x204), 2);
      }
  });
test('original transfer and text requests share one interrupt stream without external wait writers', () => {
  const v = side({ counter: 0 }),
    records = [];
  addNmiIo(v);
  addNmiIo(v);
  for (const [pc, nmi] of [
    [0x81acb5, false],
    [0x81acb8, false],
    [0x81acaf, false],
    [0x81acb2, false],
    [0x81acaf, true],
    [0x81acb2, false],
    [0x81acb4, false],
    [0x81acbc, false],
    [0x81aef4, false],
    [0x81aef7, false],
    [0x81acc3, false],
    [0x81acc6, false],
    [0x81acc3, true],
    [0x81acc6, false],
    [0x81acc8, false],
    [0x81aefb, false],
  ])
    records.push({ pc, nmi });
  const e = {
    interrupts: freeze(records),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
    dmaTransfers: Object.freeze(v.dma),
  };
  v.h.call(0x801000, 0x81acb5, () => requestTextMapUpload(v.a, e, false), true);
  assert.equal(v.mem.read16(0x1f8), 0);
  assert.equal(e.interruptIndex, 8);
  v.h.call(
    0x801004,
    0x81aef4,
    () => runTaskTextWait(v.a, 'AEF4', { interruptEvents: e }, false),
    true,
  );
  finishInterruptObservations(e);
  assert.equal(v.mem.read16(0x1fa), 0);
  assert.equal(v.a.ioIndex, v.a.io.length);
  assert.equal(v.mem.read16(0x1c76), 2);
});
test('missing DMA observation stops at the original trigger before clearing the pending text request', () => {
  const v = side({ counter: 0 });
  addNmiIo(v, true);
  v.h.pushByte(0x80);
  v.h.push(0x1234, 2);
  v.a.ctx.programBank = 0x81;
  const e = {
      interrupts: freeze([
        { pc: 0x81aefc, nmi: false },
        { pc: 0x81aeff, nmi: false },
        { pc: 0x81acc9, nmi: true },
      ]),
      interruptIndex: 0,
      interruptRoutines: GAME_NMI_ROUTINES,
    },
    before = v.mem.wram.slice(0x2ae0, 0x2af0);
  assert.throws(
    () => runTaskTextWait(v.a, 'AEFC', { interruptEvents: e }, false),
    (err) => err.reason === 'text_dma_observation_required' && err.pc === 0x81aa93,
  );
  assert.equal(v.mem.read16(0x1fc), 1);
  assert.equal(v.a.ctx.pc, 0xaa93);
  assert.equal(v.a.ctx.status & 32, 32);
  assert.deepEqual(v.mem.wram.slice(0x2ae0, 0x2af0), before);
  assert.equal(e.interruptIndex, 3);
  assert.equal(v.a.trace.at(-1).pc, 0x81aa93);
});
test('unbound WORD root and missing interrupt records never invent request completion', () => {
  const v = side(),
    e = { interrupts: freeze([]), interruptIndex: 0 };
  v.a.ctx.programBank = 0x81;
  assert.throws(
    () => runInterruptWordWait(v.h, e, 0x81acc0),
    (err) => err.reason === 'wait_interrupt_word_entry_required',
  );
  assert.throws(
    () => runInterruptWordWait(v.h, e, 0x81acaf),
    (err) => err.reason === 'wait_interrupt_observation_required',
  );
  assert.equal(v.mem.read16(0x1f8), 1);
});
