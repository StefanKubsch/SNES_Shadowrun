import test from 'node:test';
import assert from 'node:assert/strict';
import {
  D65,
  DISPLAY_P3,
  SRGB,
  applyMatrix,
  phosphorToOutput,
  rgbToXyz,
} from '../src/crt/colour.mjs';

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-14, `${actual} != ${expected}`);

// Independent reference coefficients from CSS Color 4, section 19 sample code:
// https://www.w3.org/TR/2026/CRD-css-color-4-20261029/#color-conversion-code
// lin_sRGB_to_XYZ and lin_P3_to_XYZ, using D65 without chromatic adaptation.
for (const [profile, expected] of [
  [
    SRGB,
    [
      506752 / 1228815,
      87881 / 245763,
      12673 / 70218,
      87098 / 409605,
      175762 / 245763,
      12673 / 175545,
      7918 / 409605,
      87881 / 737289,
      1001167 / 1053270,
    ],
  ],
  [
    DISPLAY_P3,
    [
      608311 / 1250200,
      189793 / 714400,
      198249 / 1000160,
      35783 / 156275,
      247089 / 357200,
      198249 / 2500400,
      0,
      32229 / 714400,
      5220557 / 5000800,
    ],
  ],
]) {
  test(`${profile.name} RGB-to-XYZ agrees with the independent W3C matrix`, () => {
    rgbToXyz(profile).forEach((value, index) => close(value, expected[index]));
  });
}

test('row-major matrix application preserves orientation and unclipped values', () => {
  const matrix = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 10]);
  assert.deepEqual(applyMatrix(matrix, Object.freeze([2, 3, 5])), [23, 53, 88]);
  assert.deepEqual(applyMatrix(matrix, [-1, 0, 0]), [-1, -4, -7]);
});

test('output conversion preserves a different source white in XYZ instead of adapting it', () => {
  // Equal-energy white has X=Y=Z. It must not become D65 merely because the
  // output uses D65 primaries/normalization. This is an algebra test, not a preset.
  const conversion = phosphorToOutput(SRGB, [1 / 3, 1 / 3], SRGB);
  const outputWhite = applyMatrix(conversion, [1, 1, 1]);
  const xyz = applyMatrix(rgbToXyz(SRGB), outputWhite);
  xyz.forEach((value) => close(value, 1));
  assert.ok(Math.abs(outputWhite[0] - outputWhite[1]) > 0.01);
});

test('matrix construction leaves frozen profiles unchanged and returns independent arrays', () => {
  const profile = Object.freeze({
    red: Object.freeze([...SRGB.red]),
    green: Object.freeze([...SRGB.green]),
    blue: Object.freeze([...SRGB.blue]),
    white: Object.freeze([...D65]),
  });
  const first = rgbToXyz(profile);
  const second = rgbToXyz(profile);
  assert.notEqual(first, second);
  first[0] = 9;
  close(second[0], 506752 / 1228815);
  const identity = phosphorToOutput(profile, profile.white, profile);
  identity.forEach((value, index) => close(value, index % 4 === 0 ? 1 : 0));
});
