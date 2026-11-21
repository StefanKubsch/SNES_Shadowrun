import { SCENE_ROOM_FIELDS, sceneRoomState } from '../../src/state/scene-room.mjs';
import { COMBAT_FIELDS, combatState } from '../../src/state/combat.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from '../../src/state/windows-text.mjs';
import { CAMERA_MAP_FIELDS, cameraMaps } from '../../src/state/camera-maps.mjs';
import { COLLISION_FIELDS, collisionTable } from '../../src/state/collision.mjs';
// A diagnostic projection, never imported by the product. The unconverted state
// retains its bytes; the live object fields supply their original little-endian
// positions, including matrix, intro and OAM aliases. Projection does not mutate
// either the game state or the raw compatibility store.
import { OBJECT_FIELDS, objectTable, hasDetachedObjects } from '../../src/state/objects.mjs';
import { BYTE_BITS, BYTE_MASK } from '../../src/constants/bits.mjs';

// Contiguous fields can copy their existing bytes on little-endian hosts. Other
// hosts and strided records retain the explicit little-endian projection below.
// Views are cached per field array, without copying or changing the live storage.
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1,
  byteViews = new WeakMap();
function projectValues(into, values, base, bytes, stride = bytes, count = values.length) {
  if (
    stride === bytes &&
    count === values.length &&
    values.BYTES_PER_ELEMENT === bytes &&
    (bytes === 1 || LITTLE_ENDIAN)
  ) {
    let view = byteViews.get(values);
    if (!view) {
      view = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
      byteViews.set(values, view);
    }
    into.set(view, base);
    return;
  }
  for (let i = 0; i < count; i++) {
    into[base + i * stride] = values[i] & BYTE_MASK;
    if (bytes === 2) into[base + i * stride + 1] = values[i] >>> BYTE_BITS;
  }
}
export function toWram(memory, into = new Uint8Array(memory.wram.length)) {
  const { wram } = memory;
  if (into.buffer === wram.buffer) throw new Error('projection_destination_aliases_state');
  into.set(wram);
  if (hasDetachedObjects(wram)) {
    const objects = objectTable(wram);
    for (const [name, base] of Object.entries(OBJECT_FIELDS))
      projectValues(into, objects[name], base, 2);
  }
  for (const [schema, get] of [
    [COLLISION_FIELDS, collisionTable],
    [CAMERA_MAP_FIELDS, cameraMaps],
    [WINDOW_TEXT_FIELDS, windowsText],
    [COMBAT_FIELDS, combatState],
    [SCENE_ROOM_FIELDS, sceneRoomState],
  ]) {
    const table = get(wram);
    if (table)
      for (const [name, { base, count, bytes = 2, stride = bytes }] of Object.entries(schema))
        projectValues(into, table[name], base, bytes, stride, count);
  }
  return into;
}

// Restore a diagnostic snapshot into a fixture, including detached fields. Validate
// its size before changing state. Runtime saves keep their separate fixed format.
export function restoreWram(memory, bytes) {
  const { wram } = memory;
  if (!(bytes instanceof Uint8Array) || bytes.length !== wram.length)
    throw new Error('wram_snapshot_size_required');
  const collision = collisionTable(wram);
  const maps = cameraMaps(wram);
  const windows = windowsText(wram);
  const combatStateFields = combatState(wram);
  const sceneRoomStateFields = sceneRoomState(wram);
  wram.set(bytes);
  if (sceneRoomStateFields)
    for (const [name, { base, count, bytes: width, stride }] of Object.entries(SCENE_ROOM_FIELDS))
      for (let i = 0; i < count; i++)
        sceneRoomStateFields[name][i] =
          bytes[base + i * stride] | (width === 2 ? bytes[base + i * stride + 1] << BYTE_BITS : 0);
  if (combatStateFields)
    for (const [name, { base, count, bytes: width, stride }] of Object.entries(COMBAT_FIELDS))
      for (let i = 0; i < count; i++)
        combatStateFields[name][i] =
          bytes[base + i * stride] | (width === 2 ? bytes[base + i * stride + 1] << BYTE_BITS : 0);
  if (windows)
    for (const [name, { base, count, bytes: width }] of Object.entries(WINDOW_TEXT_FIELDS))
      for (let i = 0; i < count; i++)
        windows[name][i] =
          bytes[base + i * width] | (width === 2 ? bytes[base + i * width + 1] << BYTE_BITS : 0);
  if (maps)
    for (const [name, { base, count, bytes: width }] of Object.entries(CAMERA_MAP_FIELDS))
      for (let i = 0; i < count; i++)
        maps[name][i] =
          bytes[base + i * width] | (width === 2 ? bytes[base + i * width + 1] << BYTE_BITS : 0);
  if (collision)
    for (const [name, { base, count, stride }] of Object.entries(COLLISION_FIELDS))
      for (let i = 0; i < count; i++)
        collision[name][i] = bytes[base + i * stride] | (bytes[base + i * stride + 1] << BYTE_BITS);
  if (hasDetachedObjects(wram)) {
    const objects = objectTable(wram);
    for (const [name, base] of Object.entries(OBJECT_FIELDS))
      for (let index = 0; index < objects[name].length; index++)
        objects[name][index] = bytes[base + index * 2] | (bytes[base + index * 2 + 1] << BYTE_BITS);
  }
}
