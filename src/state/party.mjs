// Party members share the combat owner's saved fields. Member numbers are ordinary
// array indices; lastMember is -1 for an empty party. Only this migration bridge
// knows the old doubled indices used by scripts and unmigrated callers.
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { stateField } from './named-fields.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const states = new WeakMap();
export function partyState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name, index = 0) => stateField(mem, COMBAT_FIELDS, combatState, name, index),
    records = new Map();
  state = Object.defineProperties(
    {},
    {
      lastIndex: field('groupIndex'),
      leaderOnly: field('leaderOnly'),
      lastMember: {
        get() {
          const value = state.lastIndex;
          return (value & WORD_SIGN ? value - WORD_MASK - 1 : value) / 2;
        },
        set(value) {
          state.lastIndex = value * 2;
        },
      },
    },
  );
  state.member = (index) => {
    // Removal of the final member also reads the entry after it.
    const originalIndex = ((index * 2) & WORD_MASK) / 2;
    let record = records.get(originalIndex);
    if (!record) {
      record = Object.defineProperties(
        {},
        {
          kind: field('groupObjects', originalIndex),
          number: field('groupNumbers', originalIndex),
          position: field('groupPositions', originalIndex),
          slot: field('groupSlots', originalIndex),
        },
      );
      records.set(originalIndex, record);
    }
    return record;
  };
  states.set(mem, state);
  return state;
}
