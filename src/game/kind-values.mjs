// Kinds that scripts ask for (lifted from the script natives 80:C9F1, 80:CAF2, 80:CB06 and
// 80:D0FC; register-level references in proof/game-reference/kind-values.mjs).
//
// An object's kind lies at 7E:3F28 plus its slot, an actor entry's kind at offset 3 of
// its entry in the actor table 8D:B01F (src/data/actors.mjs). The kind table 8C:EFB0
// (src/data/kinds.mjs) holds six bytes per kind: the value word and the flag word among
// them. The original forms the entry offset 6 * kind as 2 * kind plus 4 * kind with an
// ADC whose carry is the bit the second doubling shifted out (bit 14 of the kind), all
// in 16 bits; for the game's kinds that carry is zero.
import { OBJECT_KIND, WRAM } from '../task/wram.mjs';
import { ACTOR_KIND, ACTOR_TABLE } from '../data/actors.mjs';
import { KIND_FLAGS_OFFSET, KIND_TABLE, KIND_VALUE_OFFSET } from '../data/kinds.mjs';
import { LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const longWord = (mem, address) => mem.read16(address & LONG_MASK);

// The kind table offset of kind as the original forms it.
function kindEntry(kind) {
  const twice = (kind * 2) & WORD_MASK,
    fourTimes = (twice * 2) & WORD_MASK,
    carry = twice >>> (WORD_BITS - 1);
  return (fourTimes + twice + carry) & WORD_MASK;
}
const kindWord = (mem, kind, field) => longWord(mem, KIND_TABLE + field + kindEntry(kind));

// 80:D0FC: the kind of the actor entry at the offset actor.
export const actorKind = (mem, actor) => longWord(mem, ACTOR_TABLE + ACTOR_KIND + actor);
// 80:CAF2: the value of the actor entry's kind.
export const actorKindValue = (mem, actor) =>
  kindWord(mem, actorKind(mem, actor), KIND_VALUE_OFFSET);
// 80:CB06: the flags of the actor entry's kind.
export const actorKindFlags = (mem, actor) =>
  kindWord(mem, actorKind(mem, actor), KIND_FLAGS_OFFSET);
// 80:C9F1: the value of the object's kind.
export const objectKindValue = (mem, object) =>
  kindWord(mem, longWord(mem, WRAM + OBJECT_KIND + object), KIND_VALUE_OFFSET);
