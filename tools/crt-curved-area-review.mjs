// Reproduce the sampled combined curvature/convergence approximation review.
// Run: node tools/crt-curved-area-review.mjs [--quick] [--tiny]
import { createCurvedAreaProbe } from '../proof/crt/curved-area.mjs';
import { surfaceToOutput } from '../src/crt/geometry.mjs';
import { SNES_PAL_RGB as source, SONY_PVM_20M2E as monitor } from '../src/crt/profiles.mjs';
import { srgbEncode } from '../src/crt/signal.mjs';

const quick = process.argv.includes('--quick'),
  orders = quick ? [6, 10] : [8, 12],
  results = [],
  started = performance.now();
const difference = (a, b) => ({
  linear: Math.max(...a.map((v, c) => Math.abs(v - b[c]))),
  code: Math.max(...a.map((v, c) => 255 * Math.abs(srgbEncode(v) - srgbEncode(b[c])))),
});
for (const pattern of quick ? ['checker'] : ['white', 'checker', 'impulse']) {
  const probe = createCurvedAreaProbe(source, monitor, pattern),
    p = probe.layout.picture;
  for (const [W, H] of quick
    ? [
        [1440, 1080],
        [64, 48],
      ]
    : [
        [2880, 2160],
        [1440, 1080],
        [400, 300],
        [64, 48],
        [12, 9],
        ...(process.argv.includes('--tiny')
          ? [
              [4, 3],
              [1, 1],
            ]
          : []),
      ]) {
    const positions = new Map();
    const add = (x, y) => {
      x = Math.max(0, Math.min(W - 1, Math.floor(x)));
      y = Math.max(0, Math.min(H - 1, Math.floor(y)));
      positions.set(`${x},${y}`, [x, y]);
    };
    if (H >= 48) {
      for (const u of [0, 0.125, 0.5, 0.875, 1])
        for (const v of [0, 0.125, 0.5, 0.875, 1]) {
          const at = surfaceToOutput(probe.layout, p.x + u * p.width, p.y + v * p.height);
          add(at.x * W, at.y * H);
          if ((u === 0 || u === 1) && (v === 0 || v === 1)) add(at.x * W - 1, at.y * H - 1);
        }
      for (const wire of monitor.damperWires.positions)
        for (const u of [0.125, 0.5, 0.875]) {
          const at = surfaceToOutput(probe.layout, u, wire);
          for (const delta of [-1, 0, 1]) add(at.x * W, at.y * H + delta);
        }
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) add(W / 2 + dx, H / 2 + dy);
      for (const [x, y] of [
        [0, 0],
        [W - 1, H - 1],
        [0, H / 2],
        [W / 2, 0],
      ])
        add(x, y);
    } else {
      for (const u of [0, 0.5, 1]) for (const v of [0, 0.5, 1]) add(u * W, v * H);
    }
    const max = { combined: 0, curvature: 0, convergence: 0, linear: 0, refinement: 0 },
      worst = {};
    for (const [x, y] of positions.values()) {
      const fine = ['local', 'curved', 'spatial'].map((mode) =>
        probe.pixel(W, H, x, y, mode, orders[1]),
      );
      const coarse = ['local', 'curved', 'spatial'].map((mode) =>
        probe.pixel(W, H, x, y, mode, orders[0]),
      );
      const combined = difference(fine[0], fine[2]),
        curvature = difference(fine[0], fine[1]),
        convergence = difference(fine[1], fine[2]);
      if (combined.code > max.combined)
        Object.assign(worst, { x, y, local: fine[0], spatial: fine[2] });
      max.combined = Math.max(max.combined, combined.code);
      max.curvature = Math.max(max.curvature, curvature.code);
      max.convergence = Math.max(max.convergence, convergence.code);
      max.linear = Math.max(max.linear, combined.linear);
      for (let mode = 0; mode < 3; mode++)
        max.refinement = Math.max(max.refinement, difference(coarse[mode], fine[mode]).code);
    }
    const result = { pattern, width: W, height: H, pixels: positions.size, max, worst };
    results.push(result);
    console.log(JSON.stringify({ progress: result }));
  }
}
console.log(
  JSON.stringify(
    {
      contract:
        'Sampled independent point-density area integration of the current PAL electrical source and curved monitor, neutral controls, including grille, wires and nonzero halo. Local: centre displacement and diagonal footprint; curved: exact per-point cylinder with fixed centre displacement; spatial: exact per-point cylinder and spatial displacement. The existing output-pixel Gaussian mask filter is retained with local derivative scaling. Eight-sigma point tails in all modes isolate mapping error from finite row support. No Jacobian light multiplier. This is neither hardware calibration nor a global bound.',
      orders,
      source: source.name,
      monitor: monitor.name,
      results,
      durationMs: performance.now() - started,
    },
    null,
    2,
  ),
);
