// The line of sight from a viewer object to a target object through the map boxes of
// the current cell list (lifted from 81:A25F; the register-level version in
// src/task/line-of-sight.mjs stays for the shooting natives 80:8AB5, 80:8A51 and
// 80:8A8C). The sight natives 80:8BC5, 80:8C08, 80:8C8D and 80:8CCF use it
// (src/game/combat-targets.mjs).
//
// Positions count in box units (coordinates over 4) and cell units (over 16). The
// cell list at the long pointer in the direct page FC holds a count byte and then
// 12-byte box records: x0, y0, an unused word, x1, y1 (box units) and the height. A
// box blocks the sight when three tests pass:
// 1. it overlaps the bounding box of the line on both axes;
// 2. in the plan view the line passes between its corners: the distances from the
//    viewer's cell to the box edges along the direction of travel, times the line's
//    spans, compared crosswise on the hardware multiplier;
// 3. the line's height where it meets the box edge (the eye height plus the box's
//    rise times the span over the edge distance, on the hardware multiplier and
//    divider) reaches the target's bottom; at or above the target's top it blocks,
//    below it a gap of less than half the target's box height marks a low box.
// The arithmetic stays in 16 bits as in the original, with its wraps. On another
// platform the multiplier is an 8 by 8 bit product and the divider an unsigned 16 by
// 8 bit division (a zero divisor gives FFFF).
import { OBJECT_BOX_HEIGHT, OBJECT_HEIGHT, OBJECT_X, OBJECT_Y } from '../task/wram.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  RDDIVL,
  RDMPYL,
  WRDIVB,
  WRDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The direct page long pointer to the cell list.
const DP_CELL_LIST = 0xfc;
// A box record: its fields' offsets and its size; the records start after the count.
const BOX_X0 = 0,
  BOX_Y0 = 2,
  BOX_X1 = 6,
  BOX_Y1 = 8,
  BOX_HEIGHT = 10,
  BOX_RECORD = 12,
  FIRST_BOX = 1;
// Coordinates to box units and box units to cell units.
const BOX_SHIFT = 2,
  CELL_SHIFT = 2;
// The quadrant bits: the target lies left of (x) or above (y) the viewer.
const LEFT = 2,
  ABOVE = 1;

// The original instructions of the multiplier and divider accesses, the sites of the
// device model. Per quadrant the edge test (the first product, the second product's
// read and start, the compare, the third product, the fourth's read and start, the
// compare; then the other branch: first product, read, start, compare) and the meeting
// edge choice (first product, read, start, compare).
const EDGE_SITES = [
  {
    main: [0x81a35f, 0x81a36d, 0x81a370, 0x81a375, 0x81a383, 0x81a391, 0x81a394, 0x81a39a],
    other: [0x81a3ad, 0x81a3bb, 0x81a3be, 0x81a3c4],
    meeting: [0x81a589, 0x81a5a5, 0x81a5a8, 0x81a5ae],
  },
  {
    main: [0x81a3d5, 0x81a3e7, 0x81a3ea, 0x81a3ef, 0x81a401, 0x81a40f, 0x81a412, 0x81a418],
    other: [0x81a42f, 0x81a43d, 0x81a440, 0x81a446],
    meeting: [0x81a682, 0x81a6ac, 0x81a6af, 0x81a6b5],
  },
  {
    main: [0x81a45b, 0x81a469, 0x81a46c, 0x81a471, 0x81a47f, 0x81a491, 0x81a494, 0x81a49a],
    other: [0x81a4ad, 0x81a4bf, 0x81a4c2, 0x81a4c8],
    meeting: [0x81a6df, 0x81a701, 0x81a704, 0x81a70a],
  },
  {
    main: [0x81a4dd, 0x81a4ef, 0x81a4f2, 0x81a4f7, 0x81a509, 0x81a51b, 0x81a51e, 0x81a524],
    other: [0x81a53b, 0x81a54d, 0x81a550, 0x81a556],
    meeting: [0x81a734, 0x81a75e, 0x81a761, 0x81a767],
  },
];
// The height at the meeting edge per axis and rise sign: the factor, the scale (the
// span) and the product's read, the dividend, the divisor and the quotient's read.
const HEIGHT_SITES = {
  x: {
    rising: [0x81a5bc, 0x81a5c1, 0x81a5c7, 0x81a5ca, 0x81a5d1, 0x81a601],
    falling: [0x81a60e, 0x81a613, 0x81a619, 0x81a61c, 0x81a623, 0x81a64d],
  },
  y: {
    rising: [0x81a5e2, 0x81a5e7, 0x81a5ed, 0x81a5f0, 0x81a5f7, 0x81a601],
    falling: [0x81a62e, 0x81a633, 0x81a639, 0x81a63c, 0x81a643, 0x81a64d],
  },
};

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const swapBytes = (value) => ((value >>> BYTE_BITS) | (value << BYTE_BITS)) & WORD_MASK;

// The line from the viewer to the target: its bounding box in box units, the viewer's
// cell, the cell spans with their bytes swapped (the span in the high byte, as the
// multiplier takes it), the quadrant, the eye height and the target's bottom, top and
// box height.
function sightLine(mem, viewer, target) {
  const { wram } = mem;
  const viewerX = dataBankWord(mem, OBJECT_X, viewer) >>> BOX_SHIFT,
    viewerY = dataBankWord(mem, OBJECT_Y, viewer) >>> BOX_SHIFT,
    targetX = dataBankWord(mem, OBJECT_X, target) >>> BOX_SHIFT,
    targetY = dataBankWord(mem, OBJECT_Y, target) >>> BOX_SHIFT,
    cellX = viewerX >>> CELL_SHIFT,
    cellY = viewerY >>> CELL_SHIFT;
  let quadrant = 0;
  const span = (to, from, bit) => {
    const difference = (to >>> CELL_SHIFT) - from;
    if (difference >= 0) return swapBytes(difference);
    quadrant |= bit;
    return swapBytes(-difference);
  };
  const spanX = span(targetX, cellX, LEFT),
    spanY = span(targetY, cellY, ABOVE);
  const targetBox = word(wram, OBJECT_BOX_HEIGHT + target),
    targetBottom = dataBankWord(mem, OBJECT_HEIGHT, target) >>> BOX_SHIFT,
    viewerBox = word(wram, OBJECT_BOX_HEIGHT + viewer);
  // The eye at three quarters of the viewer's box.
  const eye =
    ((dataBankWord(mem, OBJECT_HEIGHT, viewer) >>> BOX_SHIFT) +
      (viewerBox >>> 1) +
      (viewerBox >>> 2)) &
    WORD_MASK;
  return {
    minX: Math.min(viewerX, targetX),
    maxX: Math.max(viewerX, targetX),
    minY: Math.min(viewerY, targetY),
    maxY: Math.max(viewerY, targetY),
    cellX,
    cellY,
    spanX,
    spanY,
    quadrant,
    eye,
    targetBottom,
    targetTop: (targetBottom + targetBox) & WORD_MASK,
    targetBox,
  };
}

// The distance in cell units from the viewer's cell to a box edge along the direction
// of travel: the 16-bit difference and whether it is not negative.
function edgeDistance(edge, cell, backwards) {
  const near = edge >>> CELL_SHIFT,
    difference = backwards ? cell - near : near - cell;
  return { value: difference & WORD_MASK, ahead: difference >= 0 };
}
// A box's edges seen from the viewer: the near and far x and y edges along the
// direction of travel.
function boxEdges(box, line) {
  const left = (line.quadrant & LEFT) !== 0,
    above = (line.quadrant & ABOVE) !== 0;
  return {
    nearX: edgeDistance(left ? box.x1 : box.x0, line.cellX, left),
    farX: edgeDistance(left ? box.x0 : box.x1, line.cellX, left),
    nearY: edgeDistance(above ? box.y1 : box.y0, line.cellY, above),
    farY: edgeDistance(above ? box.y0 : box.y1, line.cellY, above),
  };
}

// The hardware multiplier: the word's low byte times its high byte (the original
// stores the edge distance ORed with the swapped span as one word).
function startProduct(port, factors, site) {
  port.write(WRMPYA, factors, 2, site);
}
const readProduct = (port, site) => port.read(RDMPYL, 2, site);

// 2. The line passes between the box corners in the plan view (81:A344).
function linePassesBox(port, line, edges, sites) {
  const { nearX, farX, nearY, farY } = edges,
    [first, secondRead, second, compare, third, fourthRead, fourth, lastCompare] = sites.main;
  if (!farX.ahead) return false;
  startProduct(port, farX.value | line.spanY, first);
  if (!nearY.ahead) {
    const [otherFirst, otherRead, otherSecond, otherCompare] = sites.other;
    if (!farY.ahead) return false;
    startProduct(port, farY.value | line.spanX, otherFirst);
    if (!nearX.ahead) return true;
    const product = readProduct(port, otherRead);
    startProduct(port, nearX.value | line.spanY, otherSecond);
    return product >= readProduct(port, otherCompare);
  }
  const product = readProduct(port, secondRead);
  startProduct(port, nearY.value | line.spanX, second);
  if (product < readProduct(port, compare)) return false;
  if (!farY.ahead) return true;
  startProduct(port, farY.value | line.spanX, third);
  if (!nearX.ahead) return true;
  const crossed = readProduct(port, fourthRead);
  startProduct(port, nearX.value | line.spanY, fourth);
  return crossed >= readProduct(port, lastCompare);
}

// 3. The line's height at the meeting edge against the target (81:A5B3 to 81:A656).
// axis is 'x' or 'y'; result.lowBox is set for a box just below the line.
function heightBlocks(port, line, box, edges, axis, result) {
  const near = axis === 'x' ? edges.nearX : edges.nearY,
    far = axis === 'x' ? edges.farX : edges.farY,
    span = (axis === 'x' ? line.spanX : line.spanY) >>> BYTE_BITS;
  // The box's rise above the eye in 8 bits.
  const rise = (box.height & BYTE_MASK) - (line.eye & BYTE_MASK),
    rising = rise >= 0,
    [factorSite, spanSite, productSite, dividendSite, divisorSite, quotientSite] =
      HEIGHT_SITES[axis][rising ? 'rising' : 'falling'];
  port.write(WRMPYA, Math.abs(rise) & BYTE_MASK, 1, factorSite);
  port.write(WRMPYB, span, 1, spanSite);
  port.write(WRDIVL, readProduct(port, productSite), 2, dividendSite);
  port.write(WRDIVB, (rising ? near : far).value & BYTE_MASK, 1, divisorSite);
  const quotient = port.read(RDDIVL, 2, quotientSite);
  let height;
  if (rising) {
    height = line.eye + quotient;
    // Past FFFF the line runs out of the height range: blocked.
    if (height > WORD_MASK) return true;
  } else {
    // The original subtracts with the carry clear, one more.
    height = line.eye - quotient - 1;
    if (height < 0) return false;
  }
  if (height < line.targetBottom) return false;
  if (height >= line.targetTop) return true;
  if ((((line.targetTop - height) << 1) & WORD_MASK) < line.targetBox) result.lowBox = true;
  return false;
}

// The axis of the edge where the line meets the box (81:A55C): y when the near x edge
// lies behind the viewer, x when the near y edge does, otherwise by the products. That
// last test compares the box record's offset (the Y register, CPY) with the second
// product instead of the first, which it reads and drops.
function meetingAxis(port, line, edges, sites, recordOffset) {
  const [first, read, second, compare] = sites.meeting;
  startProduct(port, edges.nearX.value | line.spanY, first);
  if (!edges.nearX.ahead) return 'y';
  if (!edges.nearY.ahead) return 'x';
  readProduct(port, read);
  startProduct(port, edges.nearY.value | line.spanX, second);
  return recordOffset >= readProduct(port, compare) ? 'y' : 'x';
}

// Whether a box of the cell list blocks the sight from viewer to target (object
// indices). Returns { blocked, lowBox }: lowBox marks a box whose top lies just below
// the line (the original's direct page word 68 = FFFF), which the shooting natives read.
export function lineOfSight(mem, port, viewer, target) {
  const { wram } = mem,
    list = (word(wram, DP_CELL_LIST) | (wram[DP_CELL_LIST + 2] << WORD_BITS)) & LONG_MASK,
    read = (offset) => {
      const at = (list + offset) & LONG_MASK;
      return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
    },
    result = { blocked: false, lowBox: false },
    count = mem.read8(list);
  if (count === 0) return result;
  const line = sightLine(mem, viewer, target),
    sites = EDGE_SITES[line.quadrant];
  for (let n = 0, at = FIRST_BOX; n < count; n++, at += BOX_RECORD) {
    const box = {
      x0: read(at + BOX_X0),
      y0: read(at + BOX_Y0),
      x1: read(at + BOX_X1),
      y1: read(at + BOX_Y1),
      height: read(at + BOX_HEIGHT),
    };
    // 1. The box overlaps the line's bounding box.
    if (line.maxX < box.x0 || line.maxY < box.y0 || box.x1 < line.minX || box.y1 < line.minY)
      continue;
    const edges = boxEdges(box, line);
    if (!linePassesBox(port, line, edges, sites)) continue;
    const axis = meetingAxis(port, line, edges, sites, (at + BOX_RECORD) & WORD_MASK);
    if (heightBlocks(port, line, box, edges, axis, result)) {
      result.blocked = true;
      return result;
    }
  }
  return result;
}
