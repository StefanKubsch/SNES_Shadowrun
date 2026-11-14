// The party's karma, nuyen and magic points as scripts add to them (lifted from the script
// natives 80:CDB2, 80:CCDB and 80:8B8A; register-level references in
// proof/game-reference/party-funds.mjs).
//
// Karma (7E:3C11) is a word that wraps without a limit. Nuyen (7E:3C0D) is a 32-bit
// balance: a carry out of the low word raises the high word, and when that wraps the
// balance stays at FFFFFFFF. The magic points of the member shown in the status and
// spell menus (its index doubled at 7E:1F60, through the data bank 80) are a byte at
// 7E:3C96 plus the member that wraps without a limit; only the argument's low byte
// counts.
import { dataBankWord } from '../system/data-bank.mjs';
import { KARMA, MAGIC_POINTS, MEMBER_INDEX, NUYEN, WRAM } from '../task/wram.mjs';
import { BYTE_MASK, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

const NUYEN_LOW = WRAM + NUYEN,
  NUYEN_HIGH = NUYEN_LOW + 2,
  WORD = WORD_MASK + 1;

// 80:CDB2: karma plus amount.
export const addKarma = (mem, amount) =>
  mem.write16(WRAM + KARMA, (mem.read16(WRAM + KARMA) + amount) & WORD_MASK);

// 80:CCDB: nuyen plus amount, at most FFFFFFFF.
export function addNuyen(mem, amount) {
  const sum = mem.read16(NUYEN_LOW) + amount;
  if (sum < WORD) {
    mem.write16(NUYEN_LOW, sum);
    return;
  }
  const high = (mem.read16(NUYEN_HIGH) + 1) & WORD_MASK;
  mem.write16(NUYEN_LOW, sum & WORD_MASK);
  mem.write16(NUYEN_HIGH, high || WORD_MASK);
  if (!high) mem.write16(NUYEN_LOW, WORD_MASK);
}

// 80:8B8A: the shown member's magic points plus the low byte of amount.
export function addMemberMagicPoints(mem, amount) {
  const address = (WRAM + MAGIC_POINTS + (dataBankWord(mem, MEMBER_INDEX) >>> 1)) & LONG_MASK;
  mem.write8(address, (mem.read8(address) + amount) & BYTE_MASK);
}
