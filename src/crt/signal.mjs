// CRT signal reference (docs/CRT-FILTER.md). LIGHT in shaders.mjs uses the
// same model; the browser tests compare GPU output with the beam reference.
// Linear DAC and nominal source gain are assumptions, not measured target-board
// transfer functions. Source RC and monitor Gaussian electronics stay separate.
// Signal coordinates use source pixel edges; see docs/VIDEO-OUTPUT.md.
import { DEFAULT_CONTROLS } from './controls.mjs';
import { GAUSSIAN_REACH_SIGMAS, RC_REACH_TAUS, SOURCE_LEVEL_BITS } from '../constants/crt.mjs';

// Abramowitz/Stegun 7.1.26 coefficients of erf (see erf below).
const ERF_P = 0.3275911,
  ERF_A1 = 0.254829592,
  ERF_A2 = -0.284496736,
  ERF_A3 = 1.421413741,
  ERF_A4 = -1.453152027,
  ERF_A5 = 1.061405429;
// erfcx continued fraction: terms below and above ERFCX_FAST_FROM.
const ERFCX_FAST_FROM = 4,
  ERFCX_TERMS = 12,
  ERFCX_FAST_TERMS = 6;
// signalStep support: 8 sigmas and 24 RC constants (omitted mass below 3.8e-11).
const STEP_TAIL_SIGMAS = 8,
  STEP_TAIL_TAUS = 24;
// Fewest voltage intervals per side kept for narrow profiles.
const MIN_VOLTAGE_REACH = 3;
// sRGB transfer function (IEC 61966-2-1).
const SRGB_LINEAR_LIMIT = 0.0031308,
  SRGB_LINEAR_SLOPE = 12.92,
  SRGB_SCALE = 1.055,
  SRGB_GAMMA = 2.4,
  SRGB_OFFSET = 0.055;

// Recover a DAC code from an integer 8-bit channel, with levelBits in 1..8.
// For the SNES, the PPU has already applied register 2100 brightness and
// expanded the 5-bit code to 8 bits. Do not apply that brightness again.
export function levelVoltage(value, levelBits = SOURCE_LEVEL_BITS) {
  const maximumCode = (1 << levelBits) - 1;
  const codeDivisor = 1 << (SOURCE_LEVEL_BITS - levelBits);
  return Math.floor(value / codeDivisor) / maximumCode;
}

// H(f) = exp(-f^2 / (2*sigmaF^2)); the assumed -3 dB frequency is
// sigmaF * sqrt(ln 2). Convert time sigma = 1 / (2*pi*sigmaF) to source pixels.
export function bandwidthSigma(source, monitor) {
  const sigmaFrequencyHz = monitor.rgbBandwidthHz / Math.sqrt(Math.LN2);
  return source.dotClockHz / (2 * Math.PI * sigmaFrequencyHz);
}

// Small-signal stock output model; the monitor's own bandwidth stays separate.
// DC offsets are removed by the assumed ideal video clamp. Missing rgbOutput
// preserves the generic normalized source. Values are derived once per setup.
export function sourceResponse(source, monitor) {
  const output = source.rgbOutput;
  if (output == null) return { gain: 1, tau: 0 };
  for (const name of ['dacFullScaleV', 'encoderGain', 'bufferGain', 'seriesOhm', 'cableShuntOhm'])
    if (!(output[name] > 0) || !Number.isFinite(output[name]))
      throw Error(`crt: rgbOutput.${name} must be finite and positive`);
  for (const name of ['shuntF', 'cableLengthM', 'cableFPerM'])
    if (!(output[name] >= 0) || !Number.isFinite(output[name]))
      throw Error(`crt: rgbOutput.${name} must be finite and nonnegative`);
  for (const name of ['rgbInputVpp', 'rgbInputOhm'])
    if (!(monitor[name] > 0) || !Number.isFinite(monitor[name]))
      throw Error(`crt: monitor.${name} must be finite and positive`);
  const load = 1 / (1 / output.cableShuntOhm + 1 / monitor.rgbInputOhm);
  const gain =
    (output.dacFullScaleV * output.encoderGain * output.bufferGain * load) /
    ((output.seriesOhm + load) * monitor.rgbInputVpp);
  const resistance = 1 / (1 / output.seriesOhm + 1 / load);
  // Lumped short-line approximation: the cable capacitance joins the AV shunt;
  // line inductance, loss and reflections are omitted.
  const capacitance = output.shuntF + output.cableLengthM * output.cableFPerM;
  const tau = resistance * capacitance * source.dotClockHz;
  if (!Number.isFinite(gain) || !Number.isFinite(tau)) throw Error('crt: invalid RGB response');
  return { gain, tau };
}

// Abramowitz/Stegun 7.1.26, maximum error below 1.5e-7. Keep the polynomial
// and operation order aligned with the GLSL reference approximation.
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absoluteX = Math.abs(x);
  const t = 1 / (1 + ERF_P * absoluteX);
  const polynomial = ((((ERF_A5 * t + ERF_A4) * t + ERF_A3) * t + ERF_A2) * t + ERF_A1) * t;
  return sign * (1 - polynomial * Math.exp(-absoluteX * absoluteX));
}

const normalCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2)); // magic-number-ok: (1 + erf) / 2

// exp(x*x)*erfc(x) without overflow/cancellation for nonnegative x.
// NIST DLMF 7.9.1 / A&S 7.1.14, 12 continued-fraction terms above 2,
// reduced to six above 4 where convergence is faster;
// below 2 the existing erf approximation retains adequate absolute accuracy.
function erfcx(x) {
  if (x < 2) return Math.exp(x * x) * (1 - erf(x));
  let denominator = x;
  for (let k = x >= ERFCX_FAST_FROM ? ERFCX_FAST_TERMS : ERFCX_TERMS; k >= 1; k--)
    denominator = x + (k * 0.5) / denominator; // magic-number-ok: continued fraction k/2
  return 1 / (Math.sqrt(Math.PI) * denominator);
}

// Step response of a causal source RC followed by Gaussian monitor electronics.
// The stable form avoids exp(sigma^2/(2*tau^2)) at the tiny stock RC constant.
// tau and sigma are in source pixels. tau=0 retains the original monitor path.
export function signalStep(x, sigma, tau = 0) {
  const z = x / sigma;
  if (tau === 0) return normalCdf(z);
  // Outside this support the omitted Gaussian/exponential mass is below
  // 3.8e-11. Most stock-profile interval boundaries lie far into these tails.
  if (z <= -STEP_TAIL_SIGMAS) return 0;
  if (x >= STEP_TAIL_SIGMAS * sigma + STEP_TAIL_TAUS * tau) return 1;
  const ratio = sigma / tau;
  const at = (ratio - z) / Math.SQRT2;
  const tail =
    at >= 0
      ? 0.5 * Math.exp(-0.5 * z * z) * erfcx(at) // magic-number-ok: Gaussian exponent -x^2/2
      : Math.exp(ratio * (0.5 * ratio - z)) * normalCdf(z - ratio); // magic-number-ok: Gaussian exponent -x^2/2
  return Math.min(1, Math.max(0, normalCdf(z) - tail));
}

// At least six sigmas to each side, for a combined omitted Gaussian mass
// below 2e-9, plus 20 causal RC time constants (tail below exp(-20)).
// Keep the existing seven intervals for narrow profiles.
export function voltageReach(sigma, tau = 0) {
  if (!(sigma > 0) || !Number.isFinite(sigma))
    throw Error('crt: electronics sigma must be finite and positive');
  if (!(tau >= 0) || !Number.isFinite(tau))
    throw Error('crt: source RC constant must be finite and nonnegative');
  return Math.max(
    MIN_VOLTAGE_REACH,
    Math.ceil(GAUSSIAN_REACH_SIGMAS * sigma + RC_REACH_TAUS * tau),
  );
}

// Convolve held levels with the source RC and Gaussian monitor electronics.
// sigma and optional tau use source pixels; tau=0 is the Gaussian-only path.
// voltageAt(i) supplies the constant voltage over [i, i+1), or zero in blanking.
// reach selects a finite neighbourhood: omitted tails are not renormalized.
// The default follows sigma and tau; an explicit shorter reach retains losses.
// This integrates source pixel rectangles, not a final output pixel's area.
export function lineVoltage(voltageAt, x, sigma, reach = undefined, tau = 0) {
  reach ??= voltageReach(sigma, tau);
  const first = Math.floor(x) - reach;
  const last = first + 2 * reach;
  let upperCdf = signalStep(x - first, sigma, tau);
  let sum = 0;
  for (let pixel = first; pixel <= last; pixel++) {
    const lowerCdf = signalStep(x - pixel - 1, sigma, tau);
    // Adjacent source rectangles share a boundary: evaluate its CDF only once.
    sum += voltageAt(pixel) * (upperCdf - lowerCdf);
    upperCdf = lowerCdf;
  }
  return sum;
}

export function tubeLight(voltage, gamma) {
  return Math.pow(Math.max(voltage, 0), gamma);
}

// BT.1886 Annex 1 control roles, retaining the monitor profile's gamma.
// Coverage gates the bias with the same filtered picture window as the signal.
// Retain light above reference white until the final output encoding.
export function controlledLight(
  voltage,
  gamma,
  { brightness = 0, contrast = 1 } = DEFAULT_CONTROLS,
  coverage = 1,
) {
  return contrast * tubeLight(voltage + brightness * coverage, gamma);
}

export const pictureCoverage = (x, width, sigma, tau = 0) =>
  signalStep(x, sigma, tau) - signalStep(x - width, sigma, tau);

export function srgbEncode(light) {
  const clippedLight = Math.min(Math.max(light, 0), 1);
  return clippedLight <= SRGB_LINEAR_LIMIT
    ? SRGB_LINEAR_SLOPE * clippedLight
    : SRGB_SCALE * Math.pow(clippedLight, 1 / SRGB_GAMMA) - SRGB_OFFSET;
}
