// Scene records (docs/ROM-FREE.md, step 2): the packed records of the table
// $8B:F9E3 (src/data/lz-streams.mjs) that $81:A117 unpacks to 7F:DA14 and
// reads through the pointer in DP 0E (src/task/main-scene-load.mjs,
// main-scene-layers.mjs). Layout, in order:
// - backdrop: word, copied to 7E:0D12 and written by the NMI as colour 0 to
//   CGRAM (src/task/main-game-nmi.mjs); BGR555.
// - tileset: byte n; tables $8D:F1A0 + 2 n and $8D:F1AC + 2 n give the block
//   and attribute pointers (DP 11, DP 14).
// - shapes: count byte, then per shape ($81:8DE2) a word p and either
//   - p bit 15 clear, a line: byte value, byte length; bit 14 selects the
//     step $82 (8D23) instead of $7E (8D09) through the grid at 7F:CA14,
//   - p bit 15 set, a rectangle: byte value, byte width, byte height; bit 14
//     first draws the border (8D3D), then the fill (8DC0).
//   The grid offset is p & 3FFE (bit 0 is kept as read); here row = offset
//   >> 7 and column = offset & 7F, from bits 0-13 of p.
// - two object lists ($81:903E), each a count byte (0 skips the list) and per
//   object a word w and three bytes: type w & 1FFF (index into $8A:C36A),
//   flip w bit 15 (XOR 4000 on the tile attributes), z a signed byte, then x
//   and y as bytes whose high byte is FF when w bit 13 (x) or bit 14 (y) is
//   set. The first list goes to the layer at 7E:76A8, the second to 7E:46A8.
// All 165 records are read exactly to their end by this layout. Native form
// assets/vm-scenes.json, one entry per scene in table order.
import { VmFault } from '../vm/memory.mjs';
import {
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_HEX_DIGITS,
  BYTE_VALUES,
  INT8_MAX,
  INT8_MIN,
} from '../constants/bits.mjs';
import { COLOUR_MASK } from '../constants/ppu.mjs';

// Shape word: bit 15 rectangle (else line), bit 14 border or the alternate step,
// grid position row << 7 | column in bits 0-13.
const SHAPE_RECT = 0x8000,
  SHAPE_ALTERNATE = 0x4000,
  GRID_ROW_SHIFT = 7,
  GRID_POSITION_MASK = 0x7f,
  LINE_STEP = 0x7e,
  LINE_STEP_ALTERNATE = 0x82;
// Object word: type in bits 0-12, bit 13/14 the high byte of x/y (FF), bit 15 flip.
const OBJECT_TYPE_MASK = 0x1fff,
  OBJECT_X_HIGH = 0x2000,
  OBJECT_Y_HIGH = 0x4000,
  OBJECT_FLIP = 0x8000;

const hex4 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');
const signed8 = (v) => (v > INT8_MAX ? v - BYTE_VALUES : v);
const signed9 = (byte, high) => (high ? byte - BYTE_VALUES : byte);

export function decodeScene(bytes) {
  let p = 0;
  const byte = () => {
    if (p >= bytes.length) throw new VmFault('scene_length_required');
    return bytes[p++];
  };
  const word = () => byte() | (byte() << BYTE_BITS);
  const scene = { backdrop: hex4(word()), tileset: byte(), shapes: [] };
  for (let n = byte(); n > 0; n--) {
    const at = word(),
      row = (at >> GRID_ROW_SHIFT) & GRID_POSITION_MASK,
      column = at & GRID_POSITION_MASK,
      alternate = !!(at & SHAPE_ALTERNATE);
    if (at & SHAPE_RECT)
      scene.shapes.push({
        kind: 'rect',
        row,
        column,
        border: alternate,
        value: byte(),
        width: byte(),
        height: byte(),
      });
    else
      scene.shapes.push({
        kind: 'line',
        row,
        column,
        step: alternate ? LINE_STEP_ALTERNATE : LINE_STEP,
        value: byte(),
        length: byte(),
      });
  }
  for (const list of ['objects_76a8', 'objects_46a8']) {
    scene[list] = [];
    for (let n = byte(); n > 0; n--) {
      const w = word(),
        z = byte(),
        x = byte(),
        y = byte();
      scene[list].push({
        type: w & OBJECT_TYPE_MASK,
        flip: !!(w & OBJECT_FLIP),
        z: signed8(z),
        x: signed9(x, w & OBJECT_X_HIGH),
        y: signed9(y, w & OBJECT_Y_HIGH),
      });
    }
  }
  if (p !== bytes.length) throw new VmFault('scene_length_required');
  return scene;
}

const need = (ok, reason) => {
  if (!ok) throw new VmFault(reason);
};
const inRange = (v, low, high) => Number.isInteger(v) && v >= low && v <= high;

export function encodeScene(scene) {
  const out = [],
    byte = (v) => {
      need(inRange(v, 0, BYTE_MASK), 'scene_value_required');
      out.push(v);
    },
    word = (v) => {
      byte(v & BYTE_MASK);
      byte(v >> BYTE_BITS);
    };
  need(
    new RegExp(`^[0-9A-F]{${WORD_HEX_DIGITS}}$`).test(scene.backdrop) &&
      parseInt(scene.backdrop, HEX_RADIX) <= COLOUR_MASK,
    'scene_backdrop_required',
  );
  word(parseInt(scene.backdrop, HEX_RADIX));
  byte(scene.tileset);
  byte(scene.shapes.length);
  for (const s of scene.shapes) {
    need(
      inRange(s.row, 0, GRID_POSITION_MASK) && inRange(s.column, 0, GRID_POSITION_MASK),
      'scene_position_required',
    );
    const at = (s.row << GRID_ROW_SHIFT) | s.column;
    if (s.kind === 'rect') {
      word(SHAPE_RECT | (s.border ? SHAPE_ALTERNATE : 0) | at);
      byte(s.value);
      byte(s.width);
      byte(s.height);
    } else {
      need(
        s.kind === 'line' && (s.step === LINE_STEP || s.step === LINE_STEP_ALTERNATE),
        'scene_shape_required',
      );
      word((s.step === LINE_STEP_ALTERNATE ? SHAPE_ALTERNATE : 0) | at);
      byte(s.value);
      byte(s.length);
    }
  }
  for (const list of ['objects_76a8', 'objects_46a8']) {
    byte(scene[list].length);
    for (const o of scene[list]) {
      need(
        inRange(o.type, 0, OBJECT_TYPE_MASK) &&
          inRange(o.z, INT8_MIN, INT8_MAX) &&
          inRange(o.x, -BYTE_VALUES, BYTE_MASK) &&
          inRange(o.y, -BYTE_VALUES, BYTE_MASK),
        'scene_object_required',
      );
      word(
        o.type |
          (o.flip ? OBJECT_FLIP : 0) |
          (o.x < 0 ? OBJECT_X_HIGH : 0) |
          (o.y < 0 ? OBJECT_Y_HIGH : 0),
      );
      byte(o.z & BYTE_MASK);
      byte(o.x & BYTE_MASK);
      byte(o.y & BYTE_MASK);
    }
  }
  return Uint8Array.from(out);
}
