// The actors' state records that scripts read and change (lifted from the script natives
// 80:CB2B, 80:CB3C, 80:CB4D, 80:CB9F, 80:CBB3 and 80:CBCB; register-level references in
// proof/game-reference/actor-state.mjs).
//
// An actor entry (a byte offset into the actor table 8D:B01F, src/data/actors.mjs) holds
// the WRAM address of its state record (0: none): the flag byte at +1, the count byte at
// +2 and the property word at +3, in bank 7E (an address near FFFF reaches 7F). Without
// a record the reads return the bytes at 7E:0001 to 0004 and the writes change nothing.
import { ACTOR_RECORD, ACTOR_TABLE } from '../data/actors.mjs';
import { RECORD_COUNT, RECORD_FLAGS, RECORD_PROPERTY, WRAM } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK } from '../constants/bits.mjs';

const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const fieldAddress = (state, offset) => (WRAM + offset + state) & LONG_MASK;

// The state record of the actor entry (0: none).
export const actorState = (mem, actor) => longWord(mem, ACTOR_TABLE + ACTOR_RECORD + actor);
// 80:CB2B: the flag byte of the actor's state record.
export const actorStateFlags = (mem, actor) =>
  mem.read8(fieldAddress(actorState(mem, actor), RECORD_FLAGS));
// 80:CB3C: the count byte of the actor's state record.
export const actorStateCount = (mem, actor) =>
  mem.read8(fieldAddress(actorState(mem, actor), RECORD_COUNT));
// 80:CB4D: the property word of the actor's state record.
export const actorStateProperty = (mem, actor) =>
  longWord(mem, fieldAddress(actorState(mem, actor), RECORD_PROPERTY));
// The flag byte of the actor's state record changed by change(old) unless it has no
// record or keep(state) holds (the exploit fix of src/game/bugfixes.mjs).
function changeFlags(mem, actor, change, keep = () => false) {
  const state = actorState(mem, actor);
  if (state === 0 || keep(state)) return;
  const at = fieldAddress(state, RECORD_FLAGS);
  mem.write8(at, change(mem.read8(at)) & BYTE_MASK);
}
// 80:CB9F: the flag byte set to the low byte of flags; keep(state) as above.
export const setActorStateFlags = (mem, actor, flags, keep) =>
  changeFlags(mem, actor, () => flags, keep);
// 80:CBB3: bits (low byte) set in the flag byte.
export const setActorStateFlagBits = (mem, actor, bits) =>
  changeFlags(mem, actor, (old) => old | bits);
// 80:CBCB: only these bits (low byte) kept in the flag byte.
export const keepActorStateFlagBits = (mem, actor, bits) =>
  changeFlags(mem, actor, (old) => old & bits);
