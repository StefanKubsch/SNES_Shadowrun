// The picture renderer of phase 5 (docs/FRAME-DESCRIPTION.md): it draws one frame
// from a frame description and knows no PPU registers. The SNES back end
// (proof/video/ppu-frame.mjs) builds the description from its PPU model; game code
// can later build it directly.
//
// A frame description is either BLANK_FRAME (forced blank or brightness 0) or:
//   brightness   1-15
//   main, sub    layer bits of the main and the sub screen (bit n: source n below)
//   mainWindows, subWindows  layer bits masked by their window areas
//   windowAreas  per source 0-4 and the colour window 5: { edge, invert }, where
//                edge is the first index (0 or 2) of an edge pair, or -1 without
//   edges        the four window edges (x of window 1 left/right, window 2 left/right)
//   clip         where the main screen is black: CLIP_NEVER/OUTSIDE/INSIDE/ALWAYS
//                of the colour window
//   math         null, or colour math { layers, half, subtract, region, sub, fixed }:
//                source bits, halving, subtraction, MATH_ALWAYS/INSIDE/OUTSIDE of the
//                colour window, whether the sub screen is the operand, the fixed colour
//   palette      256 colours (15-bit BGR); 0 is the backdrop, 128-255 the OBJ palettes
//   vram         character and map memory (bytes)
//   layers       BG layers in drawing order: { layer, base, across, width, height,
//                chars, bpp, large, h, v, low, high }: map byte address, screens
//                across, map size in pixels, character byte address, bits per pixel,
//                16x16 cells, scroll offsets and the composition levels of tile
//                priority 0 and 1
//   objects      { base, gap, sprites }: OBJ character byte address, the gap to the
//                second name table, and sprites in OBJ number order with
//                { x, y, size, name, vFlip, hFlip, priority, palette, table }
//   rows         null, or per output row null or a list of changes applied before
//                the row: ['edge', index, x], ['main', bits],
//                ['map', layer, base, across, width, height], ['scroll', layer, axis, offset]
// Composition follows the sources in proof/video/ppu-frame.mjs (Book I chapter 27).
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import {
  COLOUR_COMPONENTS,
  COLOUR_COMPONENT_BITS,
  COLOUR_COMPONENT_MASK,
  MAX_BRIGHTNESS,
  OPAQUE,
  RGBA_BYTES,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SCREEN_MAP_BYTES,
  TILE_SIZE,
} from '../constants/ppu.mjs';

export const BLANK_FRAME = Object.freeze({ blank: true });

// Composition sources and layer bits: BG1-BG4 0-3, OBJ 4, backdrop or colour window 5.
export const OBJ_LAYER = 4,
  BACKDROP = 5,
  COLOUR_WINDOW = 5,
  WINDOW_AREAS = 6;
const OBJ_LAYER_BIT = 1 << OBJ_LAYER,
  BACKDROP_BIT = 1 << BACKDROP;
// Where the main screen is black, and where colour math applies, relative to the
// colour window.
export const CLIP_NEVER = 0,
  CLIP_OUTSIDE = 1,
  CLIP_INSIDE = 2,
  CLIP_ALWAYS = 3;
export const MATH_ALWAYS = 0,
  MATH_INSIDE = 1,
  MATH_OUTSIDE = 2;
// Window areas without a window.
export const NO_WINDOW = Object.freeze({ edge: -1, invert: false });

// RGBA output: byte offset of the alpha channel inside a pixel.
const ALPHA = 3;
// 5-bit colour component to 8-bit output: shift up, then repeat the top bits.
const COMPONENT_LEVELS = 1 << COLOUR_COMPONENT_BITS,
  COMPONENT_TO_BYTE_SHIFT = BYTE_BITS - COLOUR_COMPONENT_BITS,
  COMPONENT_REPEAT_SHIFT = 2 * COLOUR_COMPONENT_BITS - BYTE_BITS;
// Screen maps: 32 x 32 two-byte entries per 2 KiB screen.
const MAP_ROW_BYTES = 64,
  MAP_TILES_SHIFT = 5,
  MAP_TILE_MASK = 31;
// Characters: 8 x 8 pixels; map cells select 8x8 or 16x16.
const TILE_SHIFT = 3,
  TILE_PIXEL_MASK = 7,
  TILE_LAST_PIXEL = 7,
  BPP_4 = 4,
  PLANE_PAIR_STRIDE = 16,
  PLANE_3 = 3;
// A 16x16 map cell names four 8x8 characters, N/N+1 above N+16/N+17.
const LARGE_TILE_SCALE = 2,
  TILE_NAME_ROW_STEP = 16;
// Screen map entry: bit 15 vertical flip, 14 horizontal flip, 13 priority,
// bits 10-12 palette, bits 0-9 character number.
const TILE_V_FLIP = 0x8000,
  TILE_H_FLIP = 0x4000,
  TILE_PRIORITY_SHIFT = 13,
  TILE_PALETTE_SHIFT = 10,
  TILE_PALETTE_MASK = 7,
  TILE_NAME_MASK = 0x3ff;
// OBJ characters: 16 names per row of the 16 x 16 name table, 32 bytes per 4bpp tile.
const OBJ_NAME_ROW_MASK = 0xf0,
  OBJ_NAMES_PER_ROW = 16,
  OBJ_NAME_COLUMN_MASK = 0x0f,
  OBJ_TILE_BYTES = 32;
// OBJ X is nine bits wide; -256 is the X of a wrapped OBJ.
const OBJ_X_HIGH = 256;
// OBJ palettes are colours 128-255, 16 per palette; palettes 4-7 take part in
// colour math.
const OBJ_PALETTE_BASE = 128,
  OBJ_PALETTE_COLOURS = 16,
  OBJ_MATH_PALETTE_FIRST = 4;
// Per line: 32 OBJ in range (33's range over), 34 8x8 tiles (35's time over).
const OBJ_RANGE_LIMIT = 32,
  OBJ_TILE_LIMIT = 34;
// Composition levels of OBJ priority 0-3 (front is higher).
const OBJ_LEVELS = [2, 4, 7, 10];

// Colour index of one pixel in planar tile data: plane pairs interleave per row,
// higher pairs follow 16 bytes later; bit is 7 - x.
export function planarIndex(vram, start, bit, planes) {
  let index = 0;
  for (let plane = 0; plane < planes; plane++)
    index |=
      ((vram[(start + (plane >>> 1) * PLANE_PAIR_STRIDE + (plane & 1)) & WORD_MASK] >>> bit) & 1) <<
      plane;
  return index;
}

// Performance: each output row first decodes every enabled BG layer once into a line
// buffer (colour or -1 for clear, priority level), one tile row per 8 pixels; the
// per-pixel pass then only composes. Nothing is allocated per pixel.
export function renderFrame(d) {
  const pixels = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * RGBA_BYTES);
  if (d.blank) {
    for (let n = ALPHA; n < pixels.length; n += RGBA_BYTES) pixels[n] = OPAQUE;
    return pixels;
  }
  // shade maps a 5-bit component to its 8-bit output at this brightness.
  const shade = new Uint8Array(COMPONENT_LEVELS);
  for (let c = 0; c < COMPONENT_LEVELS; c++) {
    const v = ((c * d.brightness) / MAX_BRIGHTNESS) | 0;
    shade[c] = (v << COMPONENT_TO_BYTE_SHIFT) | (v >>> COMPONENT_REPEAT_SHIFT);
  }
  const { sub, mainWindows, subWindows, windowAreas, clip, math, palette, vram, rows } = d,
    sprites = d.objects.sprites,
    edges = Int16Array.from(d.edges);
  let main = d.main;
  const mathOn = math !== null,
    useSub = mathOn && math.sub;
  // The window area of a source (5: colour window) at x.
  const masked = (layer, x) => {
    const area = windowAreas[layer];
    if (area.edge < 0) return false;
    const inside = x >= edges[area.edge] && x <= edges[area.edge + 1];
    return inside !== area.invert;
  };
  const word = (at) => vram[at & WORD_MASK] | (vram[(at + 1) & WORD_MASK] << BYTE_BITS);
  // Row changes update a copy; the description stays unchanged.
  const layers = d.layers.map((l) => ({
      ...l,
      tileShift: TILE_SHIFT + Number(l.large),
      tilePixelMask: TILE_SIZE * (l.large ? LARGE_TILE_SCALE : 1) - 1,
      // Line buffer of the current row: level << 16 | colour, -1 when clear.
      line: new Int32Array(SCREEN_WIDTH),
    })),
    byLayer = new Map(layers.map((l) => [l.layer, l]));
  // Decodes one output row of a BG layer into its line buffer.
  const decodeRow = (l, y) => {
    // BG lines are 1..224 against OBJ lines 0..223.
    const sy = (y + 1 + l.v) & (l.height - 1),
      ty = sy >>> l.tileShift,
      rowBase =
        l.base +
        (ty >>> MAP_TILES_SHIFT) * l.across * SCREEN_MAP_BYTES +
        (ty & MAP_TILE_MASK) * MAP_ROW_BYTES,
      { line, bpp } = l;
    let lastTx = -1,
      flip = 0,
      level = 0,
      colorBase = 0,
      p0 = 0,
      p1 = 0,
      p2 = 0,
      p3 = 0;
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const sx = (x + l.h) & (l.width - 1),
        tx = sx >>> TILE_SHIFT;
      if (tx !== lastTx) {
        lastTx = tx;
        const mapX = sx >>> l.tileShift,
          tile = word(
            rowBase + (mapX >>> MAP_TILES_SHIFT) * SCREEN_MAP_BYTES + (mapX & MAP_TILE_MASK) * 2,
          ),
          py = tile & TILE_V_FLIP ? l.tilePixelMask - (sy & l.tilePixelMask) : sy & l.tilePixelMask,
          right = l.large ? (tx & 1) ^ Number(!!(tile & TILE_H_FLIP)) : 0,
          name =
            ((tile & TILE_NAME_MASK) + right + (py >>> TILE_SHIFT) * TILE_NAME_ROW_STEP) &
            TILE_NAME_MASK,
          start = l.chars + name * bpp * TILE_SIZE + (py & TILE_PIXEL_MASK) * 2;
        flip = tile & TILE_H_FLIP;
        level = (tile >>> TILE_PRIORITY_SHIFT) & 1 ? l.high : l.low;
        colorBase = ((tile >>> TILE_PALETTE_SHIFT) & TILE_PALETTE_MASK) * (1 << bpp);
        // Plane pairs interleave per row, higher pairs follow 16 bytes later.
        p0 = vram[start & WORD_MASK];
        p1 = vram[(start + 1) & WORD_MASK];
        if (bpp === BPP_4) {
          p2 = vram[(start + PLANE_PAIR_STRIDE) & WORD_MASK];
          p3 = vram[(start + PLANE_PAIR_STRIDE + 1) & WORD_MASK];
        }
      }
      const bit = flip ? sx & TILE_PIXEL_MASK : TILE_LAST_PIXEL - (sx & TILE_PIXEL_MASK);
      let index = ((p0 >>> bit) & 1) | (((p1 >>> bit) & 1) << 1);
      if (bpp === BPP_4) index |= (((p2 >>> bit) & 1) << 2) | (((p3 >>> bit) & 1) << PLANE_3);
      line[x] = index ? (level << WORD_BITS) | palette[colorBase + index] : -1;
    }
  };
  const applyRow = (changes) => {
    for (const change of changes) {
      const [kind] = change;
      if (kind === 'edge') edges[change[1]] = change[2];
      else if (kind === 'main') main = change[1];
      else if (kind === 'map') {
        const l = byLayer.get(change[1]);
        [, , l.base, l.across, l.width, l.height] = change;
      } else {
        const [, layer, vertical, offset] = change,
          l = byLayer.get(layer);
        if (vertical) l.v = offset;
        else l.h = offset;
      }
    }
  };
  const backdrop = palette[0];
  const objColor = new Uint16Array(SCREEN_WIDTH),
    objPalette = new Uint8Array(SCREEN_WIDTH),
    objRank = new Uint8Array(SCREEN_WIDTH),
    range = [],
    loadedTiles = new Uint8Array(OBJ_RANGE_LIMIT),
    firstTileX = new Int16Array(OBJ_RANGE_LIMIT);
  const onScreen = (s, tileX) => s.x + tileX > -TILE_SIZE && s.x + tileX < SCREEN_WIDTH;
  // One screen with its window mask: colour and source (0-3 BG, 4 OBJ, 5 backdrop)
  // of the front pixel at x, as frontRgb/frontSource.
  let frontRgb = 0,
    frontSource = BACKDROP;
  const screen = (enabled, windows, x) => {
    let rgb = backdrop,
      rank = 0,
      source = BACKDROP;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (!(enabled & (1 << l.layer))) continue;
      // A clear pixel changes nothing, whatever its level and window.
      const v = l.line[x];
      if (v < 0) continue;
      const level = v >>> WORD_BITS;
      if (level <= rank || (windows & (1 << l.layer) && masked(l.layer, x))) continue;
      rgb = v & WORD_MASK;
      rank = level;
      source = l.layer;
    }
    frontRgb = rgb;
    frontSource = source;
    if (!(enabled & OBJ_LAYER_BIT)) return;
    // The front OBJ (smallest number) alone is compared with the BG priority.
    const objVisible = !(windows & OBJ_LAYER_BIT && masked(OBJ_LAYER, x)),
      front = objRank[x] > rank && objVisible;
    if (front) {
      frontRgb = objColor[x];
      frontSource = OBJ_LAYER;
    }
  };
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const changes = rows?.[y];
    if (changes) applyRow(changes);
    if (sprites.length) {
      objRank.fill(0);
      range.length = 0;
      const { base, gap } = d.objects;
      // 33's range over: the 32 in-range OBJ with the smallest numbers remain.
      for (let n = 0; n < sprites.length && range.length < OBJ_RANGE_LIMIT; n++) {
        const s = sprites[n];
        const dy = (y - s.y) & BYTE_MASK;
        if (dy >= s.size || (s.x + s.size <= 0 && s.x !== -OBJ_X_HIGH)) continue;
        range.push(s);
      }
      // 35's time over: at most 34 on-screen 8x8 tiles, taken from the largest OBJ
      // number down. A partly loaded OBJ keeps its leftmost on-screen tiles, in
      // screen order whatever the H flip (docs/PPU-ROOM.md).
      const pixel = (s, dx) => {
        const dy = (y - s.y) & BYTE_MASK,
          py = s.vFlip ? s.size - 1 - dy : dy,
          px = s.hFlip ? s.size - 1 - dx : dx;
        const tile =
          ((s.name & OBJ_NAME_ROW_MASK) +
            (py >>> TILE_SHIFT) * OBJ_NAMES_PER_ROW +
            ((s.name + (px >>> TILE_SHIFT)) & OBJ_NAME_COLUMN_MASK)) &
          BYTE_MASK;
        const start =
            base + (s.table ? gap : 0) + tile * OBJ_TILE_BYTES + (py & TILE_PIXEL_MASK) * 2,
          bit = TILE_LAST_PIXEL - (px & TILE_PIXEL_MASK);
        return planarIndex(vram, start, bit, BPP_4);
      };
      let tiles = 0;
      for (let i = range.length - 1; i >= 0; i--) {
        const s = range[i];
        let count = 0;
        firstTileX[i] = s.size;
        for (let tileX = 0; tileX < s.size; tileX += TILE_SIZE)
          if (onScreen(s, tileX)) {
            if (!count) firstTileX[i] = tileX;
            count++;
          }
        loadedTiles[i] = Math.min(count, OBJ_TILE_LIMIT - tiles);
        tiles += loadedTiles[i];
      }
      for (let i = 0; i < range.length; i++) {
        const s = range[i];
        if (!loadedTiles[i]) continue;
        // On-screen tiles are contiguous; those from firstTileX on are loaded.
        const loadedEnd = firstTileX[i] + loadedTiles[i] * TILE_SIZE;
        for (let dx = 0; dx < Math.min(s.size, loadedEnd); dx++) {
          const sx = s.x + dx;
          if (sx < 0 || sx >= SCREEN_WIDTH || objRank[sx]) continue;
          const index = pixel(s, dx);
          if (!index) continue;
          objColor[sx] = palette[OBJ_PALETTE_BASE + s.palette * OBJ_PALETTE_COLOURS + index];
          objRank[sx] = OBJ_LEVELS[s.priority];
          objPalette[sx] = s.palette;
        }
      }
    }
    for (let i = 0; i < layers.length; i++) decodeRow(layers[i], y);
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      screen(main, mainWindows, x);
      let rgb = frontRgb;
      const source = frontSource;
      if (clip !== CLIP_NEVER || mathOn) {
        const inside = masked(COLOUR_WINDOW, x);
        if (
          clip === CLIP_ALWAYS ||
          (clip === CLIP_OUTSIDE && !inside) ||
          (clip === CLIP_INSIDE && inside)
        )
          rgb = 0;
        const bit =
          source === OBJ_LAYER
            ? objPalette[x] >= OBJ_MATH_PALETTE_FIRST
              ? OBJ_LAYER_BIT
              : 0
            : source === BACKDROP
              ? BACKDROP_BIT
              : 1 << source;
        if (
          mathOn &&
          math.layers & bit &&
          (math.region === MATH_ALWAYS ||
            (math.region === MATH_INSIDE && inside) ||
            (math.region === MATH_OUTSIDE && !inside))
        ) {
          let other = math.fixed,
            half = math.half;
          if (useSub) {
            screen(sub, subWindows, x);
            if (frontSource === BACKDROP) half = false;
            else other = frontRgb;
          }
          let out = 0;
          for (
            let c = 0;
            c < COLOUR_COMPONENTS * COLOUR_COMPONENT_BITS;
            c += COLOUR_COMPONENT_BITS
          ) {
            const a = (rgb >>> c) & COLOUR_COMPONENT_MASK,
              b = (other >>> c) & COLOUR_COMPONENT_MASK;
            let v = math.subtract ? a - b : a + b;
            if (half) v >>= 1;
            out |= Math.max(0, Math.min(COLOUR_COMPONENT_MASK, v)) << c;
          }
          rgb = out;
        }
      }
      const at = (y * SCREEN_WIDTH + x) * RGBA_BYTES;
      pixels[at] = shade[rgb & COLOUR_COMPONENT_MASK];
      pixels[at + 1] = shade[(rgb >>> COLOUR_COMPONENT_BITS) & COLOUR_COMPONENT_MASK];
      pixels[at + 2] = shade[(rgb >>> (2 * COLOUR_COMPONENT_BITS)) & COLOUR_COMPONENT_MASK];
      pixels[at + ALPHA] = OPAQUE;
    }
  }
  return pixels;
}
