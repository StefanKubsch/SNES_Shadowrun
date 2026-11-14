// An object's velocity towards a point (lifted from 80:8D95 with 80:8D84; register-level
// reference in src/task/native-combat.mjs). The script natives 80:8D7F (move towards an
// object), 80:8D3F (jump towards an object) and 80:8D4E (jump towards a point of the
// point list) use it (src/task/native-script-leaves.mjs).
//
// Per axis the distance from the object to the point is split into its sign and
// magnitude. The divisor is the sum of the three magnitudes over 16 (halved once more
// for a move, at least 1); each velocity is its axis's magnitude divided by the low byte
// of the divisor, with the axis's sign. A jump adds half the divisor to the height
// velocity, so the object rises. The divisions run on the hardware divider as in the
// original (on another platform: an unsigned 16 by 8 bit division).
import {
  OBJECT_HEIGHT,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { RDDIVL, WRDIVB, WRDIVL } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The sum of the magnitudes over 16.
const DIVISOR_SHIFT = 4,
  // The sign word of a negative distance.
  NEGATIVE = WORD_MASK,
  // A point of the point list: a byte, then the x, y and height words over 4.
  POINT_X = 1,
  POINT_Y = 3,
  POINT_HEIGHT = 5,
  POINT_SCALE = 2,
  // The original's point index: the number times 8, minus the number twice.
  POINT_INDEX_SHIFT = 3;
// Original instructions, the sites of the device model: per axis (height, x, y) the
// dividend, the divisor and the quotient.
const SITES = {
  height: [0x808dcb, 0x808de6, 0x808df2],
  x: [0x808dfd, 0x808e04, 0x808e0f],
  y: [0x808e1a, 0x808e21, 0x808e2c],
};

// The object fields are reached through the data bank 80 as the original does
// (src/system/data-bank.mjs).

// The position of object as a point.
export const objectPoint = (mem, object) => ({
  x: dataBankWord(mem, OBJECT_X, object),
  y: dataBankWord(mem, OBJECT_Y, object),
  height: dataBankWord(mem, OBJECT_HEIGHT, object),
});
// The point index of number: 6 times the number in 16 bits, from the original's
// subtractions with their borrow (they differ for numbers above 1FFF).
function pointIndex(number) {
  const first = ((number << POINT_INDEX_SHIFT) & WORD_MASK) - number,
    borrow = first < 0 ? 1 : 0;
  return ((first & WORD_MASK) - number - borrow) & WORD_MASK;
}
// Point number of the point list at the long address list (80:8D4E): its words times 4.
// A point in the unmapped register area stops (the original reads the open bus there).
export function listPoint(mem, list, number) {
  const index = pointIndex(number),
    at = (offset) => {
      const address = list + ((index + offset) & WORD_MASK);
      return (
        ((mem.read8(address) | (mem.read8(address + 1) << BYTE_BITS)) << POINT_SCALE) & WORD_MASK
      );
    };
  return { x: at(POINT_X), y: at(POINT_Y), height: at(POINT_HEIGHT) };
}

// Set the velocity of object towards point (80:8D95); move halves the divisor once
// more. Returns the original's working values: the signs (FFFF: negative) and
// magnitudes per axis and the divisor.
export function setVelocityTowards(mem, port, object, point, move) {
  const axis = (target, offset) => {
    const distance = (target - dataBankWord(mem, offset, object)) & WORD_MASK;
    return distance & WORD_SIGN
      ? { sign: NEGATIVE, magnitude: -distance & WORD_MASK }
      : { sign: 0, magnitude: distance };
  };
  const x = axis(point.x, OBJECT_X),
    y = axis(point.y, OBJECT_Y),
    height = axis(point.height, OBJECT_HEIGHT);
  // The sum adds with the carry of the first addition, as the original's ADC chain.
  const first = height.magnitude + x.magnitude,
    sum = ((first & WORD_MASK) + y.magnitude + (first >>> WORD_BITS)) & WORD_MASK;
  let divisor = sum >>> DIVISOR_SHIFT;
  if (move) divisor >>>= 1;
  if (divisor === 0) divisor = 1;
  const velocity = ({ sign, magnitude }, [dividendSite, divisorSite, quotientSite], target) => {
    port.write(WRDIVL, magnitude, 2, dividendSite);
    port.write(WRDIVB, divisor & BYTE_MASK, 1, divisorSite);
    let value = sign ^ port.read(RDDIVL, 2, quotientSite);
    // The original completes the negation whenever the result has its sign set.
    if (value & WORD_SIGN) value = (value + 1) & WORD_MASK;
    setDataBankWord(mem, target, object, value);
  };
  velocity(height, SITES.height, OBJECT_VELOCITY_Z);
  velocity(x, SITES.x, OBJECT_VELOCITY_X);
  velocity(y, SITES.y, OBJECT_VELOCITY_Y);
  return { x, y, height, divisor };
}
// A jump: the height velocity of object rises by half the divisor (80:8D3F, 80:8D4E).
export function addRise(mem, object, divisor) {
  setDataBankWord(
    mem,
    OBJECT_VELOCITY_Z,
    object,
    (dataBankWord(mem, OBJECT_VELOCITY_Z, object) + (divisor >>> 1)) & WORD_MASK,
  );
}
