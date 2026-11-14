import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { WRAM_BANK, BANK_WITHOUT_IO } from '../../src/constants/memory-map.mjs';
import { WRAM, PLAYER_OBJECT, OBJECT_LAST_SLOT } from '../../src/task/wram.mjs';
import { isSlotMotionData } from './slot-motion-data.mjs';
import { prepareMotionAFC4 } from './slot-motion-afc4.mjs';

const OBJECT_SLOT_COUNT = OBJECT_LAST_SLOT / 2 + 1;
const PLAYER_OBJECT_ADDRESS = WRAM + PLAYER_OBJECT;
const POSITIVE_ALTERNATING_MOTION = 4;
const NEGATIVE_ALTERNATING_MOTION = -POSITIVE_ALTERNATING_MOTION & WORD_MASK;

// Pure game-data contract from all 51 DE94 bytes. Entry E0/M0/X0 is the
// declared WORD API precondition; no CPU/register execution or clock tick.
export function prepareMotionPrefixDE94({ motionData = null, bank = null } = {}) {
  if (
    (motionData !== null && !isSlotMotionData(motionData)) ||
    (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK))
  )
    throw Error('Invalid DE94 context');
  // These absolute operands are below 2000: low-WRAM mirrors 00..3F/80..BF,
  // or direct bank 7E. Other DBRs cannot use this 7E data owner implicitly.
  if (bank === null || (bank !== WRAM_BANK && bank & BANK_WITHOUT_IO))
    return { handled: false, reason: 'slot_motion_prefix_bank_required' };
  if (!motionData)
    return {
      handled: false,
      reason: 'slot_motion_data_source_required',
      address: PLAYER_OBJECT_ADDRESS,
    };
  const source = motionData.readSpecialSlot();
  if (!source.available) {
    const { available, ...boundary } = source;
    return { handled: false, ...boundary };
  }
  const offset = source.value;
  if (offset & WORD_SIGN) return { handled: true, outcome: 'inactive', offset, fields: {} };
  const counter = motionData.readPrefixCounter();
  if (!counter.available) {
    const { available, ...boundary } = counter;
    return { handled: false, ...boundary };
  }
  if (counter.value === 0) return { handled: true, outcome: 'counter_zero', offset, fields: {} };
  // Source has no alignment/capacity gate. Our bounded slot owner only
  // supports these reached bytes; unsupported aliases stop before all writes.
  if (offset > OBJECT_LAST_SLOT || offset & 1)
    return { handled: false, reason: 'slot_window_required', offset };
  const value = counter.value - 1;
  return {
    handled: true,
    outcome: value === 0 ? 'expired' : 'alternating',
    offset,
    counterWrite: value,
    fields:
      value === 0
        ? { '0D20': 0, '0D78': 0 }
        : counter.value & 1
          ? { '0D20': NEGATIVE_ALTERNATING_MOTION, '0D78': POSITIVE_ALTERNATING_MOTION }
          : { '0D20': POSITIVE_ALTERNATING_MOTION, '0D78': NEGATIVE_ALTERNATING_MOTION },
  };
}

// Both original calls share one preflight. AFC4 reads the actual planned
// movement columns, including writes to an inactive or duplicated slot.
export function prepareMotionDE94AFC4(context) {
  const prefix = prepareMotionPrefixDE94(context);
  if (!prefix.handled) return { ...prefix, phase: 'prefix' };
  const snapshot = context.snapshot;
  if (!snapshot?.columns) throw Error('Invalid DE94/AFC4 snapshot');
  const columns = { ...snapshot.columns };
  for (const [key, value] of Object.entries(prefix.fields)) {
    if (!Array.isArray(columns[key]) || columns[key].length !== OBJECT_SLOT_COUNT)
      throw Error('Invalid DE94/AFC4 slot columns');
    columns[key] = [...columns[key]];
    columns[key][prefix.offset / 2] = value;
  }
  const afc4 = prepareMotionAFC4({ ...context, snapshot: { ...snapshot, columns } });
  return afc4.handled ? { handled: true, prefix, afc4 } : afc4;
}
