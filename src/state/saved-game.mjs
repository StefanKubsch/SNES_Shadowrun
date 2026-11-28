// The saved fields of the existing scene and party owners. The serializer addresses
// these fields by name. Raw fixtures temporarily use the owners' schema bridge;
// live games read and restore their independent arrays directly.
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { readStateByte, readStateWord, writeStateByte, writeStateWord } from './objects.mjs';

const OWNERS = Object.freeze({
  scene: [SCENE_ROOM_FIELDS, sceneRoomState],
  combat: [COMBAT_FIELDS, combatState],
});
export function savedGameState(mem) {
  const { wram } = mem;
  return {
    get(owner, field, index) {
      const [schema, table] = OWNERS[owner],
        values = table(wram)?.[field];
      if (values) return values[index];
      const { base, bytes, stride = bytes } = schema[field],
        at = base + index * stride;
      return bytes === 1 ? readStateByte(wram, at) : readStateWord(wram, at);
    },
    set(owner, field, index, value) {
      const [schema, table] = OWNERS[owner],
        values = table(wram)?.[field];
      if (values) values[index] = value;
      else {
        const { base, bytes, stride = bytes } = schema[field],
          at = base + index * stride;
        if (bytes === 1) writeStateByte(wram, at, value);
        else writeStateWord(wram, at, value);
      }
    },
  };
}
