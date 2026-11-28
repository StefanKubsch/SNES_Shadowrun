// Named, typed script fields over the same storage the game functions use. Live
// scripts access the independent arrays directly; the temporary schema bridge keeps
// raw diagnostic fixtures working while phase 3 migrates the other state consumers.
import { SCRIPT_FIELDS } from './script-fields.mjs';
import { FRONTEND_FIELDS, frontendState } from './frontend.mjs';
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { MATRIX_FIELDS, matrixState } from './matrix.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { WRAM_BASE } from '../constants/memory-map.mjs';
import { BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

export const SCRIPT_STATE_OWNERS = Object.freeze({
  frontend: [FRONTEND_FIELDS, frontendState],
  scene: [SCENE_ROOM_FIELDS, sceneRoomState],
  combat: [COMBAT_FIELDS, combatState],
  matrix: [MATRIX_FIELDS, matrixState],
  windows: [WINDOW_TEXT_FIELDS, windowsText],
});
const states = new WeakMap();

export function scriptState(mem) {
  let state = states.get(mem);
  if (state) return state;
  state = {};
  for (const [path, owner, field, index, bytes] of SCRIPT_FIELDS) {
    const [schema, table] = SCRIPT_STATE_OWNERS[owner],
      layout = schema[field],
      mask = bytes === 1 ? BYTE_MASK : WORD_MASK,
      address = WRAM_BASE + layout.base + index * (layout.stride ?? layout.bytes),
      read = bytes === 1 ? mem.read8.bind(mem) : mem.read16.bind(mem),
      write = bytes === 1 ? mem.write8.bind(mem) : mem.write16.bind(mem),
      parts = path.split('.'),
      name = parts.pop();
    let parent = state;
    for (const part of parts) parent = parent[part] ??= {};
    Object.defineProperty(parent, name, {
      enumerable: true,
      get() {
        const values = table(mem.wram)?.[field];
        return values ? values[index] & mask : read(address);
      },
      set(value) {
        const values = table(mem.wram)?.[field];
        if (values) values[index] = (values[index] & ~mask) | (value & mask);
        else write(address, value & mask);
      },
    });
  }
  states.set(mem, state);
  return state;
}
