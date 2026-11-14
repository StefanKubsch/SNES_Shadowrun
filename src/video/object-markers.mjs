// Marking usable objects (quality-of-life option, user decision 2026-11-04,
// docs/OBJECT-MARKERS.md): a periodic pulsating ring at the centre of every
// object the action glove can use. Display only: it reads the WRAM and draws
// into the finished picture, so game state, saves and recordings stay
// unchanged and the option can change at any time.
//
// Which objects: the glove check 80:BCBE (src/task/native-glove.mjs) offers an
// object of the draw list 14B2 (Y = 14B0 downwards) with a picture (1090) and
// a named kind (8C:EFB0 + 6 * kind, name word not FFFF). Of those, people and
// creatures are left out: their kind flags (8C:EFB0 + 6 * kind + 4) have bit
// 15 or bit 13 set, which no item, door or device kind has (assets/vm-kinds.json).
// This also leaves out Jake himself (kind 0B, flags A368).
//
// Where: BCBE tests the glove pixel (01D4/01D6 high bytes) with four linear
// conditions per object, so the hit area is a screen rectangle. The equations
// below are BCBE's with the action glove limits 01E4 = 0600, 01E6 = 0C00
// (80:BC67, src/task/native-glove-crosshair-limits.mjs).
import {
  CAMERA_X,
  CAMERA_Y,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  GLOVE_KIND,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DIAGONAL,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { KIND_TABLE } from '../data/kinds.mjs';
import { WORD_MASK, BYTE_BITS } from '../constants/bits.mjs';
import { RGBA_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/ppu.mjs';

const LIVING = 0xa000,
  LEFT = 0x0600,
  TOP = 0x0c00;
// Kind table entries (8C:EFB0): six bytes, name word first, flags at +4.
const KIND_ENTRY_BYTES = 6,
  KIND_FLAGS = 4,
  NO_NAME = 0xffff;
const SIGN_BIT = 0x8000;
// BCBE works in quarter pixels: the distances are shifted right twice.
const QUARTER_SHIFT = 2;
// Glove kind of the open action glove (src/task/wram.mjs GLOVE_KIND).
const ACTION_GLOVE = 0xffff;
// Ring around the box centre (the point where the glove names the object):
// the radius grows from RING_START to RING_END pixels during one pulse; the
// ring is RING_WIDTH pixels wide with an anti-aliased edge.
const RING_START = 1.5,
  RING_END = 3.5,
  RING_WIDTH = 1,
  RGB_CHANNELS = 3;
// Pixel centres lie half a pixel inside their corner; the same half pixel is
// the anti-aliasing ramp at each ring edge.
const HALF_PIXEL = 0.5;
// Pulse timing in pictures (50 Hz): one pulse of PULSE pictures every PERIOD.
export const MARKER_PERIOD = 200,
  MARKER_PULSE = 40;
const COLOUR = [255, 236, 140];

const m16 = (v) => v & WORD_MASK,
  negative = (v) => (v & SIGN_BIT) !== 0;

// Door kinds (user decision 2026-11-05: doors are not highlighted). Their
// flags match those of devices, so they are listed by name from
// assets/vm-kinds.json and assets/vm-texts.json: Wooden Door (18, 23),
// Automatic Door (19, 4B), Crypt Door (1A), Fridge Door (1B), Glass doors (62),
// Door (76, 92), Elevator Doors (87), Elevator Door (93, 94), Glass Door (BA).
// tools/object-markers.test.mjs checks the list against the names.
export const DOOR_KINDS = new Set([
  0x18, 0x19, 0x1a, 0x1b, 0x23, 0x4b, 0x62, 0x76, 0x87, 0x92, 0x93, 0x94, 0xba,
]);

// A kind the glove names that is not a person, creature or door (see above).
export function usableKind(memory, kind) {
  const entry = KIND_TABLE + KIND_ENTRY_BYTES * kind;
  return (
    memory.read16(entry) !== NO_NAME &&
    !(memory.read16(entry + KIND_FLAGS) & LIVING) &&
    !DOOR_KINDS.has(kind)
  );
}

// Hit rectangles [x0, y0, x1, y1, object] (inclusive, glove pixels) of the
// usable objects; memory is the VmMemory of the running game.
export function usableObjectBoxes(memory) {
  const wram = memory.wram,
    word = (at) => wram[at] | (wram[at + 1] << BYTE_BITS),
    boxes = [];
  // 14B0 is the last word index; a negative (FFFE or below) ends the list, as in BCBE.
  for (let y = word(DRAW_LIST_INDEX); y >= 0 && y < SIGN_BIT; y -= 2) {
    const x = word(DRAW_LIST + y),
      field = (offset) => word(offset + x);
    if (!word(OBJECT_ACTION_DIRECTIONS + x)) continue;
    if (!usableKind(memory, word(OBJECT_KIND + x))) continue;

    // Vertical: BCBE from 80:BD1F (DP17, the two bounds against DP11).
    let base = m16(TOP - field(OBJECT_DIAGONAL) - field(OBJECT_HEIGHT) - word(CAMERA_Y));
    if (negative(base)) continue;
    base >>= QUARTER_SHIFT;
    const bottom = m16(2 * base - field(OBJECT_BOX_X1) - field(OBJECT_BOX_Y1));
    if (negative(bottom)) continue;
    const upper = m16(
      2 * m16(base - field(OBJECT_BOX_HEIGHT)) - field(OBJECT_BOX_X2) - field(OBJECT_BOX_Y2),
    );
    // Horizontal: the ROR pair keeps the sign of a negative distance.
    let across = m16(LEFT + field(OBJECT_Y) - field(OBJECT_X) - word(CAMERA_X));
    if (negative(across)) across = SIGN_BIT | ((SIGN_BIT | (across >> 1)) >> 1);
    across >>= QUARTER_SHIFT;
    const right = m16(across - field(OBJECT_BOX_X1) + field(OBJECT_BOX_Y2));
    if (negative(right)) continue;
    const left = m16(across + field(OBJECT_BOX_Y1) - field(OBJECT_BOX_X2));
    boxes.push([
      negative(left) ? 0 : left + 1,
      negative(upper) ? 0 : (upper >> 1) + 1,
      right,
      bottom >> 1,
      x,
    ]);
  }
  return boxes;
}

// Pulse progress 0..1 for picture nmi, or -1 outside the pulse at the start
// of each period.
export function markerPulse(nmi) {
  const phase = nmi % MARKER_PERIOD;
  return phase < MARKER_PULSE ? phase / MARKER_PULSE : -1;
}

// Pulsating rings into RGBA pixels (256 x 224) at pulse progress t: the ring
// widens while a sine envelope fades it in and out again.
export function drawObjectMarkers(pixels, boxes, t) {
  if (!(t >= 0 && t < 1)) return;
  const strength = Math.sin(Math.PI * t),
    radius = RING_START + (RING_END - RING_START) * t,
    reach = Math.ceil(radius + RING_WIDTH);
  if (strength <= 0) return;
  for (const [x0, y0, x1, y1] of boxes) {
    if (x1 < x0 || y1 < y0) continue;
    // The ring centre is the centre of the inclusive box.
    const cx = (x0 + x1 + 1) / 2,
      cy = (y0 + y1 + 1) / 2;
    for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
      if (y < 0 || y >= SCREEN_HEIGHT) continue;
      for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
        if (x < 0 || x >= SCREEN_WIDTH) continue;
        const distance = Math.hypot(x + HALF_PIXEL - cx, y + HALF_PIXEL - cy),
          cover = Math.min(
            1,
            Math.max(0, RING_WIDTH / 2 + HALF_PIXEL - Math.abs(distance - radius)),
          );
        if (cover <= 0) continue;
        const i = (y * SCREEN_WIDTH + x) * RGBA_BYTES,
          a = cover * strength;
        for (let c = 0; c < RGB_CHANNELS; c++) pixels[i + c] += (COLOUR[c] - pixels[i + c]) * a;
      }
    }
  }
}

// Marked only while Jake moves freely or the action glove is open, never in
// menus, dialogues, sequences or the matrix.
export function markersAllowed(game) {
  const wram = game.memory.wram,
    glove = wram[GLOVE_KIND] | (wram[GLOVE_KIND + 1] << BYTE_BITS);
  return (game.controlNmi >= 0 && game.nmis - game.controlNmi <= 1) || glove === ACTION_GLOVE;
}
