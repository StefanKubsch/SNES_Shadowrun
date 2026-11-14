import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxSample,
  gaussWeights,
  halationKernel,
  lineRows,
  lineWeight,
  peakGain,
  samplesPerRow,
  spotSigma,
  spotWeights,
  tubeReference,
} from '../src/crt/beam.mjs';
import { SRGB } from '../src/crt/colour.mjs';
import { grille } from '../src/crt/screen.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';

const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

function integrate(fn, from, to) {
  const step = (to - from) / 512;
  let sum = fn(from) + fn(to);
  for (let i = 1; i < 512; i++) sum += (i % 2 ? 4 : 2) * fn(from + i * step);
  return (sum * step) / 3;
}

const density = (distance, sigma) =>
  Math.exp(-0.5 * (distance / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

// Synthetic units, not a hardware calibration: one source pixel is 1 mm wide
// and one raster line 0.75 mm high. The forward MTF specifies sigma 1/3 line,
// or 1/4 source pixel, independently of spotSigma's inverse calculation.
const source = Object.freeze({
  width: 8,
  height: 6,
  dotClockHz: 1e6,
  levelBits: 8,
  standard: Object.freeze({ activeLineS: 8e-6, activeLines: 8, aspect: 4 / 3 }),
});
const monitor = Object.freeze({
  screenWidthMm: 8,
  grillePitchMm: 0.4,
  resolutionTvLines: 12,
  resolutionContrast: Math.exp(-Math.LN2 / 8) * Math.exp(-(Math.PI ** 2) / 8),
  rgbBandwidthHz: 2e6,
  gamma: 2,
  white: Object.freeze([...SRGB.white]),
  phosphor: SRGB,
  halation: Object.freeze({ sigmaMm: 0.6, energy: 0 }),
});
const layout = Object.freeze({ picture: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }) });

test('inferred spot reproduces the forward MTF and keeps line/pixel units separate', () => {
  const spot = spotSigma(source, monitor);
  close(spot.lines, 1 / 3);
  close(spot.pixels, 1 / 4);
  const twiceClock = spotSigma({ ...source, dotClockHz: 2e6 }, monitor);
  close(twiceClock.lines, spot.lines);
  close(twiceClock.pixels, 2 * spot.pixels);
  const twiceLines = spotSigma(
    { ...source, standard: { ...source.standard, activeLines: 16 } },
    monitor,
  );
  close(twiceLines.lines, 2 * spot.lines);
  close(twiceLines.pixels, spot.pixels);
  assert.equal(samplesPerRow(source), 96);

  const original = spotSigma(SNES_PAL_RGB, SONY_PVM_20M2E);
  const electronics = Math.exp((-Math.LN2 * ((300 * (4 / 3)) / 52e-6 / 10e6) ** 2) / 2);
  const spotResponse = Math.exp(-2 * Math.PI ** 2 * (original.lines / 288) ** 2 * 300 ** 2);
  close(electronics * spotResponse, 0.05);
});

test('spot and halo kernels match independently known rational weights and own their arrays', () => {
  // exp(-m^2/(2*sigma^2)) = 2^(-m^2); after scaling by 512 the
  // seven unnormalized weights are integers, whose sum is 1090.
  const sigma = 1 / Math.sqrt(2 * Math.LN2);
  const expected = [1, 32, 256, 512, 256, 32, 1].map((value) => value / 1090);
  for (const weightsFor of [spotWeights, gaussWeights]) {
    const first = weightsFor(sigma);
    assert.equal(first.reach, 3);
    first.weights.forEach((value, index) => close(value, expected[index]));
    first.weights[0] = 99;
    close(weightsFor(sigma).weights[0], expected[0]);
    for (const spread of [0.1, 2.08, 10.53]) {
      const { reach, weights } = weightsFor(spread);
      assert.equal(weights.length, 2 * reach + 1);
      close(
        weights.reduce((sum, value) => sum + value, 0),
        1,
      );
      weights.forEach((value, index) => {
        assert.ok(value > 0);
        assert.equal(value, weights[weights.length - 1 - index]);
      });
    }
  }
});

// Exact integral of a piecewise-linear function: Simpson is exact on each
// linear piece between integer kinks.
function integrateLinear(fn, from, to) {
  let sum = 0;
  for (let start = from; start < to;) {
    const end = Math.min(to, Math.floor(start) + 1);
    sum += ((end - start) * (fn(start) + 4 * fn((start + end) / 2) + fn(end))) / 6;
    start = end;
  }
  return sum;
}

test('vertical footprint integrates the Gaussian line over the output pixel height', () => {
  close(lineWeight(0, 0.5, 0), Math.sqrt(2 / Math.PI));
  close(lineWeight(1, 0.5, 0), (Math.exp(-2) * Math.sqrt(2)) / Math.sqrt(Math.PI));
  // Erf's 1.5e-7 approximation error bounds the agreement, not quadrature.
  for (const footprint of [0.002, 0.14, 0.28, 1, 3, 6]) {
    for (const distance of [-4, -1, -0.5, 0, 0.25, 0.8, 2.6]) {
      const boxAverage =
        integrate((at) => density(distance - at, 1 / 3), -footprint / 2, footprint / 2) / footprint;
      close(lineWeight(distance, 1 / 3, footprint), boxAverage, 1.5e-7 / footprint);
    }
  }
  // Below BOX_MINIMUM the point density is used; just above it, erf error
  // divided by the small footprint dominates the O(footprint^2) difference.
  close(lineWeight(0.2, 1 / 3, 5e-4), density(0.2, 1 / 3));
  close(lineWeight(0.2, 1 / 3, 5e-4), lineWeight(0.2, 1 / 3, 0.0011), 1.5e-7 / 0.0011);
  // Rows reach four sigma beyond the box, so the support grows with footprint.
  assert.deepEqual(lineRows(10.5, 1 / 3, 0), [9, 11]);
  assert.deepEqual(lineRows(10.5, 1 / 3, 6), [6, 14]);
  assert.deepEqual(lineRows(10.2, 1 / 3, 0.28), [9, 11]);
  const whiteCentre = Array.from({ length: 41 }, (_, index) => density(index - 20, 1 / 3)).reduce(
    (sum, value) => sum + value,
    0,
  );
  close(peakGain(1 / 3), 1 / whiteCentre);
});

test('horizontal footprint averages the interpolated samples over the output pixel width', () => {
  const data = [0.3, 1, 0.2, 0.7, 0, 0.9];
  // Independent linear interpolant, zero beyond the samples.
  const value = (at) => {
    const index = Math.floor(at),
      fraction = at - index,
      sample = (i) => (i >= 0 && i < data.length ? data[i] : 0);
    return sample(index) * (1 - fraction) + sample(index + 1) * fraction;
  };
  for (const width of [0.0011, 0.5, 1.6, 2, 7.3, 20])
    for (const centre of [-1.2, 0, 0.35, 2.5, 3.9, 6.4]) {
      const expected = integrateLinear(value, centre - width / 2, centre + width / 2) / width;
      close(boxSample(data, centre, width), expected, 1e-12);
    }
  // Point sampling below BOX_MINIMUM is linear interpolation.
  close(boxSample(data, 2.25, 0), 0.2 + 0.25 * 0.5);
  close(boxSample(data, 2.25, 5e-4), 0.2 + 0.25 * 0.5);
});

// Output pixels tile the screen, so their mean light times their source-unit
// area sums to the same beam energy at every output size. Point sampling
// fails this under minification. A negligible grille pitch makes the mask
// exactly 1/3; the picture sits inside the canvas with all tails.
test('output pixels conserve direct beam energy at every output size', () => {
  const flatMask = { ...monitor, grillePitchMm: 1e-6 };
  const inner = { picture: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } };
  for (const [sx, sy, channel] of [
    [3, 2, 0],
    [0, 5, 1],
  ]) {
    const frame = new Uint8ClampedArray(8 * 6 * 4);
    frame[(sy * 8 + sx) * 4 + channel] = 255;
    const ref = tubeReference(frame, source, flatMask);
    const totals = [];
    for (const [W, H] of [
      [512, 384],
      [96, 72],
      [16, 12],
      [8, 6],
      [4, 3],
      [3, 2],
    ]) {
      const area = (8 / (0.5 * W)) * (6 / (0.5 * H));
      let total = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) total += ref.pixel(inner, W, H, x, y)[channel] * area;
      totals.push(total);
    }
    // Rows end four sigma beyond each box; each omitted tail is below 3.2e-5.
    for (const total of totals) close(total, totals[0], 1e-4 * totals[0]);
    assert.ok(totals[0] > 0.01, `lit pixel energy ${totals[0]}`);
  }
});

test('halation dimensions convert mm through underscan and retain a zero-energy fallback', () => {
  const halo = halationKernel(source, monitor);
  close(halo.x, 0.6);
  close(halo.y, 0.8);
  assert.deepEqual(
    [halo.marginX, halo.marginY, halo.width, halo.height, halo.energy],
    [2, 3, 12, 12, 0],
  );
  const smallerRaster = halationKernel(source, { ...monitor, underscan: 0.5 });
  close(smallerRaster.x, 1.2);
  close(smallerRaster.y, 1.6);
  const noHalo = halationKernel(source, { ...monitor, halation: null });
  close(noHalo.x, 1);
  close(noHalo.y, 4 / 3);
  assert.equal(noHalo.energy, 0);
});

test('wide line comb normalization retains Gaussian energy beyond six rows', () => {
  const sigma = 3;
  let expected = 0;
  for (let n = -40; n <= 40; n++) expected += density(n, sigma);
  close(peakGain(sigma) * expected, 1, 1e-8);
});

// Independent spatial integral of the held impulse, without production erf,
// lineVoltage or kernel helpers. This checks nonlinear stage order and sample
// centres, not just equality between the JS reference and the GPU shader.
const voltageSigma = (Math.sqrt(Math.LN2) / (2 * Math.PI * 2e6)) * 1e6;
const voltage = (x) => integrate((at) => density(x - at, voltageSigma), 3, 4);
const spotTotal = Array.from({ length: 13 }, (_, i) => Math.exp(-((i - 6) ** 2) / 8)).reduce(
  (sum, value) => sum + value,
  0,
);
function spreadSample(index, nonlinearFirst) {
  let sum = 0;
  for (let offset = -6; offset <= 6; offset++) {
    const v = voltage((index + offset + 0.5) / 8 - 2);
    sum += (Math.exp(-(offset ** 2) / 8) / spotTotal) * (nonlinearFirst ? v ** 2 : v);
  }
  return sum;
}

test('held voltage is squared before spot spreading and then averaged over output pixels', () => {
  const frame = new Uint8ClampedArray(8 * 6 * 4);
  frame[(2 * 8 + 3) * 4] = 255;
  const ref = tubeReference(frame, source, monitor);
  const gain =
    1 /
    Array.from({ length: 41 }, (_, i) => density(i - 20, 1 / 3)).reduce(
      (sum, value) => sum + value,
      0,
    );
  for (const x of [50, 63, 77]) {
    const sx = ((x + 0.5) * 8) / 128;
    const sample = (sx + 2) * 8 - 0.5;
    const index = Math.floor(sample),
      fraction = sample - index;
    // Output pixels are 1/16 source pixel (half a sample) wide, 1/16 line high.
    const interpolated = (at) => {
      const left = Math.floor(at);
      return (
        spreadSample(left, true) * (left + 1 - at) + spreadSample(left + 1, true) * (at - left)
      );
    };
    const spread = integrate(
      (at) => interpolated(sample + 0.5 * at) * grille(0, x + 0.5 + at, 6.4),
      -0.5,
      0.5,
    );
    const distance = (39.5 * 6) / 96 - 2.5;
    const vertical = integrate((at) => density(distance - at, 1 / 3), -1 / 32, 1 / 32) * 16;
    const expected = gain * vertical * spread;
    const actual = ref.pixel(layout, 128, 96, x, 39);
    close(actual[0], expected, 3e-7);
    close(actual[1], 0);
    close(actual[2], 0);
    if (x === 63) {
      const voltageSpread =
        spreadSample(index, false) * (1 - fraction) + spreadSample(index + 1, false) * fraction;
      assert.ok(
        Math.abs(expected - gain * vertical * voltageSpread ** 2 * grille(0, x + 0.5, 6.4)) > 0.005,
      );
    }
  }
});

test('halation adds light linearly, reaches the border and stays isolated between frames', () => {
  const frame = new Uint8ClampedArray(8 * 6 * 4);
  frame[2 * 8 * 4] = 255;
  const atEnergy = (energy) =>
    tubeReference(frame, source, { ...monitor, halation: { sigmaMm: 0.6, energy } });
  const bare = atEnergy(0),
    one = atEnergy(0.1),
    two = atEnergy(0.2);
  for (const [x, y] of [
    [0, 39],
    [-8, 39],
    [10, 20],
  ]) {
    const direct = bare.pixel(layout, 128, 96, x, y)[0];
    const withOne = one.pixel(layout, 128, 96, x, y)[0];
    const withTwo = two.pixel(layout, 128, 96, x, y)[0];
    assert.ok(withOne > direct);
    close(withTwo - direct, 2 * (withOne - direct));
  }
  const result = one.pixel(layout, 128, 96, 0, 39);
  const original = [...result];
  result[0] = 99;
  const black = tubeReference(new Uint8ClampedArray(frame.length), source, monitor);
  assert.deepEqual(black.pixel(layout, 128, 96, 0, 39), [0, 0, 0]);
  assert.deepEqual(one.pixel(layout, 128, 96, 0, 39), original);
});
