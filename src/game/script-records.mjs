// The nuyen payment and the actors' state holders (lifted from the script natives
// 80:CD20 and 80:CBF7; register-level versions in src/task/native-modal.mjs, which the
// proofs keep using). The natives' bridges are in src/task/native-script-leaves.mjs.
//
// The nuyen are a 32-bit count, its low word first. An actor's entry in the actor table
// (src/data/actors.mjs) points at its state record in WRAM (or 0 for none), whose holder
// word names the object that holds the actor's item.
import { NUYEN } from '../task/wram.mjs';
import { ACTOR_RECORD, ACTOR_TABLE, STATE_HOLDER } from '../data/actors.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK } from '../constants/bits.mjs';

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:CD20: pay amount nuyen if there are enough. Returns whether they were paid.
export function payNuyen(wram, amount) {
  const low = word(wram, NUYEN),
    high = word(wram, NUYEN + 2);
  if (low < amount) {
    if (high === 0) return false;
    setWord(wram, NUYEN + 2, high - 1);
  }
  setWord(wram, NUYEN, low - amount);
  return true;
}

// 80:CBF7: the holder of actor (its entry's byte offset in the actor table) becomes
// holder; an actor without a state record keeps none.
export function setActorStateHolder(mem, actor, holder) {
  const at = (ACTOR_TABLE + ACTOR_RECORD + actor) & LONG_MASK,
    record = mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
  if (record === 0) return;
  // The original adds the record to 7E:0003 in 24 bits: past FFFC it reaches bank 7F.
  setWord(mem.wram, record + STATE_HOLDER, holder);
}
