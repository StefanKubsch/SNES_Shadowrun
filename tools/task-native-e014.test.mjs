import test from 'node:test';
import assert from 'node:assert/strict';
import { rom, decodeWindows, compareDialog, prng } from './task-native-dialog-harness.mjs';
import { nativeE014Spec, proveE014Source } from './task-native-e014-source.mjs';
import { nativeEA6ESpec } from './task-native-ea6e-source.mjs';
import { controlPlayer, PLAYER_CONTROL_ROUTINES } from '../proof/replay/native-player-control.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';
import { ORACLE_NATIVES } from '../proof/vm/oracle-natives.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';

// NativeD0/E014 (player control) against the original instructions. Every external routine (A985, AAAF, the
// window/text/input routines, BCB2 and the status screen's externals) runs as the same stub with its real frame on
// both sides; the stubs of F963 (window) and A6C7/A6AD (choices) take the scenario values. DEC7 reads the camera
// rotation from SRAM 70:1FFD.
const map = decodeWindows(nativeE014Spec.windows),
  statusMap = decodeWindows(nativeEA6ESpec.windows);
const romOffset = (address) => (((address >>> 16) & 0x1f) << 15) | (address & 0x7fff);
const romWord = (address) => rom[romOffset(address)] | (rom[romOffset(address + 1)] << 8);
const weapons = Array.from({ length: 13 }, (_, k) => romWord(0x809700 + 2 * k));
const EXTERNAL = nativeE014Spec.externalReturns.map(([target]) => target);
const items = Array.from({ length: 0x100 }, (_, n) => n).filter((n) => {
  const t = romWord(0x8db022 + n);
  return t < 0x2000 && 0xefb0 + 6 * t <= 0xfffe;
});
const portraits = Array.from({ length: 0x60 }, (_, k) => k).filter((k) => {
  const record = 0x8d0000 | romWord(0x8094f7 + 2 * k),
    bank = rom[romOffset(record + 2)],
    pointer = romWord(record);
  return (bank >= 0x80 && bank < 0xa0 && pointer >= 0x8000) || bank === 0x7e || bank === 0x7f;
});

test('E014 pinned own code: 1391 instructions, 26 external returns, bound as special native, no oracle native', () => {
  const proof = proveE014Source(map);
  assert.equal(proof.reachable_instructions, 1391);
  assert.equal(proof.external_return_assumptions, 26);
  assert.equal(proof.maximum_local_stack_bytes, 14);
  assert.ok(SPECIAL_NATIVES.has(0x80e014));
  assert.ok(!ORACLE_NATIVES.has(0x80e014));
  assert.deepEqual(
    EXTERNAL.filter((t) => !PLAYER_CONTROL_ROUTINES.has(t)),
    [],
  );
});

function stub(target, acc, s) {
  const { ctx } = acc,
    raw = acc.pullWord();
  if (target >>> 16 === 0x81) {
    ctx.programBank = acc.read((ctx.s + 1) & 0xffff);
    ctx.s = (ctx.s + 1) & 0xffff;
  }
  ctx.pc = (raw + 1) & 0xffff;
  const dp = [0, 2, 4, 6, 8, 0xa].map((o) => acc.readWord(o, 16));
  acc.trace.push({
    kind: 'call',
    pc: target,
    address: dp[0] | (dp[1] << 16),
    value: (dp.slice(2).reduce((v, w) => v * 31 + w, ctx.a) + ctx.x * 7 + ctx.y) % 0x1000000,
  });
  if (target === 0x80f963) acc.writeWord(0, s.window, 16);
  if (target === 0x80a6c7) acc.writeWord(0, s.menu.shift() ?? 0, 16);
  if (target === 0x80a6ad) acc.writeWord(0, s.items.shift() ?? 0, 16);
  if (target === 0x80a835) acc.writeWord(0, s.slot, 16);
  const a = (dp[0] * 5 + dp[2] + target) & 0xffff;
  ctx.a = a;
  ctx.status = (ctx.status & ~0x83) | (a & 0x8000 ? 0x80 : 0) | (a === 0 ? 2 : 0) | (dp[3] & 1);
  return { rawReturnWord: raw };
}
const side = (s) => ({ ...s, menu: [...s.menu], items: [...s.items] });
const nativeRoutines = (s) => {
  const c = side(s);
  return new Map(EXTERNAL.map((t) => [t, (h) => stub(t, h.a, c)]));
};
const referenceCalls = (acc, e, s) => {
  const c = side(s);
  return new Map(EXTERNAL.map((t) => [t, () => stub(t, acc, c)]));
};

test('E014 equations match the original instructions on every own instruction', () => {
  const covered = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const r = prng(seed * 7919 + 0xe014),
      int = (n) => Math.floor(r() * n),
      pick = (list) => list[int(list.length)],
      wram = new Uint8Array(0x20000);
    for (let n = 0; n < 0x20000; n++) wram[n] = int(256);
    const sram = new Uint8Array(SRAM_SIZE);
    for (let n = 0; n < SRAM_SIZE; n++) sram[n] = int(256);
    const put = (address, v) => {
      const o = address >= 0x7e0000 ? address - 0x7e0000 : address & 0xffff;
      wram[o] = v & 255;
      wram[o + 1] = (v >>> 8) & 255;
    };
    const leader = pick([0x10, 0x20, 0x56]),
      tagged = pick([0x10, 0x30, 0x40]),
      weapon = pick(weapons),
      k = weapons.indexOf(weapon);
    put(0xcc2, leader);
    put(0x1de, tagged);
    put(0x1da, pick([0x8000, 0xffff, int(0x60)]));
    // Buttons: menus, pad directions, A/X/B/L/R; glove and aiming state.
    put(
      0x1ce,
      pick([
        0x2000, 0x1000, 0x4000, 0, 0, 0x0100, 0x0800, 0x0080, 0x0040, 0x8000, 0x0020, 0x0010,
        0x00c0, 0x8030,
      ]),
    );
    put(
      0x1ca,
      pick([
        0,
        0x0080,
        0x0040,
        0x00c0,
        0x0100,
        0x0200,
        0x0400,
        0x0800,
        0x0500,
        0x0a00,
        int(0x10000),
      ]),
    );
    put(0x1d8, pick([0, 0, 0xffff, 0xfffd]));
    put(0x1d5d, pick([0, 0, 0xffff]));
    put(0x1d5f, pick([0, 0, 0xffff]));
    put(0x1d5b, pick([0, 0xffff]));
    put(0x7e3c31, pick([0x8000, int(0x8000)]));
    put(0x7e3c13, pick([0, 0x01ec, 1 + int(0x100)]));
    put(0x7e3c33, pick([1, int(256)]));
    put(0x7e3c34, int(16));
    for (const o of [0x10, 0x20, 0x30, 0x40, 0x56])
      put(0x1458 + o, pick([0x8000 | int(0x8000), int(0x8000)]));
    // Group for the overview and the status screen (both members and the tagged object are in it).
    const count = 2 * int(4);
    put(0x7e2de6, count);
    for (let n = 0; n <= count; n += 2) {
      put(0x7e2df0 + n, pick(weapons));
      put(0x1fa8 + n, pick([0x10, 0x20, 0x30, 0x56]));
    }
    for (const o of [leader, tagged]) put(0x150a + o, weapon);
    put(0x7e2df0 + count, weapon);
    put(0x1d6b, pick([0, 0, 1]));
    for (const o of [0x10, 0x20, 0x30, 0x40, 0x56]) put(0x13a8 + o, 0x2000 + 2 * int(0x100));
    for (let n = 0; n < 14; n++) wram[0x3bfb + n] = pick([0, 0, 1, 2, 3, int(8) + 1]);
    const entry = 0x3c2e + 4 * 2 * k;
    for (const [o, v] of [
      [0, pick(items)],
      [3, pick([...items.slice(0, 8), 0x8000])],
    ]) {
      wram[entry + o] = v & 255;
      wram[entry + o + 1] = v >>> 8;
    }
    put(0x1f54, pick(portraits));
    put(0x7e3c17, pick([0, 1]));
    for (let x = 0; x < 8; x += 2) put(0x7e0216 + x, pick([0x8000, 0xffff, int(0x8000)]));
    put(0x7e2de4, int(0x10000));
    for (let o = 2; o < 0x20; o += 2) put(0x1e2d + o, 0x208a - 7 * int(0x4a0));
    const menu = [];
    for (let n = int(3); n > 0; n--) menu.push(1 + int(6));
    menu.push(pick([0, 0xffff]));
    const s = {
      entry: 0x80e014,
      wram,
      sram,
      a: int(0x10000),
      x: int(0x10000),
      y: int(0x10000),
      dbr: 0x80,
      p: int(256) & 0xc7,
      window: int(0x10000),
      slot: pick([0x10, 0x20, 0x56]),
      menu,
      items: [pick([1, 2, 0xffff, 0]), pick([1, 0, 0xffff])],
    };
    const result = compareDialog(map, s, {
      native: (h, e, s) => controlPlayer(h.a, e, true, nativeRoutines(s)),
      calls: referenceCalls,
    });
    assert.deepEqual(result.differences, [], `seed ${seed}`);
    for (const pc of result.visited) covered.add(pc);
  }
  // The status screen windows shared with EA6E are compared by its own test; here every other instruction counts.
  assert.deepEqual(
    [...map.keys()]
      .filter((pc) => !statusMap.has(pc) && !covered.has(pc))
      .map((pc) => pc.toString(16)),
    [],
  );
});
