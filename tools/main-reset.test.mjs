import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resetWindows,
  coldResetWindows,
  softwareResetWindows,
  resetVector,
  decodeResetSource,
  proveResetSource,
} from './main-reset-source.mjs';
import { startupSpecs } from './main-startup-source.mjs';
import {
  DialogTestMemory,
  rom,
  prng,
  window,
  decodeWindows,
} from './task-native-dialog-harness.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { runMainReset, runMainSoftwareReset } from '../src/task/main-reset.mjs';
import { MAIN_STARTUP_ROUTINES as MAIN_STARTUP_TASK } from '../src/task/main-startup.mjs';
// The ROM comparison observes the register-level APU reads of 81:F007 at their data
// bank address (80:2140) and its stack byte, so the startup table uses the audio references.
import { withAudioReference } from '../proof/apu-reference/audio-routines.mjs';
const MAIN_STARTUP_ROUTINES = withAudioReference(MAIN_STARTUP_TASK);
import { SRAM_SIZE } from '../src/vm/memory.mjs';

const cases = [
  [0x00e382, coldResetWindows],
  [0x80e382, resetWindows],
  [0x809e3d, [...softwareResetWindows, ...resetWindows]],
];
const expand = (trace) =>
  trace.flatMap((o) =>
    o.width === 2
      ? [
          { ...o, width: 1, value: o.value & 255 },
          { ...o, width: 1, address: o.address + 1, value: o.value >>> 8 },
        ]
      : [{ ...o, width: 1 }],
  );
test('reset pins physical bank00/80 aliases, reset vector and exact E1/E0/D/S nonreturning contracts', () => {
  assert.equal(window(resetVector.start, resetVector.start + 2).hex, '82E3');
  assert.equal(resetVector.hex, '82E3');
  for (const [entry, windows] of cases) {
    const map = decodeResetSource(rom, windows),
      p = proveResetSource(map, entry);
    assert.equal(p.instructions, entry === 0x809e3d ? 75 : 62);
    assert.equal(p.terminals[0].target, 0x80a133);
    const changed = new Map(map),
      pc = entry === 0x809e3d ? 0x80e39e : (entry & 0xff0000) | 0xe39e,
      i = map.get(pc);
    changed.set(pc, { ...i, state: { ...i.state, e: 0 } });
    assert.throws(() => proveResetSource(changed, entry), /Reset source mode drift/);
  }
});
function side(entry, seed) {
  const random = prng(seed),
    wram = Uint8Array.from({ length: 0x20000 }, () => Math.floor(random() * 256)),
    sram = Uint8Array.from({ length: SRAM_SIZE }, () => Math.floor(random() * 256)),
    warm = entry === 0x809e3d;
  const a = new TaskAccessor({
    mem: new DialogTestMemory(wram, sram, rom),
    a: 0xabcd,
    x: warm ? 0x1234 : seed & 255,
    y: warm ? 0xabcd : (seed * 71) & 255,
    s: warm ? [0x1ef0, 0x100, 0x1fe, 0x400][seed % 4] : seed % 2 ? 0x100 : 0x1ff,
    d: 0,
    dbr: warm ? 0x80 : seed % 2 ? 0 : 0x80,
    p: (seed & (warm ? 0xc7 : 0xcf)) | (warm ? 0 : 0x30),
    pc: entry & 65535,
  });
  a.load();
  a.ctx.e = warm ? 0 : 1;
  a.ctx.programBank = entry >>> 16;
  a.trace = [];
  a.devices = { write() {} };
  a.io = warm ? [{ pc: 0x81f00e, address: 0x802140, width: 1, value: a.mem.read8(0x1ce4) }] : [];
  return { a, mem: a.mem };
}
for (const [entry, windows] of cases)
  test(
    entry.toString(16) +
      ': reset matches original PPU requests, mode exchanges and fresh stack writes without inventing memory',
    () => {
      const own = decodeResetSource(rom, windows),
        map = new Map([...own, ...decodeWindows(startupSpecs[0].windows)]),
        stop = Symbol('A133');
      for (let seed = 0; seed < 16; seed++) {
        const n = side(entry, seed),
          r = side(entry, seed),
          before = new Map([
            [
              0x80a133,
              () => {
                r.a.ctx.pc = 0xa133;
                throw stop;
              },
            ],
          ]),
          oldSram = n.mem.sram.slice();
        const calls = new Map([
          [
            0x81f007,
            () => {
              const v = MAIN_STARTUP_ROUTINES.get(0x81f007)(dialogAccess(r.a));
              return { rawReturnWord: v.rawReturnWord };
            },
          ],
        ]);
        assert.throws(
          () => runReference(map, r.mem, r.a.ctx, { entry, before, calls, io: r.a.trace }),
          (e) => e === stop,
        );
        if (entry === 0x809e3d) runMainSoftwareReset(n.a, null, MAIN_STARTUP_ROUTINES);
        else runMainReset(n.a);
        assert.deepEqual(n.a.ctx, r.a.ctx);
        assert.deepEqual(n.mem.wram, r.mem.wram);
        assert.deepEqual(n.mem.sram, oldSram);
        assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
        assert.equal(n.a.ioIndex, n.a.io.length);
        assert.equal(n.a.ctx.s, 0x13f);
        assert.equal(n.a.ctx.d, 0);
        assert.equal(n.a.ctx.e, 0);
        assert.equal(n.a.ctx.status & 0xbf, 5);
        assert.equal(n.a.ctx.programBank, 0x80);
        assert.equal(n.a.ctx.pc, 0xa133);
      }
    },
  );
test('unsupported reset mode/register entries fail before effects; missing warm-reset APU reply remains an explicit frontier', () => {
  for (const mutate of [
    (v) => (v.a.ctx.e = 0),
    (v) => (v.a.ctx.d = 1),
    (v) => (v.a.ctx.s = 0x201),
    (v) => (v.a.ctx.x = 0x100),
    (v) => (v.a.ctx.status &= ~0x20),
    (v) => (v.a.ctx.bank = 0x7e),
  ]) {
    const v = side(0x80e382, 0);
    mutate(v);
    const ctx = { ...v.a.ctx },
      wram = v.mem.wram.slice();
    assert.throws(
      () => runMainReset(v.a),
      (e) => e.reason === 'main_reset_entry_required',
    );
    assert.deepEqual(v.a.ctx, ctx);
    assert.deepEqual(v.mem.wram, wram);
  }
  const v = side(0x809e3d, 0);
  v.a.io = [];
  assert.throws(
    () => runMainSoftwareReset(v.a),
    (e) => e.reason === 'device_observation_required' && e.details.pc === 0x81f00e,
  );
  assert.equal(v.a.ctx.e, 0);
});
