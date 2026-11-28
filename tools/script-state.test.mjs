import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { scriptState } from '../src/state/scripts.mjs';
import { detachFrontend } from '../src/state/frontend.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachMatrix } from '../src/state/matrix.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { SCRIPT_FIELDS } from '../src/state/script-fields.mjs';
import { scriptStateField } from './script-state-fields.mjs';
import * as W from '../src/data/wram.mjs';

const memory = () => new VmMemory(cartridge.rom, undefined, null, cartridge.present);
const detach = (mem) => {
  for (const owner of [
    detachFrontend,
    detachSceneRoom,
    detachCombat,
    detachMatrix,
    detachWindowsText,
  ])
    owner(mem.wram);
};
const parentOf = (state, path) => {
  const parts = path.split('.'),
    name = parts.pop();
  return [parts.reduce((parent, part) => parent[part], state), name];
};
const WORD_VALUE = 0xa537,
  BYTE_VALUE = 0x37,
  HIGH_BYTE = 0xa5;

for (const detached of [false, true]) {
  test(`script fields share native storage and preserve widths (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      state = scriptState(mem);
    if (detached) detach(mem);
    // The native side writes each original operand; the named field sees it. Writes
    // back through every field are checked by the original operand and access width.
    for (const [path, , , , bytes] of SCRIPT_FIELDS) {
      // Find the operand independently by scanning the fixed legacy state constants.
      const address = Object.values(W).find((address) => {
        if (!Number.isInteger(address)) return false;
        try {
          return scriptStateField(address, bytes) === `state.${path}`;
        } catch {
          return false;
        }
      });
      assert.notEqual(address, undefined, path);
      const [parent, name] = parentOf(state, path),
        at = W.WRAM + address;
      mem.write16(at, WORD_VALUE);
      assert.equal(parent[name], bytes === 1 ? BYTE_VALUE : WORD_VALUE, path);
      parent[name] = -1;
      assert.equal(mem.read16(at), bytes === 1 ? (HIGH_BYTE << 8) | 0xff : 0xffff, path);
      parent[name] = 0x10000;
      assert.equal(mem.read16(at), bytes === 1 ? HIGH_BYTE << 8 : 0, path);
    }
  });
}

test('script state survives late detachment and remains private to its game', () => {
  const mem = memory(),
    state = scriptState(mem),
    other = scriptState(memory());
  state.room.number = 345;
  detach(mem);
  assert.equal(scriptState(mem), state);
  assert.equal(state.room.number, 345);
  state.room.number = 3;
  assert.equal(mem.read16(W.WRAM + W.ROOM), 3);
  assert.equal(other.room.number, 0);
});

test('Leadership and the Skillsoft note retain their original shared value', () => {
  const mem = memory(),
    state = scriptState(mem);
  detach(mem);
  state.jake.leadership = 4;
  assert.equal(mem.read8(W.WRAM + W.JAKE_SKILLSOFT), 4);
  assert.equal(mem.read8(W.WRAM + W.JAKE_BODY + 10), 4);
  mem.write8(W.WRAM + W.JAKE_SKILLSOFT, 1);
  assert.equal(state.jake.leadership, 1);
});
