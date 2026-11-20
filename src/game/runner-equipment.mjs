// A runner's equipment (lifted from the script natives 80:8B16, 80:8B9F, 80:9D15 and 80:9CE4;
// register-level references in proof/game-reference/runner-equipment.mjs).
//
// Each runner has an eight-byte equipment row in WRAM (7E:3C2E plus eight times the
// runner): the armour object word and its rating byte, then the weapon object word and
// the kind, damage and range bytes. The member shown in the menus (7E:1F60, a word
// index) selects the row of the equip natives. Taking an item off (9D15, 9CE4) searches
// the rows from the last runner down and gives the first runner who wears it the default
// armour or weapon of the ROM table 80:97A9 again.
//
// The original's weapon branch 80:9D50 stores the default weapon word into kind and
// damage and its low byte into the range (two stores meant as reads of the defaults go
// to the ROM and have no effect); with the bug fixes on the defaults are read
// (src/game/bugfixes.mjs, docs/BUGFIXES.md).
import { dataBankWord } from '../system/data-bank.mjs';
import {
  RUNNER_DEFAULT_ARMOUR,
  RUNNER_DEFAULT_ARMOUR_RATING,
  RUNNER_DEFAULT_WEAPON,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE,
  RUNNER_DEFAULT_WEAPON_RANGE,
  RUNNER_EQUIPMENT_SCAN_START,
  RUNNER_EQUIPMENT_BYTES,
} from '../data/runners.mjs';
import {
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  PLAYER_OBJECT,
  MEMBER_INDEX,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_DAMAGE,
  RUNNER_WEAPON_RANGE,
  RECORD_PROPERTY,
  WRAM,
} from '../data/wram.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord, setLongObjectWord } from '../state/objects.mjs';

// The actor table's state record words (8D:B020 plus the actor entry; 0: none).
const ACTOR_STATE_RECORDS = 0x8db020;

// A word or byte of WRAM bank 7E at offset (which may cross into bank 7F).
const wramWord = (mem, offset) => mem.read16((WRAM + offset) & LONG_MASK);
const setWramWord = (mem, offset, value) => mem.write16((WRAM + offset) & LONG_MASK, value);
const setWramByte = (mem, offset, value) => mem.write8((WRAM + offset) & LONG_MASK, value);
// A byte through the data bank 80 at offset plus index.
const dataBankByte = (mem, offset, index) =>
  mem.read8((CODE_BANK_BASE + offset + index) & LONG_MASK);

// The equipment row of the member shown in the menus (the word index times four).
const memberRow = (mem) => (dataBankWord(mem, MEMBER_INDEX) << 2) & WORD_MASK;

// 80:8B16: the member wears the armour item object of rating; the object under the
// glove, or the player object when none is under it, gets the rating.
export function equipArmour(mem, item, rating) {
  const row = memberRow(mem);
  setWramWord(mem, RUNNER_ARMOUR + row, objectWord(mem, 'number', item));
  setWramByte(mem, RUNNER_ARMOUR_RATING + row, rating);
  const wearer = dataBankWord(
    mem,
    dataBankWord(mem, GLOVE_TARGET_TAG) & WORD_SIGN ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT,
  );
  setLongObjectWord(mem, 'armour', wearer, rating);
}
// 80:8B9F: the member wields the weapon item object with the kind, damage and range bytes.
export function equipWeapon(mem, item, kind, damage, range) {
  const row = memberRow(mem);
  setWramWord(mem, RUNNER_WEAPON + row, objectWord(mem, 'number', item));
  setWramByte(mem, RUNNER_WEAPON_KIND + row, kind);
  setWramByte(mem, RUNNER_WEAPON_DAMAGE + row, damage);
  setWramByte(mem, RUNNER_WEAPON_RANGE + row, range);
}
// The first runner from the last down who wears the object number gets the default
// armour or weapon again. The return words of 80:9CE4's JSRs to its branches lie only in
// free stack bytes and are not reproduced (game state only, user decision 2026-11-17).
function takeOff(mem, number, fixes) {
  for (let row = RUNNER_EQUIPMENT_SCAN_START; row >= 0; row -= RUNNER_EQUIPMENT_BYTES) {
    if (number === wramWord(mem, RUNNER_ARMOUR + row)) {
      setWramWord(mem, RUNNER_ARMOUR + row, dataBankWord(mem, RUNNER_DEFAULT_ARMOUR, row));
      setWramByte(
        mem,
        RUNNER_ARMOUR_RATING + row,
        dataBankByte(mem, RUNNER_DEFAULT_ARMOUR_RATING, row),
      );
      return;
    }
    if (number === wramWord(mem, RUNNER_WEAPON + row)) {
      const weapon = dataBankWord(mem, RUNNER_DEFAULT_WEAPON, row);
      setWramWord(mem, RUNNER_WEAPON + row, weapon);
      if (fixes) {
        setWramWord(
          mem,
          RUNNER_WEAPON_KIND + row,
          dataBankWord(mem, RUNNER_DEFAULT_WEAPON_KIND_DAMAGE, row),
        );
        setWramByte(
          mem,
          RUNNER_WEAPON_RANGE + row,
          dataBankByte(mem, RUNNER_DEFAULT_WEAPON_RANGE, row),
        );
      } else {
        setWramWord(mem, RUNNER_WEAPON_KIND + row, weapon);
        setWramByte(mem, RUNNER_WEAPON_RANGE + row, weapon);
      }
      return;
    }
  }
}
// 80:9D15: the record of the item object gets the property word, and the item is taken
// off its runner. Without a record nothing changes.
export function setItemProperty(mem, item, property, fixes) {
  const record = objectWord(mem, 'record', item);
  if (record === 0) return;
  setWramWord(mem, RECORD_PROPERTY + record, property);
  takeOff(mem, objectWord(mem, 'number', item), fixes);
}
// 80:9CE4: the state record of the actor entry gets the property word, and the actor's
// item is taken off its runner.
export function setActorItemProperty(mem, actor, property, fixes) {
  const record = mem.read16((ACTOR_STATE_RECORDS + actor) & LONG_MASK);
  if (record === 0) return;
  setWramWord(mem, RECORD_PROPERTY + record, property);
  takeOff(mem, actor, fixes);
}
