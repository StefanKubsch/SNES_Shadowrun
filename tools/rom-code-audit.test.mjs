import test from 'node:test';
import assert from 'node:assert/strict';
import { ROM_CODE_CLASSES, isDataToCodeBoundary } from './rom-code-retention.mjs';
import { classifyRetainedCode, auditRetainedCode } from './rom-code-audit.mjs';

test('every code-class pair is excluded from data margins, including static, unused and dead code', () => {
  for (const previous of ROM_CODE_CLASSES) {
    for (const current of ROM_CODE_CLASSES) {
      assert.equal(
        isDataToCodeBoundary([previous, current], 1),
        false,
        `${previous} -> ${current}`,
      );
      assert.equal(isDataToCodeBoundary(['lookup_table', current], 1), true, `data -> ${current}`);
    }
  }
  assert.equal(isDataToCodeBoundary(['code'], 0), false);
  // The map uses numeric IDs; it must use the same boundary definition.
  const ids = new Set([1, 2, 5, 38, 39, 40]);
  assert.equal(isDataToCodeBoundary([2, 1], 1, ids), false);
  assert.equal(isDataToCodeBoundary([32, 1], 1, ids), true);
});

test('read provenance overrides margins while a stale code_kept label alone explains nothing', () => {
  const classes = ['lookup_table', 'code_kept', 'code_static', 'code_kept', 'code_kept'];
  const native = new Uint8Array([0, 1, 0, 0, 1]);
  const rows = classifyRetainedCode(
    classes,
    native,
    [
      { address: '80:8001', hex: '00' },
      { address: '80:8003', hex: '0000' },
    ],
    0x100000,
  );
  assert.deepEqual(
    rows.map((r) => r.category),
    ['recorded_cpu_read', 'unexplained', 'recorded_cpu_read'],
  );
  assert.equal(rows[0].data_boundary, true);
  assert.equal(rows[2].data_boundary, false);
});

test('only data margins and product readers remain; transitions between code classes are no margins', async () => {
  const audit = await auditRetainedCode();
  assert.equal(audit.retained_code_bytes, 121);
  assert.equal(audit.raw_code_runs, 87);
  assert.equal(audit.raw_bytes, 216);
  assert.equal(audit.decoded_bytes, 996041);
  assert.equal(audit.absent_code_bytes, 52319);
  assert.deepEqual(audit.counts, { data_margin: 81, recorded_cpu_read: 40 });
  assert.equal(audit.omitted_code_class_transitions, 39);
  for (const omitted of audit.omitted_transitions) {
    assert.equal(omitted.absent, true, omitted.address);
    assert.equal(omitted.native_recorded, false, omitted.address);
  }
});
