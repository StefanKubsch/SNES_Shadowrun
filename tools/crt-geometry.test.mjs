import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outputLayout,
  monitorSurface,
  outputToSurface,
  outputToSource,
  pictureInRaster,
  pixelAspect,
  sourceToOutput,
  surfaceToOutput,
} from '../src/crt/geometry.mjs';
import { PAL_625, SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';

// CRT geometry within the documented model (docs/CRT-FILTER.md): source
// pixels at 21.28137 MHz / 4 in a 52 us by 288-line raster, aspect 4:3.
// The model reads the PVM's 5% underscan as a reduction on each axis.
const close = (actual, expected, what) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual} != ${expected}`);
test('the SNES PAL picture lies in the PAL raster by its dot clock and line count', () => {
  const p = pictureInRaster(SNES_PAL_RGB, PAL_625);
  close(p.width, (256 * 4) / 21281370 / 52e-6, 'width');
  close(p.height, 224 / 288, 'height');
  close(p.x, (1 - p.width) / 2, 'x');
  close(p.y, (1 - p.height) / 2, 'y');
  // A source pixel is about 1.39 times as wide as it is high on the screen.
  close(
    pixelAspect(SNES_PAL_RGB, PAL_625),
    (((p.width * 4) / 3 / p.height) * 224) / 256,
    'pixel aspect',
  );
  assert.equal(pixelAspect(SNES_PAL_RGB, PAL_625).toFixed(3), '1.388');
});

test('the assumed cylinder has the stated depth and a perspective projection with straight verticals', () => {
  const layout = outputLayout(SNES_PAL_RGB, PAL_625, SONY_PVM_20M2E, true);
  const sag = 1100 - Math.sqrt(1100 ** 2 - 192 ** 2);
  close(sag, 16.88597091534257, 'centre-to-edge depth in mm');
  const scale = 600 / (600 + sag);
  const corner = surfaceToOutput(layout, 1, 1);
  close(corner.x, 0.5 + 0.5 * scale, 'right edge perspective');
  close(corner.y, 0.5 + 0.5 * scale, 'lower right perspective');
  close(surfaceToOutput(layout, 0.5, 1).y, 1, 'centre remains on the projection plane');
  for (const u of [0, 0.1, 0.5, 0.9, 1]) {
    const top = surfaceToOutput(layout, u, 0.2);
    const bottom = surfaceToOutput(layout, u, 0.8);
    close(top.x, bottom.x, 'vertical grid line stays straight');
    close(top.y + bottom.y, 1, 'vertical symmetry');
    const opposite = surfaceToOutput(layout, 1 - u, 0.2);
    close(top.x + opposite.x, 1, 'horizontal symmetry');
  }
  assert.ok(corner.y < 1 && corner.x < 1, 'edges recede, rather than expanding past the canvas');
});

test('cylinder input mapping and projected bounds preserve every source edge and pixel centre', () => {
  const layout = outputLayout(SNES_PAL_RGB, PAL_625, SONY_PVM_20M2E, true);
  const bounds = layout.bounds;
  for (const x of [0, 0.5, 63.5, 128, 255.5, 256])
    for (const y of [0, 0.5, 111.5, 223.5, 224]) {
      const point = sourceToOutput(layout, SNES_PAL_RGB, x, y);
      const back = outputToSource(layout, SNES_PAL_RGB, point.x, point.y);
      close(back.x, x, 'inverse source x');
      close(back.y, y, 'inverse source y');
      assert.ok(point.x >= bounds.x - 1e-12 && point.x <= bounds.x + bounds.width + 1e-12);
      assert.ok(point.y >= bounds.y - 1e-12 && point.y <= bounds.y + bounds.height + 1e-12);
    }
  assert.ok(bounds.width < layout.picture.width, 'projected picture has a narrower footprint');
  close(bounds.height, layout.picture.height, 'top/bottom bounds include the centre extrema');
  assert.ok(outputToSource(layout, SNES_PAL_RGB, 0, 0).x < 0, 'border input is not clamped');
});

test('local cylinder footprint scales agree with numerical derivatives', () => {
  const layout = outputLayout(SNES_PAL_RGB, PAL_625, SONY_PVM_20M2E, true);
  const step = 1e-5;
  let maxShearPixels = 0;
  for (const u of [0, 0.07, 0.25, 0.5, 0.75, 0.93, 1])
    for (const v of [0, 0.13, 0.5, 0.87, 1]) {
      const at = outputToSurface(layout, u, v);
      const left = outputToSurface(layout, u - step, v);
      const right = outputToSurface(layout, u + step, v);
      const top = outputToSurface(layout, u, v - step);
      const bottom = outputToSurface(layout, u, v + step);
      close(at.scaleX, (right.x - left.x) / (2 * step), 'horizontal derivative');
      close(at.scaleY, (bottom.y - top.y) / (2 * step), 'vertical derivative');
      close(at.shearY, (right.y - left.y) / (2 * step), 'shear derivative');
      maxShearPixels = Math.max(maxShearPixels, (Math.abs(at.shearY) * 3) / 4);
    }
  assert.ok(
    maxShearPixels > 0.04 && maxShearPixels < 0.055,
    `omitted shear across one 4:3 pixel: ${maxShearPixels}`,
  );
});

test('flat profiles preserve their geometry and invalid cylinders fail explicitly', () => {
  for (const monitor of [null, {}, { ...SONY_PVM_20M2E, curvature: null }]) {
    assert.equal(monitorSurface(monitor), null);
    const layout = outputLayout(SNES_PAL_RGB, PAL_625, monitor, true);
    assert.equal(layout.surface, undefined);
    assert.deepEqual(surfaceToOutput(layout, 0.2, 0.7), { x: 0.2, y: 0.7 });
    assert.deepEqual(outputToSurface(layout, 0.2, 0.7), {
      x: 0.2,
      y: 0.7,
      scaleX: 1,
      scaleY: 1,
      shearY: 0,
    });
  }
  for (const [radiusMm, viewingDistanceMm] of [
    [192, 600],
    [1100, 0],
    [NaN, 600],
    [1100, Infinity],
    [1100, 1],
  ])
    assert.throws(
      () => monitorSurface({ screenWidthMm: 384, curvature: { radiusMm, viewingDistanceMm } }),
      /crt: cylinder/,
    );
});
test('with the tube the PVM underscan shrinks the raster around the screen centre', () => {
  const p = pictureInRaster(SNES_PAL_RGB, PAL_625),
    { aspect, picture } = outputLayout(SNES_PAL_RGB, PAL_625, SONY_PVM_20M2E, true);
  close(aspect, 4 / 3, 'aspect');
  close(picture.width, p.width * 0.95, 'width');
  close(picture.height, p.height * 0.95, 'height');
  close(picture.x + picture.width / 2, 0.5, 'centre x');
  close(picture.y + picture.height / 2, 0.5, 'centre y');
  const corner = outputToSource({ picture }, SNES_PAL_RGB, picture.x, picture.y),
    end = outputToSource(
      { picture },
      SNES_PAL_RGB,
      picture.x + picture.width,
      picture.y + picture.height,
    );
  close(corner.x, 0, 'left');
  close(corner.y, 0, 'top');
  close(end.x, 256, 'right');
  close(end.y, 224, 'bottom');
  assert.ok(
    outputToSource({ picture }, SNES_PAL_RGB, 0, 0).x < 0,
    'screen corner is outside the picture',
  );
});
test('without the tube the output is the plain source picture with square pixels', () => {
  const layout = outputLayout(SNES_PAL_RGB, PAL_625, SONY_PVM_20M2E, false);
  assert.deepEqual(layout, { aspect: 256 / 224, picture: { x: 0, y: 0, width: 1, height: 1 } });
  assert.deepEqual(outputToSource(layout, SNES_PAL_RGB, 0.5, 0.25), { x: 128, y: 56 });
});

// Deliberately different from PAL, with independently specified expected
// rectangles. This checks units and asymmetric placement, not SNES hardware.
const customStandard = { activeLineS: 0.001, activeLines: 200, aspect: 2 };
const customSource = { width: 400, height: 100, dotClockHz: 1e6 };
for (const { position, raster, output } of [
  {
    position: { x: 0, y: 0 },
    raster: { x: 0, y: 0, width: 0.4, height: 0.5 },
    output: { x: 0.1, y: 0.1, width: 0.32, height: 0.4 },
  },
  {
    position: { x: 0.0001, y: 25 },
    raster: { x: 0.1, y: 0.125, width: 0.4, height: 0.5 },
    output: { x: 0.18, y: 0.2, width: 0.32, height: 0.4 },
  },
]) {
  test(`explicit picture position uses seconds and lines: ${JSON.stringify(position)}`, () => {
    const source = { ...customSource, position };
    const picture = pictureInRaster(source, customStandard);
    const layout = outputLayout(source, customStandard, { underscan: 0.2 }, true);
    for (const key of ['x', 'y', 'width', 'height']) {
      close(picture[key], raster[key], `raster ${key}`);
      close(layout.picture[key], output[key], `output ${key}`);
    }
    assert.equal(layout.aspect, 2);
    const corner = outputToSource(layout, source, output.x, output.y);
    close(corner.x, 0, 'first pixel left edge');
    close(corner.y, 0, 'first pixel top edge');
    const centre = outputToSource(
      layout,
      source,
      output.x + output.width / 800,
      output.y + output.height / 200,
    );
    close(centre.x, 0.5, 'first pixel centre x');
    close(centre.y, 0.5, 'first pixel centre y');
    const farEdge = outputToSource(
      layout,
      source,
      output.x + output.width,
      output.y + output.height,
    );
    close(farEdge.x, 400, 'far edge x');
    close(farEdge.y, 100, 'far edge y');
    const beyond = outputToSource(layout, source, 1, 1);
    assert.ok(beyond.x > source.width && beyond.y > source.height, 'border is not clamped');
  });
}

test('pixel aspect depends on clock and raster, independent of picture dimensions and position', () => {
  for (const [width, height] of [
    [100, 50],
    [400, 100],
    [800, 200],
  ]) {
    const source = { ...customSource, width, height, position: { x: 0.0001, y: 25 } };
    close(pixelAspect(source, customStandard), 0.4, `${width} x ${height}`);
  }
  close(pixelAspect({ ...customSource, dotClockHz: 2e6 }, customStandard), 0.2, 'double clock');
});

test('layout rectangles belong to their call and absent underscan preserves the raster', () => {
  const source = Object.freeze({
    ...customSource,
    position: Object.freeze({ x: 0.0001, y: 25 }),
  });
  const raster = pictureInRaster(source, customStandard);
  for (const monitor of [null, {}, { underscan: 0 }]) {
    const layout = outputLayout(source, customStandard, monitor, true);
    assert.deepEqual(layout.picture, raster, 'no underscan means no transform');
  }
  const monitor = Object.freeze({ underscan: 0.2 });
  const first = outputLayout(source, customStandard, monitor, true);
  const second = outputLayout(source, customStandard, monitor, true);
  assert.notEqual(first.picture, second.picture);
  first.picture.x = 9;
  close(second.picture.x, 0.18, 'another layout is unaffected');
  assert.deepEqual(pictureInRaster(source, customStandard), raster, 'source is unaffected');
  assert.deepEqual(
    outputLayout(source, null, null, false),
    {
      aspect: 4,
      picture: { x: 0, y: 0, width: 1, height: 1 },
    },
    'plain output does not need a raster or monitor',
  );
});
