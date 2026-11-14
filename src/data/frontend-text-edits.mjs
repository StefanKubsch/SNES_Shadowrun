// Bank-81 frontend content keeps original identities and tile-based layout.
import { VmFault } from '../vm/memory.mjs';
import { HEX_RADIX } from '../constants/bits.mjs';

const FRONTEND_COPYRIGHT = 0x81d582;
const FRONTEND_SAVE_LABELS = new Map([
  [0x81e425, '1'],
  [0x81e433, '2'],
]);
// D531 writes one tile per character. E32F needs an arrow and a gap before
// selectable labels; D555 puts the copyright in column 2 as well.
const ROW_COLUMNS = 32,
  TEXT_COLUMN = 10,
  MIN_TEXT_COLUMN = 2,
  TILE_BYTES = 2;
export const FRONTEND_TEXT_LIMIT = ROW_COLUMNS - MIN_TEXT_COLUMN;
const SLOT_TOKEN = '{slot}';
const cpuAddress = (address) => parseInt(address.replace(':', ''), HEX_RADIX);
const codesFor = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0));

export function buildFrontendTextEdits(asset, originals) {
  const defaults = new Map(
    originals.map(({ address, text }) => [
      cpuAddress(address),
      {
        codes: codesFor(text),
        shift: 0,
      },
    ]),
  );
  const identities = new Map(originals.map(({ address }) => [address, cpuAddress(address)]));
  const result = { defaults, en: new Map(), de: new Map() };
  for (const code of ['en', 'de']) {
    for (const entry of asset[code]) {
      const id = identities.get(entry?.address);
      if (id === undefined) continue; // Huffman identities are validated by the caller.
      if (result[code].has(id)) throw new VmFault('menu_edit_identity_required');
      let text = entry.text;
      if (typeof text !== 'string') throw new VmFault('menu_edit_text_required');
      const digit = FRONTEND_SAVE_LABELS.get(id);
      // Nonempty save labels keep an unambiguous substitution site for all
      // four slots. Validate the rendered length, not the token's JSON length.
      if (digit && text) {
        if (text.split(SLOT_TOKEN).length !== 2) throw new VmFault('menu_edit_slot_required');
        text = text.replace(SLOT_TOKEN, digit);
      }
      if (/[{}]/.test(text)) throw new VmFault('menu_edit_slot_required');
      if (!/^[\x20-\x7E]*$/.test(text)) throw new VmFault('menu_edit_character_required');
      if (text.length > FRONTEND_TEXT_LIMIT) throw new VmFault('menu_edit_row_required');
      result[code].set(id, {
        codes: codesFor(text),
        shift: 0,
        slotIndex: digit && text ? entry.text.indexOf(SLOT_TOKEN) : -1,
      });
    }
  }
  return result;
}

// Keep original English/German positioning without edits. With edits, every
// selectable row shares one start column and arrow, including setting pairs.
export function resolveFrontendTextEdits(edits, language) {
  if (!edits || !(edits.en.size || (language && edits.de.size))) return null;
  const texts = new Map([
    ...edits.defaults,
    ...edits.en,
    ...(language?.menus ?? []),
    ...(language ? edits.de : []),
  ]);
  let longest = 0;
  for (const [id, { codes }] of texts)
    if (id !== FRONTEND_COPYRIGHT) longest = Math.max(longest, codes.length);
  const baseColumn = TEXT_COLUMN + (language?.menuArrowShift ?? 0) / TILE_BYTES;
  const column = Math.max(MIN_TEXT_COLUMN, Math.min(baseColumn, ROW_COLUMNS - longest));
  const shift = (column - TEXT_COLUMN) * TILE_BYTES;
  for (const [id, entry] of texts) {
    const digit = FRONTEND_SAVE_LABELS.get(id);
    texts.set(id, {
      ...entry,
      // The copyright has no cursor and keeps its independent column 2.
      shift: id === FRONTEND_COPYRIGHT ? 0 : shift,
      slotIndex: entry.slotIndex ?? (digit ? entry.codes.indexOf(digit.charCodeAt(0)) : -1),
    });
  }
  return { texts, arrowShift: shift };
}
