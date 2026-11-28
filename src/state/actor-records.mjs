// Mutable actor records share the saved scene owner's bytes. Record identifiers
// remain opaque legacy tokens until every object/actor consumer has migrated.
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { stateField } from './named-fields.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const games = new WeakMap();
export function actorRecordState(mem, id) {
  let records = games.get(mem);
  if (!records) games.set(mem, (records = new Map()));
  let record = records.get(id);
  if (record) return record;
  const byte = (offset) =>
      stateField(
        mem,
        SCENE_ROOM_FIELDS,
        sceneRoomState,
        'actorRecords',
        id - SCENE_ROOM_FIELDS.actorRecords.base + offset,
      ),
    word = (offset) => {
      const low = byte(offset),
        high = byte(offset + 1);
      return {
        enumerable: true,
        get: () => low.get() | (high.get() << BYTE_BITS),
        set(value) {
          low.set(value & BYTE_MASK);
          high.set(value >>> BYTE_BITS);
        },
      };
    };
  record = Object.defineProperties({ id }, { property: word(0), count: byte(2), holder: word(3) });
  records.set(id, record);
  return record;
}
