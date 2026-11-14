// The actors' state records that scripts read and change (lifted from the script natives
// 80:CB2B, 80:CB3C, 80:CB4D, 80:CB9F, 80:CBB3 and 80:CBCB; register-level references in
// proof/game-reference/actor-state.mjs).
//
// An actor entry (a byte offset into the actor table 8D:B01F, src/data/actors.mjs) holds
// the WRAM address of its state record (0: none): the flag byte at +1, the count byte at
// +2 and the property word at +3, in bank 7E (an address near FFFF reaches 7F). Without
// a record the reads return the bytes at 7E:0001 to 0004 and the writes change nothing.
import { ACTOR_RECORD, ACTOR_TABLE } from '../data/actors.mjs';
import { OBJECT_NUMBER, RECORD_COUNT, RECORD_FLAGS, RECORD_PROPERTY, WRAM } from '../task/wram.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

// A script's truth value.
const TRUE = WORD_MASK;

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
// 80:9DAE: TRUE (FFFF) when the actor has a state record whose property word is wanted,
// else 0.
export const isActorStateProperty = (mem, actor, wanted) =>
  actorState(mem, actor) !== 0 && actorStateProperty(mem, actor) === wanted ? TRUE : 0;
// 80:9DC8: the count byte of the state record of the object's actor entry (the object's
// number at 7E:150A, through the data bank 80) counted down, wrapping; guard (record,
// count) may change the count stored (the health cheat, src/game/cheats.mjs). TRUE (FFFF)
// when it reaches 0 or there is no record, else 0.
export function countDownObjectState(mem, object, guard = (_record, value) => value) {
  const state = actorState(mem, dataBankWord(mem, OBJECT_NUMBER, object));
  if (state === 0) return TRUE;
  const at = fieldAddress(state, RECORD_COUNT),
    count = guard(state, (mem.read8(at) - 1) & BYTE_MASK);
  mem.write8(at, count);
  return count === 0 ? TRUE : 0;
}
// 80:9DEC: the count byte of the actor's state record raised by amount (its low byte),
// wrapping in a byte, then at most six; no record, no change.
const COUNT_MAX = 6;
export function raiseActorStateCount(mem, actor, amount) {
  const state = actorState(mem, actor);
  if (state === 0) return;
  const at = fieldAddress(state, RECORD_COUNT);
  mem.write8(at, Math.min((mem.read8(at) + amount) & BYTE_MASK, COUNT_MAX));
}
