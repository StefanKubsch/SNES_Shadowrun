// The distance each party member follows behind the leader, in trail steps.
import { readTables } from '../data/tables.mjs';
import { romAddress } from '../data/rom-bytes.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const states = new WeakMap();
export function formationSpacing(mem, member) {
  let spacing = states.get(mem);
  if (!spacing) {
    const table = readTables((at) => mem.read8(at)).find(
      (table) => table.name === 'formation_slot_offsets',
    );
    spacing = { steps: table.values.map((value) => value / 2), address: romAddress(table.address) };
    states.set(mem, spacing);
  }
  if (Number.isInteger(member) && member >= 0 && member < spacing.steps.length)
    return spacing.steps[member];
  // A missing member retains the original content alias.
  return mem.read16(spacing.address + ((member * 2) & WORD_MASK)) / 2;
}
