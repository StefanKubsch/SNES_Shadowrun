import test from 'node:test';
import assert from 'node:assert/strict';
import { frontendSpecs, frontendDataWindows, proveFrontend } from './main-frontend-source.mjs';
import { decodeWindows, rom, window } from './task-native-dialog-harness.mjs';
// The start menu texts are lifted (src/frontend); their register-level reference was retired on
// 2026-11-25 (golden traces attract and new-game), so the source specs only pin the original.
import { proveWordStack } from './static-word-stack-proof.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';

const maps = new Map(frontendSpecs.map((s) => [s.entry, decodeWindows(s.windows)]));
test('frontend sources retain complete pinned paths, stack protection and path-specific mode/bank returns', () => {
  for (const s of frontendSpecs) {
    const map = maps.get(s.entry),
      p = proveFrontend(map, s);
    assert.equal(p.reachable_instructions, s.instructions, s.name);
    assert.equal(map.size, s.instructions, s.name);
    assert.equal(p.minimum_protected_stack_bytes, s.stackBytes, s.name);
    assert.deepEqual(p.returns, s.returns, s.name);
    assert.deepEqual(p.external_returns ?? [], s.externalReturns, s.name);
  }
  assert.deepEqual(
    frontendSpecs
      .find((s) => s.entry === 0x81e6ae)
      .returns.map((r) => r.x)
      .sort(),
    [0, 1],
  );
  for (const w of frontendDataWindows)
    assert.equal(window(w.start, w.start + w.hex.length / 2).hex, w.hex);
});
test('proof preserves BRL control flow and rejects unproved widths or invalid bank/control lemmas', () => {
  const bytes = rom.slice();
  bytes.set([0x82, 1, 0, 0x48, 0x60], 0); // BRL over an unreachable unbalanced PHA.
  const map = decodeTaskWindows(bytes, [{ start: 0x808000, hex: '8201004860' }]).map;
  const p = proveWordStack(map, 0x808000, 'RTS');
  assert.equal(p.reachable_instructions, 2);
  assert.equal(p.returns.length, 1);
  const checksum = maps.get(0x81d5d0);
  assert.throws(() => proveWordStack(checksum, 0x81d5d0, 'RTS'), /Mode mismatch/);
  assert.throws(() => proveWordStack(map, 0x808000, 'RTS', { initialM: 2 }), /Invalid initial/);
  assert.throws(
    () => proveWordStack(map, 0x808000, 'RTS', { controlWidthJoins: new Set([0x808003]) }),
    /Invalid control/,
  );
  assert.throws(
    () =>
      proveWordStack(map, 0x808000, 'RTS', { externalReturnBanks: new Map([[0x809000, 0x81]]) }),
    /Invalid external return bank/,
  );
  const nmi = maps.get(0x81e6ae),
    externalReturns = new Map(
      [...nmi.values()]
        .filter((i) => ['JSR', 'JSL'].includes(i.mnemonic))
        .map((i) => [i.target, i.mnemonic === 'JSL' ? 'RTL' : 'RTS']),
    );
  assert.throws(
    () => proveWordStack(nmi, 0x81e6ae, 'RTL', { externalReturns }),
    /Mode mismatch 81:E783/,
  );
});
