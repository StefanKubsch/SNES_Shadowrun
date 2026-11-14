// Source boundaries and glyph aliases: docs/PACKED-TEXT-EDITING.md.
import { VmFault, PACKED_TEXT_BANK } from '../vm/memory.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, HEX_RADIX } from '../constants/bits.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';

export const PROLOGUE_EDIT = 0x81f5ce;
export const CREDITS_EDIT = 0x81f2bd;
export const PACKED_TEXT_DOMAINS = Object.freeze(
  [
    {
      id: PROLOGUE_EDIT,
      field: 'lines',
      count: { en: 28, de: 29 },
      columns: 32,
      map: 0x81f803,
      font: 0x81f8b8,
      mapBytes: 256,
      fontBytes: { en: 1312, de: 1344 },
    },
    {
      id: CREDITS_EDIT,
      field: 'groups',
      count: { en: 14, de: 14 },
      columns: 31,
      map: 0x85fd38,
      font: 0x85fc15,
      mapBytes: 320,
      fontBytes: { en: 864, de: 896 },
    },
  ].map((domain) =>
    Object.freeze({
      ...domain,
      count: Object.freeze(domain.count),
      fontBytes: Object.freeze(domain.fontBytes),
    }),
  ),
);
const PAGE_LINES = 4,
  SOURCE_READ_AHEAD = 2;
const INTRO_GLYPH = /^[ A-Za-z0-9!"#&'(),.\-:;]$/;
const CREDITS_GLYPH = /^[ A-Za-z0-9!.\-:?]$/;
const BIT_TABLE = 0x80a033;
const UNICODE_ALIASES = Object.freeze({
  intro: { ä: '$', ß: '%' },
  credits: { ä: 'a', Ä: 'a', ü: 'u', Ü: 'u' },
});

function lineBytes(line, domain, language) {
  if (typeof line !== 'string' || line.length > domain.columns)
    throw new VmFault('packed_edit_row_required');
  const credits = domain.id === CREDITS_EDIT;
  if (!credits && !line) throw new VmFault('packed_edit_line_required');
  const bytes = [];
  for (const char of line) {
    let glyph = language === 'de' ? UNICODE_ALIASES[credits ? 'credits' : 'intro'][char] : null;
    if (!glyph) {
      if (!(credits ? CREDITS_GLYPH : INTRO_GLYPH).test(char))
        throw new VmFault('packed_edit_character_required');
      // German lowercase a/u are umlaut slots, so ordinary letters use uppercase.
      glyph = credits ? char.toUpperCase() : char;
    }
    bytes.push(glyph.charCodeAt(0));
  }
  return [...bytes, 0];
}

export function buildPackedTextEdits(asset) {
  const result = { en: new Map(), de: new Map() };
  for (const language of ['en', 'de']) {
    for (const entry of asset[language]) {
      const domain = PACKED_TEXT_DOMAINS.find(
        (d) =>
          entry?.address ===
          d.id
            .toString(HEX_RADIX)
            .toUpperCase()
            .replace(/(..)(....)/, '$1:$2'),
      );
      if (!domain) continue;
      if (result[language].has(domain.id)) throw new VmFault('packed_edit_identity_required');
      if (Object.keys(entry).some((key) => key !== 'address' && key !== domain.field))
        throw new VmFault('packed_edit_shape_required');
      const content = entry[domain.field];
      if (!Array.isArray(content) || (content.length && content.length !== domain.count[language]))
        throw new VmFault('packed_edit_count_required');
      const bytes = [];
      for (const item of content) {
        if (domain.id === PROLOGUE_EDIT) bytes.push(...lineBytes(item, domain, language));
        else {
          if (!Array.isArray(item) || !item.length || item.length > PAGE_LINES)
            throw new VmFault('packed_edit_page_required');
          bytes.push(item.length);
          for (const line of item) bytes.push(...lineBytes(line, domain, language));
        }
      }
      result[language].set(domain.id, Uint8Array.from([...bytes, 0]));
    }
  }
  return result;
}

// Preflight the complete replacement set before publishing any provider state.
// The temporary bank exists only while the owner's three sources are loading.
export function beginPackedTextEdit(memory, id) {
  if (!memory) return null;
  if (memory.packedTextSnapshot) throw new VmFault('packed_edit_snapshot_active');
  const edits = memory.textEdits?.packed;
  const language = memory.languageData;
  const domain = PACKED_TEXT_DOMAINS.find((d) => d.id === id);
  if (!domain) throw new VmFault('packed_edit_identity_required');
  let data = language && edits?.de.get(id),
    code = 'de';
  if (!data) {
    if (!language?.streams.has(id)) {
      data = edits?.en.get(id);
      code = 'en';
    }
  }
  if (!data) {
    // Keep the exact original or translated source pointers. Pin the A1 bank
    // as well so switching to English cannot remove an in-flight source.
    const translated = !!language?.streams.has(id);
    const sources = new Map(
      [domain.id, domain.map, domain.font].map((cpu) => {
        const source = translated ? language.streams.get(cpu) : cpu;
        if (source === undefined) throw new VmFault('packed_edit_source_required', cpu);
        return [cpu, source];
      }),
    );
    const snapshot = { bank: null, sources, languageBank: translated ? language.bank : null };
    memory.packedTextSnapshot = snapshot;
    return snapshot;
  }
  const bits = lzBits((n) => memory.read8(BIT_TABLE + n));
  const packed = lzEncode(data, [], bits);
  const parts = [Uint8Array.from([data.length & BYTE_MASK, data.length >> BYTE_BITS, ...packed])];
  for (const [cpu, length] of [
    [domain.map, domain.mapBytes],
    [domain.font, domain.fontBytes[code]],
  ]) {
    const source = code === 'de' ? language.streams.get(cpu) : cpu;
    if (source === undefined || memory.read16(source) !== length)
      throw new VmFault('packed_edit_source_required', cpu);
    const found = lzDecode((n) => memory.read8(source + 2 + n), length, bits);
    parts.push(
      Uint8Array.from({ length: 2 + found.byteLength }, (_, n) => memory.read8(source + n)),
    );
  }
  const size = parts.reduce((n, part) => n + part.length, SOURCE_READ_AHEAD);
  if (size > LOROM_OFFSET) throw new VmFault('packed_edit_bank_full');
  const bank = new Uint8Array(size),
    sources = new Map();
  let at = 0;
  for (const [n, cpu] of [domain.id, domain.map, domain.font].entries()) {
    sources.set(cpu, (PACKED_TEXT_BANK << WORD_BITS) | (LOROM_OFFSET + at));
    bank.set(parts[n], at);
    at += parts[n].length;
  }
  const snapshot = { bank, sources };
  memory.packedTextSnapshot = snapshot;
  return snapshot;
}

export function endPackedTextEdit(memory, snapshot) {
  if (memory?.packedTextSnapshot === snapshot) memory.packedTextSnapshot = null;
}
