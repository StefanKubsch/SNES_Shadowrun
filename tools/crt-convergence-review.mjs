// Reproduce the bounded convergence approximation review; no GPU or ROM needed.
// Run: node tools/crt-convergence-review.mjs [--quick]
import { createConvergenceProbe } from '../proof/crt/convergence.mjs';
import { SNES_PAL_RGB as source, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';
import { srgbEncode } from '../src/crt/signal.mjs';

const quick = process.argv.includes('--quick');
const monitor = { ...SONY_PVM_20M2E, halation: { ...SONY_PVM_20M2E.halation, energy: 0 } };
const orders = quick ? [4, 8] : [8, 12];
const results = [];
const start = performance.now();
for (const pattern of quick ? ['checker'] : ['white', 'checker', 'impulse']) {
  const probe = createConvergenceProbe(source, monitor, pattern);
  for (const height of quick ? [1080, 48] : [2160, 1080, 300, 48, 9, 3, 1]) {
    const width = Math.round((height * 4) / 3),
      positions = new Map();
    const add = (x, y) => {
      x = Math.min(width - 1, Math.max(0, Math.floor(x)));
      y = Math.min(height - 1, Math.max(0, Math.floor(y)));
      positions.set(`${x},${y}`, [x, y]);
    };
    const p = probe.layout.picture;
    for (const u of [0, 0.5, 1])
      for (const v of [0, 0.5, 1]) add((p.x + p.width * u) * width, (p.y + p.height * v) * height);
    for (const wire of monitor.damperWires.positions)
      for (const delta of [-1, 0, 1]) add(width / 2, wire * height + delta);
    for (const [u, v] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ])
      add(u * width, v * height);
    if (height >= 300) {
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++) add(width / 2 + dx, height / 2 + dy);
      for (const u of [0.125, 0.875])
        for (const v of [0.125, 0.875])
          add((p.x + p.width * u) * width, (p.y + p.height * v) * height);
    }
    let maxLinear = 0,
      maxCode = 0,
      maxRefinementLinear = 0,
      maxRefinementCode = 0,
      worst;
    for (const [x, y] of positions.values()) {
      const coarse = [false, true].map((variable) =>
        probe.pixel(width, height, x, y, variable, orders[0]),
      );
      const fine = [false, true].map((variable) =>
        probe.pixel(width, height, x, y, variable, orders[1]),
      );
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(fine[0][channel] - fine[1][channel]);
        const code = 255 * Math.abs(srgbEncode(fine[0][channel]) - srgbEncode(fine[1][channel]));
        if (code > maxCode)
          worst = { x, y, channel, fixed: fine[0][channel], varying: fine[1][channel] };
        maxLinear = Math.max(maxLinear, difference);
        maxCode = Math.max(maxCode, code);
        for (let mode = 0; mode < 2; mode++) {
          maxRefinementLinear = Math.max(
            maxRefinementLinear,
            Math.abs(coarse[mode][channel] - fine[mode][channel]),
          );
          maxRefinementCode = Math.max(
            maxRefinementCode,
            255 * Math.abs(srgbEncode(coarse[mode][channel]) - srgbEncode(fine[mode][channel])),
          );
        }
      }
    }
    results.push({
      pattern,
      width,
      height,
      pixels: positions.size,
      maxLinear,
      maxCode,
      maxRefinementLinear,
      maxRefinementCode,
      worst,
    });
  }
}
console.log(
  JSON.stringify(
    {
      contract:
        'Inverse displacement evaluated at destination coordinates; compare centre translation with spatial variation. Identical output-pixel mask filter, no displacement Jacobian light multiplier, neutral controls, no halo; sampled fixtures only, not a hardware calibration or a global error bound.',
      orders,
      source: source.name,
      monitor: monitor.name,
      results,
      durationMs: performance.now() - start,
    },
    null,
    2,
  ),
);
