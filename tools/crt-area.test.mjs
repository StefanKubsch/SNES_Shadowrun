import test from 'node:test';
import assert from 'node:assert/strict';
import { grilleHat, wiredLine } from '../src/crt/area.mjs';

const density = (x, sigma) => Math.exp(-0.5 * (x / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
function integrate(fn, first, last, steps = 512) {
  if (last <= first) return 0;
  const step = (last - first) / steps;
  let sum = fn(first) + fn(last);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * fn(first + i * step);
  return (sum * step) / 3;
}
const close = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// Convolve ideal rectangular stripes in space, with the same 0.8-output-pixel
// Gaussian at every footprint. No production Fourier or integration helper.
function mask(channel, x, pitch) {
  let sum = 0;
  for (let triad = Math.floor((x - 7) / pitch); triad <= Math.ceil((x + 7) / pitch); triad++) {
    const first = (triad + channel / 3) * pitch;
    sum += integrate((at) => density(x - at, 0.8), first, first + pitch / 3, 64);
  }
  return sum;
}

test('spot interpolation hats are integrated together with the existing filtered grille', () => {
  for (const [channel, x, pitch, centre, width, index] of [
    [0, 0.5, 1.5, 0.3, 1.4, 0],
    [1, 2.5, 3, 2.2, 0.7, 2],
    [2, 1.5, 6.4, 0.25, 3.8, 1],
    [0, 4.5, 20, 0, 0.0011, 0],
    [1, 3.5, 3, 0.25, 0.0005, 0],
    [0, 0.5, 3, 1, 0.6, 5],
  ]) {
    const first = width < 0.001 ? -0.5 : Math.max(-0.5, (index - 1 - centre) / width);
    const last = width < 0.001 ? 0.5 : Math.min(0.5, (index + 1 - centre) / width);
    const fn = (at) =>
      Math.max(0, 1 - Math.abs(centre + (width < 0.001 ? 0 : width * at) - index)) *
      mask(channel, x + at, pitch);
    const middle = Math.max(first, Math.min(last, (index - centre) / width));
    const expected = integrate(fn, first, middle, 64) + integrate(fn, middle, last, 64);
    close(grilleHat(channel, x, pitch, centre, width, index), expected, 3e-6);
  }
  // This ramp has covariance with the mask. Separate area means do not agree.
  const product = grilleHat(0, 1.5, 3, 0.4, 0.8, 0);
  const separate = 0.6 * integrate((at) => mask(0, 1.5 + at, 3), -0.5, 0.5, 64);
  assert.ok(Math.abs(product - separate) > 0.001);
});

test('beam and wire products agree with spatial quadrature, including overlap and saturation', () => {
  for (const [footprint, distance, y, width, positions] of [
    [0.14, 0.2, 20.5, 0.2, [0.2, 0.7]],
    [4, -1.5, 20.5, 0.5, [0.2, 0.7]],
    [100, 22, 50.5, 0.2, [0.2, 0.7]],
    [0.28, 0.4, 50.5, 1.5, [0.5, 0.5]],
    [4, 0.2, 50.5, 2.4, [0.49, 0.51]],
    [0.0005, 0.2, 20.5, 0.2, [0.2, 0.7]],
    [0.14, 0.1, 80.5, 0, [0.2, 0.7]],
  ]) {
    const sigma = 0.36,
      height = 100;
    const monitor = { screenWidthMm: 400 / 3, damperWires: { widthMm: width, positions } };
    const point = footprint < 0.001;
    const expected = integrate(
      (at) => {
        const shadow = Math.min(
          1,
          positions.reduce((sum, p) => sum + width * density(y + at - p * height, 0.8), 0),
        );
        return density(distance + (point ? 0 : footprint * at), sigma) * (1 - shadow);
      },
      -0.5,
      0.5,
      32768,
    );
    close(wiredLine(distance, sigma, footprint, y, monitor, height), expected, 2e-6);
  }
  const monitor = { screenWidthMm: 400 / 3 };
  close(
    wiredLine(0.2, 0.36, 0.28, 20.5, monitor, 100),
    integrate((at) => density(0.2 + 0.28 * at, 0.36), -0.5, 0.5),
    1e-6,
  );
});
