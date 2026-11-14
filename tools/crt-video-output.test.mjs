import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandwidthSigma,
  controlledLight,
  lineVoltage,
  pictureCoverage,
  signalStep,
  sourceResponse,
  voltageReach,
} from '../src/crt/signal.mjs';
import { spotSigma } from '../src/crt/beam.mjs';
import { createCrt } from '../src/crt/crt.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';
import { heldCircuitVoltage } from './crt-video-oracle.mjs';

const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('stock PAL output sees both 75 ohm loads, the AV capacitor and the cable after the 39 ohm resistor', () => {
  const source = SNES_PAL_RGB;
  const response = sourceResponse(source, SONY_PVM_20M2E);
  // Direct circuit equations, independent of sourceResponse's reciprocal sums.
  const load = 37.5;
  const expectedV = (0.8 * 10 ** (6.5 / 20) * load) / (39 + load);
  close(response.gain, expectedV / 0.7);
  close(response.tau / source.dotClockHz, ((39 * load) / (39 + load)) * (47e-12 + 2 * 66.7e-12));
  assert.deepEqual(source.boards, ['SNSP-CPU-1CHIP-01', 'SNSP-CPU-1CHIP-02']);
  assert.ok(response.gain > 1.18 && response.gain < 1.19);
  assert.ok(controlledLight(response.gain, 2.25) > 1, 'retain stock overdrive before the optics');
  const noCableShunt = sourceResponse(
    { ...source, rgbOutput: { ...source.rgbOutput, cableShuntOhm: 1e30 } },
    SONY_PVM_20M2E,
  );
  assert.ok(
    noCableShunt.gain > response.gain * 1.3,
    'a PAL cable cannot be treated as a bare lead',
  );
  assert.deepEqual(sourceResponse({ ...source, rgbOutput: null }, {}), { gain: 1, tau: 0 });
});

test('the source network does not change the monitor bandwidth or inferred physical spot', () => {
  const ideal = { ...SNES_PAL_RGB, rgbOutput: null };
  assert.equal(bandwidthSigma(SNES_PAL_RGB, SONY_PVM_20M2E), bandwidthSigma(ideal, SONY_PVM_20M2E));
  assert.deepEqual(spotSigma(SNES_PAL_RGB, SONY_PVM_20M2E), spotSigma(ideal, SONY_PVM_20M2E));
  const response = sourceResponse(
    { ...SNES_PAL_RGB, rgbOutput: { ...SNES_PAL_RGB.rgbOutput, shuntF: 0, cableLengthM: 0 } },
    SONY_PVM_20M2E,
  );
  assert.equal(response.tau, 0);
  const longer = sourceResponse(
    { ...SNES_PAL_RGB, rgbOutput: { ...SNES_PAL_RGB.rgbOutput, cableLengthM: 4 } },
    SONY_PVM_20M2E,
  );
  assert.ok(longer.tau > sourceResponse(SNES_PAL_RGB, SONY_PVM_20M2E).tau);
  assert.equal(longer.gain, response.gain, 'lumped cable capacitance does not change DC gain');
  assert.ok(response.gain > 1);
});

test('RC plus monitor convolution agrees with independent circuit quadrature, including both edges', () => {
  const stock = sourceResponse(SNES_PAL_RGB, SONY_PVM_20M2E);
  const sigmaStock = bandwidthSigma(SNES_PAL_RGB, SONY_PVM_20M2E);
  for (const [sigma, tau] of [
    [sigmaStock, stock.tau],
    [0.2, 0.08],
    [0.2, 0.5],
    [0.65, 1.5],
  ]) {
    const levels = [0.2, 1, 0.4];
    for (const x of [-0.75, 0, 0.0625, 0.5, 1, 1.75, 2.5, 3, 3.25, 5]) {
      const expected = levels.reduce(
        (sum, value, i) => sum + value * heldCircuitVoltage(i, i + 1, x, sigma, tau),
        0,
      );
      close(
        lineVoltage((i) => levels[i] ?? 0, x, sigma, undefined, tau),
        expected,
        5e-6,
      );
      close(pictureCoverage(x, 3, sigma, tau), heldCircuitVoltage(0, 3, x, sigma, tau), 5e-6);
    }
    assert.ok(signalStep(0, sigma, tau) < 0.5, 'a causal circuit delays the edge');
    close(
      lineVoltage(() => 0.6, 0.37, sigma, undefined, tau),
      0.6,
      3e-7,
    );
    assert.ok(voltageReach(sigma, tau) >= Math.ceil(6 * sigma + 20 * tau));
  }
  for (const tau of [0, 1e-9, 0.005, 0.5, 4])
    for (const x of [-100, -5, 0, 1, 10, 100]) {
      const value = signalStep(x, 0.07, tau);
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
});

test('invalid electrical profiles and unsupported RC support fail before canvas allocation', () => {
  for (const key of ['dacFullScaleV', 'encoderGain', 'bufferGain', 'seriesOhm', 'cableShuntOhm'])
    for (const value of [0, -1, NaN, Infinity])
      assert.throws(
        () =>
          sourceResponse(
            { ...SNES_PAL_RGB, rgbOutput: { ...SNES_PAL_RGB.rgbOutput, [key]: value } },
            SONY_PVM_20M2E,
          ),
        /finite and positive/,
      );
  for (const key of ['shuntF', 'cableLengthM', 'cableFPerM'])
    for (const value of [-1, NaN, Infinity])
      assert.throws(
        () =>
          sourceResponse(
            { ...SNES_PAL_RGB, rgbOutput: { ...SNES_PAL_RGB.rgbOutput, [key]: value } },
            SONY_PVM_20M2E,
          ),
        /finite and nonnegative/,
      );
  assert.throws(
    () => sourceResponse(SNES_PAL_RGB, { ...SONY_PVM_20M2E, rgbInputOhm: 0 }),
    /rgbInputOhm/,
  );
  assert.throws(
    () =>
      createCrt(
        {},
        {
          source: { ...SNES_PAL_RGB, rgbOutput: { ...SNES_PAL_RGB.rgbOutput, shuntF: 1e-6 } },
          monitor: SONY_PVM_20M2E,
        },
      ),
    /light reach .* exceeds shader limit/,
  );
});
