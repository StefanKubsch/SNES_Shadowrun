// Output-pixel integrals of the existing screen model, in output-pixel units.
// The 0.8-pixel Gaussian and finite Fourier mask are unchanged. Convergence
// remains a translation evaluated at the pixel centre (beam.mjs).
import { erf } from './signal.mjs';
import { ANTIALIAS, screenHeightMm, wireShadow } from './screen.mjs';
import {
  CENTRE,
  GRILLE_HARMONICS,
  HARMONIC_CUTOFF,
  PHOSPHOR_STRIPES,
  POINT_FOOTPRINT,
} from '../constants/crt.mjs';

// Below this |z| the sinc and moment terms use their Taylor series.
const SERIES_LIMIT = 0.05;

const density = (x, sigma) => Math.exp(-0.5 * (x / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)); // magic-number-ok: normal density
const mass = (distance, sigma, width) =>
  (erf((distance + width / 2) / (sigma * Math.SQRT2)) -
    erf((distance - width / 2) / (sigma * Math.SQRT2))) /
  2;

// Integral of a linear segment times the filtered grille. value is the
// segment's midpoint value; slope is its derivative per output pixel.
function maskedSegment(channel, x, pitch, first, last, value, slope) {
  if (last <= first) return 0;
  const half = (last - first) / 2;
  const middle = (first + last) / 2;
  let sum = value / PHOSPHOR_STRIPES;
  for (let n = 1; n <= GRILLE_HARMONICS; n++) {
    const frequency = n / pitch;
    const attenuation = Math.exp(-2 * Math.PI ** 2 * ANTIALIAS ** 2 * frequency ** 2); // magic-number-ok: Gaussian transfer function
    if (attenuation < HARMONIC_CUTOFF) break;
    const omega = 2 * Math.PI * frequency;
    const z = omega * half,
      z2 = z * z;
    // Stable sinc and (sin(z)-z*cos(z))/z^2 at the point limit.
    const sinc = Math.abs(z) < SERIES_LIMIT ? 1 - z2 / 6 + (z2 * z2) / 120 : Math.sin(z) / z; // magic-number-ok: Taylor series
    const moment =
      Math.abs(z) < SERIES_LIMIT
        ? z * (1 / 3 - z2 / 30 + (z2 * z2) / 840) // magic-number-ok: Taylor series
        : (Math.sin(z) - z * Math.cos(z)) / z2;
    const phase = omega * (x + middle - ((channel + CENTRE) * pitch) / PHOSPHOR_STRIPES);
    const coefficient =
      (attenuation * 2 * Math.sin((Math.PI * n) / PHOSPHOR_STRIPES)) / (Math.PI * n);
    sum += coefficient * (value * Math.cos(phase) * sinc - slope * half * Math.sin(phase) * moment);
  }
  return 2 * half * sum;
}

// Mean of one interpolation hat times the grille across a unit output pixel.
// centre/width/index are in spot-sample units; x/pitch in output pixels.
export function grilleHat(channel, x, pitch, centre, width, index) {
  if (width < POINT_FOOTPRINT)
    return maskedSegment(
      channel,
      x,
      pitch,
      -CENTRE,
      CENTRE,
      Math.max(0, 1 - Math.abs(centre - index)),
      0,
    );
  const first = Math.max(-CENTRE, (index - 1 - centre) / width);
  const middle = (index - centre) / width;
  const last = Math.min(CENTRE, (index + 1 - centre) / width);
  let sum = 0;
  for (const [a, b, slope] of [
    [first, Math.min(last, middle), width],
    [Math.max(first, middle), last, -width],
  ]) {
    const value = 1 - Math.abs(centre + (width * (a + b)) / 2 - index);
    sum += maskedSegment(channel, x, pitch, a, b, value, slope);
  }
  return sum;
}

// Eight-point Gauss-Legendre, used only where the sum of wire shadows can
// saturate. Split at <= one beam sigma and <= 1/32 output pixel; a tiny output
// therefore cannot step over a narrow line. The omitted tails are < 1.3e-15.
const GAUSS_LEGENDRE_NODES = [
  0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];
const GAUSS_LEGENDRE_WEIGHTS = [
  0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];
// Below this summed wire shadow the line is treated as unshadowed.
const WIRE_BOUND_EPSILON = 1e-8;
// Saturated case: integrate over +-8 beam sigmas in steps of at most 1/32 output pixel.
const WIRE_REACH_SIGMAS = 8,
  WIRE_STEPS_PER_PIXEL = 32;

export function wiredLine(distance, sigma, footprint, y, monitor, height) {
  const wires = monitor.damperWires;
  const bare =
    footprint < POINT_FOOTPRINT
      ? density(distance, sigma)
      : mass(distance, sigma, footprint) / footprint;
  if (!wires || wires.widthMm === 0) return bare;
  const width = (wires.widthMm / screenHeightMm(monitor)) * height;
  let bound = 0;
  for (const position of wires.positions) {
    const nearest = Math.max(0, Math.abs(y - position * height) - CENTRE);
    bound += width * density(nearest, ANTIALIAS);
  }
  if (bound < WIRE_BOUND_EPSILON) return bare;
  if (bound > 1 || footprint < POINT_FOOTPRINT) {
    // At the established point limit hold beam density constant, but still
    // average wire transmission across the output pixel.
    const point = footprint < POINT_FOOTPRINT;
    const scale = point ? 1 : footprint;
    const first = point ? -CENTRE : Math.max(-footprint / 2, -distance - WIRE_REACH_SIGMAS * sigma);
    const last = point ? CENTRE : Math.min(footprint / 2, -distance + WIRE_REACH_SIGMAS * sigma);
    const count = Math.max(
      1,
      Math.ceil((last - first) / Math.min(point ? 1 : sigma, scale / WIRE_STEPS_PER_PIXEL)),
    );
    let sum = 0;
    for (let i = 0; i < count && last > first; i++) {
      const half = (last - first) / (2 * count),
        middle = first + (2 * i + 1) * half;
      for (let n = 0; n < GAUSS_LEGENDRE_NODES.length; n++)
        for (const sign of [-1, 1]) {
          const at = middle + sign * half * GAUSS_LEGENDRE_NODES[n];
          const beam = point ? bare : density(distance + at, sigma);
          sum +=
            half *
            GAUSS_LEGENDRE_WEIGHTS[n] *
            beam *
            (1 - wireShadow(monitor, y + at / scale, height));
        }
    }
    return sum / scale;
  }
  // Product of two Gaussians: another Gaussian times their overlap density.
  // This integrates the beam and each unsaturated shadow together exactly.
  const wireSigma = footprint * ANTIALIAS;
  const variance = sigma * sigma + wireSigma * wireSigma;
  const productSigma = (sigma * wireSigma) / Math.sqrt(variance);
  let sum = bare;
  for (const position of wires.positions) {
    const offset = footprint * (y - position * height);
    const middle = (distance * wireSigma * wireSigma + offset * sigma * sigma) / variance;
    sum -=
      width *
      density(distance - offset, Math.sqrt(variance)) *
      mass(middle, productSigma, footprint);
  }
  return sum;
}
