import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditInstructionStarts,
  unreadOperandCandidates,
  auditUnreadRom,
} from './rom-unread-audit.mjs';

test('operand candidates retain mirror, word-boundary and unresolved bank/index cases', () => {
  const bytes = Buffer.alloc(0x100000);
  // Long mirror, word crossing the start, unresolved absolute bank/index,
  // immediate bitmask, and a distant indexed base needing separate review.
  const instructions = [
    [0, [0xaf, 0x80, 0x80, 0x0d]],
    [4, [0xaf, 0x7f, 0x80, 0x8d]],
    [8, [0xbd, 0x80, 0x80]],
    [11, [0x29, 0x80, 0x80]],
    [14, [0xbf, 0x00, 0x80, 0x8d]],
  ];
  for (const [offset, code] of instructions) bytes.set(code, offset);
  const starts = instructions.map(([offset]) => `${offset.toString(16)}:000`);
  const found = unreadOperandCandidates(bytes, starts, 0x8d8080, 64);
  assert.deepEqual(
    found.map((f) => f.kind),
    ['long_memory_base', 'long_memory_base', 'absolute_memory_base_unknown_bank', 'literal_only'],
  );
  assert.ok(!found.some((f) => f.pc === '80:800E'), 'distant base is outside this bounded search');
});

test('the audit decodes alternative observed M/X states instead of trusting only the first trace', () => {
  const starts = auditInstructionStarts(
    { traced_starts: ['00010:000'] },
    { starts: { '00010': ['00 0', '20 0'], '00020': ['00 1'] } },
  );
  assert.deepEqual(starts, ['00010:000', '00010:010', '00020:111']);
});

test('the unidentified bytes and all four TCRF character tile sets remain in the product', async () => {
  const report = await auditUnreadRom();
  assert.equal(report.unread_bytes, 95);
  assert.deepEqual(
    report.ranges.map((r) => [r.address, r.bytes]),
    [
      ['80:FFB5', 11],
      ['8B:FD61', 20],
      ['8D:8080', 64],
    ],
  );
  for (const range of report.ranges) {
    assert.equal(range.preserved_in_product, true, range.address);
    assert.equal(range.recorded_native_read_bytes, 0, range.address);
    assert.deepEqual(
      range.operand_candidates.filter((c) => c.kind !== 'literal_only'),
      [],
      range.address,
    );
  }
  assert.deepEqual(
    report.unused_characters.map((c) => [c.name, c.kind, c.picture_count]),
    [
      ['Gorgax', 94, 64],
      ['Heavy Orc', 96, 64],
      ['Slick Dude', 46, 2],
      ['Wolf', 117, 46],
    ],
  );
  for (const character of report.unused_characters) {
    assert.ok(character.tile_source_count > 0, character.name);
    assert.equal(character.tile_bytes_match_original, true, character.name);
  }
});
