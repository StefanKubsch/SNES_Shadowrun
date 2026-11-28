// Equipping updates the selected runner and the wearer's armour. Taking an item
// off restores the first matching runner's defaults, searched from the end.
// The optional original weapon bug writes the weapon number into kind/damage
// and its low byte into range; the enabled fix restores the three proper defaults.
import { runnerState } from '../state/runners.mjs';
import { defaultEquipment } from '../content/runners.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { RUNNERS } from '../data/runners.mjs';
import {
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  PLAYER_OBJECT,
  MEMBER_INDEX,
  RECORD_PROPERTY,
  WRAM,
} from '../data/wram.mjs';
import { LONG_MASK, WORD_SIGN, BYTE_BITS } from '../constants/bits.mjs';
import { objectWord, setLongObjectWord } from '../state/objects.mjs';

const ACTOR_STATE_RECORDS = 0x8db020;
const setProperty = (mem, record, property) =>
  mem.write16((WRAM + RECORD_PROPERTY + record) & LONG_MASK, property);
const selected = (mem) => runnerState(mem, (dataBankWord(mem, MEMBER_INDEX) & 0x3fff) / 2);

export function equipArmour(mem, item, rating) {
  const runner = selected(mem);
  runner.armour.object = objectWord(mem, 'number', item);
  runner.armour.rating = rating;
  const wearer = dataBankWord(
    mem,
    dataBankWord(mem, GLOVE_TARGET_TAG) & WORD_SIGN ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT,
  );
  setLongObjectWord(mem, 'armour', wearer, rating);
}
export function equipWeapon(mem, item, kind, damage, range) {
  const weapon = selected(mem).weapon;
  weapon.object = objectWord(mem, 'number', item);
  weapon.kind = kind;
  weapon.damage = damage;
  weapon.range = range;
}
function takeOff(mem, number, fixes) {
  for (let index = RUNNERS; index >= 0; index--) {
    const runner = runnerState(mem, index);
    if (number === runner.armour.object) {
      const defaults = defaultEquipment(mem, index).armour;
      runner.armour.object = defaults.object;
      runner.armour.rating = defaults.rating;
      return;
    }
    if (number === runner.weapon.object) {
      const defaults = defaultEquipment(mem, index).weapon;
      runner.weapon.object = defaults.object;
      runner.weapon.kind = fixes ? defaults.kind : defaults.object;
      runner.weapon.damage = fixes ? defaults.damage : defaults.object >>> BYTE_BITS;
      runner.weapon.range = fixes ? defaults.range : defaults.object;
      return;
    }
  }
}
export function setItemProperty(mem, item, property, fixes) {
  const record = objectWord(mem, 'record', item);
  if (record === 0) return;
  setProperty(mem, record, property);
  takeOff(mem, objectWord(mem, 'number', item), fixes);
}
export function setActorItemProperty(mem, actor, property, fixes) {
  const record = mem.read16((ACTOR_STATE_RECORDS + actor) & LONG_MASK);
  if (record === 0) return;
  setProperty(mem, record, property);
  takeOff(mem, actor, fixes);
}
