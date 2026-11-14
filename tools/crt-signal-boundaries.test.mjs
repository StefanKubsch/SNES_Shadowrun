import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controlledLight,
  lineVoltage,
  pictureCoverage,
  srgbEncode,
  voltageReach,
} from '../src/crt/signal.mjs';

// Independent numerical integration: do not use erf or the reference's CDF.
function integrateGaussian(from, to, x, sigma) {
  // Resolve even a narrow Gaussian when integrating a long picture window.
  const intervals = Math.max(512, 2 * Math.ceil(((to - from) * 16) / sigma));
  const step = (to - from) / intervals;
  let sum = 0;
  for (let sample = 0; sample <= intervals; sample++) {
    const distance = (x - (from + sample * step)) / sigma;
    const weight = sample === 0 || sample === intervals ? 1 : sample % 2 ? 4 : 2;
    sum += (weight * Math.exp(-0.5 * distance * distance)) / (sigma * Math.sqrt(2 * Math.PI));
  }
  return (sum * step) / 3;
}

test('low-pass integrates held source pixels rather than point samples', () => {
  const sigma = 0.65;
  const levels = [0.2, 1, 0.4];
  const voltageAt = (pixel) => levels[pixel] ?? 0;
  for (const x of [-0.75, 0, 0.5, 1, 1.75, 2.5, 3]) {
    let expected = 0;
    for (let pixel = 0; pixel < levels.length; pixel++) {
      expected += levels[pixel] * integrateGaussian(pixel, pixel + 1, x, sigma);
    }
    assert.ok(Math.abs(lineVoltage(voltageAt, x, sigma, 5) - expected) < 1e-6, `x=${x}`);
  }
});

test('finite picture coverage follows both edges and retains blanking losses', () => {
  const width = 2,
    sigma = 0.4;
  const voltageAt = (pixel) => (pixel >= 0 && pixel < width ? 1 : 0);
  for (const x of [-0.5, 0, 0.5, 1.5, 2, 2.5]) {
    const coverage = pictureCoverage(x, width, sigma);
    assert.ok(Math.abs(lineVoltage(voltageAt, x, sigma) - coverage) < 1e-14, `x=${x}`);
    assert.ok(coverage < 1, 'do not normalize away the dark picture border');
  }
  const truncated = lineVoltage(() => 1, 0.5, 1, 0);
  assert.ok(Math.abs(truncated - integrateGaussian(0, 1, 0.5, 1)) < 1e-6);
  assert.ok(truncated < 0.4, 'an explicitly short kernel is not renormalized');
});

test('partial monitor controls retain neutral defaults and clipping belongs to output encoding', () => {
  assert.equal(controlledLight(0.5, 2, { brightness: 0.1 }), 0.6 ** 2);
  assert.equal(controlledLight(0.5, 2, { contrast: 0 }), 0);
  const light = controlledLight(1, 2, { contrast: 2 });
  assert.equal(light, 2, 'linear light remains available to later optical stages');
  assert.equal(srgbEncode(light), srgbEncode(1), 'only output encoding clips white');
  assert.equal(srgbEncode(-0.1), 0);
  assert.equal(srgbEncode(0.0031308), 12.92 * 0.0031308);
});

test('automatic electronics support preserves wide fields and their blanking edges', () => {
  for (const sigma of [0.07, 0.65, 2, 8]) {
    for (const phase of [0, 0.125, 0.5, 0.999]) {
      assert.ok(Math.abs(lineVoltage(() => 1, phase, sigma) - 1) < 3e-7);
      for (const x of [-2 * sigma, 0, 16, 32, 32 + 2 * sigma]) {
        const actual = lineVoltage((i) => (i >= 0 && i < 32 ? 1 : 0), x + phase, sigma);
        const expected = integrateGaussian(0, 32, x + phase, sigma);
        assert.ok(Math.abs(actual - expected) < 2e-6, `sigma=${sigma}, x=${x}, phase=${phase}`);
      }
    }
  }
  assert.equal(voltageReach(0.07), 3, 'preserve the current seven intervals');
  for (const sigma of [0, -1, NaN, Infinity])
    assert.throws(() => voltageReach(sigma), /finite and positive/);
});
