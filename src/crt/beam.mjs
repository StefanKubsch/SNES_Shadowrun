// CRT beam reference (docs/CRT-FILTER.md, stages 3 and 4). The shaders use
// the same model in separate light, spot, halation and final output passes.
//
// 1. Light per source line: low-pass voltage (signal.mjs), monitor controls and
//    gun characteristic, OVERSAMPLE samples per source pixel with MARGIN
//    pixels on either side for the softened picture edge.
// 2. Horizontal Gaussian beam spot over these samples.
// 3. Vertical Gaussian around each line centre; summing nearby lines produces
//    scanlines. Each output pixel averages this beam light over its area:
//    with the grille and wire transmission inside the integral (area.mjs).
//    Halation from step 1 is averaged separately, without grille or wires.
//
// Spot size from monitor resolution: N TV lines are N/2 periods per picture
// height, at which the system has monitor.resolutionContrast left. The Gaussian
// spot MTF exp(-2π²σ²f²) combines with the electronics' low-pass along the line.
// Gaussian electronics/spot, isotropic spot size and limiting contrast are
// assumptions, not a measured point-spread function of this monitor.
// Profiles require positive dimensions/bandwidths/sigmas and a contrast strictly
// between zero and the electronics response at the limiting frequency.
import { outputLayout, outputToSurface, pictureInRaster } from './geometry.mjs';
import {
  bandwidthSigma,
  controlledLight,
  erf,
  levelVoltage,
  lineVoltage,
  pictureCoverage,
  sourceResponse,
  voltageReach,
} from './signal.mjs';
import { normalizeControls } from './controls.mjs';
import { convergenceMm, pitchPixels, screenHeightMm } from './screen.mjs';
import { grilleHat, wiredLine } from './area.mjs';
import { SRGB, applyMatrix, phosphorToOutput } from './colour.mjs';
import {
  CENTRE,
  GAUSSIAN_REACH_SIGMAS,
  KERNEL_REACH_SIGMAS,
  RC_REACH_TAUS,
  RGB_CHANNELS,
  SOURCE_LEVEL_BITS,
} from '../constants/crt.mjs';
import { RGBA_BYTES } from '../constants/ppu.mjs';

// peakGain keeps at least six lines of the line comb.
const PEAK_MIN_REACH = 6;
// Halation is added as gain * energy * halo / 3 (docs/CRT-FILTER.md, as in the shader).
const HALO_DIVISOR = 3;

export const OVERSAMPLE = 8;
export const MARGIN = 2;

// Infer spot sigma in fractions of active raster height, then convert to
// raster-line spacings and source pixels. Underscan is applied by the layout.
export function spotSigma(source, monitor) {
  const standard = source.standard;
  const cyclesPerHeight = monitor.resolutionTvLines / 2;
  const alongLineHz = (cyclesPerHeight * standard.aspect) / standard.activeLineS;
  const sigmaHz = monitor.rgbBandwidthHz / Math.sqrt(Math.LN2);
  const electronics = Math.exp((-alongLineHz * alongLineHz) / (2 * sigmaHz * sigmaHz));
  const heightFraction =
    Math.sqrt(-Math.log(monitor.resolutionContrast / electronics) / (2 * Math.PI * Math.PI)) /
    cyclesPerHeight;
  const picture = pictureInRaster(source, standard);
  const pixelWidth = (picture.width * standard.aspect) / source.width;
  // In line spacings (one source line per raster line) and source pixels.
  return { lines: heightFraction * standard.activeLines, pixels: heightFraction / pixelWidth };
}

// Horizontal spot sigma is in oversampled texels, not source pixels.
export function spotWeights(sigmaSamples) {
  return gaussWeights(sigmaSamples);
}

// Output-area sampling, shared with BEAM in shaders.mjs. Rows reach
// LINE_REACH spot sigmas beyond the output pixel's box; each omitted Gaussian
// tail holds less than 3.2e-5 of a line's light. Footprints below
// BOX_MINIMUM (lines or oversampled texels) use point sampling, where the
// box difference would lose float precision; the two agree to O(width^2).
// Both implementations visit the overlapping source rows and texture samples;
// their support is bounded by the actual texture, including at tiny outputs.
export const LINE_REACH = 4;
export const BOX_MINIMUM = 1e-3;

// Mean vertical beam density over an output pixel of footprint lines,
// centred distance lines from the beam's line centre: the exact Gaussian
// box integral. Footprint zero is the point density.
export function lineWeight(distance, sigmaLines, footprint) {
  if (footprint < BOX_MINIMUM)
    return (
      Math.exp((-distance * distance) / (2 * sigmaLines * sigmaLines)) /
      (sigmaLines * Math.sqrt(2 * Math.PI))
    );
  const scale = 1 / (sigmaLines * Math.SQRT2),
    half = footprint / 2;
  return (erf((distance + half) * scale) - erf((distance - half) * scale)) / (2 * footprint);
}

// Rows whose box-integrated weight is included for an output pixel centred
// at line (raster coordinates, row j has its centre at j + 0.5).
export function lineRows(line, sigmaLines, footprint) {
  const reach = LINE_REACH * sigmaLines + footprint / 2;
  return [Math.ceil(line - reach - CENTRE), Math.floor(line + reach - CENTRE)];
}

// Integral of the unit hat (linear interpolation basis) from -infinity to x.
function hatIntegral(x) {
  if (x <= -1) return 0;
  if (x <= 0) return ((x + 1) * (x + 1)) / 2;
  if (x < 1) return 1 - ((1 - x) * (1 - x)) / 2;
  return 1;
}

// Mean of the linear interpolant through data (sample k at position k, zero
// outside) over [centre - width/2, centre + width/2], in sample units.
export function boxSample(data, centre, width) {
  if (width < BOX_MINIMUM) {
    const index = Math.floor(centre),
      fraction = centre - index;
    return sampleLine(data, index) * (1 - fraction) + sampleLine(data, index + 1) * fraction;
  }
  const first = centre - width / 2,
    last = centre + width / 2;
  let sum = 0;
  for (let index = Math.floor(first); index <= Math.ceil(last); index++)
    sum += sampleLine(data, index) * (hatIntegral(last - index) - hatIntegral(first - index));
  return sum / width;
}
// Normalize the bare white line centre at zero footprint, before the grille
// and additive halation, retaining at least six sigmas of the line comb.
// Pixel averaging changes the peak.
export function peakGain(sigmaLines) {
  let sum = 0;
  const reach = Math.max(PEAK_MIN_REACH, Math.ceil(GAUSSIAN_REACH_SIGMAS * sigmaLines));
  for (let n = -reach; n <= reach; n++) sum += lineWeight(n, sigmaLines, 0);
  return 1 / sum;
}
// Space for the voltage's six-sigma tail followed by the finite spot kernel.
export const lightMargin = (sigmaVoltage, sigmaSpot, tau = 0) =>
  Math.max(
    MARGIN,
    Math.ceil(
      GAUSSIAN_REACH_SIGMAS * sigmaVoltage +
        RC_REACH_TAUS * tau +
        Math.ceil(KERNEL_REACH_SIGMAS * sigmaSpot * OVERSAMPLE) / OVERSAMPLE,
    ),
  );
export const samplesPerRow = (source, margin = MARGIN) => (source.width + 2 * margin) * OVERSAMPLE;

// Halation: assumed Gaussian sigma in mm, converted through the underscanned
// picture to source pixels/raster lines. Margins cover ceil(3*sigma) on each
// axis, not the infinite tail. Absent halation keeps valid dimensions with
// zero energy. The energy parameter adds light; direct light is not reduced.
export function halationKernel(source, monitor) {
  const p = outputLayout(source, source.standard, monitor, true).picture,
    h = monitor.halation ?? { sigmaMm: 1, energy: 0 };
  const x = h.sigmaMm / ((p.width * monitor.screenWidthMm) / source.width),
    y = h.sigmaMm / ((p.height * screenHeightMm(monitor)) / source.height);
  const marginX = Math.ceil(KERNEL_REACH_SIGMAS * x),
    marginY = Math.ceil(KERNEL_REACH_SIGMAS * y);
  return {
    x,
    y,
    marginX,
    marginY,
    width: source.width + 2 * marginX,
    height: source.height + 2 * marginY,
    energy: h.energy,
  };
}
// Discrete point weights truncated at ceil(3*sigma), normalized once over
// their full support. Callers use zero outside the image, without local edge
// renormalization. Every call owns its array; no kernels are cached globally.
export function gaussWeights(sigma) {
  const reach = Math.ceil(KERNEL_REACH_SIGMAS * sigma),
    w = [];
  let sum = 0;
  for (let m = -reach; m <= reach; m++) {
    const v = Math.exp((-m * m) / (2 * sigma * sigma));
    w.push(v);
    sum += v;
  }
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return { reach, weights: w };
}

function sampleLine(data, index) {
  return index >= 0 && index < data.length ? data[index] : 0;
}

// Frame reference: pixel(x,y) gives linear light before sRGB encoding in a W x H
// output at layout. Each channel's beam uses its convergence position, grille
// and damper wires, plus halation, in the output colour space (colour.mjs).
// Frame data and profiles are borrowed: keep them unchanged for the lifetime
// of this reference. Lazy rows/halos belong to this instance, not a live frame
// stream. Each pixel result is fresh. Direct light times grille/wires, plus
// the bilinear halo, is averaged over the pixel. The convergence field stays
// a local translation evaluated at its centre, without a footprint Jacobian.
export function tubeReference(pixels, source, monitor, output = SRGB, controls) {
  const settings = normalizeControls(controls);
  const colour = phosphorToOutput(monitor.phosphor, monitor.white, output);
  const response = sourceResponse(source, monitor);
  const sigmaBw = bandwidthSigma(source, monitor),
    spot = spotSigma(source, monitor),
    gamma = monitor.gamma,
    bits = source.levelBits ?? SOURCE_LEVEL_BITS,
    lightReach = voltageReach(sigmaBw, response.tau),
    margin = lightMargin(sigmaBw, spot.pixels, response.tau);
  const { reach, weights } = spotWeights(spot.pixels * OVERSAMPLE),
    count = samplesPerRow(source, margin),
    gain = peakGain(spot.lines),
    rows = new Map();
  function row(r, c) {
    const key = r * RGBA_BYTES + c;
    if (rows.has(key)) return rows.get(key);
    const voltageAt = (i) =>
      i < 0 || i >= source.width
        ? 0
        : levelVoltage(pixels[(r * source.width + i) * RGBA_BYTES + c], bits);
    const light = new Float64Array(count),
      spread = new Float64Array(count);
    for (let k = 0; k < count; k++) {
      const x = (k + CENTRE) / OVERSAMPLE - margin;
      light[k] = controlledLight(
        response.gain * lineVoltage(voltageAt, x, sigmaBw, lightReach, response.tau),
        gamma,
        settings,
        pictureCoverage(x, source.width, sigmaBw, response.tau),
      );
    }
    for (let k = 0; k < count; k++) {
      let sum = 0;
      for (let m = -reach; m <= reach; m++) {
        const at = k + m;
        if (at >= 0 && at < count) sum += weights[m + reach] * light[at];
      }
      spread[k] = sum;
    }
    const result = { light, spread };
    rows.set(key, result);
    return result;
  }
  // Per-channel halation: mean samples per source pixel, then horizontal and vertical Gaussian.
  const halo = halationKernel(source, monitor),
    halos = [];
  let horizontalHaloWeights, verticalHaloWeights;
  function haloImage(c) {
    if (halos[c]) return halos[c];
    const { width, height, marginX, marginY } = halo,
      base = new Float64Array(width * height),
      wide = new Float64Array(width * height),
      out = new Float64Array(width * height);
    for (let r = 0; r < source.height; r++) {
      const light = row(r, c).light;
      for (let x = 0; x < source.width; x++) {
        let sum = 0;
        for (let s = 0; s < OVERSAMPLE; s++) sum += light[(x + margin) * OVERSAMPLE + s];
        base[(r + marginY) * width + x + marginX] = sum / OVERSAMPLE;
      }
    }
    // The three channel images use the same immutable kernel weights.
    const gx = (horizontalHaloWeights ??= gaussWeights(halo.x)),
      gy = (verticalHaloWeights ??= gaussWeights(halo.y));
    for (let j = 0; j < height; j++)
      for (let i = 0; i < width; i++) {
        let sum = 0;
        for (let m = -gx.reach; m <= gx.reach; m++) {
          const k = i + m;
          if (k >= 0 && k < width) sum += gx.weights[m + gx.reach] * base[j * width + k];
        }
        wide[j * width + i] = sum;
      }
    for (let j = 0; j < height; j++)
      for (let i = 0; i < width; i++) {
        let sum = 0;
        for (let m = -gy.reach; m <= gy.reach; m++) {
          const k = j + m;
          if (k >= 0 && k < height) sum += gy.weights[m + gy.reach] * wide[k * width + i];
        }
        out[j * width + i] = sum;
      }
    return (halos[c] = out);
  }
  function haloAt(c, sx, line, footprintX, footprintY) {
    if (halo.energy === 0) return 0;
    const image = haloImage(c),
      tx = sx + halo.marginX - CENTRE,
      ty = line + halo.marginY - CENTRE,
      first = Math.max(0, Math.floor(ty - footprintY / 2)),
      last = Math.min(halo.height - 1, Math.ceil(ty + footprintY / 2));
    const { width } = halo;
    let sum = 0;
    for (let j = first; j <= last; j++) {
      const weight =
        footprintY < BOX_MINIMUM
          ? Math.max(0, 1 - Math.abs(ty - j))
          : (hatIntegral(ty + footprintY / 2 - j) - hatIntegral(ty - footprintY / 2 - j)) /
            footprintY;
      sum += weight * boxSample(image.subarray(j * width, (j + 1) * width), tx, footprintX);
    }
    return sum;
  }
  return {
    spot,
    gain,
    halo,
    pixel(layout, W, H, x, y) {
      const p = layout.picture,
        at = outputToSurface(layout, (x + CENTRE) / W, (y + CENTRE) / H),
        u = at.x,
        v = at.y,
        // Output pixel width in source pixels and height in raster lines.
        footprintX = (source.width / (p.width * W)) * at.scaleX,
        footprintY = (source.height / (p.height * H)) * at.scaleY,
        pitch = pitchPixels(monitor, W) / at.scaleX,
        screenX = (u * W) / at.scaleX,
        screenY = (v * H) / at.scaleY,
        out = [0, 0, 0];
      for (let c = 0; c < RGB_CHANNELS; c++) {
        // Invert the landing displacement to find the source aimed at here.
        const [dx, dy] = convergenceMm(monitor, c, u * 2 - 1, v * 2 - 1),
          cu = u - dx / monitor.screenWidthMm,
          cv = v - dy / screenHeightMm(monitor);
        const sx = ((cu - p.x) / p.width) * source.width,
          line = ((cv - p.y) / p.height) * source.height,
          [first, last] = lineRows(line, spot.lines, footprintY);
        const centre = (sx + margin) * OVERSAMPLE - CENTRE,
          width = footprintX * OVERSAMPLE;
        const left = Math.max(0, Math.floor(centre - width / 2));
        const right = Math.min(count - 1, Math.ceil(centre + width / 2));
        const weights = [];
        for (let k = left; k <= right; k++)
          weights.push(grilleHat(c, screenX, pitch, centre, width, k));
        let sum = 0;
        for (let j = Math.max(first, 0); j <= Math.min(last, source.height - 1); j++) {
          const data = row(j, c).spread;
          let along = 0;
          for (let k = left; k <= right; k++) along += data[k] * weights[k - left];
          sum +=
            wiredLine(
              line - (j + CENTRE),
              spot.lines,
              footprintY,
              screenY,
              monitor,
              H / at.scaleY,
            ) * along;
        }
        const gx = ((u - p.x) / p.width) * source.width,
          gl = ((v - p.y) / p.height) * source.height;
        out[c] =
          gain * (sum + (halo.energy * haloAt(c, gx, gl, footprintX, footprintY)) / HALO_DIVISOR);
      }
      return applyMatrix(colour, out);
    },
  };
}
