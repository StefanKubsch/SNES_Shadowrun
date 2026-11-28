// Static actor and kind records. The data readers are the phase 4 content bridge.
import {
  readActors,
  ACTOR_BYTES,
  ACTOR_TABLE,
  ACTOR_RECORD,
  ACTOR_KIND,
  ACTOR_SCRIPT,
} from '../data/actors.mjs';
import { readKinds, KIND_TABLE } from '../data/kinds.mjs';
import { textPointerWord } from '../data/rom-bytes.mjs';
import { HEX_RADIX, WORD_MASK, WORD_BITS, LONG_MASK } from '../constants/bits.mjs';
const states = new WeakMap();
const textId = (label) => {
  if (!label) return WORD_MASK;
  const [bank, offset] = label.split(':');
  return textPointerWord(bank, offset);
};
export function actorContent(mem) {
  let content = states.get(mem);
  if (!content) {
    const actors = readActors((at) => mem.read8(at)).map((actor, index) => ({
      number: index * ACTOR_BYTES,
      flags: parseInt(actor.flags, HEX_RADIX),
      record: actor.record ? parseInt(actor.record, HEX_RADIX) : 0,
      kind: actor.kind,
      script: actor.script,
    }));
    const kinds = readKinds((at) => mem.read8(at)).map((kind) => ({
      name: textId(kind.name),
      value: parseInt(kind.value, HEX_RADIX),
      flags: parseInt(kind.flags, HEX_RADIX),
    }));
    states.set(mem, (content = { actors, kinds }));
  }
  return content;
}
export function actorDetails(mem, number) {
  const index = number / ACTOR_BYTES,
    content = actorContent(mem);
  if (Number.isInteger(index) && index >= 0 && index < content.actors.length)
    return content.actors[index];
  const at = ACTOR_TABLE + number,
    word = (offset) => mem.read16((at + offset) & LONG_MASK);
  return {
    number,
    flags: mem.read8(at & LONG_MASK),
    record: word(ACTOR_RECORD),
    kind: word(ACTOR_KIND),
    script: word(ACTOR_SCRIPT),
  };
}
export function kindDetails(mem, number) {
  const kinds = actorContent(mem).kinds;
  if (Number.isInteger(number) && number >= 0 && number < kinds.length) return kinds[number];
  const twice = (number << 1) & WORD_MASK,
    index = (((twice << 1) & WORD_MASK) + twice + (twice >>> (WORD_BITS - 1))) & WORD_MASK,
    word = (offset) => mem.read16((KIND_TABLE + index + offset) & LONG_MASK);
  return { name: word(0), value: word(2), flags: word(4) };
}
