import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';
import { testTempDir } from './temp-dir.mjs';
import { probeCrtShaders } from './crt-shader-probe.mjs';
import * as shaders from '../src/crt/shaders.mjs';
import { heldCircuitVoltage } from './crt-video-oracle.mjs';

// These expectations use spatial quadrature and known rational coefficients,
// not production signal/beam/screen helpers or the full renderer reference.
const density = (distance, sigma) =>
  Math.exp(-0.5 * (distance / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
function integrate(fn, from, to, steps = 512) {
  const step = (to - from) / steps;
  let sum = fn(from) + fn(to);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * fn(from + i * step);
  return (sum * step) / 3;
}
const rgba = (width, height, pixel) =>
  Array.from({ length: width * height }, (_, i) => [
    ...pixel(i % width, Math.floor(i / width)),
    1,
  ]).flat();
const fixtures = [];

const plainBytes = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];
for (const picture of [
  [0, 0, 1, 1],
  [0.25, 0.25, 0.5, 0.5],
]) {
  fixtures.push({
    name: `plain orientation, nearest pixels and picture ${picture}`,
    shader: 'PLAIN',
    width: 4,
    height: 4,
    uniforms: { size: [2, 2], picture },
    textures: [{ name: 'frame', width: 2, height: 2, bytes: plainBytes }],
    expected: (x, y) => {
      const u = ((x + 0.5) / 4 - picture[0]) / picture[2];
      const v = (1 - (y + 0.5) / 4 - picture[1]) / picture[3];
      if (u < 0 || v < 0 || u >= 1 || v >= 1) return [0, 0, 0];
      const at = (Math.floor(v * 2) * 2 + Math.floor(u * 2)) * 4;
      return plainBytes.slice(at, at + 3).map((value) => value / 255);
    },
  });
}

const levels = [
  [0, 16, 31],
  [31, 3, 0],
  [7, 27, 8],
  [12, 31, 2],
  [25, 0, 31],
  [31, 11, 19],
];
for (const [
  name,
  width,
  height,
  data,
  sigma,
  brightness,
  contrast,
  reach,
  sourceGain = 1,
  sourceTau = 0,
] of [
  ['neutral', 3, 2, levels, 0.17, 0, 1, 3],
  ['adjusted', 3, 2, levels, 0.65, 0.1, 1.7, 4],
  // Independent stock PAL values: 0.8 V DAC, 6.5 dB S-RGB, 39 ohms,
  // 47 pF, 75 || 75 ohms; receiver white is 0.7 V. Test the actual tiny
  // time constant and a wider RC that exposes an incorrect convolution.
  [
    'stock PAL 1CHIP',
    3,
    2,
    levels,
    ((21281370 / 4) * Math.sqrt(Math.LN2)) / (2 * Math.PI * 1e7),
    0,
    1,
    3,
    (0.8 * 10 ** (6.5 / 20) * 37.5) / (76.5 * 0.7),
    ((39 * 37.5) / 76.5) * 47e-12 * (21281370 / 4),
  ],
  ['causal RC with controls', 3, 2, levels, 0.2, 0.08, 1.7, 12, 1.18, 0.5],
  ['finite seven-pixel support', 9, 1, Array.from({ length: 9 }, () => [31, 31, 31]), 2, 0, 1, 3],
  [
    'wide response',
    17,
    1,
    Array.from({ length: 17 }, (_, i) => [31, i % 2 ? 31 : 0, i]),
    2,
    0.1,
    1.2,
    12,
  ],
]) {
  fixtures.push({
    name: `light held-level quadrature, ${name}`,
    shader: 'LIGHT',
    width: (width + 4) * 8,
    height,
    uniforms: {
      size: [width, height],
      sigma,
      reach,
      brightness,
      contrast,
      sourceGain,
      sourceTau,
      gamma: 2.25,
      oversample: 8,
      margin: 2,
      levelDivisor: 8,
      levelSteps: 31,
    },
    textures: [
      {
        name: 'frame',
        width,
        height,
        bytes: data.flatMap((rgb) => [...rgb.map((v) => (v << 3) | (v >> 2)), 255]),
      },
    ],
    expected: (column, row) => {
      const x = (column + 0.5) / 8 - 2;
      const first = Math.floor(x) - reach;
      const held = (from, to) =>
        sourceTau
          ? heldCircuitVoltage(from, to, x, sigma, sourceTau)
          : integrate((at) => density(x - at, sigma), from, to);
      const coverage = held(0, width);
      return [0, 1, 2].map((channel) => {
        let voltage = 0;
        for (
          let pixel = Math.max(0, first);
          pixel < Math.min(width, first + 2 * reach + 1);
          pixel++
        ) {
          voltage += (data[row * width + pixel][channel] / 31) * held(pixel, pixel + 1);
        }
        return contrast * Math.max(sourceGain * voltage + brightness * coverage, 0) ** 2.25;
      });
    },
    aboveOne: name === 'adjusted' || sourceGain > 1,
  });
}

const kernelIntegers = [1, 32, 256, 512, 256, 32, 1];
const kernel = (distance) => (Math.abs(distance) <= 3 ? kernelIntegers[distance + 3] / 1090 : 0);
const kernelSigma = 1 / Math.sqrt(2 * Math.LN2);
for (const impulse of [0, 2]) {
  fixtures.push({
    name: `spot rational impulse at ${impulse}, full-support normalization`,
    shader: 'SPOT',
    width: 5,
    height: 1,
    uniforms: { sigma: kernelSigma, reach: 3 },
    textures: [
      {
        name: 'light',
        width: 5,
        height: 1,
        floats: rgba(5, 1, (x) => (x === impulse ? [1, 2, 4] : [0, 0, 0])),
      },
    ],
    expected: (x) => [1, 2, 4].map((value) => value * kernel(x - impulse)),
  });
}

fixtures.push({
  name: 'halo base averages only source columns and pads both axes with zero',
  shader: 'HALO_BASE',
  width: 4,
  height: 4,
  uniforms: { size: [2, 2], haloMargin: [1, 1], oversample: 8, margin: 2 },
  textures: [
    {
      name: 'light',
      width: 48,
      height: 2,
      floats: rgba(48, 2, (x, y) => [x + 100 * y, 2 * x + y, 0]),
    },
  ],
  expected: (x, y) =>
    x >= 1 && x <= 2 && y >= 1 && y <= 2
      ? [19.5 + (x - 1) * 8 + (y - 1) * 100, 39 + (x - 1) * 16 + y - 1, 0]
      : [0, 0, 0],
});

for (const direction of [
  [1, 0],
  [0, 1],
]) {
  fixtures.push({
    name: `halo blur rational weights along ${direction}, zero outside image`,
    shader: 'HALO_BLUR',
    width: 3,
    height: 3,
    uniforms: { sigma: kernelSigma, reach: 3, direction },
    textures: [
      {
        name: 'image',
        width: 3,
        height: 3,
        floats: rgba(3, 3, (x, y) => (x === 1 && y === 1 ? [1, 2, 4] : [0, 0, 0])),
      },
    ],
    expected: (x, y) => {
      const onAxis = direction[0] ? y === 1 : x === 1;
      const weight = onAxis ? kernel((direction[0] ? x : y) - 1) : 0;
      return [1, 2, 4].map((value) => value * weight);
    },
  });
}

function spatialGrille(channel, x, pitch = 3) {
  let sum = 0;
  for (let period = -4; period <= 5; period++) {
    const start = period * pitch + (channel * pitch) / 3;
    sum += integrate((at) => density(x - at, 0.8), start, start + pitch / 3);
  }
  return sum;
}

// Independent geometric construction: iterate the depth where a view ray
// meets the circular front, rather than using the renderer's quadratic root.
function cylindricalPoint(u, v) {
  const r = 1100 / 384,
    d = 600 / 384;
  let depth = 0;
  for (let i = 0; i < 24; i++) {
    const x = (u - 0.5) * (1 + depth / d);
    depth = r - Math.sqrt(r * r - x * x);
  }
  const scale = 1 + depth / d;
  return { x: 0.5 + (u - 0.5) * scale, y: 0.5 + (v - 0.5) * scale };
}
const redX = [0.1, 0.08, 0.04, 0.03],
  redY = [-0.05, 0.02, 0.06, -0.04];
const blueX = [-0.06, -0.04, 0.05, -0.02],
  blueY = [0.08, -0.03, -0.04, 0.01];
const field = (coefficients, u, v) =>
  coefficients[0] + coefficients[1] * u + coefficients[2] * v + coefficients[3] * u * v;
const encode = (value) => {
  value = Math.min(1, Math.max(0, value));
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
};
for (const [haloEnergy, gain, wireWidth, footprint = [0.3, 0.4], curved = false] of [
  [0, 1.7, 0.2],
  [0.2, 8, 0.2],
  [0.2, 1.7, 2.4],
  [0, 1.7, 0.2, [5e-5, 5e-5]],
  [0.2, 1.7, 0.2, [0.3, 0.4], true],
]) {
  fixtures.push({
    name: `beam product integral, centre convergence, halo ${haloEnergy}, wire width ${wireWidth}, footprint ${footprint}, curved ${curved}`,
    shader: 'BEAM',
    width: 4,
    height: 4,
    uniforms: {
      picture: [0, 0, 1, 1],
      size: [1, 1],
      screenMm: [4, 3],
      haloMargin: [1, 1],
      sigma: 0.5,
      // Nonuniform linear light must be integrated with the mask, not apart.
      footprint,
      curvature: curved ? [1100 / 384, 600 / 384] : [0, 0],
      outputSize: [4, 4],
      gain,
      oversample: 8,
      margin: 2,
      pitch: 3,
      antialias: 0.8,
      haloEnergy,
      // GLSL's column-major upload represents rows [1,.1,0], [0,1,.2], [-.6,0,1].
      colour: [1, 0, -0.6, 0.1, 1, 0, 0, 0.2, 1],
      redX,
      redY,
      blueX,
      blueY,
      wires: [0.25, 0.75, wireWidth, 4],
    },
    textures: [
      {
        name: 'spread',
        width: 40,
        height: 1,
        floats: rgba(40, 1, (x) => [0.2 + 0.01 * x, 0.4 + 0.005 * x, 0.3 + 0.008 * x]),
      },
      { name: 'halo', width: 3, height: 3, floats: rgba(3, 3, () => [0.25, 0.5, 1]) },
    ],
    expected: (x, y) => {
      let u = (x + 0.5) / 4,
        v = 1 - (y + 0.5) / 4;
      let scaleX = 1,
        scaleY = 1;
      if (curved) {
        const step = 1e-5;
        scaleX = (cylindricalPoint(u + step, v).x - cylindricalPoint(u - step, v).x) / (2 * step);
        scaleY = (cylindricalPoint(u, v + step).y - cylindricalPoint(u, v - step).y) / (2 * step);
        const point = cylindricalPoint(u, v);
        u = point.x;
        v = point.y;
      }
      const localFootprint = [footprint[0] * scaleX, footprint[1] * scaleY];
      const screenX = (u * 4) / scaleX,
        screenHeight = 4 / scaleY;
      const uv = [2 * u - 1, 2 * v - 1];
      const light = [0, 1, 2].map((channel) => {
        const dx = channel === 0 ? field(redX, ...uv) : channel === 2 ? field(blueX, ...uv) : 0;
        const dy = channel === 0 ? field(redY, ...uv) : channel === 2 ? field(blueY, ...uv) : 0;
        const sample = (u - dx / 4 + 2) * 8 - 0.5;
        const along = integrate(
          (at) =>
            ([0.2, 0.4, 0.3][channel] +
              [0.01, 0.005, 0.008][channel] *
                (sample + (localFootprint[0] * 8 < 0.001 ? 0 : localFootprint[0] * 8 * at))) *
            spatialGrille(channel, screenX + at, 3 / scaleX),
          -0.5,
          0.5,
          64,
        );
        const vertical = integrate(
          (at) => {
            const shadow = Math.min(
              1,
              (wireWidth / scaleY) *
                (density((v - 0.25) * screenHeight + at, 0.8) +
                  density((v - 0.75) * screenHeight + at, 0.8)),
            );
            return (
              density(
                v - dy / 3 - 0.5 + (localFootprint[1] < 0.001 ? 0 : localFootprint[1] * at),
                0.5,
              ) *
              (1 - shadow)
            );
          },
          -0.5,
          0.5,
        );
        const direct = along * vertical;
        return gain * (direct + (haloEnergy * [0.25, 0.5, 1][channel]) / 3);
      });
      return [light[0] + 0.1 * light[1], light[1] + 0.2 * light[2], -0.6 * light[0] + light[2]].map(
        encode,
      );
    },
  });
}

// Strong minification on both axes: each output pixel covers 1.5 source
// pixels (three samples) and four raster lines. Expectations integrate the
// sample interpolant exactly per linear piece and the Gaussian numerically.
const minified = (x, row, channel) =>
  [0.05, 0.1, 0.15][channel] + 0.06 * ((x * 3 + row * 5 + channel * 2) % 7);
const interpolant = (row, channel) => (at) => {
  const left = Math.floor(at),
    sample = (i) => (i >= 0 && i < 10 ? minified(i, row, channel) : 0);
  return sample(left) * (left + 1 - at) + sample(left + 1) * (at - left);
};
function integrateLinear(fn, from, to) {
  let sum = 0;
  for (let start = from; start < to;) {
    const end = Math.min(to, Math.floor(start) + 1);
    sum += ((end - start) * (fn(start) + 4 * fn((start + end) / 2) + fn(end))) / 6;
    start = end;
  }
  return sum;
}
fixtures.push({
  name: 'beam output-area integration under strong minification',
  shader: 'BEAM',
  width: 2,
  height: 2,
  uniforms: {
    picture: [0, 0, 1, 1],
    size: [3, 8],
    screenMm: [4, 3],
    haloMargin: [0, 0],
    sigma: 0.5,
    footprint: [1.5, 4],
    gain: 1,
    oversample: 2,
    margin: 1,
    // A negligible pitch leaves only the mean grille transmission 1/3.
    pitch: 0.01,
    antialias: 0.8,
    haloEnergy: 0,
    colour: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    redX: [0, 0, 0, 0],
    redY: [0, 0, 0, 0],
    blueX: [0, 0, 0, 0],
    blueY: [0, 0, 0, 0],
    wires: [0.25, 0.75, 0, 2],
  },
  textures: [
    {
      name: 'spread',
      width: 10,
      height: 8,
      floats: rgba(10, 8, (x, row) => [0, 1, 2].map((channel) => minified(x, row, channel))),
    },
    { name: 'halo', width: 1, height: 1, floats: [0, 0, 0, 1] },
  ],
  expected: (x, y) => {
    // Pixel centre in source pixels and lines; rows are read from the bottom.
    const sx = ((x + 0.5) / 2) * 3,
      line = (1 - (y + 0.5) / 2) * 8;
    const centre = (sx + 1) * 2 - 0.5;
    return [0, 1, 2].map((channel) => {
      let sum = 0;
      for (let row = 0; row < 8; row++) {
        const vertical = integrate((at) => density(line - row - 0.5 - at, 0.5), -2, 2) / 4;
        const horizontal =
          integrateLinear(interpolant(row, channel), centre - 1.5, centre + 1.5) / 3;
        sum += vertical * horizontal;
      }
      return encode(sum / 3);
    });
  },
});

// A halo impulse crosses interpolation kinks and zero borders on both axes.
// Integral of each unit tent is computed with independent piecewise Simpson.
for (const footprint of [
  [0.5, 0.5],
  [4, 3],
]) {
  fixtures.push({
    name: `halo area mean with zero borders and footprint ${footprint}`,
    shader: 'BEAM',
    width: 3,
    height: 2,
    uniforms: {
      picture: [0, 0, 1, 1],
      size: [3, 2],
      screenMm: [4, 3],
      haloMargin: [0, 0],
      sigma: 0.5,
      footprint,
      gain: 1,
      oversample: 2,
      margin: 1,
      pitch: 3,
      antialias: 0.8,
      haloEnergy: 0.6,
      colour: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      redX: [0, 0, 0, 0],
      redY: [0, 0, 0, 0],
      blueX: [0, 0, 0, 0],
      blueY: [0, 0, 0, 0],
      wires: [0.25, 0.75, 2.4, 2],
    },
    textures: [
      { name: 'spread', width: 10, height: 2, floats: rgba(10, 2, () => [0, 0, 0]) },
      {
        name: 'halo',
        width: 3,
        height: 2,
        floats: rgba(3, 2, (x, y) => (x === 1 && y === 0 ? [1, 0.5, 0.25] : [0, 0, 0])),
      },
    ],
    expected: (x, y) => {
      const tentMean = (centre, width) =>
        integrateLinear(
          (t) => Math.max(0, 1 - Math.abs(t)),
          centre - width / 2,
          centre + width / 2,
        ) / width;
      const mean = tentMean(x - 1, footprint[0]) * tentMean(1 - y, footprint[1]);
      return [1, 0.5, 0.25].map((value) => encode(0.2 * value * mean));
    },
  });
}

const edge = findEdge();
for (const [width, height] of [
  [20, 8],
  [3, 100],
  [20, 100],
]) {
  fixtures.push({
    name: `beam covers the complete ${width} by ${height} source in one output pixel`,
    shader: 'BEAM',
    width: 1,
    height: 1,
    uniforms: {
      picture: [0, 0, 1, 1],
      size: [width, height],
      screenMm: [4, 3],
      haloMargin: [0, 0],
      sigma: 0.5,
      footprint: [width, height],
      gain: 1,
      oversample: 8,
      margin: 2,
      pitch: 0.01,
      antialias: 0.8,
      haloEnergy: 0,
      colour: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      redX: [0, 0, 0, 0],
      redY: [0, 0, 0, 0],
      blueX: [0, 0, 0, 0],
      blueY: [0, 0, 0, 0],
      wires: [0.25, 0.75, 0, 1],
    },
    textures: [
      {
        name: 'spread',
        width: (width + 4) * 8,
        height,
        floats: rgba((width + 4) * 8, height, () => [0.2, 0.4, 0.6]),
      },
      { name: 'halo', width: 1, height: 1, floats: [0, 0, 0, 1] },
    ],
    expected: () => {
      let area = 0;
      for (let row = 0; row < height; row++)
        area += integrate((at) => density(at - row - 0.5, 0.5), 0, height) / height;
      return [0.2, 0.4, 0.6].map((light) => encode((light * area) / 3));
    },
  });
}
test(
  'isolated CRT shader passes agree with independent spatial expectations',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async (context) => {
    // A minimal fixture avoids compiling/running the product CRT before the
    // isolated probes. The marker satisfies the shared browser helper's ready
    // check. Keep the fixture and per-case checkpoint with the browser logs.
    const root = await testTempDir(context, 'snes-crt-shader-page-');
    await writeFile(join(root, 'index.html'), '<!doctype html><button id="start">Probe</button>');
    // Closing Edge can drop its acknowledgement; bound that browser command
    // below the test deadline, as for the other CRT browser checks.
    await withStartPage({ exe: edge, root, commandTimeout: 30000 }, async ({ evalJs, logDir }) => {
      for (const fixture of fixtures) {
        await writeFile(join(logDir, 'shader-checkpoint.txt'), fixture.name);
        const sources = { VERTEX: shaders.VERTEX, [fixture.shader]: shaders[fixture.shader] };
        const [actual] = await evalJs(
          `(${probeCrtShaders.toString()})(${JSON.stringify([fixture])}, ${JSON.stringify(sources)})`,
        );
        await context.test(fixture.name, () => {
          assert.equal(actual.name, fixture.name);
          let maxDifference = 0;
          for (let y = 0; y < fixture.height; y++)
            for (let x = 0; x < fixture.width; x++) {
              const at = (y * fixture.width + x) * 4;
              const expected = fixture.expected(x, y);
              for (let channel = 0; channel < 3; channel++) {
                const difference = Math.abs(actual.pixels[at + channel] - expected[channel]);
                assert.ok(Number.isFinite(difference), `${fixture.name}: nonfinite output`);
                maxDifference = Math.max(maxDifference, difference);
              }
              assert.equal(actual.pixels[at + 3], 1);
            }
          assert.ok(maxDifference < 2e-5, `${fixture.name}: max error ${maxDifference}`);
          if (fixture.aboveOne)
            assert.ok(
              actual.pixels.some((value) => value > 1),
              'linear light must survive above reference white',
            );
        });
      }
      await writeFile(join(logDir, 'shader-checkpoint.txt'), 'All shader probes completed.');
    });
  },
);
