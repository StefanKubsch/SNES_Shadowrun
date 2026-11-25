import { requireValue } from './ppu-state.mjs';
import {
  BLANK_FRAME,
  OBJ_LAYER,
  COLOUR_WINDOW,
  WINDOW_AREAS,
  NO_WINDOW,
  renderFrame,
} from '../../src/video/frame-renderer.mjs';
import { BYTE_BITS, NIBBLE_BITS, NIBBLE_MASK } from '../../src/constants/bits.mjs';
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
} from '../../src/constants/hardware-registers.mjs';
import {
  CGRAM_COLOURS,
  INIDISP_BRIGHTNESS_MASK,
  INIDISP_FORCED_BLANK,
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE,
  OBJECT_COUNT,
  SCREEN_HEIGHT,
  SCROLL_MASK,
  BGSC_BASE_MASK,
  BGSC_BASE_SHIFT,
  BGSC_TALL,
  BGSC_WIDE,
  CHARACTER_BASE_STEP,
  OBJSEL_BASE_MASK,
  OBJ_NAME_BASE_STEP,
} from '../../src/constants/ppu.mjs';
// The SNES back end of the picture (docs/FRAME-DESCRIPTION.md): the PPU registers,
// VRAM, CGRAM and OAM at an explicit original boundary become a frame description,
// which src/video/frame-renderer.mjs draws.
// Book I chapter 27 PDF117-119,128,133; appendix A PDF200,205,207,209,212,214.
// Windows: chapter 6 (PDF 68) and PDF 126-129; OBJ line limits: chapter 20 (PDF 91).
// Mode 1 only. OBJ are opt-in; rows holds the H-DMA writes before each output row
// (hdma.mjs). Colour math: chapter 7 (PDF 69-73) and 2130-2132 (PDF 130-132). Other
// raster changes, two-window logic, direct colour and other video modes remain
// boundaries.

// BGMODE $2105: mode number, BG3 priority in mode 1, 16x16 tile size bits.
const BGMODE_MODE_MASK = 0x07,
  BG_MODE_1 = 1,
  BGMODE_BG3_PRIORITY = 0x08;
// TMW/TSW bits 5-7 and TM/TS bits 5-7 are unused; bits 0-4 are BG1-4 and OBJ.
const LAYER_UNUSED_BITS = 0xe0;
const BG_LAYERS_MODE_1 = 3,
  BG_LAYER_COUNT = 4,
  OBJ_LAYER_BIT = 1 << OBJ_LAYER;
// CGWSEL $2130: bits 7-6 clip the main screen to black, bits 5-4 prevent colour
// math, both relative to the colour window; bit 1 adds the sub screen, bit 0
// selects direct colour. The field values are the renderer's CLIP_* and MATH_*.
const CGWSEL_DIRECT_COLOUR = 0x01,
  CGWSEL_ADD_SUBSCREEN = 0x02,
  CGWSEL_CLIP_SHIFT = 6,
  CGWSEL_MATH_SHIFT = 4,
  WINDOW_REGION_MASK = 3;
const CLIP_NEVER = 0,
  CLIP_OUTSIDE = 1,
  CLIP_INSIDE = 2,
  MATH_INSIDE = 1,
  MATH_OUTSIDE = 2,
  MATH_NEVER = 3;
// CGADSUB $2131: bits 0-5 BG1-4/OBJ/backdrop, bit 6 half, bit 7 subtract.
const CGADSUB_LAYERS = 0x3f,
  CGADSUB_HALF = 0x40,
  CGADSUB_SUBTRACT = 0x80;
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
// pixels per side. Book I PDF 117 (2-27-3) and PDF 216 (A-21): 16x16 cells double
// the map extent.
const MAP_PIXELS = 256,
  WIDE_MAP_PIXELS = 512,
  LARGE_TILE_SCALE = 2;
// Mode 1 uses 2bpp for BG3 and 4bpp for BG1/BG2.
const BPP_2 = 2,
  BPP_4 = 4;
// Priority levels (front is higher) for tile priority bit 0/1 of BG1-BG3 in
// mode 1; BG3 priority bit lifts BG3 high tiles in front of everything.
const BG_LEVELS = [
  [6, 9],
  [5, 8],
  [1, 3],
];
const BG3_TOP_LEVEL = 11;
// OBJSEL $2101: size pair (bits 5-7), name gap (bits 3-4), name base (bits 0-2).
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
// OBJ X is nine bits wide (high table bit 8); Y is eight bits and wraps at 256.
const OBJ_X_HIGH = 256,
  OBJ_Y_WRAP = 256;
const OBJ_SIZES = [
  [8, 16],
  [8, 32],
  [8, 64],
  [16, 32],
  [16, 64],
  [32, 64],
];

// The window area of one nibble of W12SEL-WOBJSEL.
function windowArea(v) {
  if (!(v & WINDOW_ENABLES)) return NO_WINDOW;
  const edge = v & WINDOW_1_ENABLE ? 0 : WINDOW_2_EDGES;
  return { edge, invert: !!(v & (edge ? WINDOW_2_INVERT : WINDOW_1_INVERT)) };
}

// A map base/size write (BGnSC) as the renderer's map change.
function mapOf(sc, large) {
  const scale = large ? LARGE_TILE_SCALE : 1;
  return {
    base: (sc & BGSC_BASE_MASK) << BGSC_BASE_SHIFT,
    across: sc & BGSC_WIDE ? 2 : 1,
    width: (sc & BGSC_WIDE ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
    height: (sc & BGSC_TALL ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
  };
}

// H-DMA writes before a row: window edges, TM, map base/size (PDF 118), and scroll
// words as low/high pairs (PDF 119). Split pairs stay rejected. Writes to layers
// the frame does not draw are dropped.
function rowChanges(w, large) {
  const changes = [];
  let pending = -1,
    low = 0;
  for (let n = 0; n < w.length; n += 2) {
    const port = w[n],
      value = w[n + 1];
    if (port >= WH0 && port <= WH3) changes.push(['edge', port - WH0, value]);
    else if (port === TM) changes.push(['main', value]);
    else if (port >= BG1SC && port <= BG4SC) {
      const layer = port - BG1SC;
      if (!large.has(layer)) continue;
      const { base, across, width, height } = mapOf(value, large.get(layer));
      changes.push(['map', layer, base, across, width, height]);
    } else if (port >= BG1HOFS && port <= BG4VOFS) {
      if (pending === -1) {
        pending = port;
        low = value;
        continue;
      }
      requireValue(pending === port, 'ppu_scroll_latch_required');
      pending = -1;
      const at = port - BG1HOFS,
        layer = at >>> 1;
      if (!large.has(layer)) continue;
      changes.push(['scroll', layer, at & 1, ((value << BYTE_BITS) | low) & SCROLL_MASK]);
    }
  }
  requireValue(pending === -1, 'ppu_scroll_pair_required');
  return changes;
}

// The frame description of a mode 1 frame (src/video/frame-renderer.mjs).
export function describeMode1Frame(ppu, { objects = false, rows = null } = {}) {
  const display = ppu.register(INIDISP);
  if (display & INIDISP_FORCED_BLANK || !(display & INIDISP_BRIGHTNESS_MASK)) return BLANK_FRAME;
  // 2100 brightness (PDF 115): 16 steps, no digital formula in the manual; the
  // oracle's output scales each 5-bit component by brightness/15 (truncated).
  const brightness = display & INIDISP_BRIGHTNESS_MASK;
  ppu.requireComplete();
  const mode = ppu.register(BGMODE);
  // TM may change per row through H-DMA (hdma.mjs): layers and OBJ are prepared
  // for every value of the field.
  const main = ppu.register(TM);
  let mainAny = main;
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
  // With both windows on a layer the 212A/212B logic applies; that combination is
  // still a boundary.
  const windowAreas = new Array(WINDOW_AREAS).fill(NO_WINDOW),
    edges = new Int16Array(WINDOW_EDGES).fill(-1);
  const colorWindow =
    clip === CLIP_OUTSIDE ||
    clip === CLIP_INSIDE ||
    (mathOn && (prevent === MATH_INSIDE || prevent === MATH_OUTSIDE));
  if (colorWindow) {
    const v = ppu.register(WOBJSEL) >>> NIBBLE_BITS;
    requireValue((v & WINDOW_ENABLES) !== WINDOW_ENABLES, 'ppu_window_logic_source_required');
    windowAreas[COLOUR_WINDOW] = windowArea(v);
  }
  for (let layer = 0; layer <= OBJ_LAYER; layer++)
    if ((tmw | tsw) & (1 << layer)) {
      const v =
        layer < BG_LAYER_COUNT
          ? (ppu.register(W12SEL + (layer >>> 1)) >>> ((layer & 1) * NIBBLE_BITS)) & NIBBLE_MASK
          : ppu.register(WOBJSEL) & NIBBLE_MASK;
      requireValue((v & WINDOW_ENABLES) !== WINDOW_ENABLES, 'ppu_window_logic_source_required');
      windowAreas[layer] = windowArea(v);
    }
  for (let n = 0; n < WINDOW_EDGES; n++)
    if (ppu.registerKnown[WH0 - INIDISP + n]) edges[n] = ppu.registers[WH0 - INIDISP + n];
  requireValue(ppu.scrollPending === -1, 'ppu_scroll_pair_required');
  const sprites = [];
  let objBase = 0,
    objGap = 0;
  if ((mainAny | sub) & OBJ_LAYER_BIT) {
    const select = ppu.register(OBJSEL);
    requireValue(select >>> OBJSEL_SIZE_SHIFT < OBJ_SIZES.length, 'ppu_obj_size_source_required');
    for (let n = 0; n < OBJECT_COUNT; n++) {
      const entry = n * OAM_ENTRY_BYTES,
        highByte = OAM_HIGH_TABLE + (n >>> OBJECTS_PER_HIGH_BYTE_SHIFT),
        highShift = (n & OBJECT_IN_HIGH_BYTE_MASK) * HIGH_BITS_PER_OBJECT;
      const y = ppu.oam[entry + OAM_Y],
        big = (ppu.oam[highByte] >> (highShift + HIGH_SIZE_BIT)) & 1,
        size = OBJ_SIZES[select >>> OBJSEL_SIZE_SHIFT][big];
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
          name: ppu.oam[entry + OAM_NAME],
          vFlip: !!(attr & OBJ_V_FLIP),
          hFlip: !!(attr & OBJ_H_FLIP),
          priority: (attr >>> OBJ_PRIORITY_SHIFT) & OBJ_PRIORITY_MASK,
          palette: (attr >>> OBJ_PALETTE_SHIFT) & OBJ_PALETTE_MASK,
          table: attr & OBJ_SECOND_TABLE,
        });
      }
    }
    if (objects)
      requireValue(
        !(ppu.register(OAMADDH) & OAMADDH_PRIORITY_ROTATION),
        'ppu_obj_rotation_source_required',
      );
    objBase = (select & OBJSEL_BASE_MASK) * OBJ_NAME_BASE_STEP;
    objGap = (((select >>> OBJSEL_GAP_SHIFT) & OBJSEL_GAP_MASK) + 1) * OBJ_NAME_GAP_STEP;
  }
  // CGRAM does not change while a frame is rendered.
  const palette = new Int32Array(CGRAM_COLOURS);
  for (let n = 0; n < CGRAM_COLOURS; n++)
    palette[n] = ppu.cgram[n * 2] | (ppu.cgram[n * 2 + 1] << BYTE_BITS);
  const layers = [],
    large = new Map();
  for (let layer = 0; layer < BG_LAYERS_MODE_1; layer++)
    if ((mainAny | sub) & (1 << layer)) {
      requireValue(
        ppu.scrollKnown[layer * 2] && ppu.scrollKnown[layer * 2 + 1],
        'ppu_scroll_required',
      );
      const sc = ppu.register(BG1SC + layer),
        nba = ppu.register(BG12NBA + (layer >>> 1)),
        isBg3 = layer === BG_LAYERS_MODE_1 - 1,
        isLarge = !!(mode & (1 << (NIBBLE_BITS + layer)));
      // Priority levels for tile priority bit 0/1 (front is higher).
      const [low, normalHigh] = BG_LEVELS[layer];
      large.set(layer, isLarge);
      layers.push({
        layer,
        ...mapOf(sc, isLarge),
        chars: ((nba >>> ((layer & 1) * NIBBLE_BITS)) & NIBBLE_MASK) * CHARACTER_BASE_STEP,
        bpp: isBg3 ? BPP_2 : BPP_4,
        large: isLarge,
        h: ppu.scroll[layer * 2],
        v: ppu.scroll[layer * 2 + 1],
        low,
        high: isBg3 && mode & BGMODE_BG3_PRIORITY ? BG3_TOP_LEVEL : normalHigh,
      });
    }
  // Row changes, with every enabled window area's edges known on every row.
  const changes = rows ? new Array(SCREEN_HEIGHT).fill(null) : null,
    known = Int16Array.from(edges);
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const w = rows?.[y];
    if (w) {
      changes[y] = rowChanges(w, large);
      for (const change of changes[y]) if (change[0] === 'edge') known[change[1]] = change[2];
    }
    for (const area of windowAreas)
      if (area.edge >= 0)
        requireValue(known[area.edge] >= 0 && known[area.edge + 1] >= 0, 'ppu_register_required', {
          port: WH0 + area.edge,
        });
  }
  return {
    blank: false,
    brightness,
    main,
    sub,
    mainWindows: tmw,
    subWindows: tsw,
    windowAreas,
    edges,
    clip,
    math: mathOn
      ? {
          layers: math & CGADSUB_LAYERS,
          half: !!(math & CGADSUB_HALF),
          subtract: !!(math & CGADSUB_SUBTRACT),
          region: prevent,
          sub: useSub,
          fixed: ppu.fixedColor,
        }
      : null,
    palette,
    vram: ppu.vram,
    layers,
    objects: { base: objBase, gap: objGap, sprites },
    rows: changes,
  };
}

export function renderMode1Frame(ppu, options) {
  return renderFrame(describeMode1Frame(ppu, options));
}
