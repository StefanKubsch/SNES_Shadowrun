// Diagnostic quadrature, never imported by the game. It compares the existing
// centre translation with the same inverse displacement evaluated throughout
// the output pixel. Source profiles and the verified light/spot model are shared;
// the area integral uses point densities and split Gauss-Legendre quadrature,
// without area.mjs, lineWeight, boxSample or a supersampled output canvas.
import { bandwidthSigma, lineVoltage, sourceResponse } from '../../src/crt/signal.mjs';
import {
  lightMargin,
  LINE_REACH,
  OVERSAMPLE,
  peakGain,
  spotSigma,
  spotWeights,
} from '../../src/crt/beam.mjs';
import { outputLayout } from '../../src/crt/geometry.mjs';
import { grille, pitchPixels, screenHeightMm, wireShadow } from '../../src/crt/screen.mjs';
import { applyMatrix, phosphorToOutput, SRGB } from '../../src/crt/colour.mjs';

// Generated from the Legendre recurrence, independently of area.mjs's GL8 table.
export function gaussLegendre(order) {
  if (!Number.isInteger(order) || order < 2 || order > 24) throw Error('Expected order 2..24');
  const nodes = [];
  for (let i = 1; i <= order; i++) {
    let x = Math.cos((Math.PI * (i - 0.25)) / (order + 0.5)),
      derivative;
    for (let iteration = 0; iteration < 20; iteration++) {
      let previous = 1,
        current = x;
      for (let n = 2; n <= order; n++) {
        const next = ((2 * n - 1) * x * current - (n - 1) * previous) / n;
        previous = current;
        current = next;
      }
      derivative = (order * (x * current - previous)) / (x * x - 1);
      const change = current / derivative;
      x -= change;
      if (Math.abs(change) < 2e-15) break;
    }
    nodes.push([x, 2 / ((1 - x * x) * derivative * derivative)]);
  }
  return nodes;
}

const fieldAt = (field, u, v) => field[0] + field[1] * u + field[2] * v + field[3] * u * v;
const zero = { x: [0, 0, 0, 0], y: [0, 0, 0, 0] };

export function createConvergenceProbe(source, monitor, pattern) {
  if (!['white', 'checker', 'impulse'].includes(pattern)) throw Error(`Unknown pattern ${pattern}`);
  const layout = outputLayout(source, source.standard, monitor, true);
  const p = layout.picture,
    spot = spotSigma(source, monitor);
  const response = sourceResponse(source, monitor);
  const sigma = bandwidthSigma(source, monitor),
    margin = lightMargin(sigma, spot.pixels, response.tau);
  const count = (source.width + 2 * margin) * OVERSAMPLE;
  const kernel = spotWeights(spot.pixels * OVERSAMPLE),
    gain = peakGain(spot.lines);
  const matrix = phosphorToOutput(monitor.phosphor, monitor.white, SRGB);
  const rows = new Map(),
    lights = new Map();
  const rowType = (row) =>
    pattern === 'checker'
      ? row & 1
      : pattern === 'impulse'
        ? Number(row === Math.floor(source.height / 2))
        : 1;
  function rowData(row) {
    const type = rowType(row);
    if (pattern === 'impulse' && type === 0) return null;
    if (rows.has(type)) return rows.get(type);
    const held = (x) =>
      x < 0 || x >= source.width
        ? 0
        : pattern === 'checker'
          ? Number(((x + type) & 1) === 0)
          : pattern === 'impulse'
            ? Number(x === Math.floor(source.width / 2))
            : 1;
    const light = Float64Array.from(
      { length: count },
      (_, k) =>
        Math.max(
          0,
          response.gain *
            lineVoltage(held, (k + 0.5) / OVERSAMPLE - margin, sigma, undefined, response.tau),
        ) ** monitor.gamma,
    );
    const spread = new Float64Array(count);
    for (let k = 0; k < count; k++)
      for (let offset = -kernel.reach; offset <= kernel.reach; offset++) {
        const index = k + offset;
        if (index >= 0 && index < count)
          spread[k] += kernel.weights[offset + kernel.reach] * light[index];
      }
    lights.set(type, light);
    rows.set(type, spread);
    return spread;
  }
  // Source-sample knots at which a row interpolant changes slope. Constant
  // stretches are a single interval; no spot feature is skipped at tiny outputs.
  for (let row = 0; row < source.height; row++) rowData(row);
  const knots = new Set([-1, count]);
  for (const data of rows.values())
    for (let k = 0; k < count; k++) {
      const left = k === 0 ? 0 : data[k - 1],
        right = k + 1 === count ? 0 : data[k + 1];
      if (Math.abs(left - 2 * data[k] + right) > 1e-14) knots.add(k);
    }
  const sortedKnots = [...knots].sort((a, b) => a - b);

  function integratePixel(W, H, x, y, variable, order, referenceSupport = false) {
    const nodes = gaussLegendre(order),
      u0 = (x + 0.5) / W,
      v0 = (y + 0.5) / H;
    const pitch = pitchPixels(monitor, W),
      heightMm = screenHeightMm(monitor);
    const fy = source.height / (p.height * H);
    const light = [];
    for (let channel = 0; channel < 3; channel++) {
      const field =
        channel === 0
          ? (monitor.convergence?.red ?? zero)
          : channel === 2
            ? (monitor.convergence?.blue ?? zero)
            : zero;
      const at = (tx, ty) => {
        const u = u0 + tx / W,
          v = v0 + ty / H;
        const du = fieldAt(field.x, (variable ? u : u0) * 2 - 1, (variable ? v : v0) * 2 - 1);
        const dv = fieldAt(field.y, (variable ? u : u0) * 2 - 1, (variable ? v : v0) * 2 - 1);
        return [
          ((u - du / monitor.screenWidthMm - p.x) / p.width) * source.width,
          ((v - dv / heightMm - p.y) / p.height) * source.height,
        ];
      };
      // Baseline checks can select the renderer's finite four-sigma row set.
      // The field comparison uses eight-sigma point tails in both modes to
      // separate displacement variation from that existing truncation error.
      const centreLine = at(0, 0)[1];
      const referenceReach = LINE_REACH * spot.lines + fy / 2;
      const supportFirst = referenceSupport
        ? Math.max(0, Math.ceil(centreLine - referenceReach - 0.5))
        : 0;
      const supportLast = referenceSupport
        ? Math.min(source.height - 1, Math.floor(centreLine + referenceReach - 0.5))
        : source.height - 1;
      function along(ty) {
        const left = at(-0.5, ty),
          right = at(0.5, ty);
        const cx = ((left[0] + right[0]) / 2 + margin) * OVERSAMPLE - 0.5;
        const cy = (left[1] + right[1]) / 2;
        const dx = (right[0] - left[0]) * OVERSAMPLE,
          dy = right[1] - left[1];
        if (!(dx > 0)) throw Error('Probe requires positive horizontal inverse-map derivative');
        const breaks = [-0.5];
        for (const knot of sortedKnots) {
          const t = (knot - cx) / dx;
          if (t > -0.5 && t < 0.5) breaks.push(t);
        }
        breaks.push(0.5);
        let sum = 0;
        for (let i = 1; i < breaks.length; i++) {
          const half = (breaks[i] - breaks[i - 1]) / 2,
            middle = (breaks[i] + breaks[i - 1]) / 2;
          for (const [node, weight] of nodes) {
            const t = middle + half * node,
              sx = cx + dx * t,
              line = cy + dy * t;
            const index = Math.floor(sx),
              fraction = sx - index;
            let beam = 0;
            const first = Math.max(supportFirst, Math.ceil(line - 8 * spot.lines - 0.5));
            const last = Math.min(supportLast, Math.floor(line + 8 * spot.lines - 0.5));
            for (let row = first; row <= last; row++) {
              const data = rowData(row);
              if (!data) continue;
              const a = index >= 0 && index < count ? data[index] : 0;
              const b = index + 1 >= 0 && index + 1 < count ? data[index + 1] : 0;
              const distance = (line - row - 0.5) / spot.lines;
              beam +=
                ((a * (1 - fraction) + b * fraction) * Math.exp(-0.5 * distance * distance)) /
                (spot.lines * Math.sqrt(2 * Math.PI));
            }
            sum += half * weight * beam * grille(channel, x + 0.5 + t, pitch);
          }
        }
        return sum * (1 - wireShadow(monitor, y + 0.5 + ty, H));
      }
      // A full source-line interval per vertical cell, and <=1/4 output pixel
      // for the filtered wires. Gaussian width remains resolved under minification.
      const cells = Math.max(4, Math.ceil(fy));
      let sum = 0;
      for (let cell = 0; cell < cells; cell++) {
        const middle = -0.5 + (cell + 0.5) / cells,
          half = 0.5 / cells;
        for (const [node, weight] of nodes) sum += half * weight * along(middle + half * node);
      }
      light.push(sum * gain);
    }
    return applyMatrix(matrix, light);
  }

  return {
    layout,
    pixel: integratePixel,
    // Borrowed fixture fields for independent spatial diagnostics only.
    field: {
      spot,
      gain,
      margin,
      count,
      rows: Array.from({ length: source.height }, (_, row) => rowData(row)),
      lights: Array.from({ length: source.height }, (_, row) => lights.get(rowType(row)) ?? null),
      knots: sortedKnots.map((k) => (k + 0.5) / OVERSAMPLE - margin),
    },
    // Reconstruct the exact held-level fixture for checks against tubeReference.
    frame() {
      const pixels = new Uint8ClampedArray(source.width * source.height * 4);
      for (let y = 0; y < source.height; y++)
        for (let x = 0; x < source.width; x++) {
          const on =
            pattern === 'checker'
              ? ((x + y) & 1) === 0
              : pattern === 'impulse'
                ? x === Math.floor(source.width / 2) && y === Math.floor(source.height / 2)
                : true;
          pixels.set([on ? 255 : 0, on ? 255 : 0, on ? 255 : 0, 255], (y * source.width + x) * 4);
        }
      return pixels;
    },
  };
}
