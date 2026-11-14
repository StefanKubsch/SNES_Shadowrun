import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectRom } from './rom.mjs';
import {
  inventoryTextReferences,
  typedTextReferences,
  javascriptTextCandidates,
  rawTextMatches,
} from './text-reference-inventory.mjs';

const json = (file) =>
  JSON.parse(readFileSync(new URL(`../assets/${file}.json`, import.meta.url), 'utf8'));

test('a text-looking actor ID, bitmask or state address remains a candidate rather than a proved reference', () => {
  const report = inventoryTextReferences();
  assert.equal(report.text_count, 1603);
  assert.equal(report.proven_references, 1786);
  assert.equal(report.decoded_data_references, 1730);
  assert.equal(report.native_references, 56);
  assert.equal(report.referenced_texts, 1603);
  assert.deepEqual(report.unreferenced_texts, []);
  assert.deepEqual(report.by_asset, {
    'vm-kinds.json': 227,
    'vm-runners.json': 13,
    'vm-topics.json': 64,
    'vm-tables.json': 699,
    'vm-dialogs.json': 727,
  });
  assert.equal(new Set(report.references.map((r) => r.slot)).size, 1786);
  assert.equal(report.script_units, 946);
  assert.equal(report.script_candidates.length, 41);
  assert.ok(
    report.script_candidates.some((c) => c.instruction === 'push_u16' && c.value === 0x07b6),
  );
  assert.ok(report.script_candidates.some((c) => c.value === 0x8000));
  assert.ok(report.script_candidates.some((c) => c.instruction === 'store_state_u8'));
  assert.equal(report.native_operand_candidates.length, 100);
  const mask = report.native_operand_candidates.find((c) => c.pc === '80:8778');
  assert.equal(mask.status, 'numeric_match_only');
  assert.ok(!report.references.some((r) => r.slot === mask.slot));
  assert.equal(
    report.native_operand_candidates.find((c) => c.pc === '80:CE56').status,
    'proven_reference',
  );
  assert.equal(report.language_identity_bindings.length, 1591);
  assert.equal(report.script_coverage.filter((c) => c.unit_gaps.length).length, 7);
  assert.equal(
    report.relocation_ready,
    false,
    'target coverage alone does not authorize pointer rewrites',
  );
});

test('typed source fields reject another valid text target and cannot silently become absent sentinels', () => {
  const { bytes } = inspectRom(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));
  const texts = json('vm-texts').texts;
  const assets = {
    kinds: json('vm-kinds'),
    runners: json('vm-runners'),
    topics: json('vm-topics'),
    tables: json('vm-tables'),
    dialogs: json('vm-dialogs'),
  };
  const wrong = structuredClone(assets);
  wrong.topics.topics[0] = texts[1].address;
  assert.throws(() => typedTextReferences(bytes, texts, wrong), /differs from ROM/);
  const absent = structuredClone(assets);
  absent.kinds.kinds[0].name = null;
  assert.throws(() => typedTextReferences(bytes, texts, absent), /sentinel differs/);
  const zero = structuredClone(assets);
  zero.tables.tables.find((t) => t.name === 'text_numbers').values[0] = 0;
  assert.throws(() => typedTextReferences(bytes, texts, zero), /sentinel differs/);
});

test('JavaScript scanning parses code and ignores numbers in comments and string contents', () => {
  const words = new Map([[0x8000, '9E:8000']]);
  const sites = javascriptTextCandidates(
    '// 0x8000\nconst mask=0x8000, text="0x8000", binary=0b1000000000000000;',
    words,
    'fixture.mjs',
  );
  assert.equal(sites.length, 2);
  assert.ok(sites.every((s) => s.line === 2 && s.target === '9E:8000'));
});

test('unaligned raw words and mirrored long addresses stay numeric matches without a source contract', () => {
  const bytes = Buffer.alloc(32);
  bytes.set([0, 0x80], 1);
  bytes.set([0, 0x80, 0x1e], 8);
  const matches = rawTextMatches(
    bytes,
    new Map([[0x8000, '9E:8000']]),
    new Array(bytes.length).fill('unknown'),
    [],
  );
  assert.ok(matches.some((m) => m.slot === '80:8001' && m.encoding === 'text_word'));
  assert.ok(matches.some((m) => m.slot === '80:8008' && m.encoding === 'long_address'));
  assert.ok(matches.every((m) => m.status === 'numeric_match_only'));
});
