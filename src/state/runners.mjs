// Mutable runner resources and equipment, shared with scripts and saved games.
// Records are cached per game; equipment aliases outside the thirteen regular
// runners stay in the temporary schema bridge.
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { stateField } from './named-fields.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const states = new WeakMap();
export function runnerState(mem, index) {
  let records = states.get(mem);
  if (!records) states.set(mem, (records = new Map()));
  let record = records.get(index);
  if (record) return record;
  const equipmentIndex = ((index * 8) & WORD_MASK) / 8,
    field = (name, at = equipmentIndex) => stateField(mem, COMBAT_FIELDS, combatState, name, at);
  record = Object.defineProperties(
    {
      armour: Object.defineProperties(
        {},
        {
          object: field('armour'),
          rating: field('armourRating'),
        },
      ),
      weapon: Object.defineProperties(
        {},
        {
          object: field('weapon'),
          kind: field('weaponKind'),
          damage: field('weaponDamage'),
          range: field('weaponRange'),
        },
      ),
    },
    { magicPoints: field('magic', index) },
  );
  records.set(index, record);
  return record;
}
