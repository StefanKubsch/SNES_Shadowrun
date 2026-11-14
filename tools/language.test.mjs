// Text language (src/data/language.mjs, docs/LANGUAGES.md): the German asset
// covers every English text exactly once, its characters fit the free font
// codes, the glyphs go into the game's own ROM copy only, and a live game
// decodes the German texts while the game data stays English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import {
  buildLanguage,
  encodeLanguageText,
  installLanguage,
  wrappedLines,
  noticeSize,
  languageTextWidth,
  redirectLanguageStream,
  UMLAUTS,
  ENGLISH,
  GERMAN,
} from '../src/data/language.mjs';
import { parseRecording } from '../src/browser/recording.mjs';
import { VmMemory, LANGUAGE_BANK } from '../src/vm/memory.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { FONT } from '../src/data/font.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  CREDITS_EDIT,
} from '../src/data/packed-text-edits.mjs';

const english = JSON.parse(readFileSync('assets/vm-texts.json', 'utf8')).texts;
const asset = JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8'));
const german = buildLanguage(asset);
const GLYPH_WIDTHS = 0x81ac0c;
const TEXT_BUFFER = 0x21a0;
const INTRO_TEXT = 0x62a8,
  INTRO_NMI = 900,
  MENU_TILEMAP = 0x86a9,
  MENU_NMI = 3250;

test('every English text has one German text or is listed as untranslated', () => {
  const addresses = english.map((t) => t.address);
  const covered = [...asset.texts.map((t) => t.address), ...asset.untranslated];
  assert.deepEqual([...covered].sort(), [...addresses].sort());
  assert.equal(new Set(covered).size, covered.length);
  assert.ok(asset.texts.length >= 1590, 'nearly all texts are paired');
  for (const { text } of asset.texts) assert.doesNotThrow(() => encodeLanguageText(text), text);
  // Umlauts come only through their codes; no "^" escapes are left.
  assert.ok(!asset.texts.some((t) => t.text.includes('^')));
  assert.ok(asset.texts.some((t) => t.text.includes('ü')));
  assert.match(asset.texts.find((t) => t.address === '9D:C4FB').text, /\|Werkstattgelände/);
  assert.ok(!asset.texts.some((t) => t.text.includes('Werstattgelände')));
});

test('the umlaut codes are free in the English font and texts', () => {
  const codes = new Set(UMLAUTS.map((u) => u.code));
  for (const { text } of english)
    for (const c of text) assert.ok(!codes.has(c.charCodeAt(0)), `English text uses ${c}`);
  for (const code of codes) {
    assert.equal(cartridge.rom[romOffset(GLYPH_WIDTHS + code)], 0, 'width 0');
    for (let r = 0; r < 8; r++) assert.equal(cartridge.rom[romOffset(FONT + 8 * code + r)], 0);
  }
  assert.equal(german.glyphs.length, UMLAUTS.length);
  for (const g of german.glyphs) assert.ok(g.width > 0 && g.rows.some((v) => v));
});

test('the glyphs go into the game memory only and English restores the font', () => {
  const rom = cartridge.rom.slice(),
    memory = new VmMemory(rom, undefined, null, cartridge.present);
  installLanguage(memory, german);
  assert.notEqual(memory.rom, rom, 'own ROM copy');
  assert.deepEqual(rom, cartridge.rom, 'the shared data stay English');
  const glyph = german.glyphs[0];
  assert.equal(memory.rom[romOffset(GLYPH_WIDTHS + glyph.code)], glyph.width);
  installLanguage(memory, null);
  assert.equal(memory.language, null);
  assert.deepEqual(memory.rom, cartridge.rom);
});

// The intro (new game from the title) shows three texts in the morgue from
// about NMI 3400; the German run decodes the German ones into 7E:21A0.
const START = 0x1000;
const TITLE = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604) ? START : 0;
function intro(language) {
  const game = new LiveGame(cartridge, { pad: TITLE, languages: { [GERMAN]: german }, language });
  // Record the text ids that FE69 asks for (languageText reads memory.language).
  const ids = [];
  if (language === GERMAN) {
    const get = german.texts.get.bind(german.texts);
    game.memory.language = { get: (id) => (ids.push(id), get(id)) };
  }
  // Snapshots: the intro text screen (7E:62A8, unpacked by 81:DDFB) and the
  // main menu tilemap (7E:86A9, drawn by 81:D531).
  const wram = game.memory.wram,
    snapshots = {};
  while (game.nmis < 3800) {
    game.step();
    if (!snapshots.intro && game.nmis >= INTRO_NMI)
      snapshots.intro = wram.slice(INTRO_TEXT, INTRO_TEXT + 64);
    if (!snapshots.menu && game.nmis >= MENU_NMI)
      snapshots.menu = wram.slice(0, MENU_TILEMAP + 0x800);
  }
  return { game, ids, snapshots };
}
// Characters of a menu row: the tile of character c is the word at
// 7E:46A8 + 2 (c - 20); palette and priority bits are masked.
const MENU_TILE = 0x3ff;
function menuRow(wram, x, length) {
  const word = (a, at) => a[at] | (a[at + 1] << 8),
    chars = new Map();
  for (let c = 0x5f; c >= 0x20; c--) chars.set(word(wram, 0x46a8 + 2 * (c - 0x20)) & MENU_TILE, c);
  return Array.from({ length }, (_, i) =>
    String.fromCharCode(chars.get(word(wram, MENU_TILEMAP + x + 2 * i) & MENU_TILE) ?? 0x3f),
  ).join('');
}

test('the intro text, main menu and arrow are German', { timeout: 120000 }, () => {
  const de = intro(GERMAN),
    en = intro(ENGLISH);
  const text = (s) => Buffer.from(s.intro).toString('latin1');
  assert.ok(text(de.snapshots).startsWith(' \x00Es ist das Jahr 2050'));
  assert.ok(text(en.snapshots).startsWith(' \x00THE YEAR IS 2050'));
  // English "START NEW GAME" at 0414; German "NEUES SPIEL STARTEN" 10 bytes left.
  assert.equal(menuRow(en.snapshots.menu, 0x414, 14), 'START NEW GAME');
  assert.equal(menuRow(de.snapshots.menu, 0x40a, 19), 'NEUES SPIEL STARTEN');
  assert.equal(menuRow(de.snapshots.menu, 0x48a, 25), 'GESICHERTES SPIEL STARTEN');
  // The arrow "#" (81:E32F) before the chosen entry: English 0410, German 0406.
  assert.equal(menuRow(en.snapshots.menu, 0x410, 1), '#');
  assert.equal(menuRow(de.snapshots.menu, 0x406, 1), '#');
});

// The credits (81:F2BD) come from the language bank A1 in German mode;
// The intro, licence screen and owned credits streams come from language
// bank A1 in German mode. The shared credits font and map stay original
// outside the credits snapshot, including Matrix gauge setup. Each German
// stream unpacks; the intro text has
// its fixed a umlaut ("$" instead of 84), the credits are German.
test('the German streams are read from the language bank', () => {
  const memory = new VmMemory(cartridge.rom.slice(), undefined, null, cartridge.present);
  installLanguage(memory, german);
  const bitsFor = lzBits((i) => memory.read8(0x80a033 + i)),
    read8 = (cpu) => memory.read8(cpu);
  const unpack = (english, expectedBank = LANGUAGE_BANK) => {
    const dp = new Map([
      [0xe1, english & 0xffff],
      [0xe3, english >>> 16],
    ]);
    redirectLanguageStream(memory, { dp: (o) => dp.get(o), dpWrite: (o, v) => dp.set(o, v) });
    const source = (dp.get(0xe3) << 16) | dp.get(0xe1);
    assert.equal(source >>> 16, expectedBank, english.toString(16));
    const length = read8(source) | (read8(source + 1) << 8);
    return Buffer.from(
      lzDecode((n) => read8(source + 2 + n), length, bitsFor).data.slice(0, length),
    );
  };
  assert.equal(asset.streams.length, 7);
  for (const cpu of [0x85fc15, 0x85fd38]) {
    const original = lzDecode((n) => read8(cpu + 2 + n), memory.read16(cpu), bitsFor).data;
    assert.deepEqual(
      unpack(cpu, 0x85),
      Buffer.from(original),
      'unowned shared graphics stay original',
    );
  }
  const snapshot = beginPackedTextEdit(memory, CREDITS_EDIT);
  for (const { english } of asset.streams) unpack(parseInt(english.replace(':', ''), 16));
  const intro = unpack(0x81f5ce).toString('latin1');
  assert.match(intro, /m\$chtig/);
  assert.ok(!intro.includes('\x84'));
  assert.match(unpack(0x81f2bd).toString('latin1'), /SYSTEMPROGRAMMIERUNG/);
  endPackedTextEdit(memory, snapshot);
  for (const cpu of [0x85fc15, 0x85fd38]) unpack(cpu, 0x85);
  installLanguage(memory, null);
  assert.equal(memory.languageBank, null);
});

test(
  'a live game decodes the German texts and keeps English game data',
  { timeout: 120000 },
  () => {
    const de = intro(GERMAN),
      en = intro(ENGLISH);
    assert.ok(de.ids.length >= 3, 'the intro texts went through FE69');
    const last = german.texts.get(de.ids.at(-1));
    const buffer = de.game.memory.wram.subarray(TEXT_BUFFER, TEXT_BUFFER + last.length + 1);
    assert.deepEqual([...buffer], [...last, 0], 'German text in the buffer');
    const englishText = english.find(
      (t) => t.address === `9D:${(de.ids.at(-1) | 0x8000).toString(16).toUpperCase()}`,
    ).text;
    const englishBuffer = en.game.memory.wram.subarray(
      TEXT_BUFFER,
      TEXT_BUFFER + englishText.length,
    );
    assert.equal(
      Buffer.from(englishBuffer).toString('latin1'),
      englishText,
      'English run unchanged',
    );
    assert.deepEqual(en.game.memory.rom, cartridge.rom);
  },
);

test('recordings keep the text language and its switches', () => {
  const base = { format: 'shadowrun-recording-1', seed: 1, inputs: [], checks: [] };
  assert.equal(parseRecording(JSON.stringify(base)).language, ENGLISH);
  const r = parseRecording(
    JSON.stringify({ ...base, language: GERMAN, events: [[5, 'language-en']] }),
  );
  assert.equal(r.language, GERMAN);
  assert.throws(() => parseRecording(JSON.stringify({ ...base, language: 'xx' })));
  assert.throws(() => new LiveGame(cartridge, { language: GERMAN }), /language_data_required/);
});

// Notice windows (80:FEC1): h - 2 lines of (w - 2) * 8 pixels, a word as wide
// as the rest of the line wraps. "Oh, Uuuhh, mein Kopf." (text number 64,
// 112 pixels) does not fit Jake's English window of width 15 (104 pixels) nor
// 16 (exactly 112); the German original shows it on one line in a wider window.
test('a notice window grows for its German text', () => {
  const widths = (c) =>
    cartridge.rom[romOffset(GLYPH_WIDTHS + c)] || german.glyphs.find((g) => g.code === c)?.width;
  const codes = encodeLanguageText('Oh, Uuuhh, mein Kopf.');
  assert.equal(wrappedLines(codes, 112, widths), 2);
  assert.equal(wrappedLines(codes, 120, widths), 1);
  assert.deepEqual(noticeSize(german, [240, 64, 2048, 3, 15, 17, 2], codes, widths), [3, 17]);
  // A size the German version chose for a call wins.
  const [known] = asset.notices;
  assert.deepEqual(noticeSize(german, known.english, codes, widths), known.german);
  // A text that fits keeps the English size.
  assert.equal(noticeSize(german, [240, 64, 2048, 3, 28, 17, 2], codes, widths), null);
});

test('the purchase prompt fits as a complete word before window allocation', () => {
  const widths = (c) => cartridge.rom[romOffset(GLYPH_WIDTHS + c)];
  const codes = german.texts.get(0x75fe);
  // Script 28D (653), PC 216..229: lifetime 1, text 21, style 0,
  // height 3, width 6, y 5, x 21. CD43 opens Yes/No afterwards.
  const args = [1, 21, 0, 3, 6, 5, 21];
  assert.equal(wrappedLines(codes, 32, widths), Infinity, 'one oversized word cannot fit');
  const [rows, columns] = noticeSize(german, args, codes, widths);
  assert.equal(rows, 3, 'keep a single text row');
  assert.ok(columns > 6, 'grow the purchase prompt before F963');
  assert.equal(wrappedLines(codes, (columns - 2) * 8, widths), 1);
  assert.ok(codes.reduce((sum, code) => sum + widths(code), 0) < (columns - 2) * 8);
});

// 80:FADD sizes the name window under the glove from the name's pixel width;
// the German name must be measured, or FB39 draws past the window.
test('the glove name window is measured on the German name', () => {
  const rom = cartridge.rom.slice(),
    memory = new VmMemory(rom, undefined, null, cartridge.present);
  const id = [...german.texts.keys()].find((k) => german.texts.get(k).includes(0x15)); // a text with an encoded umlaut
  assert.equal(languageTextWidth(memory, id), null, 'English: FADD keeps its own width');
  installLanguage(memory, german);
  const codes = german.texts.get(id);
  const expected = [...codes].reduce((s, c) => s + memory.read8(GLYPH_WIDTHS + c), 0);
  assert.equal(languageTextWidth(memory, id), expected);
  assert.ok(expected > 0);
});
