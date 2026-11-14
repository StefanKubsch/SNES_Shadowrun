// Display content uses stable original text words, never relocated pointers.
import { VmFault } from '../vm/memory.mjs';
import { encodeLanguageText, ENGLISH, GERMAN } from './language.mjs';
import { PORT_TEXTS } from './port-extension.mjs';
import { textPointerWord } from './rom-bytes.mjs';
import { TEXT_BUFFER, WINDOW_MAP_BUFFER } from '../task/wram.mjs';
import { HEX_RADIX } from '../constants/bits.mjs';
import { buildFrontendTextEdits } from './frontend-text-edits.mjs';
import { buildMatrixTextEdits } from './matrix-text-edits.mjs';
import { buildPackedTextEdits, PACKED_TEXT_DOMAINS } from './packed-text-edits.mjs';

export const TEXT_EDITS_FILE = 'vm-text-edits.json';
export const TEXT_EDITS_FORMAT = 'shadowrun-text-edits-v1';
// Leave the terminating zero before the adjacent window map workspace.
export const TEXT_EDIT_LIMIT = WINDOW_MAP_BUFFER - TEXT_BUFFER - 1;
const PRINTABLE_FIRST = 0x20,
  PRINTABLE_LAST = 0x7f;
// Original texts also use these font glyphs. Newlines, NUL, the Huffman
// terminator and internal style placeholders are deliberately excluded.
const ORIGINAL_GLYPHS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 16, 17, 30, 31]);
const UMLAUT_CHARACTERS = new Set(['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']);

export function buildTextEdits(asset, originals, menuOriginals = [], matrixOriginals = []) {
  if (asset?.format !== TEXT_EDITS_FORMAT || !Array.isArray(asset.en) || !Array.isArray(asset.de))
    throw new VmFault('text_edits_format_required');
  const ids = new Map(
    originals.map(({ address }) => {
      const [bank, offset] = address.split(':');
      return [address, textPointerWord(bank, offset)];
    }),
  );
  for (const { id } of PORT_TEXTS)
    ids.set(`port:${id.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`, id); // magic-number-ok: four hexadecimal digits of a text word
  const result = {
    menus: buildFrontendTextEdits(asset, menuOriginals),
    matrix: buildMatrixTextEdits(asset, matrixOriginals),
    packed: buildPackedTextEdits(asset),
  };
  const otherIdentities = new Set(
    [...menuOriginals, ...matrixOriginals]
      .map(({ address }) => address)
      .concat(
        PACKED_TEXT_DOMAINS.map(({ id }) =>
          id
            .toString(HEX_RADIX)
            .toUpperCase()
            .replace(/(..)(....)/, '$1:$2'),
        ),
      ),
  );
  for (const code of [ENGLISH, GERMAN]) {
    const texts = new Map();
    for (const entry of asset[code]) {
      if (otherIdentities.has(entry?.address)) continue;
      const id = ids.get(entry?.address),
        text = entry?.text;
      if (id === undefined || texts.has(id)) throw new VmFault('text_edit_identity_required');
      if (typeof text !== 'string' || text.length > TEXT_EDIT_LIMIT)
        throw new VmFault('text_edit_buffer_required');
      for (const char of text) {
        const value = char.charCodeAt(0);
        if (!(
          (value >= PRINTABLE_FIRST && value <= PRINTABLE_LAST) ||
          ORIGINAL_GLYPHS.has(value) ||
          (code === GERMAN && UMLAUT_CHARACTERS.has(char))
        ))
          throw new VmFault('text_edit_character_required');
      }
      texts.set(id, encodeLanguageText(text));
    }
    result[code] = texts;
  }
  return result;
}
