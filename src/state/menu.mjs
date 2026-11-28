// Shared menu navigation, drawing state and the legacy caller's argument bridge.
// Texts and numeric values are reread for each row, preserving overlapping lists.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { FRONTEND_FIELDS, frontendState } from './frontend.mjs';
import { stateField } from './named-fields.mjs';
import { dataBankOf } from '../system/data-bank.mjs';
import * as W from '../data/wram.mjs';
import { BYTE_BITS, LONG_MASK, WORD_BITS } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
const LIST_STORAGE = Object.freeze({
  member: { texts: WINDOW_TEXT_FIELDS.listNames.base, values: WINDOW_TEXT_FIELDS.listValues.base },
  action: {
    texts: WINDOW_TEXT_FIELDS.actionNames.base,
    values: WINDOW_TEXT_FIELDS.actionHotkeys.base,
  },
  choice: { texts: 0x154, values: 0x180 },
});
const states = new WeakMap();
export function navigationState(a) {
  let state = states.get(a);
  if (state) return state;
  const mem = a.mem,
    field = (name) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name),
    raw = (at) => ({
      get: () => mem.read16Bank0(at),
      set(value) {
        mem.write16Bank0(at, value);
      },
    }),
    descriptors = {};
  for (const name of [
    'pageStart',
    'selection',
    'column',
    'row',
    'drawRow',
    'rowsRemaining',
    'repeatCounter',
    'navigationInput',
    'showNumbers',
    'hotkeys',
  ])
    descriptors[name] = field(name);
  for (const [name, at] of Object.entries({
    window: 0,
    argument: 2,
    argumentColumn: W.DP_MENU_COLUMN,
    argumentRow: W.DP_MENU_ROW,
    visibleRows: W.DP_MENU_VISIBLE_ROWS,
    soundEffect: 2,
    soundLevel: W.DP_SOUND_LEVEL,
    soundVoices: W.DP_SOUND_VOICE,
  }))
    descriptors[name] = raw(at);
  descriptors.held = stateField(mem, FRONTEND_FIELDS, frontendState, 'padHeld');
  descriptors.pressed = stateField(mem, FRONTEND_FIELDS, frontendState, 'padPressed');
  state = Object.defineProperties({}, descriptors);
  const word = (address) =>
    mem.read8(address & LONG_MASK) | (mem.read8((address + 1) & LONG_MASK) << BYTE_BITS);
  state.textAt = (offset) =>
    word(
      (mem.read16Bank0(W.DP_LIST_TOKENS) | (mem.read8(W.DP_LIST_TOKEN_BANK) << WORD_BITS)) + offset,
    );
  state.valueAt = (offset) =>
    word(((dataBankOf(a) << WORD_BITS) | mem.read16Bank0(W.DP_LIST_VALUES)) + offset);
  state.configure = ({ window, column, row, visibleRows, items, values, storage }) => {
    const serialized = storage === 'member' || storage === 'action',
      buffers = serialized ? LIST_STORAGE[storage] : LIST_STORAGE.choice,
      texts = buffers.texts,
      numbers = buffers.values;
    // Member and action rows are already serialized, including aliases changed while a
    // window opens. Read them live; rewriting a terminator would change overflow.
    if (!serialized) {
      items.forEach((item, index) => mem.write16Bank0(texts + 2 * index, item));
      mem.write16Bank0(texts + 2 * items.length, 0);
    }
    if (values) {
      if (!serialized)
        values.forEach((value, index) => mem.write16Bank0(numbers + 2 * index, value));
      mem.write16Bank0(W.DP_LIST_VALUES, numbers);
    }
    state.window = window;
    state.argumentColumn = column;
    state.argumentRow = row;
    state.visibleRows = visibleRows;
    mem.write16Bank0(W.DP_LIST_TOKENS, texts);
    mem.write16Bank0(W.DP_LIST_TOKEN_BANK, WRAM_BANK);
  };
  states.set(a, state);
  return state;
}
