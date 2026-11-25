// Every native whose source proof was retired is reached by a golden trace
// (tools/retired-native-proofs.mjs, tools/golden/native-reach.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RETIRED_NATIVE_PROOFS } from './retired-native-proofs.mjs';
import { NATIVE_REACH_FILE } from './golden/native-reach.mjs';
import { nativeTargetEntries } from '../src/script/native-targets.mjs';
import { SCENARIOS } from './golden/scenarios.mjs';

const HEX = 16;

test('every retired native proof is a native target that a golden trace reaches', () => {
  const { scenarios } = JSON.parse(readFileSync(NATIVE_REACH_FILE, 'utf8'));
  assert.deepEqual(Object.keys(scenarios).sort(), SCENARIOS.map((s) => s.name).sort());
  const reached = new Set(
    Object.values(scenarios).flatMap((calls) => Object.keys(calls).map((t) => parseInt(t, HEX))),
  );
  for (const target of RETIRED_NATIVE_PROOFS) {
    assert.ok(nativeTargetEntries.includes(target), `native target ${target.toString(HEX)}`);
    assert.ok(reached.has(target), `golden traces reach ${target.toString(HEX)}`);
  }
});
