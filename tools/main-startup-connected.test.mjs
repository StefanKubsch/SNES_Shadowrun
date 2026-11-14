import test from 'node:test';
import assert from 'node:assert/strict';
import { startupSpecs } from './main-startup-source.mjs';
import { resetWindows, coldResetWindows, softwareResetWindows } from './main-reset-source.mjs';
import { frontendSpecs } from './main-frontend-source.mjs';
import { sceneAnimationSpecs } from './main-scene-animation-source.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import {
  MAIN_STARTUP_ROUTINES as MAIN_STARTUP_TASK,
  runMainStartup,
  MainStartupContinuation,
} from '../src/task/main-startup.mjs';
// The ROM comparison observes the register-level APU reads of 81:F007 at their data
// bank address (80:2140) and its stack byte, so the startup table uses the audio references.
import { withAudioReference } from '../proof/apu-reference/audio-routines.mjs';
const MAIN_STARTUP_ROUTINES = withAudioReference(MAIN_STARTUP_TASK);
import { NATIVE_CALL_CONTINUATIONS } from '../src/task/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/task/native-wait-continuation.mjs';
import { runMainReset, runMainSoftwareReset } from '../src/task/main-reset.mjs';
import { runObservedNmi } from '../src/task/observed-nmi.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';
import { isIoAddress, isArithmeticRegister } from '../src/vm/devices.mjs';

const waitWindows = sceneAnimationSpecs
    .filter((s) => ['eebb', 'eed5', 'eedd', 'eef1'].includes(s.name))
    .flatMap((s) => s.windows),
  map = decodeWindows([
    ...resetWindows,
    ...coldResetWindows,
    ...softwareResetWindows,
    ...startupSpecs.flatMap((s) => s.windows),
    ...waitWindows,
    ...frontendSpecs
      .filter((s) => [0x81d5d0, 0x81d5e4, 0x81d5ec, 0x81d5f4, 0x81ef36].includes(s.entry))
      .flatMap((s) => s.windows),
  ]),
  waitPcs = new Set(
    decodeWindows(sceneAnimationSpecs.find((s) => s.name === 'eebb').windows).keys(),
  );
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
const resetEntry = (entry) => [0xe382, 0x80e382].includes(entry);
const noReturn = (entry) => [0x80a133, 0xe382, 0x80e382, 0x809e3d].includes(entry);
function side(entry, valid) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), new Uint8Array(SRAM_SIZE), rom),
    a = new TaskAccessor({
      mem,
      a: 0x5432,
      x: resetEntry(entry) ? 0x34 : 0x1234,
      y: resetEntry(entry) ? 0xcd : 0xabcd,
      s: resetEntry(entry) ? 0x1ff : 0x1ef0,
      d: 0,
      dbr: entry === 0xe382 ? 0 : 0x80,
      p: resetEntry(entry) ? 0x7b : 0x43,
      pc: entry & 65535,
    });
  a.load();
  a.ctx.e = Number(resetEntry(entry));
  a.ctx.programBank = entry >>> 16;
  a.trace = [];
  a.io = [];
  a.devices = { write() {} };
  const h = dialogAccess(a);
  if (!noReturn(entry)) {
    if (entry !== 0x80a15c) h.pushByte(0x80);
    h.push(0x1234, 2);
  }
  mem.sram.set(valid ? [0x80, 1, 1, 0] : [0xa5, 0xb0, 7, 0], 0x1ffc);
  if (valid) {
    const before = { ...a.ctx };
    a.ctx.e = 0;
    a.ctx.status &= ~8;
    h.rep(0x30);
    h.sep(0x20);
    h.call(
      0x81d609,
      0x81d5e4,
      () => MAIN_STARTUP_ROUTINES.get(0x81d5e4)(h, null, MAIN_STARTUP_ROUTINES),
      true,
    );
    Object.assign(a.ctx, before);
  }
  return { mem, a, h };
}
for (const resumable of [false, true])
  test(`whole startup ${resumable ? 'across finite budgets' : 'synchronously'} executes real logo/notice programs, SPC upload and observed empty NMIs before A139`, () => {
    for (const [entry, valid] of [
      [0x81e7bc, false],
      [0x81e7bc, true],
      [0x80a15c, false],
      [0x80a133, true],
      [0xe382, false],
      [0x80e382, true],
      [0x809e3d, false],
    ]) {
      const r = side(entry, valid),
        n = side(entry, valid),
        io = [],
        records = [],
        states = [],
        callbacks = [],
        installed = [],
        routines = new Map(MAIN_STARTUP_ROUTINES),
        ec16 = routines.get(0x81ec16);
      routines.set(0x81ec16, (h, e, rs) => {
        const program = h.ctx.x,
          result = ec16(h, e, rs);
        installed.push([program, h.pointer(0x6e)]);
        return result;
      });
      const valueFor = (pc, address) => {
        const port = address & 65535;
        if (port === 0x4210) return 0x80;
        if (port === 0x4212) return 0;
        if (port === 0x2140) {
          if (pc === 0x81efaa) return 0xaa;
          if (pc === 0x81f001) return r.a.ctx.a & 255;
          return r.mem.read8(0x1ce4);
        }
        if (port === 0x2141) return pc === 0x81efed ? 0xca : 0xbb;
        assert.fail('unexpected startup device ' + pc.toString(16) + ' ' + address.toString(16));
      };
      const absoluteRead = r.a.absoluteRead;
      r.a.absoluteRead = (offset, width, pc) => {
        const address = r.h.abs(offset);
        if (!isIoAddress(address) || isArithmeticRegister(address, false))
          return absoluteRead(offset, width, pc);
        const value = valueFor(pc, address);
        io.push({ pc, address, width, value });
        r.a.trace.push({ kind: 'read', pc, address, width, value });
        return value;
      };
      const read = r.mem.read8.bind(r.mem);
      let pending = null;
      r.mem.read8 = (address) => {
        if (!isIoAddress(address) || isArithmeticRegister(address, false)) return read(address);
        if (pending) {
          assert.equal(address, pending.address + 1);
          const value = pending.value >>> 8;
          pending = null;
          return value;
        }
        const pc = (r.a.ctx.programBank << 16) | r.a.ctx.pc,
          width = r.a.ctx.status & 0x20 ? 1 : 2,
          value = valueFor(pc, address),
          o = { pc, address, width, value };
        io.push(o);
        if (width === 2) pending = o;
        return value & 255;
      };
      const re = {
          values: freeze([]),
          waitIndex: 0,
          waitEvents: [],
          calls: [],
          inputs: freeze([]),
          inputIndex: 0,
        },
        stop = Symbol('first menu instruction');
      const before = new Map(
        [...map.keys()].map((pc) => [
          pc,
          () => {
            r.a.ctx.programBank = pc >>> 16;
            r.a.ctx.pc = pc & 65535;
            if (pc === 0x80a139 && noReturn(entry)) throw stop;
            if (!waitPcs.has(pc)) return;
            const nmi = pc === 0x81eecd;
            records.push({ pc, nmi });
            if (!nmi) return;
            assert.ok(r.mem.read8(0x30) & 0x80);
            callbacks.push(r.h.pointer(0x6e));
            const saved = { ...r.a.ctx };
            runObservedNmi(r.a, re, routines);
            assert.deepEqual(r.a.ctx, saved);
            if (resumable)
              states.push({ ctx: { ...r.a.ctx }, wram: r.mem.wram.slice(), io: io.length });
          },
        ]),
      );
      const calls = new Map(
        [...routines]
          .filter(([target]) => !map.has(target))
          .map(([target, run]) => [
            target,
            () => {
              const result = run(r.h, re, routines);
              return { rawReturnWord: result?.rawReturnWord ?? result };
            },
          ]),
      );
      const original = () =>
        runReference(map, r.mem, r.a.ctx, {
          entry,
          root: entry === 0x80a15c ? 'RTS' : 'RTL',
          calls,
          before,
          io: r.a.trace,
          limit: 5_000_000,
        });
      if (noReturn(entry)) assert.throws(original, (e) => e === stop);
      else original();
      n.a.io = io;
      const e = {
        ...re,
        calls: [],
        waitEvents: [],
        interrupts: freeze(records),
        interruptIndex: 0,
        interruptRoutines: MAIN_STARTUP_ROUTINES,
      };
      if (resetEntry(entry)) runMainReset(n.a);
      else if (entry === 0x809e3d) runMainSoftwareReset(n.a, e, MAIN_STARTUP_ROUTINES);
      if (resumable) {
        const c = noReturn(entry)
          ? new MainStartupContinuation(n.a, e, MAIN_STARTUP_ROUTINES)
          : NATIVE_CALL_CONTINUATIONS.get(entry).create({
              h: n.h,
              events: e,
              routines: MAIN_STARTUP_ROUTINES,
            });
        const before = n.mem.wram.slice(),
          ctx = { ...n.a.ctx };
        assert.equal(c.run(0), WAIT_PAUSED);
        assert.deepEqual(n.mem.wram, before);
        assert.deepEqual(n.a.ctx, ctx);
        let pauses = 0,
          matched = 0;
        while (c.run(1) === WAIT_PAUSED) {
          assert.ok(++pauses < records.length * 32 + 1000);
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
        assert.ok(matched > 350);
        assert.ok(pauses > 1000);
      } else if (noReturn(entry)) runMainStartup(n.a, e, MAIN_STARTUP_ROUTINES);
      else MAIN_STARTUP_ROUTINES.get(entry)(n.h, e, MAIN_STARTUP_ROUTINES);
      finishInterruptObservations(e);
      assert.equal(n.a.ioIndex, io.length);
      assert.deepEqual(n.a.ctx, r.a.ctx);
      assert.deepEqual(n.mem.wram, r.mem.wram);
      assert.deepEqual(n.mem.sram, r.mem.sram);
      assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
      assert.deepEqual(installed, [
        [0x8000, 0x81e839],
        [0xec26, 0x81e839],
      ]);
      assert.deepEqual([...new Set(callbacks)], [0x81e839]);
      assert.equal(n.a.ctx.s, resetEntry(entry) || entry === 0x809e3d ? 0x13f : 0x1ef0);
      assert.deepEqual([...n.mem.sram.slice(0x1ffc, 0x1fff)], valid ? [0x80, 1, 1] : [0x80, 0, 3]);
      assert.equal(n.a.trace.filter((o) => o.pc === 0x81effa).length, 0xc55);
      assert.equal(n.mem.read8(0x1ce4), 3);
      if (noReturn(entry)) {
        assert.equal(n.a.ctx.pc, 0xa139);
        assert.equal(n.a.ctx.a, 1);
        assert.equal(n.a.ctx.bank, 0x80);
        assert.equal(n.a.ctx.e, 0);
      }
    }
  });
