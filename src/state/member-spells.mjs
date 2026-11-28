// Named spell choices and selected spell resources. Only this migration bridge
// serializes the old menu columns, saved level reference and diagnostic arguments.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { memberMenuState } from './member-menu.mjs';
import { stateField } from './named-fields.mjs';
import { hasDetachedObjects } from './objects.mjs';
import { memberRecordAddress } from '../content/runners.mjs';
import { SPELL_NAMES, jakeState } from './jake.mjs';
import * as W from '../data/wram.mjs';
import { WRAM_BASE, WRAM_BANK } from '../constants/memory-map.mjs';
import { WORD_MASK, WORD_BITS, LONG_MASK } from '../constants/bits.mjs';

const states = new WeakMap();
export function memberSpellState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const menu = memberMenuState(mem),
    field = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    combat = (name) => stateField(mem, COMBAT_FIELDS, combatState, name),
    selectedPointer = combat('spellLevelPointer'),
    choices = new Map(),
    skillsPointer = () =>
      hasDetachedObjects(mem.wram)
        ? (memberRecordAddress(mem, menu.runnerIndex) + 6) & WORD_MASK
        : mem.read16Bank0(W.DP_MEMBER_RECORD),
    address = (index) => skillsPointer() + 6 + index;
  state = Object.defineProperties({}, { script: combat('spellScript'), name: combat('spellName') });
  state.level = (index) => {
    if (hasDetachedObjects(mem.wram)) return menu.stats.spells[SPELL_NAMES[index]];
    // Raw caller fixtures retain an explicit record argument until they migrate.
    const bank = mem.read8(W.DP_MEMBER_RECORD_BANK);
    return mem.read8((((bank << WORD_BITS) | skillsPointer()) + 6 + index) & LONG_MASK);
  };
  state.addressCarry = (index) => (address(index) > WORD_MASK ? 1 : 0);
  state.choice = (row) => {
    let choice = choices.get(row);
    if (!choice) {
      const pointer = field('listIndices', row + 24);
      choice = Object.defineProperties(
        {},
        {
          text: field('listNames', row),
          name: field('spellNames', row),
          script: field('listIndices', row),
          level: field('listIndices', row + 8),
          leaderScript: field('listIndices', row + 16),
          spell: {
            get: () => (pointer.get() - skillsPointer() - 6) & WORD_MASK,
            set(index) {
              pointer.set(address(index));
            },
          },
        },
      );
      choices.set(row, choice);
    }
    return choice;
  };
  state.select = (row) => {
    const choice = state.choice(row);
    state.script = choice.leaderScript;
    state.name = choice.name;
    selectedPointer.set(field('listIndices', row + 24).get());
  };
  Object.defineProperty(state, 'selectedLevel', {
    get() {
      const pointer = selectedPointer.get(),
        index = pointer - ((memberRecordAddress(mem, 0) + 12) & WORD_MASK);
      return index >= 0 && index < SPELL_NAMES.length
        ? jakeState(mem).spells[SPELL_NAMES[index]]
        : mem.read8(WRAM_BASE + pointer);
    },
  });
  state.prepareCast = () => {
    mem.write16Bank0(W.DP_SELECTION_POINTER, selectedPointer.get());
    mem.write16Bank0(W.DP_SELECTION_POINTER_BANK, WRAM_BANK);
    mem.write16Bank0(0, state.selectedLevel);
  };
  states.set(mem, state);
  return state;
}
