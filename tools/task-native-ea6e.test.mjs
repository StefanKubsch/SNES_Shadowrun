import test from 'node:test';
import assert from 'node:assert/strict';
import { rom, decodeWindows, compareDialog, prng } from './task-native-dialog-harness.mjs';
import { nativeEA6ESpec, proveEA6ESource } from './task-native-ea6e-source.mjs';
import { showStatusScreen, STATUS_SCREEN_ROUTINES } from '../proof/replay/native-status-screen.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';

// NativeB0/EA6E (status screen with its submenus) against the original instructions. Every external routine
// has its own proof and runs as the same stub with its real frame on both sides; the stubs of F963 (window),
// A6C7/A6AD (choices), A835 (slot) and C1CA (nested round) take the scenario values.
const map = decodeWindows(nativeEA6ESpec.windows);
const romOffset = (address) => (((address >>> 16) & 0x1f) << 15) | (address & 0x7fff);
const romWord = (address) => rom[romOffset(address)] | (rom[romOffset(address + 1)] << 8);
const weapons = Array.from({ length: 13 }, (_, k) => romWord(0x809700 + 2 * k));
const EXTERNAL = nativeEA6ESpec.externalReturns.map(([target]) => target);
// Item numbers for E9A8 whose text pointer stays in the ROM half of bank 8C (as in the F254 test).
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

test('EA6E pinned own code: 936 instructions, 24 external returns, six submenus, bound as special native', () => {
  const proof = proveEA6ESource(map);
  assert.equal(proof.reachable_instructions, 936);
  assert.equal(proof.external_return_assumptions, 24);
  assert.equal(proof.maximum_local_stack_bytes, 12);
  assert.ok(SPECIAL_NATIVES.has(0x80ea6e));
  assert.deepEqual(
    EXTERNAL.filter((t) => !STATUS_SCREEN_ROUTINES.has(t)),
    [],
  );
  // JMP (ED2E,X): the six submenus are the ROM table entries for the choices 1..6.
  assert.deepEqual(
    [2, 4, 6, 8, 10, 12].map((x) => 0x800000 | romWord(0x80ed2e + x)),
    nativeEA6ESpec.indirectTargets[0][1],
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
  if (target === 0x80c1ca)
    for (const [address, value] of s.round) acc.writeWord(address, value, 16);
  const a = (dp[0] * 5 + dp[2] + target) & 0xffff;
  ctx.a = a;
  ctx.status = (ctx.status & ~0x83) | (a & 0x8000 ? 0x80 : 0) | (a === 0 ? 2 : 0) | (dp[3] & 1);
  return { rawReturnWord: raw };
}
// Each side consumes its own copy of the choice lists.
const side = (s) => ({ ...s, menu: [...s.menu], items: [...s.items] });
const nativeRoutines = (s) => {
  const c = side(s);
  return new Map(EXTERNAL.map((t) => [t, (h) => stub(t, h.a, c)]));
};
const referenceCalls = (acc, e, s) => {
  const c = side(s);
  return new Map(EXTERNAL.map((t) => [t, () => stub(t, acc, c)]));
};

test('EA6E equations match the original instructions on every instruction', () => {
  const covered = new Set();
  for (let seed = 1; seed <= 1200; seed++) {
    const r = prng(seed * 7919 + 0xea6e),
      int = (n) => Math.floor(r() * n),
      pick = (list) => list[int(list.length)],
      wram = new Uint8Array(0x20000);
    for (let n = 0; n < 0x20000; n++) wram[n] = int(256);
    const put = (address, v) => {
      const o = address >= 0x7e0000 ? address - 0x7e0000 : address & 0xffff;
      wram[o] = v & 255;
      wram[o + 1] = (v >>> 8) & 255;
    };
    const object = pick([0x10, 0x20, 0x30, 0x56]),
      leader = pick([0x10, 0x40]),
      weapon = pick(weapons),
      k = weapons.indexOf(weapon);
    put(0, object);
    put(0xcc2, leader);
    put(0x150a + object, int(4) ? weapon : 0x7777);
    put(0x150a + leader, weapon);
    put(0x7e2de6, 2);
    put(0x7e2df0, 0x1234);
    put(0x7e2df2, weapon);
    for (const o of [object, leader]) put(0x13a8 + o, 0x2000 + 2 * int(0x100));
    // Weapon 0 points into WRAM 7E:3BFB (attributes, slots); entry 7E3C2E+4*index with real items for E9C5.
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
    put(0x7e3c18, pick([0, 1]));
    put(0x7e3c05, pick([0, 1]));
    put(0x7e3c19, pick([0, 1]));
    for (let x = 0; x < 8; x += 2) put(0x7e0216 + x, pick([0x8000, 0xffff, int(0x8000)]));
    put(0x7e2de4, int(0x10000));
    // Item records of 208A..: a few match the weapon number at 7E0003+record (many would let the list 1EAF run
    // into the stack, in the original as well).
    for (let x = 0x208a; x >= 0; x -= 7)
      if (int(200) === 0) {
        const rec = romWord(0x8db020 + x);
        if (rec) put(0x7e0003 + rec, weapon);
      }
    // Column 1E2D also holds valid records where the list stays shorter than the choice (stale rows).
    for (let o = 2; o < 0x20; o += 2) put(0x1e2d + o, 0x208a - 7 * int(0x4a0));
    const menu = [];
    for (let n = int(4); n > 0; n--) menu.push(1 + int(6));
    menu.push(pick([0, 0xffff]));
    const s = {
      entry: 0x80ea6e,
      wram,
      a: int(0x10000),
      x: int(0x10000),
      y: int(0x10000),
      dbr: 0x80,
      p: int(256) & 0xc7,
      window: int(0x10000),
      slot: pick([0x10, 0x20, 0x56]),
      menu,
      items: [pick([1, 2, 0xffff, 0]), pick([1, 0, 0xffff])],
      round: [
        [0x1d63, pick([0, 0, 1])],
        [0x1f58, pick([0, 1])],
      ],
    };
    const result = compareDialog(map, s, {
      native: (h, e, s) => showStatusScreen(h.a, e, true, nativeRoutines(s)),
      calls: referenceCalls,
    });
    assert.deepEqual(result.differences, [], `seed ${seed}`);
    for (const pc of result.visited) covered.add(pc);
  }
  // Not reachable from EA6E itself: E788..E7B4 needs 1F68 set, which the entry E68E clears (covered by the F254
  // test); ECDB needs 1F64 set, which EA6E clears at its start (only the entry EA89 of Native1C reaches it).
  const unreachable = new Set(
    [...map.keys()].filter((pc) => (pc >= 0x80e788 && pc <= 0x80e7b4) || pc === 0x80ecdb),
  );
  assert.equal(unreachable.size, 19);
  assert.deepEqual(
    [...map.keys()]
      .filter((pc) => !covered.has(pc) && !unreachable.has(pc))
      .map((pc) => pc.toString(16)),
    [],
  );
});
