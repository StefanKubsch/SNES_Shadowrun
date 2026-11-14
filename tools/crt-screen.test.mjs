import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convergenceMm,
  grille,
  pitchPixels,
  screenHeightMm,
  wireShadow,
} from '../src/crt/screen.mjs';
import { SONY_PVM_20M2E } from '../src/crt/profiles.mjs';

const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// Independent spatial quadrature, with no Fourier coefficients or production
// erf helper. Integrate the positive Gaussian over each rectangular stripe.
function integrate(fn, start, end) {
  const steps = 256;
  const step = (end - start) / steps;
  let sum = fn(start) + fn(end);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * fn(start + i * step);
  return (sum * step) / 3;
}

const gaussian = (distance) =>
  Math.exp(-0.5 * (distance / 0.8) ** 2) / (0.8 * Math.sqrt(2 * Math.PI));

function blurredStripe(channel, x, pitch) {
  let sum = 0;
  // Eight sigma on either side makes the omitted Gaussian tails negligible.
  const first = Math.floor((x - 6.4) / pitch) - 1;
  const last = Math.ceil((x + 6.4) / pitch);
  for (let period = first; period <= last; period++) {
    const start = (period + channel / 3) * pitch;
    sum += integrate((at) => gaussian(x - at), start, start + pitch / 3);
  }
  return sum;
}

test('grille agrees with spatial convolution across subpixel and resolved pitches', () => {
  for (const pitch of [0.5, 1.5, 2, 3, 4.27, 12]) {
    for (let channel = 0; channel < 3; channel++) {
      for (const phase of [-0.31, 0, 1 / 6, 1 / 3, 0.5, 0.91, 1.2]) {
        const x = phase * pitch;
        // The 1e-4 harmonic-window cutoff is not an exact convolution.
        close(grille(channel, x, pitch), blurredStripe(channel, x, pitch), 5e-5);
      }
    }
  }
});

test('grille conserves the channel means and RGB coverage without shifting its phase', () => {
  for (const pitch of [1.5, 2, 3, 12]) {
    const means = [0, 0, 0];
    for (let sample = 0; sample < 512; sample++) {
      const x = ((sample + 0.5) * pitch) / 512;
      let coverage = 0;
      for (let channel = 0; channel < 3; channel++) {
        const value = grille(channel, x, pitch);
        means[channel] += value / 512;
        coverage += value;
        close(grille(channel, x - 2 * pitch, pitch), value);
        close(
          grille(channel, x + pitch / 3, pitch),
          grille(0, x + ((1 - channel) * pitch) / 3, pitch),
        );
      }
      close(coverage, 1);
    }
    means.forEach((mean) => close(mean, 1 / 3));
  }
  for (let channel = 0; channel < 3; channel++) {
    assert.ok(grille(channel, ((channel + 0.5) * 12) / 3, 12) > 0.98);
  }
});

test('physical dimensions use the full 4:3 screen and preserve scale ratios', () => {
  const monitor = Object.freeze({ screenWidthMm: 400, grillePitchMm: 0.5 });
  assert.equal(screenHeightMm(monitor), 300);
  assert.equal(pitchPixels(monitor, 1600), 2);
  assert.equal(pitchPixels(monitor, 3200), 4);
});

test('thin-wire shadow approximates a finite opaque wire convolved with a Gaussian', () => {
  for (const height of [1080, 2160]) {
    const width = (0.05 / 288) * height;
    for (const position of [0.273, 0.727]) {
      for (const offset of [-2, -0.5, 0, 0.5, 2]) {
        const expected = integrate((at) => gaussian(offset - at), -width / 2, width / 2);
        close(wireShadow(SONY_PVM_20M2E, position * height + offset, height), expected, 0.002);
      }
    }
  }
});

test('wire positions, width scaling, absent fields and saturation are explicit', () => {
  const monitor = Object.freeze({
    screenWidthMm: 400,
    damperWires: Object.freeze({ positions: Object.freeze([0.25]), widthMm: 0.05 }),
  });
  const peak = wireShadow(monitor, 300, 1200);
  close(peak, 0.09973557010035818);
  close(wireShadow(monitor, 600, 2400), 2 * peak);
  close(wireShadow(monitor, 299.5, 1200), wireShadow(monitor, 300.5, 1200));
  assert.ok(wireShadow(monitor, 310, 1200) < 1e-30);
  for (const damperWires of [
    undefined,
    null,
    { positions: [], widthMm: 1 },
    { positions: [0.25], widthMm: 0 },
  ]) {
    assert.equal(wireShadow({ screenWidthMm: 400, damperWires }, 300, 1200), 0);
  }
  assert.equal(
    wireShadow({ ...monitor, damperWires: { positions: [0.25, 0.25], widthMm: 1 } }, 300, 1200),
    1,
  );
});

test('convergence uses independent x/y fields, signed screen coordinates and millimetres', () => {
  const monitor = Object.freeze({
    convergence: Object.freeze({
      red: Object.freeze({ x: Object.freeze([1, 2, 4, 8]), y: Object.freeze([-3, 5, -7, 11]) }),
      blue: Object.freeze({ x: Object.freeze([-2, 3, 0, 0]), y: Object.freeze([4, 0, -2, 0]) }),
    }),
  });
  for (const [u, v, expected] of [
    [0, 0, [1, -3]],
    [-1, -1, [3, 10]],
    [1, -1, [-9, -2]],
    [-1, 1, [-5, -26]],
    [1, 1, [15, 6]],
    [0.5, -0.25, [0, -0.125]],
  ]) {
    assert.deepEqual(convergenceMm(monitor, 0, u, v), expected);
  }
  assert.deepEqual(convergenceMm(monitor, 2, 0.5, -0.25), [-0.5, 4.5]);
  assert.deepEqual(convergenceMm(monitor, 1, 1, 1), [0, 0]);
  for (const empty of [
    {},
    { convergence: null },
    { convergence: { red: monitor.convergence.red } },
  ]) {
    assert.deepEqual(convergenceMm(empty, 2, 0.5, -0.25), [0, 0]);
  }
  const first = convergenceMm(monitor, 0, 0, 0);
  first[0] = 99;
  assert.deepEqual(convergenceMm(monitor, 0, 0, 0), [1, -3]);
  const missing = convergenceMm({}, 0, 0, 0);
  missing[0] = 99;
  assert.deepEqual(convergenceMm({}, 0, 0, 0), [0, 0]);
});
