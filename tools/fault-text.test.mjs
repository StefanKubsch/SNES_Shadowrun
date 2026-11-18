import test from 'node:test';
import assert from 'node:assert/strict';
import { faultText } from '../src/browser/fault-text.mjs';
import { taskStop } from '../src/system/task-stop.mjs';

test('a task stop reaches the page with its reason and hexadecimal details', () => {
  // Recording of 2026-11-18: the worker posted error.message, undefined for a task stop,
  // so the page showed nothing while the game had stopped.
  let stop;
  try {
    taskStop('object_slot_required', { base: 0x0e28, index: 0xffff });
  } catch (error) {
    stop = error;
  }
  assert.equal(faultText(stop), 'object_slot_required (base E28, index FFFF)');
  assert.equal(
    faultText({ taskBoundary: true, reason: 'depth_rule_required' }),
    'depth_rule_required',
  );
});

test('an error keeps its message; other values are named as text', () => {
  assert.equal(faultText(new Error('rom_byte_absent at 81:B1AB')), 'rom_byte_absent at 81:B1AB');
  assert.equal(faultText('broken'), 'broken');
  assert.equal(faultText(undefined), 'undefined');
});
