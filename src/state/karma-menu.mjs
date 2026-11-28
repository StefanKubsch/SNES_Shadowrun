// Karma upgrades and menu rows share the named Jake record and window owner.
// Counts and the selected row are ordinary game values; only saved/window fields
// still need the temporary schema bridge.
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { jakeState } from './jake.mjs';
const states = new WeakMap();
export function karmaMenuState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const window = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    rows = new Map();
  state = Object.defineProperties(
    { rowCount: 0, previousRowCount: -1, selectedRow: 0 },
    {
      balance: stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, 'karma'),
      player: stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, 'playerObject'),
      balanceWindow: window('menuWindows', 0),
      categoryWindow: window('menuWindows', 1),
      headerWindow: window('menuWindows', 2),
      listWindow: window('menuWindows', 3),
    },
  );
  state.row = (index) => {
    let row = rows.get(index);
    if (!row) {
      const source = window('listIndices', index);
      row = Object.defineProperties(
        {},
        {
          text: window('listNames', index),
          value: window('listValues', index),
          sourceIndex: {
            get: () => source.get() / 2,
            set(value) {
              source.set(value * 2);
            },
          },
        },
      );
      rows.set(index, row);
    }
    return row;
  };
  state.value = (upgrade) => {
    const [group, name] = upgrade.field.split('.'),
      jake = jakeState(mem);
    return name ? jake[group][name] : jake[group];
  };
  state.buy = (upgrade) => {
    const value = state.value(upgrade),
      cost = value * 8;
    if (state.balance < cost) return false;
    state.balance -= cost;
    const [group, name] = upgrade.field.split('.'),
      jake = jakeState(mem);
    if (name) jake[group][name] = value + 1;
    else jake[group] = value + 1;
    return true;
  };
  states.set(mem, state);
  return state;
}
