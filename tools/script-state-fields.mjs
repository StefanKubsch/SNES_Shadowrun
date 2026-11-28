// The decompiler's projection from original state operands to named script fields.
// Product scripts contain only paths such as state.room.number and state.jake.magic.
import { SCRIPT_FIELDS } from '../src/state/script-fields.mjs';
import { SCRIPT_STATE_OWNERS } from '../src/state/scripts.mjs';

const fields = new Map(),
  HEX_RADIX = 16;
for (const [path, owner, field, index, bytes] of SCRIPT_FIELDS) {
  const layout = SCRIPT_STATE_OWNERS[owner][0][field],
    address = layout.base + index * (layout.stride ?? layout.bytes),
    key = `${address}:${bytes}`;
  if (index >= layout.count || bytes > layout.bytes || fields.has(key))
    throw new Error(`invalid script state field: ${path}`);
  fields.set(key, path);
}
export function scriptStateField(address, bytes) {
  const path = fields.get(`${address}:${bytes}`);
  if (!path)
    throw new Error(`unnamed script state field: ${address.toString(HEX_RADIX)} (${bytes})`);
  return `state.${path}`;
}
