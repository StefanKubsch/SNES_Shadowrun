// CRT geometry (docs/CRT-FILTER.md): pure calculations, independent of the DOM.
// Output and raster coordinates are normalized, with the origin at the top left.
// The source is progressive: one source row occupies one active raster line.
// Profile assumptions (including the PAL window) belong to profiles.mjs.
// Dimensions, clocks and active intervals must be positive; underscan must
// leave a nonzero raster. Cylinder dimensions/views are validated explicitly;
// these calculations do not calibrate profiles.
import { CENTRE } from '../constants/crt.mjs';

// Screen coordinates are normalised to the width: the edge is half a width from the centre.
const HALF_WIDTH_SQUARED = CENTRE * CENTRE;

// Source rectangle in the active raster, before monitor underscan.
// source.position, when supplied, contains both x (seconds from the start of
// the active line) and y (lines from the first active line). Otherwise centre
// the picture. A source pixel lasts 1 / dotClockHz seconds horizontally.
export function pictureInRaster(source, standard) {
  const width = source.width / source.dotClockHz / standard.activeLineS;
  const height = source.height / standard.activeLines;
  const position = source.position;
  const x = position ? position.x / standard.activeLineS : (1 - width) / 2;
  const y = position ? position.y / standard.activeLines : (1 - height) / 2;
  return { x, y, width, height };
}

// Physical pixel width / height within the raster. Source dimensions cancel:
// (picture.width * aspect / source.width) / (picture.height / source.height).
// Position and uniform underscan do not change this ratio.
export function pixelAspect(source, standard) {
  return (standard.aspect * standard.activeLines) / source.dotClockHz / standard.activeLineS;
}

// Output aspect is width / height; picture is the normalized source rectangle.
// With CRT enabled, scale the active raster about the screen centre. Without
// CRT, fill the output with square source pixels, independent of the monitor.
export function outputLayout(source, standard, monitor, enabled) {
  if (!enabled) {
    return {
      aspect: source.width / source.height,
      picture: { x: 0, y: 0, width: 1, height: 1 },
    };
  }

  const rasterScale = 1 - (monitor?.underscan ?? 0);
  const margin = (1 - rasterScale) / 2;
  // This rectangle is new for each call; reuse it for the screen transform.
  const picture = pictureInRaster(source, standard);
  picture.x = margin + picture.x * rasterScale;
  picture.y = margin + picture.y * rasterScale;
  picture.width *= rasterScale;
  picture.height *= rasterScale;
  const layout = { aspect: standard.aspect, picture };
  const surface = monitorSurface(monitor);
  if (surface) {
    layout.surface = surface;
    // The projected top/bottom may peak at the cylinder centre, between the
    // corners. These bounds let the photographic surround fit the whole image.
    const points = [];
    for (const u of [
      picture.x,
      picture.x + picture.width,
      Math.max(picture.x, Math.min(CENTRE, picture.x + picture.width)),
    ])
      for (const v of [picture.y, picture.y + picture.height])
        points.push(surfaceToOutput(layout, u, v));
    const left = Math.min(...points.map((p) => p.x));
    const top = Math.min(...points.map((p) => p.y));
    layout.bounds = {
      x: left,
      y: top,
      width: Math.max(...points.map((p) => p.x)) - left,
      height: Math.max(...points.map((p) => p.y)) - top,
    };
  }
  return layout;
}

// A front-facing cylinder, with the viewer on its centre normal. Ratios use
// screen width as the length unit, keeping the GPU intersection well scaled.
// The raster is linear in the horizontal chord, not in cylinder arc length.
export function monitorSurface(monitor) {
  if (!monitor?.curvature) return null;
  const { radiusMm, viewingDistanceMm } = monitor.curvature;
  const width = monitor.screenWidthMm;
  if (
    ![radiusMm, viewingDistanceMm, width].every(Number.isFinite) ||
    width <= 0 ||
    radiusMm <= width / 2 ||
    viewingDistanceMm <= 0
  )
    throw Error(
      'crt: cylinder requires finite positive width/distance and radius greater than half the width',
    );
  const radius = radiusMm / width,
    distance = viewingDistanceMm / width;
  // All canvas rays must hit the front surface, away from its tangent. This
  // also ensures the complete visible chord projects monotonically.
  if (distance * radius * radius <= HALF_WIDTH_SQUARED * (distance + 2 * radius))
    throw Error('crt: cylinder perspective must intersect the full canvas');
  return { radius, distance };
}

export function surfaceToOutput(layout, u, v) {
  if (!layout.surface) return { x: u, y: v };
  const { radius, distance } = layout.surface;
  const x = u - CENTRE;
  // Rationalized sagitta avoids subtracting nearly equal radii.
  const depth = (x * x) / (radius + Math.sqrt(radius * radius - x * x));
  const scale = distance / (distance + depth);
  return { x: CENTRE + x * scale, y: CENTRE + (v - CENTRE) * scale };
}

// Exact ray/cylinder inverse, plus its local derivatives. The renderer uses
// the diagonal scales for its output-area integrals. Horizontal-to-vertical
// shear and variation within that pixel remain an explicit approximation.
export function outputToSurface(layout, u, v) {
  if (!layout.surface) return { x: u, y: v, scaleX: 1, scaleY: 1, shearY: 0 };
  const { radius: r, distance: d } = layout.surface;
  const x = u - CENTRE;
  const root = Math.sqrt(d * d * r * r - x * x * d * (d + 2 * r));
  const t = (d * (d + 2 * r)) / (d * (d + r) + root);
  const derivative = (t * t * x) / root;
  return {
    x: CENTRE + x * t,
    y: CENTRE + (v - CENTRE) * t,
    scaleX: t + x * derivative,
    scaleY: t,
    shearY: (v - CENTRE) * derivative,
  };
}

export function sourceToOutput(layout, source, x, y) {
  const p = layout.picture;
  return surfaceToOutput(
    layout,
    p.x + (x / source.width) * p.width,
    p.y + (y / source.height) * p.height,
  );
}

// Invert the output rectangle to fractional source coordinates. Coordinates
// describe pixel edges: the first pixel centre is (0.5, 0.5), the far edges
// are (width, height). Leave border points outside the source; do not clamp
// them onto an edge pixel. The caller converts CSS/device pixels to u and v.
export function outputToSource(layout, source, u, v) {
  const picture = layout.picture;
  const at = outputToSurface(layout, u, v);
  return {
    x: ((at.x - picture.x) / picture.width) * source.width,
    y: ((at.y - picture.y) / picture.height) * source.height,
  };
}
