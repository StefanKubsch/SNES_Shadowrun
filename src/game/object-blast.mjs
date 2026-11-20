// A blast (lifted from the script native 80:8E36; register-level version in
// proof/replay/native-object-hit.mjs, which recorded waits and inputs replay).
//
// The blast's centre is the object DP 00, its damage DP 02 (kept in DP A2 and A5). Every
// object slot from the last down to 0 is hit (80:8691 with the damage, no shooter) when
// it holds an object that can be hit (flag bit 15) and lies less than 60 from the centre
// on each axis: X, Y and height. The hit composes directly through its frame,
// with its own callees.
//
// Registers (user decision 2026-11-17): game state only. The hit takes the damage, the
// slot and the shooter as parameters (A, X and Y in the original); no registers are left.
import { hitObject } from './object-hit.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_HITTABLE,
  OBJECT_KIND,
  OBJECT_LAST_SLOT,
  OBJECT_X,
  OBJECT_Y,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The centre and damage in the direct page and the reach on each axis.
const DP_BLAST_CENTRE = 0xa2,
  DP_BLAST_DAMAGE = 0xa5,
  BLAST_REACH = 0x60,
  // The hit gets no shooter.
  NO_SHOOTER = WORD_MASK;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// Whether the blast reaches the slot: an object that can be hit within reach on each
// axis.
function blastReaches(mem, centre, slot) {
  if (word(mem.wram, OBJECT_KIND + slot) & WORD_SIGN) return false;
  if (!(dataBankWord(mem, OBJECT_FLAGS, slot) & OBJECT_HITTABLE)) return false;
  for (const offset of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
    const difference =
        (dataBankWord(mem, offset, slot) - dataBankWord(mem, offset, centre)) & WORD_MASK,
      distance = difference & WORD_SIGN ? -difference & WORD_MASK : difference;
    if (distance >= BLAST_REACH) return false;
  }
  return true;
}

// 80:8E36: hit every object the blast around DP 00 reaches with the damage DP 02. A
// sequence that ends with the native's RTS.
export function* hitObjectsInBlastSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    centre = word(wram, 0);
  yield () => {
    setWord(wram, DP_BLAST_CENTRE, centre);
    setWord(wram, DP_BLAST_DAMAGE, word(wram, 2));
  };
  for (let slot = OBJECT_LAST_SLOT; slot >= 0; slot -= 2) {
    let reached, damage;
    yield () => {
      reached = blastReaches(mem, centre, slot);
      damage = word(wram, DP_BLAST_DAMAGE);
    };
    if (reached) yield* hitObject(h, events, renderBuffer, damage, slot, NO_SHOOTER);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
