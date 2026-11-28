// Named action rows and selection workspace. The override shares flag row seven;
// overflow rows and hotkeys retain their original cross-field aliases.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { windowManagerState } from './windows.mjs';
import { navigationState } from './menu.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
export const ACTION_OVERRIDE_ROW = 7;
const ACTION_MASK_ARGUMENT = 0x65,
  ACTION_WINDOW_ARGUMENT = 0x68;
const states = new WeakMap();
export function actionMenuState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const raw = workspaceMemory(mem.wram),
    field = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    rows = new Map();
  state = Object.defineProperties(
    { windows: windowManagerState(mem) },
    {
      accepted: scratchWord(raw, ACTION_MASK_ARGUMENT),
      window: scratchWord(raw, ACTION_WINDOW_ARGUMENT),
      override: field('actionFlags', ACTION_OVERRIDE_ROW),
    },
  );
  state.row = (index) => {
    const originalIndex = ((index * 2) & WORD_MASK) / 2;
    let row = rows.get(originalIndex);
    if (!row) {
      row = Object.defineProperties(
        {},
        {
          text: field('actionNames', originalIndex),
          flag: field('actionFlags', originalIndex),
          hotkey: field('actionHotkeys', originalIndex),
        },
      );
      rows.set(originalIndex, row);
    }
    return row;
  };
  state.fitWindow = (count) =>
    fitListWindow(
      mem,
      mem.language
        ? listTextIds(mem, (WRAM_BANK << WORD_BITS) | WINDOW_TEXT_FIELDS.actionNames.base, count)
        : [],
    );
  state.configureChoice = (a, column, visibleRows) =>
    navigationState(a).configure({
      window: state.windows.windowArgument,
      column,
      row: 0,
      visibleRows,
      values: [],
      storage: 'action',
    });
  states.set(mem, state);
  return state;
}
