// Window-list drawing workspace, including live aliases of map writes to scratch.
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { windowState, windowManagerState } from './windows.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
const DRAWING_SCRATCH = {
  mapRow: 0xc3,
  columns: 0xc6,
  attributes: 0xc9,
  cellsLeft: 0xcc,
  window: 0xcf,
  tile: 0xd2,
};
const states = new WeakMap();
export function windowDrawingState(wram) {
  let state = states.get(wram);
  if (state) return state;
  const mem = workspaceMemory(wram),
    fields = {};
  for (const [name, at] of Object.entries(DRAWING_SCRATCH)) fields[name] = scratchWord(mem, at);
  state = Object.defineProperties(
    {
      manager: windowManagerState(mem),
      record: (handle) => windowState(mem, handle),
    },
    fields,
  );
  const cells = new Map();
  state.writeMap = (offset, tile) => {
    let field = cells.get(offset);
    if (!field) {
      field = stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'map', offset / 2);
      cells.set(offset, field);
    }
    field.set(tile);
  };
  states.set(wram, state);
  return state;
}
