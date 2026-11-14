import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BANK, BANK_WITHOUT_IO } from '../../src/constants/memory-map.mjs';
import { isSlotMotionData, motionPrefixResetAddresses } from './slot-motion-data.mjs';

const INACTIVE_PREFIX_SLOT = WORD_MASK;
const PREFIX_RESET_FIRST_ADDRESS = 0x7e1d5b;

// Complete 80:DE7E..DE94 data contract, not a CPU/reset/frame simulation.
// The WORD API declares E0/M0/X0. Direct calls require an explicit WRAM DBR;
// native script dispatch supplies 80 at F4FB..F4FF. No old bytes are read.
export function prepareMotionPrefixReset88({ motionData = null, bank = null } = {}) {
  if (
    (motionData !== null && !isSlotMotionData(motionData)) ||
    (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK))
  )
    throw Error('Invalid motion prefix reset context');
  if (bank === null || (bank !== WRAM_BANK && bank & BANK_WITHOUT_IO))
    return { handled: false, reason: 'slot_motion_prefix_bank_required' };
  if (!motionData)
    return {
      handled: false,
      reason: 'slot_motion_data_source_required',
      address: PREFIX_RESET_FIRST_ADDRESS,
    };
  return {
    handled: true,
    writes: motionPrefixResetAddresses.map((address, index) => ({
      address,
      value: index === 0 ? INACTIVE_PREFIX_SLOT : 0,
    })),
  };
}
