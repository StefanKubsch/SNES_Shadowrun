import { WORD_MASK } from '../../src/constants/bits.mjs';
import { OBJECT_COLLIDES, OBJECT_BLOCKED, OBJECT_FALLS } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotMotionData } from './slot-motion-data.mjs';
import { prepareMotionHelper8133 } from './slot-motion-helper-8133.mjs';
import { prepareMotionHelper8238 } from './slot-motion-helper-8238.mjs';
import { prepareMotionHelper82BC } from './slot-motion-helper-82bc.mjs';
import { prepareMotionHelper80B2 } from './slot-motion-helper-80b2.mjs';
import { prepareMotionHelper81B4 } from './slot-motion-helper-81b4.mjs';
import { prepareMotionHelperC9E0 } from './slot-motion-helper-c9e0.mjs';

const BLOCKED_CLEAR_MASK = WORD_MASK ^ OBJECT_BLOCKED;
const SLOT_FLAGS_FIELD = '1458';
const STEP_LIMIT = 5;
const COORDINATE_SCALE = 4;
const FALL_FLOOR = 0x100;

const motionHelpers = {
  '80:80B2': prepareMotionHelper80B2,
  '80:8133': prepareMotionHelper8133,
  '80:81B4': prepareMotionHelper81B4,
  '80:8238': prepareMotionHelper8238,
};

// Explicit AB26 game-data operation, not a frame callback or general CPU.
// Complete paths without calls or with sourced 80B2/8133/81B4/8238/82BC helpers.
// C9E0 shares one complete plan with all later motion helpers.
export function prepareSlotMotion(
  fields,
  { offset = null, motionData = null, ...c9e0Context } = {},
) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields))
    throw new Error('Invalid slot motion fields');
  if (
    (offset !== null && !isWord(offset)) ||
    (motionData !== null && (!isSlotMotionData(motionData) || offset === null))
  )
    throw new Error('Invalid slot motion helper context');
  const keys = ['7E:40E0', '1458', '0E28', '0E80', '0ED8', '0D20', '0D78', '0DD0'];
  for (const key of keys)
    if (fields[key] !== null && !isWord(fields[key])) throw new Error('Invalid slot motion fields');
  const missing = (field) => ({ handled: false, reason: 'slot_motion_source_required', field });
  const helper = (requiredHelper) => ({
    handled: false,
    reason: 'slot_motion_helper_required',
    requiredHelper,
  });
  if (fields['7E:40E0'] === null) return missing('7E:40E0');
  let prelude = null;
  if (fields['7E:40E0'] !== 0) {
    if (offset === null) return helper('80:C9E0');
    prelude = prepareMotionHelperC9E0({ ...c9e0Context, offset, fields });
    if (!prelude.handled) return prelude;
    fields = { ...fields, ...prelude.fields };
  }
  if (fields['1458'] === null) return missing('1458');
  let flags = fields['1458'] & BLOCKED_CLEAR_MASK;
  const working = { ...fields, [SLOT_FLAGS_FIELD]: flags };
  const writes = { ...prelude?.fields, [SLOT_FLAGS_FIELD]: flags };
  let helperScratchWords = null;
  const positions = [];
  for (const [i, coordinate, motion] of [
    [0, '0E28', '0D20'],
    [1, '0E80', '0D78'],
  ]) {
    if (fields[coordinate] === null) return missing(coordinate);
    if (fields[motion] === null) return missing(motion);
    positions[i] = fields[coordinate];
    if (fields[motion] !== 0) {
      const sum = fields[coordinate] + fields[motion];
      positions[i] = sum & WORD_MASK;
      // LDA/AND/BEQ retain the addition carry until the BCS helper choice.
      if (flags & OBJECT_COLLIDES) {
        const entry =
          i === 0
            ? sum > WORD_MASK
              ? '80:8133'
              : '80:80B2'
            : sum > WORD_MASK
              ? '80:8238'
              : '80:81B4';
        const prepare = motionHelpers[entry];
        if (!prepare || !motionData) return helper(entry);
        // AB46/AB9D wrote this wrapped coordinate before the helper reads it.
        const helperFields = { ...working, [coordinate]: positions[i] };
        for (const key of ['7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0'])
          if (!Object.hasOwn(helperFields, key)) helperFields[key] = null;
        const plan = prepare({ offset, fields: helperFields, motionData });
        if (!plan.handled) return plan;
        helperScratchWords = { ...helperScratchWords, ...plan.scratchWords };
        if (!plan.carry) {
          if (plan.value < STEP_LIMIT) {
            // All horizontal caller branches' ASLs on 1..4 supply Carry 0 for this ADC.
            working['0ED8'] = (working['0ED8'] + plan.value * COORDINATE_SCALE) & WORD_MASK;
            working['0DD0'] = 0;
            writes['0ED8'] = working['0ED8'];
            writes['0DD0'] = 0;
          } else {
            positions[i] = fields[coordinate];
            flags |= OBJECT_BLOCKED;
            working['1458'] = flags;
            writes['1458'] = flags;
          }
        }
      }
      writes[coordinate] = positions[i];
      working[coordinate] = positions[i];
    }
  }
  if (working['0ED8'] === null) return missing('0ED8');
  if (working['0DD0'] === null) return missing('0DD0');
  const oldThird = working['0ED8'];
  let thirdMotion = working['0DD0'];
  if (flags & OBJECT_FALLS) {
    thirdMotion = (thirdMotion - 1) & WORD_MASK;
    writes['0DD0'] = thirdMotion;
  }
  const third = (oldThird + thirdMotion) & WORD_MASK;
  if (third < FALL_FLOOR) {
    writes['0ED8'] = oldThird;
    writes['0DD0'] = 0;
  } else if (third !== oldThird) {
    writes['0ED8'] = third;
    if (flags & OBJECT_COLLIDES) {
      if (!motionData) return helper('80:82BC');
      const helperFields = { ...working, '0ED8': third, '0DD0': thirdMotion };
      for (const key of ['7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0'])
        if (!Object.hasOwn(helperFields, key)) helperFields[key] = null;
      const plan = prepareMotionHelper82BC({ offset, fields: helperFields, motionData });
      if (!plan.handled) return plan;
      helperScratchWords = { ...helperScratchWords, ...plan.scratchWords };
      if (!plan.carry) {
        writes['0ED8'] = oldThird;
        writes['0DD0'] = 0;
      }
    }
  }
  writes['0F30'] = ((positions[0] + positions[1]) & WORD_MASK) >>> 1;
  return {
    ...prelude,
    handled: true,
    fields: writes,
    scratchWord6B: oldThird,
    ...(helperScratchWords ? { helperScratchWords } : {}),
  };
}
