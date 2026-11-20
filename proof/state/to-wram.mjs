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

export function toWram(memory, into = new Uint8Array(memory.wram.length)) {
  const { wram } = memory;
  if (into.buffer === wram.buffer) throw new Error('projection_destination_aliases_state');
  into.set(wram);
  if (hasDetachedObjects(wram)) {
    const objects = objectTable(wram);
    for (const [name, base] of Object.entries(OBJECT_FIELDS))
      for (let index = 0; index < objects[name].length; index++) {
        const value = objects[name][index];
        into[base + index * 2] = value & BYTE_MASK;
        into[base + index * 2 + 1] = value >>> BYTE_BITS;
      }
  }
  const collision = collisionTable(wram);
  if (collision)
    for (const [name, { base, count, stride }] of Object.entries(COLLISION_FIELDS))
      for (let i = 0; i < count; i++) {
        into[base + i * stride] = collision[name][i] & BYTE_MASK;
        into[base + i * stride + 1] = collision[name][i] >>> BYTE_BITS;
      }
  const maps = cameraMaps(wram);
  if (maps)
    for (const [name, { base, count, bytes }] of Object.entries(CAMERA_MAP_FIELDS))
      for (let i = 0; i < count; i++) {
        into[base + i * bytes] = maps[name][i] & BYTE_MASK;
        if (bytes === 2) into[base + i * bytes + 1] = maps[name][i] >>> BYTE_BITS;
      }
  const windows = windowsText(wram);
  if (windows)
    for (const [name, { base, count, bytes }] of Object.entries(WINDOW_TEXT_FIELDS))
      for (let i = 0; i < count; i++) {
        into[base + i * bytes] = windows[name][i] & BYTE_MASK;
        if (bytes === 2) into[base + i * bytes + 1] = windows[name][i] >>> BYTE_BITS;
      }
  const combatStateFields = combatState(wram);
  if (combatStateFields)
    for (const [name, { base, count, bytes, stride }] of Object.entries(COMBAT_FIELDS))
      for (let i = 0; i < count; i++) {
        into[base + i * stride] = combatStateFields[name][i] & BYTE_MASK;
        if (bytes === 2) into[base + i * stride + 1] = combatStateFields[name][i] >>> BYTE_BITS;
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
  wram.set(bytes);
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
