// The party's karma, nuyen, magic points and learned spells as scripts add to them (lifted
// from the script natives 80:CDB2, 80:CCDB, 80:8B8A and 80:E1B3; register-level references
// in proof/game-reference/party-funds.mjs).
//
// Karma (7E:3C11) is a word that wraps without a limit. Nuyen (7E:3C0D) is a 32-bit
// balance: a carry out of the low word raises the high word, and when that wraps the
// balance stays at FFFFFFFF. The magic points of the member shown in the status and
// spell menus (its index doubled at 7E:1F60, through the data bank 80) are a byte at
// 7E:3C96 plus the member that wraps without a limit; only the argument's low byte
// counts. The learned spells are words at 7E:3C1C ended by 0; a new spell goes to the end
// (the new end marker first) unless the list holds it. A list without an end in all
// 32768 words would keep the original scanning forever; it stops the task instead.
import { taskStop } from '../task/plan.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { KARMA, MAGIC_POINTS, MEMBER_INDEX, NUYEN, SPELL_LIST, WRAM } from '../task/wram.mjs';
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

const SPELL_BYTES = 2,
  SPELL_ENTRIES = WORD / SPELL_BYTES;
// 80:E1B3: add the spell to the learned spells unless they hold it.
export function learnSpell(mem, spell) {
  const at = (entry) => (WRAM + SPELL_LIST + entry) & LONG_MASK;
  for (let entry = 0, n = 0; n < SPELL_ENTRIES; entry = (entry + SPELL_BYTES) & WORD_MASK, n++) {
    const known = mem.read16(at(entry));
    if (known === 0) {
      mem.write16(at(entry + SPELL_BYTES), 0);
      mem.write16(at(entry), spell);
      return;
    }
    if (known === spell) return;
  }
  taskStop('task_native_spell_list_unbounded');
}
