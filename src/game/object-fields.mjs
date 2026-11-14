// Object fields that scripts read and change (lifted from the script natives 80:CA05,
// 80:CA0D, 80:CA15 and 80:CA20; register-level references in
// proof/game-reference/object-fields.mjs).
//
// An object's flag word (7E:1458 plus its slot) is reached through the data bank 80 as
// the original does (src/system/data-bank.mjs), so a slot of FFFF (none) reaches the
// word just below the table.
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { OBJECT_FLAGS } from '../task/wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

// 80:CA05: the object's flag word.
export const objectFlags = (mem, object) => dataBankWord(mem, OBJECT_FLAGS, object);
// 80:CA0D: replace the object's flag word.
export const setObjectFlags = (mem, object, flags) =>
  setDataBankWord(mem, OBJECT_FLAGS, object, flags & WORD_MASK);
// 80:CA15: set bits in the object's flag word.
export const setObjectFlagBits = (mem, object, bits) =>
  setObjectFlags(mem, object, objectFlags(mem, object) | bits);
// 80:CA20: keep only these bits of the object's flag word.
export const keepObjectFlagBits = (mem, object, bits) =>
  setObjectFlags(mem, object, objectFlags(mem, object) & bits);
