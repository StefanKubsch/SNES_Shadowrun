import { planarIndex, requireValue } from './ppu-state.mjs';
import {
  WORD_MASK,
  BYTE_BITS,
  WORD_BITS,
  BYTE_MASK,
  NIBBLE_BITS,
  NIBBLE_MASK,
} from '../constants/bits.mjs';
import {
  INIDISP,
  BGMODE,
  TM,
  MOSAIC,
  SETINI,
  TMW,
  CGSWSEL,
  CGADSUB,
  TS,
  TSW,
  W12SEL,
  WOBJSEL,
  WH0,
  WH3,
  BG1HOFS,
  BG4VOFS,
  OBJSEL,
  OAMADDH,
  BG1SC,
  BG4SC,
  BG12NBA,
} from '../constants/hardware-registers.mjs';
import {
  CGRAM_COLOURS,
  COLOUR_COMPONENTS,
  COLOUR_COMPONENT_BITS,
  COLOUR_COMPONENT_MASK,
  INIDISP_BRIGHTNESS_MASK,
  INIDISP_FORCED_BLANK,
  MAX_BRIGHTNESS,
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE,
  OBJECT_COUNT,
  OPAQUE,
  RGBA_BYTES,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SCROLL_MASK,
  BGSC_BASE_MASK,
  BGSC_BASE_SHIFT,
  BGSC_TALL,
  BGSC_WIDE,
  CHARACTER_BASE_STEP,
  OBJSEL_BASE_MASK,
  OBJ_NAME_BASE_STEP,
  SCREEN_MAP_BYTES,
  TILE_SIZE,
} from '../constants/ppu.mjs';
// Book I chapter 27 PDF117-119,128,133; appendix A PDF200,205,207,209,212,214.
// Windows: chapter 6 (PDF 68) and PDF 126-129; OBJ line limits: chapter 20 (PDF 91).
// Mode-1 frame at an explicit original boundary. OBJ are opt-in; rows holds the
// H-DMA writes before each output row (hdma.mjs). Colour math: chapter 7 (PDF
// 69-73) and 2130-2132 (PDF 130-132). Other raster changes, two-window logic,
// direct colour and other video modes remain boundaries.
//
// Performance: each output row first decodes every enabled BG layer once into
// a line buffer (colour or -1 for clear, priority level), one tile row per 8
// pixels; the per-pixel pass then only composes. Nothing is allocated per pixel.

// RGBA output: byte offset of the alpha channel inside a pixel.
const ALPHA = 3;
// 5-bit colour component to 8-bit output: shift up, then repeat the top bits.
const COMPONENT_LEVELS = 1 << COLOUR_COMPONENT_BITS,
  COMPONENT_TO_BYTE_SHIFT = BYTE_BITS - COLOUR_COMPONENT_BITS,
  COMPONENT_REPEAT_SHIFT = 2 * COLOUR_COMPONENT_BITS - BYTE_BITS;

// BGMODE $2105: mode number, BG3 priority in mode 1, 16x16 tile size bits.
const BGMODE_MODE_MASK = 0x07,
  BG_MODE_1 = 1,
  BGMODE_BG3_PRIORITY = 0x08;
// TMW/TSW bits 5-7 and TM/TS bits 5-7 are unused; bits 0-4 are BG1-4 and OBJ.
const LAYER_UNUSED_BITS = 0xe0;
// Composition sources and layer bits: BG1-BG4 0-3, OBJ 4, backdrop or colour window 5.
const BG_LAYERS_MODE_1 = 3,
  BG_LAYER_COUNT = 4,
  OBJ_LAYER = 4,
  OBJ_LAYER_BIT = 1 << OBJ_LAYER,
  BACKDROP = 5,
  COLOUR_WINDOW = 5,
  WINDOW_AREAS = 6;
// CGWSEL $2130: bits 7-6 clip the main screen to black, bits 5-4 prevent colour
// math, both relative to the colour window; bit 1 adds the sub screen, bit 0
// selects direct colour.
const CGWSEL_DIRECT_COLOUR = 0x01,
  CGWSEL_ADD_SUBSCREEN = 0x02,
  CGWSEL_CLIP_SHIFT = 6,
  CGWSEL_MATH_SHIFT = 4,
  WINDOW_REGION_MASK = 3;
// Clip regions (main screen black) and colour math regions of CGWSEL.
const CLIP_NEVER = 0,
  CLIP_OUTSIDE = 1,
  CLIP_INSIDE = 2,
  CLIP_ALWAYS = 3;
const MATH_ALWAYS = 0,
  MATH_INSIDE = 1,
  MATH_OUTSIDE = 2,
  MATH_NEVER = 3;
// CGADSUB $2131: bits 0-5 BG1-4/OBJ/backdrop, bit 6 half, bit 7 subtract.
const CGADSUB_LAYERS = 0x3f,
  CGADSUB_BACKDROP = 1 << BACKDROP,
  CGADSUB_HALF = 0x40,
  CGADSUB_SUBTRACT = 0x80;
// Only OBJ palettes 4-7 take part in colour math.
const OBJ_MATH_PALETTE_FIRST = 4;
// Red, green and blue of the fixed colour (fixedKnown bits).
const ALL_COMPONENTS_KNOWN = 7;
// Window settings: one nibble per layer in W12SEL-WOBJSEL. Bit 1/3 enables
// window 1/2, bit 0/2 inverts it.
const WINDOW_1_INVERT = 0x01,
  WINDOW_1_ENABLE = 0x02,
  WINDOW_2_INVERT = 0x04,
  WINDOW_2_ENABLE = 0x08,
  WINDOW_ENABLES = WINDOW_1_ENABLE | WINDOW_2_ENABLE,
  WINDOW_EDGES = 4,
  WINDOW_2_EDGES = 2;

// Screen maps (BGnSC and BGnnNBA fields in src/constants/ppu.mjs): 256 or 512
// pixels per side; 32 x 32 two-byte entries per 2 KiB screen.
const MAP_PIXELS = 256,
  WIDE_MAP_PIXELS = 512;
const MAP_ROW_BYTES = 64,
  MAP_TILES_SHIFT = 5,
  MAP_TILE_MASK = 31;
// Characters: 8 x 8 pixels (TILE_SIZE); map cells select 8x8 or 16x16.
// Mode 1 uses 2bpp for BG3 and 4bpp for BG1/BG2.
const TILE_SHIFT = 3,
  TILE_PIXEL_MASK = 7,
  TILE_LAST_PIXEL = 7,
  BPP_2 = 2,
  BPP_4 = 4,
  PLANE_PAIR_STRIDE = 16,
  PLANE_3 = 3;
// Book I PDF 117 (2-27-3): a 16x16 map cell names four 8x8
// characters, N/N+1 above N+16/N+17. PDF 216 (A-21): doubled map extent.
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
// Priority levels (front is higher) for tile priority bit 0/1 of BG1-BG3 in
// mode 1; BG3 priority bit lifts BG3 high tiles in front of everything.
const BG_LEVELS = [
  [6, 9],
  [5, 8],
  [1, 3],
];
const BG3_TOP_LEVEL = 11;

// OBJSEL $2101: size pair (bits 5-7), name gap (bits 3-4), name base (bits 0-2,
// src/constants/ppu.mjs).
const OBJSEL_SIZE_SHIFT = 5,
  OBJSEL_GAP_SHIFT = 3,
  OBJSEL_GAP_MASK = 3,
  OBJ_NAME_GAP_STEP = 0x2000;
// OAMADDH bit 7: OBJ priority rotation.
const OAMADDH_PRIORITY_ROTATION = 0x80;
// OAM low table entry: X, Y, character name, attributes.
const OAM_X = 0,
  OAM_Y = 1,
  OAM_NAME = 2,
  OAM_ATTRIBUTES = 3;
// OAM high table: two bits per object (X bit 8, size), four objects per byte.
const OBJECTS_PER_HIGH_BYTE_SHIFT = 2,
  OBJECT_IN_HIGH_BYTE_MASK = 3,
  HIGH_BITS_PER_OBJECT = 2,
  HIGH_SIZE_BIT = 1;
// OBJ attributes: bit 7 vertical flip, 6 horizontal flip, 4-5 priority,
// 1-3 palette, 0 second name table.
const OBJ_V_FLIP = 0x80,
  OBJ_H_FLIP = 0x40,
  OBJ_PRIORITY_SHIFT = 4,
  OBJ_PRIORITY_MASK = 3,
  OBJ_PALETTE_SHIFT = 1,
  OBJ_PALETTE_MASK = 7,
  OBJ_SECOND_TABLE = 0x01;
// OBJ characters: 16 names per row of the 16 x 16 name table, 32 bytes per 4bpp tile.
const OBJ_NAME_ROW_MASK = 0xf0,
  OBJ_NAMES_PER_ROW = 16,
  OBJ_NAME_COLUMN_MASK = 0x0f,
  OBJ_TILE_BYTES = 32;
// OBJ X is nine bits wide (high table bit 8); Y is eight bits and wraps at 256.
const OBJ_X_HIGH = 256,
  OBJ_Y_WRAP = 256;
// OBJ palettes are CGRAM colours 128-255, 16 per palette.
const OBJ_PALETTE_BASE = 128,
  OBJ_PALETTE_COLOURS = 16;
// Per line: 32 OBJ in range (33's range over), 34 8x8 tiles (35's time over).
const OBJ_RANGE_LIMIT = 32,
  OBJ_TILE_LIMIT = 34;

const OBJ_SIZES = [
  [8, 16],
  [8, 32],
  [8, 64],
  [16, 32],
  [16, 64],
  [32, 64],
];
const OBJ_LEVELS = [2, 4, 7, 10];
export function renderMode1Frame(ppu, { objects = false, rows = null } = {}) {
  const pixels = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * RGBA_BYTES),
    display = ppu.register(INIDISP);
  if (display & INIDISP_FORCED_BLANK || !(display & INIDISP_BRIGHTNESS_MASK)) {
    for (let n = ALPHA; n < pixels.length; n += RGBA_BYTES) pixels[n] = OPAQUE;
    return pixels;
  }
  // 2100 brightness (PDF 115): 16 steps, no digital formula in the manual; the
  // oracle's output scales each 5-bit component by brightness/15 (truncated).
  // shade maps a 5-bit component to its 8-bit output at this brightness.
  const brightness = display & INIDISP_BRIGHTNESS_MASK,
    shade = new Uint8Array(COMPONENT_LEVELS);
  for (let c = 0; c < COMPONENT_LEVELS; c++) {
    const v = ((c * brightness) / MAX_BRIGHTNESS) | 0;
    shade[c] = (v << COMPONENT_TO_BYTE_SHIFT) | (v >>> COMPONENT_REPEAT_SHIFT);
  }
  ppu.requireComplete();
  const mode = ppu.register(BGMODE);
  // TM may change per row through H-DMA (hdma.mjs): layers and OBJ are prepared
  // for every value of the field, main holds the value of the current row.
  let main = ppu.register(TM),
    mainAny = main;
  if (rows)
    for (const w of rows)
      for (let n = 0; n < w.length; n += 2) if (w[n] === TM) mainAny |= w[n + 1];
  requireValue((mode & BGMODE_MODE_MASK) === BG_MODE_1, 'ppu_mode1_required');
  requireValue(ppu.register(MOSAIC) === 0, 'ppu_mosaic_source_required');
  requireValue(ppu.register(SETINI) === 0, 'ppu_screen_mode_required');
  requireValue(!ppu.hdmaEnabled || rows, 'ppu_hdma_source_required');
  const tmw = ppu.register(TMW),
    cgwsel = ppu.register(CGSWSEL),
    math = ppu.register(CGADSUB);
  requireValue(
    !(tmw & LAYER_UNUSED_BITS) && !(cgwsel & CGWSEL_DIRECT_COLOUR),
    'ppu_composition_source_required',
  );
  // CGWSEL bits 7-6: main screen black never/outside/inside/always (the
  // manual's MAIN SW on always/inside only/outside only/off); bits 5-4: colour
  // math always/inside/outside/never, both relative to the colour window.
  // Bit 1 adds the sub screen (212D), else the fixed colour (2132). CGADSUB
  // 2131: bits 0-5 BG1-4/OBJ (palettes 4-7 only)/backdrop, bit 6 half, bit 7
  // subtract. A clear sub screen pixel uses the fixed colour, not halved.
  const clip = cgwsel >>> CGWSEL_CLIP_SHIFT,
    prevent = (cgwsel >>> CGWSEL_MATH_SHIFT) & WINDOW_REGION_MASK,
    mathOn = !!(math & CGADSUB_LAYERS) && prevent !== MATH_NEVER;
  const useSub = mathOn && !!(cgwsel & CGWSEL_ADD_SUBSCREEN),
    sub = useSub ? ppu.register(TS) : 0,
    tsw = useSub ? ppu.register(TSW) : 0;
  requireValue(!(tsw & LAYER_UNUSED_BITS), 'ppu_composition_source_required');
  if (mathOn) requireValue(ppu.fixedKnown === ALL_COMPONENTS_KNOWN, 'ppu_fixed_color_required');
  // Halving a fixed-colour or clipped (black) main pixel is not stated in the manual.
  if (mathOn && math & CGADSUB_HALF)
    requireValue(useSub && clip === CLIP_NEVER, 'ppu_color_math_half_source_required');
  // TMW (212E) masks BG1-4/OBJ (bits 0-4) in their window areas (2123-2125).
  // Bit 1/3 enables window 1/2, bit 0/2 inverts it. With both windows on a
  // layer the 212A/212B logic applies; that combination is still a boundary.
  const windowSelect = new Uint8Array(WINDOW_AREAS),
    edges = new Int16Array(WINDOW_EDGES).fill(-1);
  const colorWindow =
    clip === CLIP_OUTSIDE ||
    clip === CLIP_INSIDE ||
    (mathOn && (prevent === MATH_INSIDE || prevent === MATH_OUTSIDE));
  if (colorWindow) {
    const v = ppu.register(WOBJSEL) >>> NIBBLE_BITS;
    requireValue((v & WINDOW_ENABLES) !== WINDOW_ENABLES, 'ppu_window_logic_source_required');
    windowSelect[COLOUR_WINDOW] = v;
  }
  for (let layer = 0; layer <= OBJ_LAYER; layer++)
    if ((tmw | tsw) & (1 << layer)) {
      const v =
        layer < BG_LAYER_COUNT
          ? (ppu.register(W12SEL + (layer >>> 1)) >>> ((layer & 1) * NIBBLE_BITS)) & NIBBLE_MASK
          : ppu.register(WOBJSEL) & NIBBLE_MASK;
      requireValue((v & WINDOW_ENABLES) !== WINDOW_ENABLES, 'ppu_window_logic_source_required');
      windowSelect[layer] = v;
    }
  for (let n = 0; n < WINDOW_EDGES; n++)
    if (ppu.registerKnown[WH0 - INIDISP + n]) edges[n] = ppu.registers[WH0 - INIDISP + n];
  // The window area of a layer (5: colour window) at x, after IN/OUT.
  const masked = (layer, x) => {
    const v = windowSelect[layer];
    if (!(v & WINDOW_ENABLES)) return false;
    const w = v & WINDOW_1_ENABLE ? 0 : WINDOW_2_EDGES,
      inside = x >= edges[w] && x <= edges[w + 1];
    return inside !== !!(v & (w ? WINDOW_2_INVERT : WINDOW_1_INVERT));
  };
  requireValue(ppu.scrollPending === -1, 'ppu_scroll_pair_required');
  const sprites = [];
  if ((mainAny | sub) & OBJ_LAYER_BIT) {
    const select = ppu.register(OBJSEL) >>> OBJSEL_SIZE_SHIFT;
    requireValue(select < OBJ_SIZES.length, 'ppu_obj_size_source_required');
    for (let n = 0; n < OBJECT_COUNT; n++) {
      const entry = n * OAM_ENTRY_BYTES,
        highByte = OAM_HIGH_TABLE + (n >>> OBJECTS_PER_HIGH_BYTE_SHIFT),
        highShift = (n & OBJECT_IN_HIGH_BYTE_MASK) * HIGH_BITS_PER_OBJECT;
      const y = ppu.oam[entry + OAM_Y],
        big = (ppu.oam[highByte] >> (highShift + HIGH_SIZE_BIT)) & 1,
        size = OBJ_SIZES[select][big];
      if (!objects)
        requireValue(
          y >= SCREEN_HEIGHT && y + size <= OBJ_Y_WRAP,
          'ppu_visible_obj_source_required',
        );
      else {
        const high = ppu.oam[highByte] >>> highShift,
          attr = ppu.oam[entry + OAM_ATTRIBUTES];
        sprites.push({
          x: ppu.oam[entry + OAM_X] - (high & 1 ? OBJ_X_HIGH : 0),
          y,
          size,
          attr,
          name: ppu.oam[entry + OAM_NAME],
        });
      }
    }
    if (objects)
      requireValue(
        !(ppu.register(OAMADDH) & OAMADDH_PRIORITY_ROTATION),
        'ppu_obj_rotation_source_required',
      );
  }
  const word = (at) => ppu.vram[at & WORD_MASK] | (ppu.vram[(at + 1) & WORD_MASK] << BYTE_BITS);
  const color = (index) => ppu.cgram[index * 2] | (ppu.cgram[index * 2 + 1] << BYTE_BITS);
  // CGRAM does not change while a frame is rendered.
  const palette = new Int32Array(CGRAM_COLOURS);
  for (let n = 0; n < CGRAM_COLOURS; n++) palette[n] = color(n);
  const layers = [];
  for (let layer = 0; layer < BG_LAYERS_MODE_1; layer++)
    if ((mainAny | sub) & (1 << layer)) {
      requireValue(
        ppu.scrollKnown[layer * 2] && ppu.scrollKnown[layer * 2 + 1],
        'ppu_scroll_required',
      );
      const sc = ppu.register(BG1SC + layer),
        nba = ppu.register(BG12NBA + (layer >>> 1)),
        isBg3 = layer === BG_LAYERS_MODE_1 - 1,
        bpp = isBg3 ? BPP_2 : BPP_4,
        large = !!(mode & (1 << (NIBBLE_BITS + layer))),
        scale = large ? LARGE_TILE_SCALE : 1,
        tileSize = TILE_SIZE * scale;
      // Priority levels for tile priority bit 0/1 (front is higher).
      const [low, normalHigh] = BG_LEVELS[layer],
        high = isBg3 && mode & BGMODE_BG3_PRIORITY ? BG3_TOP_LEVEL : normalHigh;
      layers.push({
        layer,
        sc,
        base: (sc & BGSC_BASE_MASK) << BGSC_BASE_SHIFT,
        chars: ((nba >>> ((layer & 1) * NIBBLE_BITS)) & NIBBLE_MASK) * CHARACTER_BASE_STEP,
        bpp,
        width: (sc & BGSC_WIDE ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
        height: (sc & BGSC_TALL ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
        large,
        tileShift: TILE_SHIFT + Number(large),
        tilePixelMask: tileSize - 1,
        h: ppu.scroll[layer * 2],
        v: ppu.scroll[layer * 2 + 1],
        low,
        high,
        // Line buffer of the current row: level << 16 | colour, -1 when clear.
        line: new Int32Array(SCREEN_WIDTH),
      });
    }
  // Decodes one output row of a BG layer into its line buffer.
  const decodeRow = (l, y) => {
    // The manual's A-10 diagram has BG lines 1..224 versus OBJ 0..223.
    const sy = (y + 1 + l.v) & (l.height - 1),
      ty = sy >>> l.tileShift,
      across = l.sc & BGSC_WIDE ? 2 : 1,
      rowBase =
        l.base +
        (ty >>> MAP_TILES_SHIFT) * across * SCREEN_MAP_BYTES +
        (ty & MAP_TILE_MASK) * MAP_ROW_BYTES,
      { line, bpp } = l,
      vram = ppu.vram;
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
        // Plane pairs interleave per row, higher pairs follow 16 bytes later (planarIndex).
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
  // H-DMA writes before a row: window edges, TM, map base/size (PDF 118),
  // and scroll words as low/high pairs (PDF 119). Split pairs stay rejected.
  const scrolled = new Map(layers.map((l) => [l.layer, l]));
  const applyRow = (w) => {
    let pending = -1,
      low = 0;
    for (let n = 0; n < w.length; n += 2) {
      const port = w[n],
        value = w[n + 1];
      if (port >= WH0 && port <= WH3) edges[port - WH0] = value;
      else if (port === TM) main = value;
      else if (port >= BG1SC && port <= BG4SC) {
        const l = scrolled.get(port - BG1SC);
        if (!l) continue;
        const scale = l.large ? LARGE_TILE_SCALE : 1;
        l.sc = value;
        l.base = (value & BGSC_BASE_MASK) << BGSC_BASE_SHIFT;
        l.width = (value & BGSC_WIDE ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale;
        l.height = (value & BGSC_TALL ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale;
      } else if (port >= BG1HOFS && port <= BG4VOFS) {
        if (pending === -1) {
          pending = port;
          low = value;
          continue;
        }
        requireValue(pending === port, 'ppu_scroll_latch_required');
        pending = -1;
        const at = port - BG1HOFS,
          l = scrolled.get(at >>> 1);
        if (!l) continue;
        const offset = ((value << BYTE_BITS) | low) & SCROLL_MASK;
        if (at & 1) l.v = offset;
        else l.h = offset;
      }
    }
    requireValue(pending === -1, 'ppu_scroll_pair_required');
  };
  const backdrop = color(0);
  const objColor = new Uint16Array(SCREEN_WIDTH),
    objPalette = new Uint8Array(SCREEN_WIDTH),
    objRank = new Uint8Array(SCREEN_WIDTH),
    range = [],
    loadedTiles = new Uint8Array(OBJ_RANGE_LIMIT),
    firstTileX = new Int16Array(OBJ_RANGE_LIMIT);
  const onScreen = (s, tileX) => s.x + tileX > -TILE_SIZE && s.x + tileX < SCREEN_WIDTH;
  // One screen (212C or 212D with its window mask 212E/212F): colour and
  // source (0-2 BG, 4 OBJ, 5 backdrop) of the front pixel at x, as
  // frontRgb/frontSource.
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
    const w = rows?.[y];
    if (w) applyRow(w);
    for (let layer = 0; layer < WINDOW_AREAS; layer++) {
      const v = windowSelect[layer];
      if (v & WINDOW_ENABLES) {
        const at = v & WINDOW_1_ENABLE ? 0 : WINDOW_2_EDGES;
        requireValue(edges[at] >= 0 && edges[at + 1] >= 0, 'ppu_register_required', {
          port: WH0 + at,
        });
      }
    }
    if (sprites.length) {
      objRank.fill(0);
      range.length = 0;
      const select = ppu.register(OBJSEL),
        base = (select & OBJSEL_BASE_MASK) * OBJ_NAME_BASE_STEP,
        gap = (((select >>> OBJSEL_GAP_SHIFT) & OBJSEL_GAP_MASK) + 1) * OBJ_NAME_GAP_STEP;
      // 33's range over: the 32 in-range OBJ with the smallest numbers remain.
      for (let n = 0; n < sprites.length && range.length < OBJ_RANGE_LIMIT; n++) {
        const s = sprites[n];
        const dy = (y - s.y) & BYTE_MASK;
        if (dy >= s.size || (s.x + s.size <= 0 && s.x !== -OBJ_X_HIGH)) continue;
        range.push(s);
      }
      // 35's time over: at most 34 on-screen 8x8 tiles, taken from the largest
      // OBJ number down (Book I). Which tiles of a partly loaded OBJ remain is
      // not in the manual; the model keeps its leftmost on-screen tiles, in
      // screen order whatever the H flip, as Mesen2 shows (docs/PPU-ROOM.md).
      const pixel = (s, dx) => {
        const dy = (y - s.y) & BYTE_MASK,
          py = s.attr & OBJ_V_FLIP ? s.size - 1 - dy : dy,
          px = s.attr & OBJ_H_FLIP ? s.size - 1 - dx : dx;
        const tile =
          ((s.name & OBJ_NAME_ROW_MASK) +
            (py >>> TILE_SHIFT) * OBJ_NAMES_PER_ROW +
            ((s.name + (px >>> TILE_SHIFT)) & OBJ_NAME_COLUMN_MASK)) &
          BYTE_MASK;
        const start =
            base +
            (s.attr & OBJ_SECOND_TABLE ? gap : 0) +
            tile * OBJ_TILE_BYTES +
            (py & TILE_PIXEL_MASK) * 2,
          bit = TILE_LAST_PIXEL - (px & TILE_PIXEL_MASK);
        return planarIndex(ppu.vram, start, bit, BPP_4);
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
          const objPaletteNumber = (s.attr >>> OBJ_PALETTE_SHIFT) & OBJ_PALETTE_MASK;
          objColor[sx] = color(OBJ_PALETTE_BASE + objPaletteNumber * OBJ_PALETTE_COLOURS + index);
          objRank[sx] = OBJ_LEVELS[(s.attr >>> OBJ_PRIORITY_SHIFT) & OBJ_PRIORITY_MASK];
          objPalette[sx] = objPaletteNumber;
        }
      }
    }
    for (let i = 0; i < layers.length; i++) decodeRow(layers[i], y);
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      screen(main, tmw, x);
      let rgb = frontRgb;
      const source = frontSource;
      if (clip || mathOn) {
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
              ? CGADSUB_BACKDROP
              : 1 << source;
        if (
          mathOn &&
          math & bit &&
          (prevent === MATH_ALWAYS ||
            (prevent === MATH_INSIDE && inside) ||
            (prevent === MATH_OUTSIDE && !inside))
        ) {
          let other = ppu.fixedColor,
            half = !!(math & CGADSUB_HALF);
          if (useSub) {
            screen(sub, tsw, x);
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
            let v = math & CGADSUB_SUBTRACT ? a - b : a + b;
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
