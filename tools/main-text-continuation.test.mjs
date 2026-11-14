import test from 'node:test';
import assert from 'node:assert/strict';
import { taskFEC1Fixture } from './task-native-fec1-fixtures.mjs';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { textDma } from './main-dma-readback-fixtures.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/task/native-call-continuation.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/task/native-wait-continuation.mjs';
import { GAME_NMI_ROUTINES } from '../src/task/main-game-nmi.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';
import { MAIN_LOOP_ROUTINES } from '../src/vm/main-loop.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../src/task/main-loop-upkeep.mjs';
import { GLOVE_ROUTINES } from '../src/task/native-glove-target-support.mjs';
import { TALK_ROUTINES } from '../src/task/native-dialog.mjs';

// The synchronous adapters were compared with the original instructions in
// their own tests (F963, FB39/FE69, FA3E/AD92, WORD waits, game NMI). Here the
// same fixed equations run once drained and once over single work units with
// identical interrupt, device and DMA records. Those records are synthetic;
// the busy poll alternates so every taken NMI pauses inside 80:9E0B.
const freeze = (rows) => Object.freeze(rows.map((o) => Object.freeze({ ...o })));
const word = (mem, at, value) => mem.write16(at, value);
function side(fixture, entry, setup) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom.slice());
  for (const [address, value] of fixture.data.snapshot().bytes)
    if (address >= 0x7e0000 && address <= 0x7fffff) mem.write8(address, value);
  for (const [at, value] of [
    [0x6e, 0xc152],
    [0x140, 0xffff],
    [0xcd8, 1],
  ])
    word(mem, at, value);
  mem.write8(0x70, 0x80);
  const { a, x, y, bank, status } = fixture.context;
  const acc = new TaskAccessor({
    mem,
    a,
    x,
    y,
    s: 0x1ef0,
    d: 0,
    dbr: bank,
    p: status & ~0x30,
    pc: entry & 65535,
  });
  acc.load();
  acc.ctx.programBank = entry >>> 16;
  acc.trace = [];
  acc.devices = { write() {} };
  const h = dialogAccess(acc);
  h.push(0x1234, 2);
  setup?.(mem);
  return { a: acc, h, mem };
}
const events = (records, dma) => ({
  mode: 'record-observations',
  values: null,
  waitIndex: 0,
  waitEvents: [],
  calls: [],
  interrupts: freeze(records),
  interruptIndex: 0,
  interruptRoutines: GAME_NMI_ROUTINES,
  dmaTransfers: Object.freeze([...dma]),
});
function deviceValue(io, address, width) {
  const offset = address & 65535;
  if (offset === 0x4212)
    return io.findLast((o) => (o.address & 65535) === 0x4212)?.value === 1 ? 0 : 1;
  return (
    new Map([
      [0x4210, 0x80],
      [0x4218, 0x8000],
      [0x213a, 0],
      [0x2134, 1],
    ]).get(offset) ?? (width === 1 ? 0 : 0)
  );
}
// Rebuild from scratch until every reached boundary owns an explicit record.
function observe(fixture, entry, run, setup, phase) {
  const records = [],
    io = [],
    dma = [];
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 4000, 'observation construction');
    const v = side(fixture, entry, setup);
    v.a.io = io;
    const e = events(records, dma);
    try {
      run(v.h, e);
      finishInterruptObservations(e);
      return { records, io, dma, v, e };
    } catch (error) {
      if (error?.reason === 'wait_interrupt_observation_required') {
        const hits = records.filter((o) => o.pc === error.pc).length;
        records.push({ pc: error.pc, nmi: hits >= 2 || (error.pc === phase && hits === 0) });
      } else if (error?.reason === 'device_observation_required') {
        io.push(
          Object.freeze({
            pc: error.details.pc,
            address: error.address,
            width: error.details.width,
            value: deviceValue(io, error.address, error.details.width),
          }),
        );
      } else if (error?.reason === 'text_dma_observation_required')
        dma.push(textDma(v.mem.read16(0x20e), dma.length));
      else throw error;
    }
  }
}
function compare(fixture, entry, run, setup = null, phase = null) {
  const o = observe(fixture, entry, run, setup, phase),
    n = side(fixture, entry, setup);
  n.a.io = o.io;
  const e = events(o.records, o.dma),
    factory = NATIVE_CALL_CONTINUATIONS.get(entry);
  assert.equal(factory.run, run);
  const c = factory.create({ h: n.h, events: e }),
    ctx = { ...n.a.ctx },
    wram = n.mem.wram.slice();
  assert.equal(c.run(0), WAIT_PAUSED);
  assert.deepEqual(n.a.ctx, ctx);
  assert.deepEqual(n.mem.wram, wram);
  let pauses = 0,
    busy = 0;
  while (c.run(1) === WAIT_PAUSED) {
    assert.ok(++pauses < 200000);
    if (n.a.ctx.programBank === 0x80 && n.a.ctx.pc >= 0x9e0b && n.a.ctx.pc < 0x9e18) busy++;
  }
  assert.equal(c.run(1), WAIT_RETURNED);
  finishInterruptObservations(e);
  assert.deepEqual(n.a.ctx, o.v.a.ctx);
  assert.deepEqual(n.mem.wram, o.v.mem.wram);
  assert.deepEqual(n.a.trace, o.v.a.trace);
  assert.equal(n.a.ioIndex, o.io.length);
  assert.equal(e.dmaIndex ?? 0, o.dma.length);
  assert.equal(n.a.ctx.pc, 0x1235);
  assert.equal(n.a.ctx.s, 0x1ef0);
  const nmis = o.records.filter((r) => r.nmi).length;
  assert.ok(nmis > 0);
  assert.ok(busy >= nmis, `${busy} busy pauses for ${nmis} NMIs`);
  return { o, c, pauses, busy };
}
const fixtures = [
  {},
  { cursor: 0 },
  { cursor: 0, occupied: [4, 4, 4, 4] },
  { cursor: 0, occupied: [4, 0x8000, 4, 4], bank: 0x7e },
  { cursor: 0, bank: 0x81, status: 0xc7 },
];

test('shared adapters own the text and notice continuations', () => {
  for (const [target, table] of [
    [0x80fec1, MAIN_UPKEEP_ROUTINES],
    [0x80fe69, MAIN_UPKEEP_ROUTINES],
    [0x80fec1, GLOVE_ROUTINES],
    [0x80fe69, GLOVE_ROUTINES],
    [0x80f963, TALK_ROUTINES],
    [0x80f963, GLOVE_ROUTINES],
  ])
    assert.equal(NATIVE_CALL_CONTINUATIONS.get(target).run, table.get(target));
  for (const target of [0x80ff14, 0x80e270, 0x80bf3b])
    assert.equal(NATIVE_CALL_CONTINUATIONS.get(target).run, MAIN_LOOP_ROUTINES.get(target));
});
test('FEC1 with F963, FE69/FB39 and FA3E keeps every frame and nested NMI/RTI across single work units', () => {
  for (const options of fixtures)
    for (const phase of [null, 0x81acbd, 0x81aefc, 0x81acc9]) {
      const f = taskFEC1Fixture(options),
        { o } = compare(f, 0x80fec1, MAIN_UPKEEP_ROUTINES.get(0x80fec1), null, phase);
      if (options.cursor === 0) assert.ok(o.dma.length > 0);
    }
});
test('FE69 text composition alone pauses at its request waits and returns once', () => {
  for (const options of fixtures.slice(1)) {
    const f = taskFEC1Fixture(options);
    compare(f, 0x80fe69, MAIN_UPKEEP_ROUTINES.get(0x80fe69), (mem) => {
      word(mem, 0, 2);
      word(mem, 2, mem.read16(0xd9b8));
    });
  }
});
test('main-loop E270 and FF14 forward the notice and release pauses to their own frames', () => {
  for (const options of fixtures.slice(1)) {
    const f = taskFEC1Fixture(options);
    compare(f, 0x80e270, MAIN_LOOP_ROUTINES.get(0x80e270), (mem) => {
      word(mem, 0x1d89, 3);
      word(mem, 0x1d87, 0);
    });
    compare(f, 0x80ff14, MAIN_LOOP_ROUTINES.get(0x80ff14), (mem) => {
      for (let slot = 0; slot < 8; slot += 2) {
        word(mem, 0x216 + slot, slot);
        word(mem, 0x21e + slot, 1);
      }
      word(mem, 0x202, 0);
      word(mem, 0x204, 6);
    });
  }
});
test('a notice continuation rejects foreign registers and never replays after a failure', () => {
  const f = taskFEC1Fixture({ cursor: 0 }),
    v = side(f, 0x80fec1),
    e = events([], []);
  v.a.io = [];
  const c = NATIVE_CALL_CONTINUATIONS.get(0x80fec1).create({ h: v.h, events: e });
  assert.equal(c.run(1), WAIT_PAUSED);
  v.a.ctx.x ^= 1;
  assert.throws(
    () => c.run(1),
    (err) => err.reason === 'native_call_owner_required',
  );
  v.a.ctx.x ^= 1;
  assert.throws(
    () => {
      while (c.run(1) === WAIT_PAUSED);
    },
    (err) =>
      ['wait_interrupt_observation_required', 'device_observation_required'].includes(err.reason),
  );
  assert.throws(
    () => c.run(1),
    (err) => err.reason === 'native_call_failed',
  );
});
