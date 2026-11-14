import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectScriptTables} from './scripts.mjs';
import {summarizeCoverage} from './mesen-coverage.mjs';

const bytes = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
const scripts = inspectScriptTables(bytes).scripts;
const report = (fields = {}) => ({intervals: 10, mismatches: [], faults: [], selfCheck: 'equal', missingNatives: {},
  scriptBases: {}, nativesCalled: {}, opcodes: {}, ...fields});

test('Abdeckung: Scriptbasis ist Scriptadresse + 2, Natives und Opcodes zählen über alle Fenster', () => {
  // Script $099 (Shades aufheben) mit Basis $9C:E64E; $D16D ist ein Leaf, $936C (Dialog) ein Spezialnative.
  assert.equal(scripts[0x099].cpu_address, '9C:E64C');
  const summary = summarizeCoverage(bytes, [
    {name: 'a', report: report({scriptBases: {'$9CE64E': 40}, nativesCalled: {'$80D16D': 2}, opcodes: {'$58': 3}})},
    {name: 'b', report: report({scriptBases: {'$123456': 1}, nativesCalled: {'$80936C': 1}, mismatches: [{}]})},
  ]);
  assert.deepEqual(summary.scripts.ids, ['$099']);
  assert.equal(summary.scripts.total, 937);
  assert.deepEqual(summary.scripts.unknown_bases, {'$123456': 1});
  assert.equal(summary.natives.run, 2);
  assert.equal(summary.natives.special_run, 1);
  assert.ok(!summary.natives.not_run.some(n => n.target === '$80D16D' || n.target === '$80936C'));
  // Spezialnatives zuerst, innerhalb nach der Zahl der Scripts, die sie rufen.
  const firstLeaf = summary.natives.not_run.findIndex(n => !n.special);
  assert.ok(firstLeaf > 0 && summary.natives.not_run.slice(firstLeaf).every(n => !n.special));
  assert.equal(summary.opcodes.run, 1);
  assert.ok(!summary.opcodes.not_run.includes('$58'));
  assert.deepEqual(summary.windows.map(w => [w.name, w.clean, w.new_scripts, w.new_natives]), [['a', true, 1, 1], ['b', false, 0, 1]]);
});
