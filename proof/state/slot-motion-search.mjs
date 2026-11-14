import { WORD_SIGN } from '../../src/constants/bits.mjs';
import { OBJECT_CLASS_MASK } from '../../src/task/wram.mjs';

// Bits 6..9 of X become the low cell-index word bits after the source shift.
export const CELL_X_INDEX_SHIFT = 5;
const BOX_FIELD = { X0: 0, Y0: 1, BOTTOM: 2, X1: 3, Y1: 4, TOP: 5 };
const CLASS_BLOCK_HEIGHT = 0x40;
// Shared, source-identical 86E5/85FE/8686 list operation for 80B2/8133/81B4/8238/82BC.
// Inputs are validated by each helper; scratch/indices retain its exact writes.
export const motionHelperScratchKeys = Object.freeze([
  '11',
  '14',
  '17',
  '1A',
  '1D',
  '20',
  '23',
  '26',
  '29',
  '2C',
  '2F',
  '32',
  '35',
  '38',
  '3B',
  '3E',
  '68',
]);

export function prepareMotionRecordSearch({
  offset,
  fields,
  motionData,
  scratch,
  indices,
  stopAfterNonzeroIndex = false,
}) {
  const first = fields['0E28'] >>> 2,
    second = fields['0E80'] >>> 2;
  const failure = (read) => ({ handled: false, reason: read.reason, address: read.address });
  const missingFlags = () => ({
    handled: false,
    reason: 'slot_motion_source_required',
    field: '1458',
  });
  for (const index of indices) {
    for (const list of [0, 1]) {
      const head = motionData.readHead(list, index);
      if (!head.available) return failure(head);
      let node = head.value;
      const seen = new Set();
      while (!(node & WORD_SIGN)) {
        if (seen.has(node))
          return { handled: false, reason: 'slot_motion_data_cycle_required', list, node };
        seen.add(node);
        const entry = motionData.readNodeRecord(node);
        if (!entry.available) return failure(entry);
        const record = entry.value,
          values = {};
        let eligible = true;
        // Preserve source short-circuit order: rejected records do not require
        // their later fields/metadata. All comparisons are unsigned words.
        for (const [field, word, upper] of [
          [0, scratch['14'], false],
          [BOX_FIELD.X1, scratch['11'], true],
          [1, scratch['1A'], false],
          [BOX_FIELD.Y1, scratch['17'], true],
          [2, scratch['20'], false],
          [BOX_FIELD.TOP, scratch['1D'], true],
        ]) {
          const read = motionData.readRecordField(record, field);
          if (!read.available) return failure(read);
          values[field] = read.value;
          if (upper ? read.value < word : word < read.value) {
            eligible = false;
            break;
          }
        }
        if (eligible) {
          const candidate = values[BOX_FIELD.TOP] - scratch['1D'];
          if (candidate >= scratch['3B']) {
            if (list === 0) scratch['68'] = record;
            const metadata = motionData.readMetadata(record);
            if (!metadata.available) return failure(metadata);
            if (list === 0) {
              if (metadata.value === 0) scratch['3B'] = candidate;
              else {
                if (fields['1458'] === null) return missingFlags();
                if (
                  (fields['1458'] & OBJECT_CLASS_MASK) === OBJECT_CLASS_MASK &&
                  first >= values[0] &&
                  first < values[BOX_FIELD.X1] &&
                  second >= values[1] &&
                  second < values[BOX_FIELD.Y1] &&
                  scratch['1D'] >= values[2]
                )
                  scratch['3B'] = CLASS_BLOCK_HEIGHT;
              }
            } else if (metadata.value !== offset) {
              const special = motionData.readSpecialSlot();
              if (!special.available) return failure(special);
              if (metadata.value !== special.value) scratch['3B'] = candidate;
              else {
                if (fields['1458'] === null) return missingFlags();
                if ((fields['1458'] & OBJECT_CLASS_MASK) !== OBJECT_CLASS_MASK)
                  scratch['3B'] = candidate;
              }
            }
          }
        }
        const next = motionData.readNextNode(node);
        if (!next.available) return failure(next);
        node = next.value;
      }
    }
    // 82BC checks Carry only after the complete 86E5 call: both lists and
    // every record may still replace 3B within this index.
    if (stopAfterNonzeroIndex && scratch['3B'] !== 0) break;
  }
  return {
    handled: true,
    value: scratch['3B'],
    carry: scratch['3B'] === 0 ? 1 : 0,
    scratchWords: scratch,
  };
}
