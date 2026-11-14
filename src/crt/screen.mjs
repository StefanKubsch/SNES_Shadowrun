// CRT screen reference (docs/CRT-FILTER.md, stage 4). The BEAM pass in
// shaders.mjs uses the same model for the current two-wire monitor profile.
// Dimensions are the full usable 4:3 screen, including the picture border.
//
// Aperture grille: equal-width R, G and B stripes occupy one third of each
// triad, without black gaps. Each channel's mean transmission is 1/3; there
// is no brightness compensation. Pitch and duty cycle are profile/model data.
// A Gaussian with sigma ANTIALIAS output pixels smooths the periodic mask.
// Its frequency response is exp(-2*pi^2*sigma^2*f^2), f in cycles/output pixel.
// At Nyquist (f=0.5) it retains about 4.25% of a harmonic's amplitude.
// This suppresses aliasing, but does not eliminate it. The finite series and
// early cutoff can ring at large pitch; positivity is not guaranteed for
// arbitrary scaling, unlike an exact convolution with a positive Gaussian.
import { CENTRE, GRILLE_HARMONICS, HARMONIC_CUTOFF, PHOSPHOR_STRIPES } from '../constants/crt.mjs';
export const ANTIALIAS = 0.8;

const gaussianResponse = (frequency) =>
  Math.exp(-2 * Math.PI * Math.PI * ANTIALIAS * ANTIALIAS * frequency * frequency); // magic-number-ok: Gaussian transfer function
const gaussianVarianceTwice = 2 * ANTIALIAS * ANTIALIAS;
const gaussianNormalization = ANTIALIAS * Math.sqrt(2 * Math.PI);

// Triad pitch in output pixels at the given full-screen output width.
export const pitchPixels = (monitor, outputWidth) =>
  (monitor.grillePitchMm / monitor.screenWidthMm) * outputWidth;

// Transmission of channel 0/1/2 (R/G/B). x is measured from the left screen
// edge in output pixels; callers supply pixel centres (index + 0.5).
// Inputs require positive pitch/dimensions. No clamping or renormalization:
// either would alter the mask's mean and disagree with the shader reference.
export function grille(channel, x, pitch) {
  const duty = 1 / PHOSPHOR_STRIPES;
  const centre = ((channel + CENTRE) * pitch) / PHOSPHOR_STRIPES;
  let sum = duty;
  for (let harmonic = 1; harmonic <= GRILLE_HARMONICS; harmonic++) {
    const weight = gaussianResponse(harmonic / pitch);
    if (weight < HARMONIC_CUTOFF) break;
    sum +=
      ((weight * 2 * Math.sin(Math.PI * harmonic * duty)) / (Math.PI * harmonic)) *
      Math.cos((2 * Math.PI * harmonic * (x - centre)) / pitch);
  }
  return sum;
}

// Usable screen height in mm, assuming the model's fixed 4:3 screen.
// The usable screen is 4:3.
const SCREEN_ASPECT_WIDTH = 4,
  SCREEN_ASPECT_HEIGHT = 3;
export const screenHeightMm = (monitor) =>
  (monitor.screenWidthMm * SCREEN_ASPECT_HEIGHT) / SCREEN_ASPECT_WIDTH;

// Fraction of direct light blocked at y (output pixel centre). Wire positions
// are fractions of the full screen height, increasing downward. Width in mm
// becomes an area in output pixels multiplying a unit-area Gaussian.
// This thin-wire approximation samples the Gaussian, rather than integrating
// a finite-width rectangle or an output-pixel box. It is accurate for widths
// small relative to ANTIALIAS; broad/overlapping shadows saturate at 1 and
// then need not preserve area. Halation is not shaded by these wires.
export function wireShadow(monitor, y, outputHeight) {
  const wires = monitor.damperWires;
  if (!wires) return 0;
  const width = (wires.widthMm / screenHeightMm(monitor)) * outputHeight;
  let shadow = 0;
  for (const position of wires.positions) {
    const distance = y - position * outputHeight;
    shadow +=
      (width * Math.exp((-distance * distance) / gaussianVarianceTwice)) / gaussianNormalization;
  }
  return Math.min(shadow, 1);
}

function bilinearField(coefficients, u, v) {
  const [constant, du, dv, duv] = coefficients;
  return constant + du * u + dv * v + duv * u * v;
}

// Landing displacement [dx, dy] in mm, relative to green. u/v run -1..1
// across the full screen, rightward/downward. Coefficients are [c0, cu, cv,
// cuv], each in mm. The beam caller subtracts this shift to find its source;
// grille and wire coordinates stay fixed on the screen. Each result is fresh.
export function convergenceMm(monitor, channel, u, v) {
  const field =
    channel === 0 ? monitor.convergence?.red : channel === 2 ? monitor.convergence?.blue : null;
  if (!field) return [0, 0];
  return [bilinearField(field.x, u, v), bilinearField(field.y, u, v)];
}
