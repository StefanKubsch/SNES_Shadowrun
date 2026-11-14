import test from 'node:test';
import assert from 'node:assert/strict';
import { createCurvedAreaProbe, intersectCylinder } from '../proof/crt/curved-area.mjs';
import { tubeReference } from '../src/crt/beam.mjs';
import { surfaceToOutput, outputToSurface, outputLayout } from '../src/crt/geometry.mjs';
import { SNES_PAL_RGB as source, SONY_PVM_20M2E as monitor } from '../src/crt/profiles.mjs';
import { srgbEncode } from '../src/crt/signal.mjs';
import { findEdge, withStartPage } from './browser-frame.mjs';

const maxError = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
const codeError = (a, b) => maxError(a.map(srgbEncode), b.map(srgbEncode)) * 255;

test('independent Newton inversion closes the forward cylinder map and its diagonal derivatives', () => {
  const layout = outputLayout(source, source.standard, monitor, true);
  for (const u of [0, 0.07, 0.3, 0.5, 0.89, 1])
    for (const v of [0, 0.273, 0.5, 0.727, 1]) {
      const at = intersectCylinder(layout.surface, u, v),
        back = surfaceToOutput(layout, at.x, at.y),
        production = outputToSurface(layout, u, v),
        step = 1e-5,
        left = intersectCylinder(layout.surface, u - step, v),
        right = intersectCylinder(layout.surface, u + step, v);
      assert.ok(maxError([back.x, back.y], [u, v]) < 2e-14);
      assert.ok(
        maxError(
          [at.x, at.y, at.scaleX, at.scaleY],
          [production.x, production.y, production.scaleX, production.scaleY],
        ) < 2e-14,
      );
      assert.ok(Math.abs((right.x - left.x) / (2 * step) - at.scaleX) < 2e-9);
    }
});

test('independent local point quadrature agrees with the renderer including halation and blank borders', () => {
  for (const pattern of ['white', 'checker', 'impulse']) {
    const probe = createCurvedAreaProbe(source, monitor, pattern),
      reference = tubeReference(probe.frame(), source, monitor);
    for (const [W, H, x, y] of [
      [1440, 1080, 1300, 180],
      [64, 48, 5, 8],
      [64, 48, 32, 24],
      [12, 9, 1, 1],
    ]) {
      const expected = reference.pixel(probe.layout, W, H, x, y),
        local = probe.pixel(W, H, x, y, 'local', 12, true);
      assert.ok(
        maxError(local, expected) < 4e-6,
        `${pattern} ${W}x${H} (${x},${y}): ${local} vs ${expected}`,
      );
    }
  }
});

test('a planar constant displacement is a null control for all three integration modes', () => {
  const flat = {
    ...monitor,
    curvature: null,
    convergence: {
      red: { x: [0.1, 0, 0, 0], y: [-0.05, 0, 0, 0] },
      blue: { x: [-0.08, 0, 0, 0], y: [0.06, 0, 0, 0] },
    },
  };
  const probe = createCurvedAreaProbe(source, flat, 'checker');
  for (const [W, H, x, y] of [
    [1440, 1080, 200, 300],
    [64, 48, 4, 8],
  ]) {
    const local = probe.pixel(W, H, x, y, 'local', 12);
    assert.ok(maxError(local, probe.pixel(W, H, x, y, 'curved', 12)) < 1e-13);
    assert.ok(maxError(local, probe.pixel(W, H, x, y, 'spatial', 12)) < 1e-13);
  }
});

test('combined curvature and convergence differences are resolved by quadrature refinement', () => {
  const probe = createCurvedAreaProbe(source, monitor, 'checker');
  let nonzero = 0;
  for (const [W, H, x, y, limit] of [
    [1440, 1080, 1339, 930, 0.1],
    [2880, 2160, 2678, 1861, 0.1],
    [64, 48, 4, 41, 1],
  ]) {
    const local = probe.pixel(W, H, x, y, 'local', 12),
      spatial = probe.pixel(W, H, x, y, 'spatial', 12),
      coarse = probe.pixel(W, H, x, y, 'spatial', 8);
    assert.ok(
      codeError(coarse, spatial) < 0.001,
      `unresolved quadrature ${W}x${H}: ${codeError(coarse, spatial)}`,
    );
    nonzero = Math.max(nonzero, codeError(local, spatial));
    assert.ok(
      codeError(local, spatial) < limit,
      'profile changes require a renewed approximation review',
    );
  }
  assert.ok(nonzero > 0.001, 'the curved field must actually vary within the sampled pixels');
});

const edge = findEdge();
test(
  'real curved CRT shaders agree with the independently integrated local approximation',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ evalJs }) => {
      for (const pattern of ['white', 'checker', 'impulse']) {
        const probe = createCurvedAreaProbe(source, monitor, pattern),
          pixels = Array.from(probe.frame());
        const result = await evalJs(`(async()=>{
          const {createCrt}=await import('/src/crt/crt.mjs');
          const canvas=document.createElement('canvas');canvas.style.cssText='width:64px;height:48px;display:block';document.body.append(canvas);
          const crt=createCrt(canvas,{source:${JSON.stringify(source)},monitor:${JSON.stringify(monitor)},output:'srgb'});
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          crt.draw(new Uint8ClampedArray(${JSON.stringify(pixels)}));
          const result={available:crt.available,width:canvas.width,height:canvas.height,pixels:Array.from(crt.snapshot())};crt.destroy();canvas.remove();return result;
        })()`);
        assert.equal(result.available, true);
        const W = result.width,
          H = result.height;
        assert.equal(W, 64);
        assert.equal(H, 48);
        for (const [u, v] of [
          [0.08, 0.15],
          [0.5, 0.5],
          [0.9, 0.2],
          [0.5, 0.273],
          [0.5, 0.727],
          [0.02, 0.5],
        ]) {
          const x = Math.floor(W * u),
            y = Math.floor(H * v),
            actual = result.pixels.slice((y * W + x) * 4, (y * W + x) * 4 + 3),
            local = probe
              .pixel(W, H, x, y, 'local', 12, true)
              .map((v) => Math.round(srgbEncode(v) * 255));
          assert.ok(
            maxError(actual, local) <= 1,
            `${pattern} ${W}x${H} (${x},${y}): ${actual} vs ${local}`,
          );
        }
      }
    });
  },
);
