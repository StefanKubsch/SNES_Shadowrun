import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandwidthSigma,
  controlledLight,
  erf,
  levelVoltage,
  lineVoltage,
  pictureCoverage,
  srgbEncode,
  tubeLight,
} from '../src/crt/signal.mjs';
import { DEFAULT_CONTROLS, normalizeControls, parseControls } from '../src/crt/controls.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';
import {
  halationKernel,
  lineWeight,
  peakGain,
  spotSigma,
  spotWeights,
  tubeReference,
} from '../src/crt/beam.mjs';
import {
  convergenceMm,
  grille,
  pitchPixels,
  screenHeightMm,
  wireShadow,
} from '../src/crt/screen.mjs';
import { DISPLAY_P3, SRGB, applyMatrix, phosphorToOutput, rgbToXyz } from '../src/crt/colour.mjs';

// CRT signal path (docs/CRT-FILTER.md, stage 2).
const close = (actual, expected, limit, what) =>
  assert.ok(Math.abs(actual - expected) <= limit, `${what}: ${actual} != ${expected}`);
test('the DAC sees the 5-bit level the PPU stored as v<<3|v>>2', () => {
  for (let v = 0; v < 32; v++)
    close(levelVoltage((v << 3) | (v >> 2), 5), v / 31, 1e-12, 'level ' + v);
  assert.equal(levelVoltage(200), 200 / 255);
});
test('the 10 MHz monitor bandwidth softens a pixel edge by about 34 ns', () => {
  close(erf(0.5), 0.5204998778, 2e-7, 'erf');
  const sigma = bandwidthSigma(SNES_PAL_RGB, SONY_PVM_20M2E),
    pixelNs = 4 / 21.28137e-3;
  close(sigma * pixelNs, 1e9 / ((2 * Math.PI * 10e6) / Math.sqrt(Math.LN2)), 1e-9, 'sigma in ns');
  // Gain at 10 MHz is -3 dB: exp(-f²/2σf²) = 1/√2.
  const sigmaF = 1 / ((2 * Math.PI * sigma) / SNES_PAL_RGB.dotClockHz);
  close(Math.exp(-(10e6 ** 2) / (2 * sigmaF ** 2)), Math.SQRT1_2, 1e-12, '-3 dB');
  // Step from black to full level at pixel 0: 10 % to 90 % rise.
  const step = (i) => (i >= 0 ? 1 : 0),
    find = (level) => {
      let lo = -1,
        hi = 1;
      for (let n = 0; n < 60; n++) {
        const mid = (lo + hi) / 2;
        if (lineVoltage(step, mid, sigma) < level) lo = mid;
        else hi = mid;
      }
      return lo;
    };
  close((find(0.9) - find(0.1)) * pixelNs, 34.0, 0.5, 'rise time ns');
  // A flat field keeps its level; the picture edge falls to blanking.
  close(
    lineVoltage(() => 0.6, 100.3, sigma),
    0.6,
    1e-6,
    'flat',
  );
  close(
    lineVoltage((i) => (i >= 0 && i < 256 ? 1 : 0), -0.5, sigma),
    0,
    1e-6,
    'blanking',
  );
});
test('the tube follows the measured gamma 2.25 and the page encodes sRGB', () => {
  assert.equal(SONY_PVM_20M2E.gamma, 2.25);
  close(tubeLight(0.5, 2.25), 0.5 ** 2.25, 1e-15, 'mid level');
  assert.equal(tubeLight(-0.1, 2.4), 0);
  assert.equal(srgbEncode(0), 0);
  close(srgbEncode(1), 1, 1e-12, 'white');
  // Level 16 of 31 comes out darker than its plain 8-bit value 132.
  assert.equal(
    Math.round(srgbEncode(tubeLight(16 / 31, 2.25)) * 255),
    Math.round(255 * (1.055 * Math.pow((16 / 31) ** 2.25, 1 / 2.4) - 0.055)),
  );
  assert.ok(Math.round(srgbEncode(tubeLight(16 / 31, 2.25)) * 255) < 132);
});
test('monitor brightness lifts black before the gun curve; contrast scales emitted light', () => {
  const gamma = SONY_PVM_20M2E.gamma;
  for (const v of [0, 1 / 31, 0.5, 1])
    assert.equal(
      controlledLight(v, gamma),
      tubeLight(v, gamma),
      'neutral controls preserve the old output',
    );
  close(
    controlledLight(0, gamma, { brightness: 0.1, contrast: 1 }),
    0.1 ** gamma,
    1e-15,
    'lifted black',
  );
  assert.equal(
    controlledLight(1 / 31, gamma, { brightness: -0.05, contrast: 1 }),
    0,
    'below cutoff',
  );
  for (const v of [0, 0.25, 0.5, 1])
    close(
      controlledLight(v, gamma, { brightness: 0, contrast: 2 }),
      2 * v ** gamma,
      1e-15,
      'gain about black',
    );
  close(
    controlledLight(0.5, gamma, { brightness: 0.1, contrast: 1.5 }),
    1.5 * 0.6 ** gamma,
    1e-15,
    'combined controls',
  );
  assert.ok(
    controlledLight(1, gamma, { brightness: 0, contrast: 2 }) > 1,
    'no premature clipping before grille and halation',
  );
  assert.equal(controlledLight(1, gamma, { brightness: 0.1, contrast: 0 }), 0, 'zero drive');
  const sigma = bandwidthSigma(SNES_PAL_RGB, SONY_PVM_20M2E);
  close(pictureCoverage(0, 256, sigma), 0.5, 1e-7, 'bias follows filtered picture edge');
  assert.equal(
    controlledLight(0, gamma, { brightness: 0.1, contrast: 1 }, pictureCoverage(-2, 256, sigma)),
    0,
    'blanking stays black',
  );
});
test('stored controls reject invalid values, clamp limits and keep defaults', () => {
  for (const value of [null, 'broken', 'null', '[]', '"text"'])
    assert.deepEqual(parseControls(value), DEFAULT_CONTROLS);
  assert.deepEqual(normalizeControls({ brightness: NaN, contrast: Infinity }), DEFAULT_CONTROLS);
  assert.deepEqual(parseControls('{"brightness":"0.05","contrast":false}'), DEFAULT_CONTROLS);
  assert.deepEqual(normalizeControls({ brightness: 9, contrast: -3 }), {
    brightness: 0.1,
    contrast: 0,
  });
  assert.deepEqual(normalizeControls({ brightness: -9, contrast: 3 }), {
    brightness: -0.1,
    contrast: 2,
  });
  assert.deepEqual(parseControls('{"brightness":0.04,"contrast":1.3}'), {
    brightness: 0.04,
    contrast: 1.3,
  });
});
// Beam (stage 3): 600 TV lines are 300 periods per picture height, 7.69 MHz
// along the line, where the low-pass retains 0.815. At 5% residual contrast,
// the spot has sigma 0.361 line spacings (0.260 pixels).
test('the beam spot follows from 600 TV lines and draws scanlines', () => {
  const spot = spotSigma(SNES_PAL_RGB, SONY_PVM_20M2E),
    f = 300,
    electronics = Math.exp(-(((f * 4) / 3 / 52e-6) ** 2) / (2 * (10e6 / Math.sqrt(Math.LN2)) ** 2));
  close(electronics, 0.815, 5e-4, 'electronics at 600 TVL');
  close(
    Math.exp(-2 * Math.PI ** 2 * (spot.lines / 288) ** 2 * f * f) * electronics,
    0.05,
    1e-12,
    'contrast at 600 TVL',
  );
  assert.deepEqual([spot.lines.toFixed(3), spot.pixels.toFixed(3)], ['0.361', '0.260']);
  // Ideal source white: line centre 1, between two lines about 74 %.
  // The beam alone: no halation, damper wires or convergence error.
  const bare = {
    ...SONY_PVM_20M2E,
    halation: { sigmaMm: 10, energy: 0 },
    damperWires: null,
    convergence: null,
  };
  const white = new Uint8ClampedArray(256 * 224 * 4).fill(255),
    ref = tubeReference(white, { ...SNES_PAL_RGB, rgbOutput: null }, bare);
  const layout = { picture: { x: 0, y: 0, width: 1, height: 1 } },
    H = 224 * 16,
    W = 256 * 16;
  // Grey is R=G=B in every output space; one grille stripe pattern divides out.
  const centre = ref.pixel(layout, W, H, W / 2, 100 * 16 + 7),
    gap = ref.pixel(layout, W, H, W / 2, 100 * 16 - 1),
    mean = (x) => {
      let s = 0;
      for (let i = 0; i < 64; i++) s += ref.pixel(layout, W, H, x + i, 100 * 16 + 7)[1];
      return s / 64;
    };
  close(mean(W / 2) * 3, 1, 0.02, 'line centre behind the grille');
  close(gap[1] / centre[1], 0.735, 0.01, 'between lines');
  // The spot weights sum to one and reach three sigma.
  const { reach, weights } = spotWeights(spot.pixels * 8);
  assert.equal(reach, Math.ceil(3 * spot.pixels * 8));
  close(
    weights.reduce((a, b) => a + b),
    1,
    1e-12,
    'weights',
  );
  close(
    1 / peakGain(spot.lines),
    [...Array(13)].reduce((s, _, i) => s + lineWeight(i - 6, spot.lines, 0), 0),
    1e-12,
    'gain',
  );
});
// Screen (stage 4): 0.4 mm grille pitch across 384 mm width.
test('the aperture grille shows its stripes where the pixels carry them and averages a third', () => {
  const at4k = pitchPixels(SONY_PVM_20M2E, 2880),
    at1080 = pitchPixels(SONY_PVM_20M2E, 1440);
  assert.deepEqual([at4k.toFixed(2), at1080.toFixed(2)], ['3.00', '1.50']);
  for (const pitch of [at4k, at1080, 12]) {
    let mean = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) mean += grille(1, (i * pitch) / n, pitch) / n;
    close(mean, 1 / 3, 1e-6, 'mean ' + pitch);
  }
  // 4K: about three pixels per triad; green is brighter on its own stripe than on red's.
  assert.ok(grille(1, at4k * 0.5, at4k) > 0.45 && grille(1, at4k / 6, at4k) < 0.3, '4K stripes');
  // 1080p: no stripe fits, the grille acts as an even third (no moiré).
  for (let x = 0; x < 10; x += 0.37) close(grille(0, x, at1080), 1 / 3, 0.003, '1080p flat');
  // Wide stripes: close to a rectangle, never negative light.
  close(grille(0, 2, 12), 1, 0.1, 'red centre');
  close(grille(0, 6, 12), 0, 0.1, 'green centre');
  for (const pitch of [1.5, 2, 2.98, 4.27, 12])
    for (let x = 0; x < pitch; x += 0.05)
      assert.ok(grille(0, x, pitch) >= -1e-6, 'no negative light ' + pitch + ' ' + x);
});
// Colour: measured P-22 primaries of a PVM-20M2U (Raney), balanced to D65,
// in sRGB or Display P3.
test('the measured P-22 phosphors map to the output space with D65 white', () => {
  assert.deepEqual(SONY_PVM_20M2E.phosphor, {
    name: 'P-22',
    red: [0.63, 0.345],
    green: [0.285, 0.605],
    blue: [0.15, 0.065],
  });
  const srgb = rgbToXyz(SRGB);
  [0.4124, 0.3576, 0.1805, 0.2126, 0.7152, 0.0722, 0.0193, 0.1192, 0.9505].forEach((v, i) =>
    close(srgb[i], v, 1e-4, 'sRGB matrix ' + i),
  );
  for (const output of [SRGB, DISPLAY_P3]) {
    const m = phosphorToOutput(SONY_PVM_20M2E.phosphor, SONY_PVM_20M2E.white, output);
    applyMatrix(m, [1, 1, 1]).forEach((v) => close(v, 1, 1e-12, 'white ' + output.name));
    // Each phosphor alone lands on its measured chromaticity.
    const back = rgbToXyz(output);
    for (const [c, name] of [
      [0, 'red'],
      [1, 'green'],
      [2, 'blue'],
    ]) {
      const xyz = applyMatrix(
          back,
          applyMatrix(
            m,
            [0, 1, 2].map((i) => (i === c ? 1 : 0)),
          ),
        ),
        sum = xyz[0] + xyz[1] + xyz[2];
      close(xyz[0] / sum, SONY_PVM_20M2E.phosphor[name][0], 1e-12, name + ' x');
      close(xyz[1] / sum, SONY_PVM_20M2E.phosphor[name][1], 1e-12, name + ' y');
    }
  }
  // P-22 red is slightly beyond sRGB red, inside Display P3.
  assert.ok(phosphorToOutput(SONY_PVM_20M2E.phosphor, SONY_PVM_20M2E.white, SRGB)[1] < 0);
  assert.ok(
    phosphorToOutput(SONY_PVM_20M2E.phosphor, SONY_PVM_20M2E.white, DISPLAY_P3).every(
      (v) => v > -0.01,
    ),
  );
});
// Halation, damper wires, convergence (approximations, profiles.mjs, CRT-FILTER.md).
test('halation spreads a few percent of the light about 10 mm into the dark', () => {
  const k = halationKernel(SNES_PAL_RGB, SONY_PVM_20M2E);
  // 10 mm are about 7.6 source pixels and 10.5 lines; the margin holds three sigma.
  assert.deepEqual(
    [k.x.toFixed(2), k.y.toFixed(2), k.marginX, k.marginY, k.energy],
    ['7.58', '10.53', 23, 32, 0.05],
  );
  // A white block in the middle of a black frame lights the black around it, falling with distance.
  const frame = new Uint8ClampedArray(256 * 224 * 4);
  for (let y = 100; y < 124; y++)
    for (let x = 116; x < 140; x++) frame.fill(255, (y * 256 + x) * 4, (y * 256 + x) * 4 + 3);
  const ref = tubeReference(frame, SNES_PAL_RGB, SONY_PVM_20M2E),
    layout = { picture: { x: 0, y: 0, width: 1, height: 1 } },
    W = 256 * 4,
    H = 224 * 4;
  const near = ref.pixel(layout, W, H, 128 * 4, 96 * 4)[1],
    far = ref.pixel(layout, W, H, 128 * 4, 70 * 4)[1],
    none = ref.pixel(layout, W, H, 10, 10)[1];
  assert.ok(near > far && far > 0 && none < 1e-6, `${near} ${far} ${none}`);
  assert.ok(near < 0.01, 'a few percent of the block light, not a bloom');
});
test('two damper wires shade thin lines at 27.3 and 72.7 percent of the screen height', () => {
  const H = 2160,
    darkest = (centre) =>
      Math.max(
        ...[-1, 0, 1].map((d) => wireShadow(SONY_PVM_20M2E, Math.floor(centre * H) + d + 0.5, H)),
      );
  for (const at of [0.273, 0.727])
    assert.ok(darkest(at) > 0.12 && darkest(at) < 0.2, 'a faint line at 4K: ' + darkest(at));
  assert.ok(
    wireShadow(SONY_PVM_20M2E, Math.floor(0.273 * H) + 5.5, H) < 1e-3 &&
      wireShadow(SONY_PVM_20M2E, H / 2, H) < 1e-12,
    'nothing beside the wires',
  );
  // The shaded area is the wire width (0.05 mm) in pixels at any resolution.
  for (const h of [1080, 2160]) {
    let sum = 0;
    for (let y = 0; y < h; y++) sum += wireShadow(SONY_PVM_20M2E, y + 0.5, h);
    close(sum, ((2 * 0.05) / screenHeightMm(SONY_PVM_20M2E)) * h, 1e-4, 'area ' + h);
  }
});
test('the convergence error stays within the Sony figures and differs between the corners', () => {
  const offset = (c, u, v) => convergenceMm(SONY_PVM_20M2E, c, u, v),
    gap = (u, v) => {
      const r = offset(0, u, v),
        b = offset(2, u, v);
      return Math.hypot(r[0] - b[0], r[1] - b[1]);
    };
  assert.deepEqual(offset(1, 0.7, -0.3), [0, 0], 'green is the reference');
  assert.ok(gap(0, 0) <= 0.25, 'centre below 0.6 mm, about 0.2');
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([u, v]) => gap(u, v));
  assert.ok(Math.max(...corners) < 1.0 && Math.max(...corners) > 0.5, 'corners below 1.0 mm');
  assert.ok(
    new Set(corners.map((v) => v.toFixed(2))).size === 4,
    'every corner differs: ' + corners,
  );
  for (let n = 0; n <= 20; n++)
    for (let m = 0; m <= 20; m++) {
      const u = n / 10 - 1,
        v = m / 10 - 1;
      assert.ok(gap(u, v) < 1.0, 'below 1.0 mm everywhere');
    }
});
