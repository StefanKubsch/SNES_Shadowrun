import { WORD_MASK } from '../../src/constants/bits.mjs';
import { OBJECT_LAST_SLOT, CELL_COORDINATE_MASK } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotMotionData } from './slot-motion-data.mjs';
import { prepareMotionRecordSearch, CELL_X_INDEX_SHIFT } from './slot-motion-search.mjs';

const keys = [
  '0ED8',
  '7E:43A0',
  '0E80',
  '7E:4348',
  '7E:42F0',
  '0E28',
  '7E:4240',
  '7E:4298',
  '1458',
];

// Complete82BC preparation; caller already wrote the new third coordinate.
// Search32/38/2F/35 once each, stopping after a complete nonzero index call.
export function prepareMotionHelper82BC({ offset, fields, motionData = null } = {}) {
  if (
    !isWord(offset) ||
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    keys.some((key) => fields[key] !== null && !isWord(fields[key]))
  )
    throw new Error('Invalid motion helper input');
  if (motionData !== null && !isSlotMotionData(motionData))
    throw new Error('Invalid slot motion data source');
  if (offset > OBJECT_LAST_SLOT || offset & 1)
    return { handled: false, reason: 'slot_window_required' };
  for (const key of keys.slice(0, -1))
    if (fields[key] === null)
      return { handled: false, reason: 'slot_motion_source_required', field: key };
  if (!motionData) return { handled: false, reason: 'slot_motion_data_source_required' };
  const scratch = { '3E': offset, '3B': 0, '1D': fields['0ED8'] >>> 2 };
  const first = fields['0E28'] >>> 2,
    second = fields['0E80'] >>> 2;
  scratch['20'] = (scratch['1D'] + fields['7E:43A0']) & WORD_MASK;
  scratch['1A'] = (second + fields['7E:4348']) & WORD_MASK;
  scratch['2C'] = (scratch['1A'] & CELL_COORDINATE_MASK) >>> 1;
  scratch['17'] = (second + fields['7E:42F0']) & WORD_MASK;
  scratch['29'] = (scratch['17'] & CELL_COORDINATE_MASK) >>> 1;
  scratch['11'] = (first + fields['7E:4240']) & WORD_MASK;
  scratch['23'] = (scratch['11'] & CELL_COORDINATE_MASK) >>> CELL_X_INDEX_SHIFT;
  scratch['38'] = scratch['23'] | scratch['29'];
  scratch['14'] = (first + fields['7E:4298']) & WORD_MASK;
  scratch['26'] = (scratch['14'] & CELL_COORDINATE_MASK) >>> CELL_X_INDEX_SHIFT;
  scratch['2F'] = scratch['26'] | scratch['29'];
  scratch['35'] = scratch['26'] | scratch['2C'];
  scratch['32'] = scratch['23'] | scratch['2C'];
  const indices = [...new Set([scratch['32'], scratch['38'], scratch['2F'], scratch['35']])];
  return prepareMotionRecordSearch({
    offset,
    fields,
    motionData,
    scratch,
    indices,
    stopAfterNonzeroIndex: true,
  });
}
