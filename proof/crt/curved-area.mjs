// Independent output-area quadrature for the combined curved CRT model.
// Shared: held-level light/spot fields and the screen/colour model. Independent:
// cylinder inversion, point beam densities, knot splitting and area integration.
// No production area integrals or outputToSurface are used here.
import { createConvergenceProbe, gaussLegendre } from './convergence.mjs';
import { gaussWeights, halationKernel, OVERSAMPLE, LINE_REACH } from '../../src/crt/beam.mjs';
import { grille, pitchPixels, screenHeightMm } from '../../src/crt/screen.mjs';
import { applyMatrix, phosphorToOutput, SRGB } from '../../src/crt/colour.mjs';

// Solve the forward sagitta projection by Newton iteration, rather than using
// the renderer's quadratic ray intersection. Derivatives follow that forward map.
export function intersectCylinder(surface, u, v) {
  if (!surface) return { x: u, y: v, scaleX: 1, scaleY: 1 };
  const { radius: r, distance: d } = surface;
  const target = u - 0.5;
  let x = target,
    scaleX,
    t;
  for (let i = 0; i < 16; i++) {
    const root = Math.sqrt(r * r - x * x);
    const depth = (x * x) / (r + root);
    t = 1 + depth / d;
    scaleX = (t * t) / (t - (x * x) / (d * root));
    const step = (x / t - target) * scaleX;
    if (Math.abs(step) < 2e-15) return { x: 0.5 + x, y: 0.5 + (v - 0.5) * t, scaleX, scaleY: t };
    x -= step;
  }
  throw Error('Cylinder inversion did not converge');
}

const fieldAt = (f, u, v) => f[0] + f[1] * u + f[2] * v + f[3] * u * v;
const zero = { x: [0, 0, 0, 0], y: [0, 0, 0, 0] };
const sample = (data, x) => {
  if (!data) return 0;
  const k = Math.floor(x),
    f = x - k;
  return (data[k] ?? 0) * (1 - f) + (data[k + 1] ?? 0) * f;
};
const normal = (x, sigma) => Math.exp(-0.5 * (x / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

function haloField(source, monitor, field) {
  const halo = halationKernel(source, monitor);
  if (!halo.energy) return { energy: 0, at: () => 0, knotsX: [], knotsY: [] };
  const gx = gaussWeights(halo.x),
    gy = gaussWeights(halo.y),
    types = new Map(),
    rows = [];
  for (const light of field.lights) {
    if (!light) {
      rows.push(null);
      continue;
    }
    if (!types.has(light)) {
      const base = Float64Array.from({ length: source.width }, (_, x) => {
        let sum = 0;
        for (let k = 0; k < OVERSAMPLE; k++) sum += light[(x + field.margin) * OVERSAMPLE + k];
        return sum / OVERSAMPLE;
      });
      const horizontal = Float64Array.from({ length: halo.width }, (_, x) => {
        let sum = 0;
        for (let k = -gx.reach; k <= gx.reach; k++)
          sum += gx.weights[k + gx.reach] * (base[x - halo.marginX + k] ?? 0);
        return sum;
      });
      types.set(light, { horizontal, vertical: new Float64Array(halo.height) });
    }
    rows.push(types.get(light));
  }
  for (let y = 0; y < halo.height; y++)
    for (let k = -gy.reach; k <= gy.reach; k++) {
      const type = rows[y - halo.marginY + k];
      if (type) type.vertical[y] += gy.weights[k + gy.reach];
    }
  return {
    energy: halo.energy,
    knotsX: Array.from({ length: halo.width + 2 }, (_, k) => k - halo.marginX - 0.5),
    knotsY: Array.from({ length: halo.height + 2 }, (_, k) => k - halo.marginY - 0.5),
    at(x, y) {
      let sum = 0;
      for (const type of types.values())
        sum +=
          sample(type.horizontal, x + halo.marginX - 0.5) *
          sample(type.vertical, y + halo.marginY - 0.5);
      return sum;
    },
  };
}

const unique = (values) => [...new Set(values)].sort((a, b) => a - b);
function crossing(fn, target, left = -0.5, right = 0.5) {
  const lo = fn(left),
    hi = fn(right);
  if (!(hi > lo)) throw Error('Diagnostic requires a monotone horizontal map');
  if (target <= lo || target >= hi) return null;
  // Safeguarded interpolation converges quickly for the shallow cylinder.
  let a = left,
    b = right,
    fa = lo,
    fb = hi;
  for (let i = 0; i < 48; i++) {
    const t = a + ((b - a) * (target - fa)) / (fb - fa),
      f = fn(t);
    if (Math.abs(f - target) < 2e-12) return t;
    if (f < target) {
      a = t;
      fa = f;
    } else {
      b = t;
      fb = f;
    }
  }
  throw Error('Interpolation-knot inversion did not converge');
}

export function createCurvedAreaProbe(source, monitor, pattern) {
  const fixture = createConvergenceProbe(source, monitor, pattern),
    { field, layout } = fixture,
    p = layout.picture,
    halo = haloField(source, monitor, field),
    matrix = phosphorToOutput(monitor.phosphor, monitor.white, SRGB),
    heightMm = screenHeightMm(monitor);

  function pixel(W, H, x, y, mode = 'spatial', order = 12, referenceSupport = false) {
    if (!['local', 'curved', 'spatial'].includes(mode)) throw Error(`Unknown spatial mode ${mode}`);
    const nodes = gaussLegendre(order),
      u0 = (x + 0.5) / W,
      v0 = (y + 0.5) / H,
      centre = intersectCylinder(layout.surface, u0, v0),
      footprintY = (source.height / (p.height * H)) * centre.scaleY,
      pitch = pitchPixels(monitor, W),
      out = [];
    const surface = (tx, ty) =>
      mode === 'local'
        ? {
            ...centre,
            x: centre.x + (tx * centre.scaleX) / W,
            y: centre.y + (ty * centre.scaleY) / H,
          }
        : intersectCylinder(layout.surface, u0 + tx / W, v0 + ty / H);
    for (let c = 0; c < 3; c++) {
      const displacement =
        c === 0
          ? (monitor.convergence?.red ?? zero)
          : c === 2
            ? (monitor.convergence?.blue ?? zero)
            : zero;
      const aimed = (at) => {
        const uv = mode === 'spatial' ? at : centre;
        return [
          ((at.x -
            fieldAt(displacement.x, uv.x * 2 - 1, uv.y * 2 - 1) / monitor.screenWidthMm -
            p.x) /
            p.width) *
            source.width,
          ((at.y - fieldAt(displacement.y, uv.x * 2 - 1, uv.y * 2 - 1) / heightMm - p.y) /
            p.height) *
            source.height,
        ];
      };
      const centreLine = aimed(centre)[1],
        reach = LINE_REACH * field.spot.lines + footprintY / 2;
      const supportFirst = referenceSupport ? Math.max(0, Math.ceil(centreLine - reach - 0.5)) : 0,
        supportLast = referenceSupport
          ? Math.min(source.height - 1, Math.floor(centreLine + reach - 0.5))
          : source.height - 1;
      const breaks = [-0.5, 0.5];
      for (const ty of [-0.5, 0, 0.5]) {
        for (const knot of field.knots) {
          const at = crossing((tx) => aimed(surface(tx, ty))[0], knot);
          if (at !== null) breaks.push(at);
        }
      }
      for (const knot of halo.knotsX) {
        const at = crossing((tx) => ((surface(tx, 0).x - p.x) / p.width) * source.width, knot);
        if (at !== null) breaks.push(at);
      }
      const xs = unique(breaks);
      let sum = 0;
      for (let i = 1; i < xs.length; i++) {
        const middle = (xs[i] + xs[i - 1]) / 2,
          half = (xs[i] - xs[i - 1]) / 2;
        for (const [nx, wx] of nodes) {
          const tx = middle + half * nx,
            at0 = surface(tx, 0),
            top = aimed(surface(tx, -0.5)),
            bottom = aimed(surface(tx, 0.5)),
            dx = bottom[0] - top[0],
            dy = bottom[1] - top[1],
            scaleY = at0.scaleY,
            mask = grille(c, (at0.x * W) / at0.scaleX, pitch / at0.scaleX),
            cells = Math.max(4, Math.ceil(Math.abs(dy) / field.spot.lines)),
            ys = Array.from({ length: cells + 1 }, (_, k) => -0.5 + k / cells);
          // At fixed x, cylinder y and the bilinear convergence map are affine
          // in output y. Split interpolation knots exactly before quadrature.
          if (Math.abs(dx) > 1e-15)
            for (const knot of field.knots) {
              const t = (knot - top[0]) / dx - 0.5;
              if (t > -0.5 && t < 0.5) ys.push(t);
            }
          const haloTop = ((surface(tx, -0.5).y - p.y) / p.height) * source.height,
            haloDy = (source.height / (p.height * H)) * scaleY;
          for (const knot of halo.knotsY) {
            const t = (knot - haloTop) / haloDy - 0.5;
            if (t > -0.5 && t < 0.5) ys.push(t);
          }
          const sorted = unique(ys);
          let along = 0;
          for (let j = 1; j < sorted.length; j++) {
            const midY = (sorted[j] + sorted[j - 1]) / 2,
              halfY = (sorted[j] - sorted[j - 1]) / 2;
            for (const [ny, wy] of nodes) {
              const ty = midY + halfY * ny,
                sx = top[0] + (ty + 0.5) * dx,
                line = top[1] + (ty + 0.5) * dy,
                first = Math.max(supportFirst, Math.ceil(line - 8 * field.spot.lines - 0.5)),
                last = Math.min(supportLast, Math.floor(line + 8 * field.spot.lines - 0.5));
              let beam = 0;
              for (let row = first; row <= last; row++)
                beam +=
                  sample(field.rows[row], (sx + field.margin) * OVERSAMPLE - 0.5) *
                  normal(line - row - 0.5, field.spot.lines);
              const v = at0.y + (ty * scaleY) / H;
              let shadow = 0;
              if (monitor.damperWires) {
                const height = H / scaleY,
                  width = (monitor.damperWires.widthMm / heightMm) * height;
                for (const position of monitor.damperWires.positions)
                  shadow += width * normal((v - position) * height, 0.8);
              }
              const scattered = halo.energy
                ? (halo.energy / 3) *
                  halo.at(
                    ((at0.x - p.x) / p.width) * source.width,
                    ((v - p.y) / p.height) * source.height,
                  )
                : 0;
              along += halfY * wy * (beam * mask * (1 - Math.min(1, shadow)) + scattered);
            }
          }
          sum += half * wx * along;
        }
      }
      out.push(field.gain * sum);
    }
    return applyMatrix(matrix, out);
  }
  return { layout, frame: fixture.frame, pixel };
}
