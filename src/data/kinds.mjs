// Kind table 8C:EFB0 (docs/ROM-FREE.md, step 2). An actor's kind k
// (src/data/actors.mjs) selects 6 bytes at 8C:EFB0 + 6 k; the readers
// multiply by 6 (ASL, STA, ASL, ADC) and add their field offset:
// - +0 name: text pointer (bit 15 selects bank 9E instead of 9D, the offset
//   gets bit 15 set; src/data/texts.mjs) for the name window FADD/F963 of
//   80:BE6D and 9BC6, for E9A8 and the lists of EA6E at 1DA9; FFFF marks a
//   kind without a name, which 9BC6 and BE6D do not offer under the glove.
// - +2 value: returned to scripts by the natives 80:C9F1 (kind of slot
//   3F28) and 80:CAF2 (kind of an actor entry).
// - +4 flags: 80:A835 copies them to 1458 of the new slot (CB06 returns
//   them); EA6E compares bits 0 and 1 with 1F66.
// The kinds used by the actor table go up to 274; 275 records end exactly
// at the first palette table 8C:F622 (src/data/palettes.mjs). Kinds are
// indices, so the table keeps its count (kind_layout_changed).
// Native form assets/vm-kinds.json: per kind name (text address as in
// vm-texts.json, or null), value and flags (hex).
import { VmFault } from '../vm/memory.mjs';
import { hex, romWriter, wordReader, textPointerLabel, textPointerWord } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX, WORD_HEX_DIGITS } from '../constants/bits.mjs';

// Entry: name text pointer (FFFF none), value word, flags word.
const KIND_BYTES = 6,
  KIND_VALUE = 2,
  KIND_FLAGS = 4,
  NO_NAME = 0xffff;
export {
  NO_NAME as KIND_NO_NAME,
  KIND_BYTES,
  KIND_VALUE as KIND_VALUE_OFFSET,
  KIND_FLAGS as KIND_FLAGS_OFFSET,
};
// EA6E lists items whose flag bits 0 and 1 equal its class 1F66.
export const KIND_ITEM_CLASS_MASK = 3;
export const KIND_TABLE = 0x8cefb0,
  KINDS = 275,
  KIND_END = KIND_TABLE + KIND_BYTES * KINDS;

export function readKinds(read8) {
  const word = wordReader(read8);
  return Array.from({ length: KINDS }, (_, k) => {
    const at = KIND_TABLE + KIND_BYTES * k,
      name = word(at);
    return {
      name: name === NO_NAME ? null : textPointerLabel(name),
      value: hex(word(at + KIND_VALUE), WORD_HEX_DIGITS),
      flags: hex(word(at + KIND_FLAGS), WORD_HEX_DIGITS),
    };
  });
}

export function placeKinds(rom, present, { kinds }) {
  const put = romWriter(rom, present, 'kind_layout_changed');
  if (kinds?.length !== KINDS) throw new VmFault('kind_layout_changed', KIND_TABLE);
  kinds.forEach((e, k) => {
    const at = KIND_TABLE + KIND_BYTES * k;
    const text = (t, pattern) => {
      const m = pattern.exec(t ?? '');
      if (!m) throw new VmFault('kind_value_required', at);
      return m;
    };
    let name = NO_NAME;
    if (e.name !== null) {
      const [, bank, offset] = text(e.name, /^(9D|9E):([89A-F][0-9A-F]{3})$/);
      name = textPointerWord(bank, offset);
      if (name === NO_NAME) throw new VmFault('kind_value_required', at);
    }
    const value = parseInt(text(e.value, /^[0-9A-F]{4}$/)[0], HEX_RADIX),
      flags = parseInt(text(e.flags, /^[0-9A-F]{4}$/)[0], HEX_RADIX);
    [name, value, flags]
      .flatMap((v) => [v & BYTE_MASK, v >> BYTE_BITS])
      .forEach((v, n) => {
        put(at + n, v);
      });
  });
}
