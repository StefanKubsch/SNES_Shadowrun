import test from 'node:test';
import assert from 'node:assert/strict';
import { createConvergenceProbe, gaussLegendre } from '../proof/crt/convergence.mjs';
import { tubeReference } from '../src/crt/beam.mjs';
import { SRGB } from '../src/crt/colour.mjs';
import { srgbEncode } from '../src/crt/signal.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';

const close = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const codeDifference = (a, b) =>
  Math.max(...a.map((value, c) => 255 * Math.abs(srgbEncode(value) - srgbEncode(b[c]))));
const source = {
  width: 8,
  height: 6,
  dotClockHz: 1e6,
  levelBits: 8,
  standard: { activeLineS: 8e-6, activeLines: 8, aspect: 4 / 3 },
};
const monitor = {
  screenWidthMm: 8,
  grillePitchMm: 0.4,
  resolutionTvLines: 12,
  resolutionContrast: Math.exp(-Math.LN2 / 8) * Math.exp(-(Math.PI ** 2) / 8),
  rgbBandwidthHz: 2e6,
  gamma: 2,
  white: SRGB.white,
  phosphor: SRGB,
  halation: { sigmaMm: 0.6, energy: 0 },
  damperWires: { positions: [0.273, 0.727], widthMm: 0.05 },
  convergence: {
    red: { x: [0.1, 0, 0, 0], y: [-0.05, 0, 0, 0] },
    blue: { x: [-0.08, 0, 0, 0], y: [0.06, 0, 0, 0] },
  },
};

test('diagnostic Gauss-Legendre nodes integrate their polynomial moments', () => {
  for (const order of [4, 8, 12]) {
    const nodes = gaussLegendre(order);
    for (let power = 0; power < 2 * order; power++) {
      const sum = nodes.reduce((value, [x, weight]) => value + weight * x ** power, 0);
      close(sum, power % 2 ? 0 : 2 / (power + 1), 2e-14);
    }
  }
  assert.throws(() => gaussLegendre(1), /order/);
});

test('constant convergence gives identical spatial and centre translation; fixed quadrature agrees with the renderer reference', () => {
  for (const electrical of [false, true]) {
    const input = electrical ? { ...source, rgbOutput: SNES_PAL_RGB.rgbOutput } : source;
    const receiver = electrical ? { ...monitor, rgbInputOhm: 75, rgbInputVpp: 0.7 } : monitor;
    for (const pattern of ['white', 'checker', 'impulse']) {
      const probe = createConvergenceProbe(input, receiver, pattern);
      const reference = tubeReference(probe.frame(), input, receiver);
      for (const [width, height, x, y] of [
        [64, 48, 32, 24],
        [64, 48, 4, 6],
        [4, 3, 2, 1],
        [1, 1, 0, 0],
      ]) {
        const fixed = probe.pixel(width, height, x, y, false, 12);
        assert.deepEqual(probe.pixel(width, height, x, y, true, 12), fixed);
        const expected = reference.pixel(probe.layout, width, height, x, y);
        const sameSupport = probe.pixel(width, height, x, y, false, 12, true);
        sameSupport.forEach((value, c) =>
          assert.ok(
            Math.abs(value - expected[c]) < 3e-6,
            `${pattern} ${width}x${height} (${x},${y}) channel ${c}: ${value} != ${expected[c]}`,
          ),
        );
      }
    }
  }
});

test('the current profile convergence effect is resolved separately from quadrature error', () => {
  const profile = { ...SONY_PVM_20M2E, halation: { ...SONY_PVM_20M2E.halation, energy: 0 } };
  const probe = createConvergenceProbe(SNES_PAL_RGB, profile, 'checker');
  for (const [width, height, x, y, codeLimit] of [
    [1440, 1080, 718, 541, 0.02],
    [2880, 2160, 1440, 1080, 0.02],
    [64, 48, 60, 41, 0.2],
  ]) {
    const fixed = probe.pixel(width, height, x, y, false, 12);
    const varying = probe.pixel(width, height, x, y, true, 12);
    const coarse = probe.pixel(width, height, x, y, true, 8);
    assert.ok(
      codeDifference(varying, coarse) < 0.0001,
      'refinement must resolve the measured difference',
    );
    assert.ok(
      codeDifference(fixed, varying) < codeLimit,
      'profile changes need a renewed approximation review',
    );
    assert.ok(codeDifference(fixed, varying) > 1e-6, 'the spatial displacement must actually vary');
  }
});

test('a synthetic large gradient exposes that centre translation is not a general affine or bilinear integral', () => {
  const stress = {
    ...monitor,
    convergence: {
      red: { x: [0.1, 0.8, 0.2, 0.12], y: [-0.05, 0.1, 0.6, -0.1] },
      blue: { x: [-0.08, -0.6, 0.2, -0.15], y: [0.06, -0.12, -0.4, 0.08] },
    },
  };
  const probe = createConvergenceProbe(source, stress, 'impulse');
  let maxCode = 0;
  for (const [width, height, x, y] of [
    [8, 6, 3, 2],
    [8, 6, 4, 3],
    [8, 6, 5, 4],
    [4, 3, 1, 1],
    [4, 3, 2, 1],
  ]) {
    const fixed = probe.pixel(width, height, x, y, false, 12),
      varying = probe.pixel(width, height, x, y, true, 12);
    maxCode = Math.max(maxCode, codeDifference(fixed, varying));
  }
  assert.ok(
    maxCode > 1,
    `a deliberately large gradient must fail a one-code-unit approximation criterion: ${maxCode}`,
  );
});
