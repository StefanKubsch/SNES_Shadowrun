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
  return into;
}

// Restore a diagnostic snapshot into a fixture, including detached fields. Validate
// its size before changing state. Runtime saves keep their separate fixed format.
export function restoreWram(memory, bytes) {
  const { wram } = memory;
  if (!(bytes instanceof Uint8Array) || bytes.length !== wram.length)
    throw new Error('wram_snapshot_size_required');
  wram.set(bytes);
  if (hasDetachedObjects(wram)) {
    const objects = objectTable(wram);
    for (const [name, base] of Object.entries(OBJECT_FIELDS))
      for (let index = 0; index < objects[name].length; index++)
        objects[name][index] = bytes[base + index * 2] | (bytes[base + index * 2 + 1] << BYTE_BITS);
  }
}
