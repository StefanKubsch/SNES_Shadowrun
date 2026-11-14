import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTROLS, normalizeControls, parseControls } from '../src/crt/controls.mjs';

test('control fields fall back independently and preserve valid zero gain', () => {
  for (const [input, expected] of [
    [{ brightness: 0.04 }, { brightness: 0.04, contrast: 1 }],
    [{ contrast: 0 }, { brightness: 0, contrast: 0 }],
    [
      { brightness: '0.04', contrast: 1.4 },
      { brightness: 0, contrast: 1.4 },
    ],
    [
      { brightness: -0.1, contrast: 2 },
      { brightness: -0.1, contrast: 2 },
    ],
    [
      { brightness: 0.1, contrast: 0 },
      { brightness: 0.1, contrast: 0 },
    ],
    [{ brightness: null, contrast: -Infinity }, DEFAULT_CONTROLS],
  ]) {
    assert.deepEqual(normalizeControls(Object.freeze(input)), expected);
  }
});

test('stored partial controls ignore unrelated keys and nonnumeric JSON values', () => {
  assert.deepEqual(parseControls('{"contrast":0,"unknown":7}'), { brightness: 0, contrast: 0 });
  assert.deepEqual(parseControls('{"brightness":0.04,"contrast":{},"__proto__":{}}'), {
    brightness: 0.04,
    contrast: 1,
  });
});

test('normalization and storage fallback return independent mutable settings', () => {
  const input = Object.freeze({ brightness: 0.04, contrast: 1.4 });
  const first = normalizeControls(input);
  first.brightness = 0.1;
  assert.deepEqual(normalizeControls(input), { brightness: 0.04, contrast: 1.4 });
  for (const stored of [null, 'broken']) {
    const settings = parseControls(stored);
    assert.notEqual(settings, DEFAULT_CONTROLS);
    settings.contrast = 0;
    assert.deepEqual(parseControls(stored), { brightness: 0, contrast: 1 });
  }
  assert.deepEqual(DEFAULT_CONTROLS, { brightness: 0, contrast: 1 });
});
