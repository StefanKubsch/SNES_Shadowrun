// Selection and windows shared by the party, status, item and spell menus.
// Named fields use the existing independent window owner during phase 3.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { runnerState } from './runners.mjs';
import { runnerMetadata, memberRecordAddress } from '../content/runners.mjs';
import { DP_MEMBER_RECORD, DP_MEMBER_RECORD_BANK } from '../data/wram.mjs';
import { WORD_MASK, WORD_SIGN, WORD_BITS } from '../constants/bits.mjs';

const states = new WeakMap();
export function memberMenuState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    selected = field('memberIndex'),
    descriptors = {};
  for (const [name, owner] of Object.entries({
    number: 'memberNumber',
    object: 'memberObject',
    health: 'memberCount',
    portrait: 'memberPortrait',
    datajack: 'memberDatajack',
    active: 'memberActive',
    itemsAtOnce: 'itemsAtOnce',
    redrawPortrait: 'portraitRedraw',
    endWord: 'dialogEnd',
    runSpell: 'spellRunsScript',
  }))
    descriptors[name] = field(owner);
  for (const [index, name] of ['window', 'menuWindow', 'submenuWindow', 'extraWindow'].entries())
    descriptors[name] = field('menuWindows', index);
  descriptors.runnerIndex = {
    get() {
      const value = selected.get();
      return (value & WORD_SIGN ? value - WORD_MASK - 1 : value) / 2;
    },
    set(value) {
      selected.set(value * 2);
    },
  };
  state = Object.defineProperties({}, descriptors);
  Object.defineProperties(state, {
    details: { get: () => runnerMetadata(mem, state.runnerIndex) },
    stats: {
      get: () =>
        state.runnerIndex >= 0 && state.runnerIndex < 13
          ? runnerState(mem, state.runnerIndex).stats
          : state.details.stats,
    },
    equipment: { get: () => runnerState(mem, (selected.get() & 0x3fff) / 2) },
    resources: { get: () => runnerState(mem, selected.get() >>> 1) },
  });
  // Write-only compatibility cursor for the old submenu readers and the golden
  // projection. The display reads named stats, never this serialized pointer.
  let recordPosition = 0;
  Object.defineProperty(state, 'recordPosition', {
    get: () => recordPosition,
    set(value) {
      recordPosition = value;
      const address = memberRecordAddress(mem, state.runnerIndex);
      mem.write16Bank0(DP_MEMBER_RECORD, (address + value) & WORD_MASK);
      mem.write8(DP_MEMBER_RECORD_BANK, address >>> WORD_BITS);
    },
  });
  state.prepareLegacySkills = () => {
    state.recordPosition = 6;
  };
  states.set(mem, state);
  return state;
}
