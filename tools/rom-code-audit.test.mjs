import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROM_CODE_CLASSES,
  isDataToCodeBoundary,
  isHardwareOnlyCodeRead,
} from './rom-code-retention.mjs';
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

test('hardware-only recorded reads retain their inclusive boundaries', () => {
  assert.equal(isHardwareOnlyCodeRead(0xd478), false);
  assert.equal(isHardwareOnlyCodeRead(0xd479), true);
  assert.equal(isHardwareOnlyCodeRead(0xd531), true);
  assert.equal(isHardwareOnlyCodeRead(0xd577), true);
  assert.equal(isHardwareOnlyCodeRead(0xd578), false);
});

test('read provenance overrides margins while a stale code_kept label alone explains nothing', () => {
  const classes = ['lookup_table', 'code_kept', 'code_static', 'code_kept', 'code_kept'];
  const native = new Uint8Array([0, 1, 0, 0, 0]);
  const rows = classifyRetainedCode(
    classes,
    native,
    { '00001': '81:D534', '00004': '80:A98C' },
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

test('only genuine data margins and observed readers remain after removing 200 code transitions', async () => {
  const audit = await auditRetainedCode();
  assert.equal(audit.retained_code_bytes, 93);
  assert.equal(audit.raw_code_runs, 89);
  assert.equal(audit.raw_bytes, 188);
  assert.equal(audit.decoded_bytes, 996041);
  assert.equal(audit.absent_code_bytes, 52347);
  assert.deepEqual(audit.counts, {
    unobserved_data_margin: 76,
    recorded_cpu_read: 15,
    hardware_only_and_margin: 2,
  });
  assert.equal(audit.omitted_code_class_transitions, 200);
  for (const omitted of audit.omitted_transitions) {
    assert.equal(omitted.absent, true, omitted.address);
    assert.equal(omitted.native_recorded, false, omitted.address);
    assert.equal(omitted.original_recorded, false, omitted.address);
  }
  for (const row of audit.bytes) {
    if (row.category === 'hardware_only_and_margin') assert.equal(row.data_boundary, true);
  }
});
