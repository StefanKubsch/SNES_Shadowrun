// Alternative text language (docs/LANGUAGES.md, user request 2026-11-05): the
// German texts of assets/vm-texts-de.json (tools/extract-texts-de.mjs) replace
// the English Huffman texts at display time. The game keeps running on the
// English data, so saved games and every script stay the same in both
// languages; only the characters that 80:FE69 decodes into the text buffer
// 7E:21A0 change (src/task/native-text-compose.mjs). The text composition
// FB39 then measures, wraps and draws them unchanged.
//
// The English font has no umlauts. The German ones use the character codes
// 13 to 19: blank glyphs of width 0 in the English font (95:F2D0, widths
// 81:AC0C) that no English text contains. installLanguage writes the seven
// German glyphs there into the game's own copy of the ROM.
import { VmFault, LANGUAGE_BANK } from '../vm/memory.mjs';
import { romOffset, textPointerWord } from './rom-bytes.mjs';
import { FONT } from './font.mjs';
import { TEXT_END } from './texts.mjs';
import { BYTE_SIGN, WORD_BITS, WORD_MASK, HEX_RADIX } from '../constants/bits.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';
import { resolveFrontendTextEdits } from './frontend-text-edits.mjs';
import { resolveMatrixTextEdits } from './matrix-text-edits.mjs';

// Bytes past the last stream that the unpacker's word fetch may read.
const STREAM_READ_AHEAD = 2;
export const LANGUAGE_FORMAT = 'shadowrun-texts-de-v1';
// Text languages: English is the cartridge itself; others come from an asset.
export const ENGLISH = 'en',
  GERMAN = 'de';
export const LANGUAGES = Object.freeze([ENGLISH, GERMAN]);
const LANGUAGE_ASSETS = Object.freeze({ [GERMAN]: 'vm-texts-de.json' });

// Reads the asset of a language (readFile as for loadCartridge,
// src/data/cartridge.mjs); the result goes to buildLanguage.
export async function loadLanguageAsset(readFile, code) {
  const name = LANGUAGE_ASSETS[code];
  if (!name) throw new VmFault('language_required');
  return JSON.parse(new TextDecoder().decode(await readFile(name)));
}
// Glyph widths 81:AC0C (src/data/tables.mjs glyph_widths).
const GLYPH_WIDTHS = 0x81ac0c;
const GLYPH_ROWS = 8;
// Umlauts: the German ROM writes "^" and a letter (escape); code is the free
// English character code that carries the glyph in the port.
export const UMLAUTS = Object.freeze(
  [
    ['ä', 'g', 0x13],
    ['ö', 'f', 0x14],
    ['ü', 'q', 0x15],
    ['ß', 'h', 0x16],
    ['Ä', 'v', 0x17],
    ['Ö', 'w', 0x18],
    ['Ü', 'u', 0x19],
  ].map(([char, escape, code]) => Object.freeze({ char, escape, code })),
);
const CODES = new Map(UMLAUTS.map((u) => [u.char, u.code]));
// Port texts (src/data/port-extension.mjs) in German, following the
// cartridge's wording for the first two bed save labels.
const PORT_TEXTS = new Map([
  [0x0100, 'Spiel 3 sichern'],
  [0x0101, 'Spiel 4 sichern'],
]);

// A text word as FE69 receives it (bit 15 selects bank 9E).
const textWord = (address) => {
  const m = /^(9D|9E):([89A-F][0-9A-F]{3})$/.exec(address ?? '');
  if (!m) throw new VmFault('language_text_address_required');
  return textPointerWord(m[1], m[2]);
};

// Character codes of a text: ASCII and the umlaut codes; never the end
// character or zero, which end the text in the buffer.
export function encodeLanguageText(text) {
  const codes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = CODES.get(text[i]) ?? text.charCodeAt(i);
    if (c === 0 || c === TEXT_END || c >= BYTE_SIGN)
      throw new VmFault('language_character_required');
    codes[i] = c;
  }
  return codes;
}

// The language from the asset: texts by FE69 text word, and the glyphs.
export function buildLanguage(asset) {
  if (
    asset?.format !== LANGUAGE_FORMAT ||
    !Array.isArray(asset.texts) ||
    !Array.isArray(asset.glyphs)
  )
    throw new VmFault('language_format_required');
  const texts = new Map();
  for (const { address, text } of asset.texts)
    texts.set(textWord(address), encodeLanguageText(text));
  for (const [id, text] of PORT_TEXTS) texts.set(id, encodeLanguageText(text));
  const glyphs = UMLAUTS.map(({ char, code }) => {
    const glyph = asset.glyphs.find((g) => g.char === char);
    if (!glyph || !/^[0-9A-F]{16}$/.test(glyph.rows ?? '') || !Number.isInteger(glyph.width))
      throw new VmFault('language_glyph_required');
    const rows = Uint8Array.from({ length: GLYPH_ROWS }, (_, r) =>
      parseInt(glyph.rows.slice(2 * r, 2 * r + 2), HEX_RADIX),
    );
    return { code, width: glyph.width, rows };
  });
  // Notice windows the German version resized: all seven English argument
  // words of the call -> German [height, width].
  const notices = new Map(
    (asset.notices ?? []).map(({ english, german }) => [english.join(','), german]),
  );
  // Menu texts of bank 81 (81:D531): ASCII by English text address, with the
  // tilemap shift of the German position.
  const menus = new Map(
    (asset.menus ?? []).map(({ address, text, shift }) => {
      if (!/^[ -~]+$/.test(text ?? '') || !Number.isInteger(shift))
        throw new VmFault('language_menu_required');
      return [
        labelAddress(address),
        { codes: Uint8Array.from(text, (c) => c.charCodeAt(0)), shift },
      ];
    }),
  );
  // Packed streams by English address, laid out one after the other in the
  // language bank A1:8000.
  const streams = new Map(),
    parts = [];
  let size = 0;
  for (const { english, bytes } of asset.streams ?? []) {
    if (!/^([0-9A-F]{2})+$/.test(bytes ?? '')) throw new VmFault('language_stream_required');
    const data = Uint8Array.from(bytes.match(/../g), (h) => parseInt(h, HEX_RADIX));
    streams.set(labelAddress(english), (LANGUAGE_BANK << WORD_BITS) | (LOROM_OFFSET + size));
    parts.push(data);
    size += data.length;
  }
  // The native unpacker (80:9E65) fetches its bits a word at a time and so
  // reads one byte past the end of a stream; in the ROM that is the next byte,
  // behind the last stream of the bank it needs padding. The decoded output does
  // not use these bits (tools/language.test.mjs decodes each stream exactly).
  if (size + STREAM_READ_AHEAD > LOROM_OFFSET) throw new VmFault('language_bank_full');
  const bank = new Uint8Array(size + STREAM_READ_AHEAD);
  parts.reduce((at, data) => (bank.set(data, at), at + data.length), 0);
  // The arrow before the chosen menu entry (81:E32F) moves with the texts.
  const menuArrowShift = asset.menuArrowShift ?? 0;
  if (!Number.isInteger(menuArrowShift)) throw new VmFault('language_menu_required');
  return Object.freeze({ texts, glyphs, notices, menus, menuArrowShift, streams, bank });
}

// A "BB:AAAA" label as a CPU address.
const labelAddress = (label) => {
  if (!/^[0-9A-F]{2}:[0-9A-F]{4}$/.test(label ?? ''))
    throw new VmFault('language_address_required');
  return parseInt(label.replace(':', ''), HEX_RADIX);
};

// Notice windows (80:FEC1 with the window allocation 80:F963): a window of
// height h and width w in tiles holds h - 2 lines of (w - 2) * 8 pixels; all
// English notice texts fit that rule. The German version widened or heightened
// its windows for the longer texts. A call it resized keeps the German size;
// any other window that its German text does not fit grows wider, then
// higher. F963 keeps the window on screen (x <= 1F - w, y <= 1B - h).
const WINDOW_BORDER = 2,
  TILE_PIXELS = 8,
  MAX_NOTICE_WIDTH = 30,
  MAX_NOTICE_HEIGHT = 26,
  SPACE = 0x20,
  BOLD = 0x7c,
  BOLD_PLACEHOLDER = 0x1a;

// Lines of a text as FB39 wraps it: words between spaces; a word as wide as
// the rest of the line or wider starts a new one (measure compares the word
// width with DP A8, carry on >=); "|" makes the rest of the word
// bold, one pixel wider per character. glyphWidth reads 81:AC0C.
export function wrappedLines(codes, pixels, glyphWidth) {
  let lines = 1,
    x = 0,
    word = 0,
    bold = false;
  const place = () => {
    // FB39 cannot split a word to fit a notice. Counting only its rows would
    // falsely accept e.g. a one-row window narrower than the purchase prompt.
    if (word >= pixels) lines = Infinity;
    const space = x ? glyphWidth(SPACE) : 0;
    if (x && x + space + word >= pixels) {
      lines++;
      x = word;
    } else x += space + word;
    word = 0;
    bold = false;
  };
  for (const c of codes) {
    if (c === SPACE) place();
    else if (c === BOLD) {
      bold = true;
      word += glyphWidth(BOLD_PLACEHOLDER) + 1;
    } else word += glyphWidth(c) + (bold ? 1 : 0);
  }
  place();
  return lines;
}

// The German [height, width] of a notice, or null to keep the English one.
// args: the seven argument words as the script pushed them (text number second).
export function noticeSize(language, args, codes, glyphWidth) {
  const known = language.notices.get(args.join(','));
  if (known) return known;
  const [height, width] = [args[3], args[4]]; // magic-number-ok: argument positions of height and width
  const fits = (h, w) =>
    wrappedLines(codes, (w - WINDOW_BORDER) * TILE_PIXELS, glyphWidth) <= h - WINDOW_BORDER;
  if (fits(height, width)) return null;
  for (let w = width + 1; w <= MAX_NOTICE_WIDTH; w++) if (fits(height, w)) return [height, w];
  const w = Math.max(width, MAX_NOTICE_WIDTH),
    lines = wrappedLines(codes, (w - WINDOW_BORDER) * TILE_PIXELS, glyphWidth);
  return [Math.min(MAX_NOTICE_HEIGHT, lines + WINDOW_BORDER), w];
}

// Switches the text language of a game's memory (null: English). The first
// switch gives the memory its own ROM copy, so other games on the same
// cartridge data keep the English font.
export function installLanguage(memory, language) {
  if (language && !memory.languageRom) {
    memory.rom = memory.rom.slice();
    memory.languageRom = { font: new Map() };
  }
  const saved = memory.languageRom?.font;
  if (saved) {
    const put = (cpu, value) => {
      const o = romOffset(cpu);
      if (!saved.has(o)) saved.set(o, memory.rom[o]);
      memory.rom[o] = value;
    };
    if (language)
      for (const { code, width, rows } of language.glyphs) {
        put(GLYPH_WIDTHS + code, width);
        rows.forEach((v, r) => put(FONT + GLYPH_ROWS * code + r, v));
      }
    else for (const [o, v] of saved) memory.rom[o] = v;
  }
  // Precedence: selected-language edits, selected-language translation,
  // edited English, original Huffman content. Empty strings remain overrides.
  const edits = memory.textEdits;
  if (edits?.en?.size || (language && edits?.de?.size)) {
    memory.language = new Map([
      ...(edits.en ?? []),
      ...(language?.texts ?? []),
      ...(language ? (edits.de ?? []) : []),
    ]);
  } else memory.language = language?.texts ?? null;
  memory.languageData = language ?? null;
  memory.languageBank = language?.bank ?? null;
  memory.frontendTextEdits = resolveFrontendTextEdits(edits?.menus, language);
  memory.matrixTextEdits = resolveMatrixTextEdits(edits?.matrix, language);
}

// The packed stream in the language bank that replaces the English stream at
// cpu (the source of the unpacker 80:9F49), or null.
export const languageStream = (memory, cpu) => memory?.languageData?.streams.get(cpu) ?? null;

// The menu text that replaces the English one at cpu (81:D531), or null.
export const languageMenuText = (memory, cpu) =>
  memory?.frontendTextEdits?.texts.get(cpu) ?? memory?.languageData?.menus.get(cpu) ?? null;

// The character codes that replace the text of FE69's text word, or null.
export const languageText = (memory, id) => memory?.language?.get(id) ?? null;

// Text number table 80:D9B8 (src/data/tables.mjs text_numbers) and glyph
// widths, read from the game memory.
const TEXT_NUMBERS = 0x80d9b8;
// FEC1's seven argument words lie in DP 0C down to 00 (the text number in
// DP 0A, height 06, width 04). In German mode this sets the German window
// size before F963 allocates the window.
export function fitNoticeWindow(memory, dp, dpWrite) {
  const language = memory?.languageData;
  if (!memory?.language) return;
  const args = [0xc, 0xa, 8, 6, 4, 2, 0].map((offset) => dp(offset)); // magic-number-ok: DP offsets of the seven argument words
  const id = memory.read16(TEXT_NUMBERS + 2 * args[1]);
  const codes = languageText(memory, id);
  if (!codes) return;
  // Cartridge-specific German dimensions apply only to the unchanged text.
  const sizing = language?.texts.get(id) === codes ? language : { notices: new Map() };
  const size = noticeSize(sizing, args, codes, (c) => memory.read8(GLYPH_WIDTHS + c));
  if (!size) return;
  dpWrite(6, size[0]); // magic-number-ok: DP of the window height
  dpWrite(4, size[1]); // magic-number-ok: DP of the window width
}

// Width of effective display content, or null to keep FADD's original sum.
// FB39 replaces a bold marker with a styled placeholder, then resets bold
// at a space. Include that placeholder's advance in layout measurements.
export function languageTextWidth(memory, id) {
  const codes = languageText(memory, id);
  if (!codes) return null;
  let width = 0,
    bold = false;
  for (const c of codes) {
    if (c === BOLD) {
      bold = true;
      width += memory.read8(GLYPH_WIDTHS + BOLD_PLACEHOLDER) + 1;
      continue;
    }
    if (c === SPACE) bold = false;
    width += memory.read8(GLYPH_WIDTHS + c) + (bold ? 1 : 0);
  }
  return width;
}

// The unpacker 80:9F49 keeps its source in DP E1 (offset) and E3 (bank); a
// stream with a translation is read from the language bank instead. h: the
// unpacker's task access (dp, dpWrite).
const DP_SOURCE = 0xe1,
  DP_SOURCE_BANK = 0xe3;
// CDB2/C3CA also use these credits sources for Matrix graphics and gauges.
// Only the credits owner's snapshot may select their translated versions.
const SHARED_CREDITS_GRAPHICS = new Set([0x85fc15, 0x85fd38]);
// The stream the unpacker reads for the stream at cpu: its translation, if any
// (also used by the lifted unpacker, src/system/unpack.mjs).
export function languageStreamSource(memory, cpu) {
  if (!memory?.languageData && !memory?.packedTextSnapshot) return cpu;
  const sources = memory?.packedTextSnapshot?.sources;
  if (SHARED_CREDITS_GRAPHICS.has(cpu) && !sources?.has(cpu)) return cpu;
  return sources?.get(cpu) ?? languageStream(memory, cpu) ?? cpu;
}
export function redirectLanguageStream(memory, h) {
  const cpu = h.dp(DP_SOURCE, 2) | (h.dp(DP_SOURCE_BANK, 1) << WORD_BITS),
    target = languageStreamSource(memory, cpu);
  if (target === cpu) return;
  h.dpWrite(DP_SOURCE, target & WORD_MASK, 2);
  h.dpWrite(DP_SOURCE_BANK, target >>> WORD_BITS, 2);
}

// A displayed menu keeps its arrow column across language switches until
// D555 rebuilds its labels. Otherwise navigation could erase a label tile.
export function beginFrontendMenu(memory) {
  if (memory)
    memory.frontendMenuArrowShift =
      memory.frontendTextEdits?.arrowShift ?? memory.languageData?.menuArrowShift ?? 0;
}
// Tilemap shift of the menu arrow (81:E32F), 0 in unedited English.
export const languageMenuArrowShift = (memory) =>
  memory?.frontendMenuArrowShift ??
  memory?.frontendTextEdits?.arrowShift ??
  memory?.languageData?.menuArrowShift ??
  0;
