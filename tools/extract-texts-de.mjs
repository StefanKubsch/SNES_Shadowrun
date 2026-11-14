// German texts as an alternative language (docs/LANGUAGES.md): the Huffman
// texts of the German ROM "Shadowrun (G).sfc", each paired with the English
// text it replaces, to assets/vm-texts-de.json (src/data/language.mjs).
//
// The German ROM is a rebuilt version: code, scripts, tables and texts lie at
// other addresses and the German text numbers are renumbered. The game keeps
// running on the English data; only the decoded text changes. Every pair
// therefore comes from a structure that exists in both ROMs and names a text
// in both, read at the same place of that structure:
// - the topic table 8D:8000 (same address in both ROMs),
// - the dialog records 8D:80C0 (German dialog table found through the code
//   that reads it; records matched by their entry keys and topic numbers),
// - the text number table (English 80:D9B8, 611 entries; German 599): the
//   numbers are paired through the script arguments of the notice native 200
//   (80:FEC1, second argument) and the selection native 154 (80:933A), compared
//   instruction by instruction in the 919 scripts whose opcode sequence is the
//   same in both ROMs; numbers between two paired numbers follow when the gap
//   has the same size in both lists, the rest of a gap by text content,
// - the kind table (English 8C:EFB0, German 8C:F0E8; value and flag words
//   checked equal), the runner names 80:9782 and the 13 text menus and name
//   lists of bank 80 (src/data/tables.mjs), each found in the German ROM by
//   its surrounding bytes and checked to hold text starts only,
// - texts that the code loads as an immediate operand, found through the same
//   instruction context,
// - finally the text order: a text between two paired texts follows when the
//   gap has the same size in both ROMs.
// The German FE69 (80:FDD4) stores each character through 80:FE2A, which
// turns "^" and a letter into one character code, letter + 1F; the German
// font 8C:F8EA holds the umlaut glyphs there (widths 81:AC0C). The asset
// stores umlauts as Unicode and keeps the seven glyphs.
import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { europeanTables } from './scripts.mjs';
import { readTextTree, readText, TEXT_TREE } from '../src/data/texts.mjs';
import { readDialogs } from '../src/data/dialogs.mjs';
import { readTopics } from '../src/data/topics.mjs';
import { DIALOG_TABLE, DIALOGS } from '../src/data/portraits.mjs';
import { KIND_TABLE, KINDS } from '../src/data/kinds.mjs';
import { LOOKUP_TABLES } from '../src/data/tables.mjs';
import { decodeScript } from '../src/script/codec.mjs';
import { lzBits, lzDecode, lzEncode } from '../src/data/lz.mjs';
import { UMLAUTS, LANGUAGE_FORMAT } from '../src/data/language.mjs';
import { LOROM_OFFSET, LOROM_OFFSET_MASK } from '../src/constants/memory-map.mjs';
import { ROM_SIZE } from '../src/vm/memory.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../src/constants/bits.mjs';

const EN_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  DE_SHA256 = 'fda5d1cc6e5202ee311e4777eaa8614ed7361a8f77661aad52c7a1a8cf86a17f';
const EN_ROM_ARGUMENT = 2,
  DE_ROM_ARGUMENT = 3;
const HEX_RADIX = 16;
const CREDIT_GROUP_COUNT_MAX = 0x0f;
const MENU_FONT_SYMBOLS = new Set(['\x1e', '\x1f', '\x7f']);
// Text banks (src/data/texts.mjs): bit 15 of a text word selects 9E.
const BANK_9D = 0x9d0000,
  BANK_9E = 0x9e0000,
  BANK_9E_END = 0x9f0000,
  TREE_NODE_BYTES = 4;
// A text longer than this ends the German chain (the longest has 294 characters).
const LONGEST_TEXT = 600;
// Text number table 80:D9B8 (src/data/tables.mjs text_numbers).
const EN_NUMBERS = 0x80d9b8,
  EN_NUMBER_COUNT = 611,
  EN_NUMBERS_OPERAND = EN_NUMBERS & WORD_MASK;
// German kind table, found by its value and flag words (checked below).
const DE_KIND_TABLE = 0x8cf0e8,
  KIND_BYTES = 6,
  KIND_VALUE = 2,
  KIND_FLAGS = 4,
  KIND_WITHOUT_NAME = 0xffff;
// Runner names 80:9782 (src/data/runners.mjs), one word per member.
const RUNNER_NAMES = 0x809782,
  RUNNERS = 13;
// German font and widths of the umlaut glyphs (escape letter + 1F).
const DE_FONT = 0x8cf8ea,
  DE_WIDTHS = 0x81ac0c,
  UMLAUT_GLYPH_OFFSET = 0x1f,
  GLYPH_ROWS = 8;
// 65816 opcodes that read a table at an absolute address with an index or
// load an immediate word.
const OP_LDA_ABS_X = 0xbd,
  OP_LDA_ABS_Y = 0xb9,
  OP_LDA_LONG_X = 0xbf,
  OP_LDA_IMMEDIATE = 0xa9,
  OP_LDX_IMMEDIATE = 0xa2,
  OP_LDY_IMMEDIATE = 0xa0,
  OP_PEA = 0xf4;
// 80:9178 reads the dialog table with REP #$20, LDA $02, ASL, TAY, LDA abs,Y.
const DIALOG_TABLE_READER = 'c220a5020aa8b9',
  DIALOG_TABLE_OPERAND = 7;
// Instruction context around an operand: bytes before the opcode and after.
const CONTEXT_BEFORE = 6,
  CONTEXT_AFTER = 3,
  IMMEDIATE_CONTEXTS = [
    [6, 3], // magic-number-ok: context lengths, tried in order until one is unique
    [4, 3], // magic-number-ok: context lengths
    [8, 2], // magic-number-ok: context lengths
  ];
// An instruction with a word operand: opcode and two operand bytes.
const INSTRUCTION_BYTES = 3;
const CODE_BANKS_END = 0x10000; // ROM offset after banks 80 and 81
// Menu texts: bank 81, printable ASCII, the LDX # of a call within 24 bytes
// before its LDY # (the alternatives of an option share one LDX).
const MENU_BANK = 0x810000,
  BANK_81 = 0x8000, // ROM offset of bank 81
  MENU_X_REACH = 24,
  MENU_TEXT_MIN = 4,
  // LDA $0E, XBA, LSR, ADC #, then PHX (the row highlight 81:E371 has TAX).
  ARROW_CODE = 'a50eeb4a69',
  ARROW_OPERAND = 5,
  ARROW_PHX = 7,
  OP_PHX = 0xda,
  ASCII_SPACE = 0x20,
  ASCII_END = 0x7f;
// Packed streams: English address, German address, check of the German output.
const LZ_BIT_TABLE = 0x80a033,
  DE_LZ_BIT_TABLE = 0x80a03f,
  LZ_TABLE_BYTES = 256,
  FONT_TILE_BYTES = 16; // a 2-bit-per-pixel tile of 8 x 8 pixels
const INTRO_TEXT = 0x81f5ce,
  CP437_A_UMLAUT = 0x84,
  MAP_A_UMLAUT = 0x24, // "$": tile 4 of the German intro map, the a umlaut
  TEMP_BASE = 0x7e0000; // any base for reading a buffer through unpack
const LANGUAGE_STREAMS = [
  [0x81f5ce, 0x81f680, 'text'], // intro text (81:DDFB)
  [0x81f803, 0x81f897, 'length'], // its character map, 128 words
  [0x81f8b8, 0x81f94f, 'font'], // its font, VRAM 2000 (two more tiles, the umlauts)
  [0x81fb0a, 0x81fbad, 'length'], // licence screen tilemap, VRAM 0800 (boot list 8A:8000, German 89:DB2C)
  [0x81f2bd, 0x81f361, 'text'], // credits (81:CE64)
  [0x85fd38, 0x85fd42, 'length'], // their character map, 160 words
  [0x85fc15, 0x85fc15, 'font'], // their font, VRAM 1000
];
// Surrounding bytes compared on each side when locating a table.
const LOCATE_PAD = 48;
// Script opcodes (docs/SCRIPT-LANGUAGE.md): pushes of a byte, signed byte or
// word, and the native call with its 8-bit native number.
const SCRIPT_PUSHES = new Set([0x00, 0x0a, 0x14]),
  SCRIPT_CALL_NATIVE = 0x58;
// Natives that take a text or dialog number, and which argument word it is.
const NUMBER_ARGUMENTS = new Map([
  [200, { kind: 'text', index: 1 }], // magic-number-ok: native 200 = 80:FEC1 notice, DP0A is its second of seven words
  [154, { kind: 'text', index: 0 }], // magic-number-ok: native 154 = 80:933A selection
  [149, { kind: 'dialog', index: 0 }], // magic-number-ok: native 149 = 80:936C dialog
]);
// Notice native 200 (80:FEC1): seven argument words; the third and fourth
// after the text number are the window height and width (DP 06 and 04).
const NOTICE_NATIVE = 200,
  NOTICE_ARGUMENTS = 7,
  NOTICE_SIZE_ARGUMENTS = [3, 4]; // magic-number-ok: argument positions of height and width
const SCRIPT_HEADER_BYTES = 2,
  GERMAN_SCRIPT_SLACK = 0x400, // bytes a German script may have beyond the English length
  SAME_SCRIPTS_REQUIRED = 900;
// Content similarity weights (only for the few choices that structures leave open).
const SIMILAR = Object.freeze({
  digits: 4,
  name: 2,
  question: 2,
  capitals: 1.5,
  ratioWeight: 3,
  germanLength: 1.25, // typical German length relative to English
  dialogOffset: 20, // a dialog number offset shared with the nearest paired dialog
});

const en = inspectRom(await readFile(process.argv[EN_ROM_ARGUMENT] ?? 'Shadowrun (E).smc')),
  de = inspectRom(await readFile(process.argv[DE_ROM_ARGUMENT] ?? 'Shadowrun (G).sfc'));
if (en.metadata.rom_sha256 !== EN_SHA256)
  throw new Error('ROM differs from the researched European revision');
if (de.metadata.rom_sha256 !== DE_SHA256)
  throw new Error('ROM differs from the researched German revision');
const E = en.bytes,
  G = de.bytes;
const offset = (cpu) => cpuToOffset(cpu, ROM_SIZE);
const reader = (bytes) => (cpu) => bytes[offset(cpu)];
const e8 = reader(E),
  g8 = reader(G);
const e16 = (cpu) => e8(cpu) | (e8(cpu + 1) << BYTE_BITS),
  g16 = (cpu) => g8(cpu) | (g8(cpu + 1) << BYTE_BITS);
const wordOf = (cpu) => (cpu >= BANK_9E ? cpu & WORD_MASK : cpu & WORD_MASK & ~WORD_SIGN);
const cpuOf = (word) => (word & WORD_SIGN ? BANK_9E : BANK_9D) | word | WORD_SIGN;
const labelWord = (label) => wordOf(parseInt(label.replace(':', ''), HEX_RADIX));
const hexWord = (word) => word.toString(HEX_RADIX);

// ---- Texts of both ROMs ----------------------------------------------------
const enAsset = JSON.parse(await readFile('assets/vm-texts.json', 'utf8'));
if (enAsset.source_rom_sha256 !== EN_SHA256) throw new Error('vm-texts.json is from another ROM');
const enTexts = enAsset.texts.map((t, index) => ({ ...t, word: labelWord(t.address), index }));
const enByWord = new Map(enTexts.map((t) => [t.word, t]));

// German chain: texts follow without gaps from the end of the tree in 9D
// and from 9E:8000. A bank ends where the next text would leave it or at the
// first text with a character outside the text set (followed by other data).
const deTree = readTextTree(g16);
const TEXT_CHARACTER_RANGES = [
  [0x01, 0x08],
  [0x0e, 0x11],
  [0x1e, 0x7f],
];
const textCharacters = (text) =>
  [...text].every((c) =>
    TEXT_CHARACTER_RANGES.some(
      ([first, last]) => c.charCodeAt(0) >= first && c.charCodeAt(0) <= last,
    ),
  );
const deTexts = [];
for (const [first, end] of [
  [TEXT_TREE + TREE_NODE_BYTES * deTree.length, BANK_9E],
  [BANK_9E | LOROM_OFFSET, BANK_9E_END],
]) {
  const inBank = (cpu) => {
    if (cpu >= end) throw new Error('bank end');
    return g8(cpu);
  };
  for (let cpu = first; cpu < end;) {
    let decoded;
    try {
      decoded = readText(inBank, deTree, cpu);
    } catch {
      break;
    }
    if (!textCharacters(decoded.text) || decoded.text.length > LONGEST_TEXT) break;
    deTexts.push({ cpu, text: decoded.text });
    cpu += decoded.length;
  }
}
deTexts.forEach((t, index) => Object.assign(t, { word: wordOf(t.cpu), index }));
const deByWord = new Map(deTexts.map((t) => [t.word, t]));

// ---- Pairs -----------------------------------------------------------------
const pairs = new Map(), // English word -> {de: German word, source}
  conflicts = [],
  sources = new Map(),
  review = [];
function pair(enWord, deWord, source) {
  if (!enByWord.has(enWord) || !deByWord.has(deWord))
    throw new Error(`${source}: no text start (${hexWord(enWord)}, ${hexWord(deWord)})`);
  const old = pairs.get(enWord);
  if (old && old.de !== deWord) {
    conflicts.push({ english: enWord, kept: old, other: { de: deWord, source } });
    return;
  }
  if (!old) {
    pairs.set(enWord, { de: deWord, source });
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }
}

// Content similarity of an English and a German text: numbers, names,
// questions, capitals and the length ratio.
function similarity(a, b) {
  let s = 0;
  const digits = (t) => (t.match(/\d/g) ?? []).join('');
  if (digits(a) || digits(b)) s += digits(a) === digits(b) ? SIMILAR.digits : -SIMILAR.digits;
  if (a.endsWith('?') !== b.endsWith('?')) s -= SIMILAR.question;
  if (/[A-Z]{3}/.test(a) && a === a.toUpperCase())
    s += b === b.toUpperCase() ? SIMILAR.capitals : -SIMILAR.capitals;
  for (const name of new Set(a.match(/[A-Z][A-Za-z]{3,}/g) ?? []))
    if (b.includes(name)) s += SIMILAR.name;
  const ratio = b.length / Math.max(1, a.length);
  s -= SIMILAR.ratioWeight * Math.abs(Math.log(ratio / SIMILAR.germanLength));
  return s;
}

// Locate an English structure of the code banks in the German ROM: the German
// position whose surroundings (LOCATE_PAD bytes on each side, structure
// masked) agree best; the caller checks the result.
function locate(cpu, length) {
  const eo = offset(cpu),
    bankStart = eo - (eo & LOROM_OFFSET_MASK);
  let best = -1,
    bestScore = -1;
  for (let p = bankStart + LOCATE_PAD; p < bankStart + LOROM_OFFSET - length - LOCATE_PAD; p++) {
    let score = 0;
    for (let k = -LOCATE_PAD; k < length + LOCATE_PAD; k++)
      if ((k < 0 || k >= length) && E[eo + k] === G[p + k]) score++;
    if (score > bestScore) [best, bestScore] = [p, score];
  }
  return (cpu & ~WORD_MASK) | LOROM_OFFSET | (best & LOROM_OFFSET_MASK);
}

// German operands of the code-bank instructions whose English operand is
// `operand` (opcodes from `opcodes`), found by their unique context.
function germanOperands(operand, opcodes, contexts) {
  const found = new Set();
  for (let i = CONTEXT_BEFORE; i + 2 < CODE_BANKS_END; i++) {
    if (!opcodes.has(E[i]) || E.readUInt16LE(i + 1) !== operand) continue;
    for (const [before, after] of contexts) {
      const pre = E.subarray(i - before, i + 1),
        post = E.subarray(i + INSTRUCTION_BYTES, i + INSTRUCTION_BYTES + after),
        hits = new Set();
      for (let j = G.indexOf(pre); j >= 0 && j < CODE_BANKS_END; j = G.indexOf(pre, j + 1))
        if (
          !Buffer.compare(
            G.subarray(j + before + INSTRUCTION_BYTES, j + before + INSTRUCTION_BYTES + after),
            post,
          )
        )
          hits.add(G.readUInt16LE(j + before + 1));
      if (hits.size === 1) {
        found.add([...hits][0]);
        break;
      }
    }
  }
  return [...found];
}

// Script arguments: text and dialog numbers that the same native call
// receives at the same instruction of the same script in both ROMs.
const scriptNumbers = { text: new Map(), dialog: new Map(), same: 0 };
// Notice windows the German version resized for its text: by English text
// number and English size, the German size (height, width).
const noticeSizes = new Map();
{
  const scripts = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
  if (scripts.source_rom_sha256 !== EN_SHA256) throw new Error('scripts.json is from another ROM');
  const t = europeanTables; // the German ROM reads the same table addresses (bank 82)
  const start = (bytes, id) =>
    offset(
      (bytes[t.scriptBanks + id] << WORD_BITS) | bytes.readUInt16LE(t.scriptPointers + 2 * id),
    ) + SCRIPT_HEADER_BYTES;
  const decode = (bytes, id, length) => {
    const o = start(bytes, id),
      end = Math.min(o - (o & LOROM_OFFSET_MASK) + LOROM_OFFSET, o + length);
    return [...decodeScript(new Uint8Array(bytes.subarray(o, end))).instructions.values()].sort(
      (p, q) => p.pc - q.pc,
    );
  };
  for (const s of scripts.scripts) {
    let a, b;
    try {
      a = decode(E, s.id, s.bytecode.length);
      b = decode(G, s.id, s.bytecode.length + GERMAN_SCRIPT_SLACK);
    } catch {
      continue;
    }
    if (a.length !== b.length || a.some((x, k) => x.opcode !== b[k].opcode)) continue;
    scriptNumbers.same++;
    for (let k = 0; k < a.length; k++) {
      const native = a[k].operand,
        argument = NUMBER_ARGUMENTS.get(native);
      if (a[k].opcode !== SCRIPT_CALL_NATIVE || !argument || b[k].operand !== native) continue;
      const at = k - scripts.nativeFunctions[native].argumentWords + argument.index;
      if (at < 0 || !SCRIPT_PUSHES.has(a[at].opcode)) continue;
      const map = scriptNumbers[argument.kind],
        x = a[at].operand,
        y = b[at].operand;
      if (map.has(x) && map.get(x) !== y)
        throw new Error(`${argument.kind} number ${x} paired twice`);
      map.set(x, y);
      if (native !== NOTICE_NATIVE) continue;
      // Notice window: all seven English words of the call identify it; the
      // German version changed only height and width.
      const words = (list) =>
        list
          .slice(k - NOTICE_ARGUMENTS, k)
          .map((i) => (SCRIPT_PUSHES.has(i.opcode) ? i.operand : null));
      const en = words(a),
        de = words(b),
        german = NOTICE_SIZE_ARGUMENTS.map((i) => de[i]);
      if (en.includes(null) || german.includes(null)) continue;
      if (NOTICE_SIZE_ARGUMENTS.every((i) => en[i] === de[i])) continue;
      const key = en.join(','),
        old = noticeSizes.get(key);
      if (old && old.german.join() !== german.join()) throw new Error(`notice ${key} sized twice`);
      noticeSizes.set(key, { english: en, german });
    }
  }
  if (scriptNumbers.same < SAME_SCRIPTS_REQUIRED)
    throw new Error(`only ${scriptNumbers.same} scripts with the same opcodes`);
}

// Topics: same table address in both ROMs.
{
  const a = readTopics(e8),
    b = readTopics(g8);
  a.forEach((t, i) => pair(labelWord(t), labelWord(b[i]), 'topics'));
}

// Dialogs: the German dialog table is the operand of the same reader.
{
  const signature = Buffer.from(DIALOG_TABLE_READER, 'hex');
  const eAt = E.indexOf(signature),
    gAt = G.indexOf(signature);
  if (
    E.readUInt16LE(eAt + DIALOG_TABLE_OPERAND) !== (DIALOG_TABLE & WORD_MASK) ||
    gAt < 0 ||
    gAt >= LOROM_OFFSET
  )
    throw new Error('dialog table reader not found');
  const deTable = (DIALOG_TABLE & ~WORD_MASK) | G.readUInt16LE(gAt + DIALOG_TABLE_OPERAND);
  const deRead8 = (cpu) =>
    cpu >= DIALOG_TABLE && cpu < DIALOG_TABLE + 2 * DIALOGS
      ? g8(cpu - DIALOG_TABLE + deTable)
      : g8(cpu);
  const a = readDialogs(e8),
    b = readDialogs(deRead8);
  const shape = (d) =>
    d.entries
      .map((x) => `${x.key}:${x.topics.join('/')}${x.script === undefined ? '' : 's'}`)
      .join(',');
  const text = (label, list) => list.get(labelWord(label)).text;
  const score = (x, y) =>
    x.entries.reduce(
      (s, entry, k) =>
        s + similarity(text(entry.text, enByWord), text(y.entries[k].text, deByWord)),
      0,
    );
  // Dialog numbers paired through the scripts decide; other dialogs prefer
  // the number offset of the nearest paired dialog (the German numbering
  // moves whole blocks), then the content.
  const anchors = [...scriptNumbers.dialog].sort((p, q) => p[0] - q[0]);
  const nearOffsets = (n) => {
    const below = anchors.filter(([x]) => x < n).at(-1),
      above = anchors.find(([x]) => x > n);
    return [below, above].filter(Boolean).map(([x, y]) => y - x);
  };
  const choices = [];
  for (const x of a)
    for (const y of b) {
      if (shape(x) !== shape(y)) continue;
      const anchored = scriptNumbers.dialog.get(x.dialog);
      if (anchored !== undefined && anchored !== y.dialog) continue;
      const s =
        anchored !== undefined
          ? Infinity
          : score(x, y) +
            (nearOffsets(x.dialog).includes(y.dialog - x.dialog) ? SIMILAR.dialogOffset : 0);
      choices.push({ x, y, s });
    }
  choices.sort((p, q) => q.s - p.s);
  const usedA = new Set(),
    usedB = new Set();
  for (const { x, y } of choices) {
    if (usedA.has(x) || usedB.has(y)) continue;
    usedA.add(x);
    usedB.add(y);
    if (
      x.entries.length &&
      choices.filter((c) => c.x === x).length > 1 &&
      !scriptNumbers.dialog.has(x.dialog)
    )
      review.push(
        `  dialog ${x.dialog} -> ${y.dialog}: "${text(x.entries[0].text, enByWord)}" -> ` +
          `"${text(y.entries[0].text, deByWord)}"`,
      );
    x.entries.forEach((entry, k) =>
      pair(labelWord(entry.text), labelWord(y.entries[k].text), 'dialogs'),
    );
  }
  if (usedA.size !== a.length) throw new Error(`only ${usedA.size} of ${a.length} dialogs matched`);
}

// Text numbers through the script arguments.
let deNumbers, deNumberCount, numberSummary;
{
  const tables = germanOperands(
    EN_NUMBERS_OPERAND,
    new Set([OP_LDA_ABS_X, OP_LDA_ABS_Y, OP_LDA_LONG_X]),
    [[CONTEXT_BEFORE, CONTEXT_AFTER]],
  );
  if (tables.length !== 1) throw new Error('German text number table not unique');
  deNumbers = (EN_NUMBERS & ~WORD_MASK) | tables[0];
  for (deNumberCount = 0; deByWord.has(g16(deNumbers + 2 * deNumberCount)); deNumberCount++);

  const numberMap = new Map(scriptNumbers.text); // English number -> German number
  for (const [x, y] of numberMap)
    if (x >= EN_NUMBER_COUNT || y >= deNumberCount)
      throw new Error(`text number ${x} out of range`);
  const anchored = numberMap.size;
  // Fill the gaps between paired numbers.
  const anchors = [
    [-1, -1],
    ...[...numberMap].sort((p, q) => p[0] - q[0]),
    [EN_NUMBER_COUNT, deNumberCount],
  ];
  const enNumberText = (n) => enByWord.get(e16(EN_NUMBERS + 2 * n)).text,
    deNumberText = (n) => deByWord.get(g16(deNumbers + 2 * n)).text;
  let dropped = 0;
  for (let i = 1; i < anchors.length; i++) {
    const [a0, b0] = anchors[i - 1],
      [a1, b1] = anchors[i];
    if (b1 <= b0) throw new Error(`text numbers out of order at ${a1}`);
    if (b1 - b0 > a1 - a0) throw new Error(`German text numbers added between ${a0} and ${a1}`);
    if (a1 - a0 === b1 - b0) {
      for (let n = a0 + 1; n < a1; n++) numberMap.set(n, b0 + n - a0);
      continue;
    }
    // A shorter German gap: the German version dropped numbers here. Keep the
    // order and choose the best content match (alignment with skips).
    const m = a1 - a0 - 1,
      k = b1 - b0 - 1;
    const best = Array.from({ length: m + 1 }, () => new Float64Array(k + 1).fill(-Infinity));
    const back = Array.from({ length: m + 1 }, () => new Uint8Array(k + 1));
    const MATCH = 2,
      SKIP = 1;
    best[0][0] = 0;
    for (let x = 0; x <= m; x++)
      for (let y = 0; y <= k; y++) {
        if (x > 0 && best[x - 1][y] > best[x][y]) [best[x][y], back[x][y]] = [best[x - 1][y], SKIP];
        if (x > 0 && y > 0) {
          const v = best[x - 1][y - 1] + similarity(enNumberText(a0 + x), deNumberText(b0 + y));
          if (v > best[x][y]) [best[x][y], back[x][y]] = [v, MATCH];
        }
      }
    for (let x = m, y = k; x > 0;) {
      if (back[x][y] === MATCH) {
        numberMap.set(a0 + x, b0 + y);
        review.push(`  ${a0 + x} "${enNumberText(a0 + x)}" -> "${deNumberText(b0 + y)}"`);
        x--;
        y--;
      } else {
        review.push(`  ${a0 + x} "${enNumberText(a0 + x)}" dropped in German`);
        x--;
        dropped++;
      }
    }
  }
  if (numberMap.size !== deNumberCount || dropped !== EN_NUMBER_COUNT - deNumberCount)
    throw new Error('text number gaps do not add up');
  for (const [n, m] of numberMap)
    pair(e16(EN_NUMBERS + 2 * n), g16(deNumbers + 2 * m), 'text numbers');
  numberSummary = `${anchored} numbers from ${scriptNumbers.same} scripts, ${dropped} dropped in German`;
}

// Kinds: name, value and flags; value and flags must agree.
for (let k = 0; k < KINDS; k++) {
  const a = KIND_TABLE + KIND_BYTES * k,
    b = DE_KIND_TABLE + KIND_BYTES * k;
  if (e16(a + KIND_VALUE) !== g16(b + KIND_VALUE) || e16(a + KIND_FLAGS) !== g16(b + KIND_FLAGS))
    throw new Error(`kind ${k} differs`);
  if (e16(a) === KIND_WITHOUT_NAME && g16(b) === KIND_WITHOUT_NAME) continue;
  pair(e16(a), g16(b), 'kinds');
}

// Text tables of bank 80 and the runner names.
{
  const tables = LOOKUP_TABLES.filter(
    ({ name, size }) => size === 'text' && name !== 'text_numbers',
  ).map(({ name, address, count }) => [name, address, count]);
  tables.push(['runner_names', RUNNER_NAMES, RUNNERS]);
  for (const [name, cpu, count] of tables) {
    const at = locate(cpu, 2 * count);
    for (let k = 0; k < count; k++) {
      const a = e16(cpu + 2 * k),
        b = g16(at + 2 * k);
      if (a === 0 && b === 0) continue;
      if (!enByWord.has(a) || !deByWord.has(b))
        throw new Error(`${name}: German table at ${cpuLabel(at)} rejected`);
    }
    for (let k = 0; k < count; k++)
      if (e16(cpu + 2 * k)) pair(e16(cpu + 2 * k), g16(at + 2 * k), 'tables');
  }
}

// Immediate operands of the code banks 80 and 81 for texts still unpaired.
{
  const opcodes = new Set([OP_LDA_IMMEDIATE, OP_LDX_IMMEDIATE, OP_LDY_IMMEDIATE, OP_PEA]);
  for (const t of enTexts) {
    if (pairs.has(t.word)) continue;
    const words = germanOperands(t.word, opcodes, IMMEDIATE_CONTEXTS).filter((w) =>
      deByWord.has(w),
    );
    if (words.length === 1) pair(t.word, words[0], 'code');
  }
}

// Text order: a gap between paired texts of the same size in both ROMs.
for (let changed = true; changed;) {
  changed = false;
  const used = new Set([...pairs.values()].map((p) => p.de));
  for (let i = 0; i < enTexts.length; i++) {
    if (pairs.has(enTexts[i].word)) continue;
    let i0 = i - 1,
      i1 = i + 1;
    while (i0 >= 0 && !pairs.has(enTexts[i0].word)) i0--;
    while (i1 < enTexts.length && !pairs.has(enTexts[i1].word)) i1++;
    if (i0 < 0 || i1 >= enTexts.length) continue;
    const j0 = deByWord.get(pairs.get(enTexts[i0].word).de).index,
      j1 = deByWord.get(pairs.get(enTexts[i1].word).de).index;
    const j = j0 + i - i0;
    if (j1 - j0 !== i1 - i0 || used.has(deTexts[j].word)) continue;
    pair(enTexts[i].word, deTexts[j].word, 'order');
    used.add(deTexts[j].word);
    changed = true;
  }
}

// ---- Menu texts of bank 81 (src/data/menu-texts.mjs) --------------------------
// 81:D531 (German 81:D559) draws the text at DBR:Y to the tilemap offset X.
// Every caller loads Y with LDY #text, the position with an LDX # shortly
// before (shared by the alternatives of a setting). The call sites follow in
// the same order in both ROMs; the German version moved the texts left.
const menuTexts = [];
let menuArrowShift;
{
  const enMenu = JSON.parse(await readFile('assets/vm-menu-texts.json', 'utf8'));
  if (enMenu.source_rom_sha256 !== EN_SHA256)
    throw new Error('vm-menu-texts.json is from another ROM');
  const enAddresses = new Set(enMenu.texts.map((t) => labelWord(t.address) | WORD_SIGN));
  const asciiAt = (bytes, cpu) => {
    let text = '';
    for (let o = offset(cpu); bytes[o] >= ASCII_SPACE && bytes[o] < ASCII_END; o++)
      text += String.fromCharCode(bytes[o]);
    return bytes[offset(cpu) + text.length] === 0 ? text : null;
  };
  // LDY #text sites in bank 81 with the X of the nearest LDX # before them.
  const sites = (bytes, accept) => {
    const list = [];
    for (let i = BANK_81; i < BANK_81 + LOROM_OFFSET; i++) {
      if (bytes[i] !== OP_LDY_IMMEDIATE) continue;
      const cpu = MENU_BANK | bytes.readUInt16LE(i + 1);
      if (!accept(cpu)) continue;
      let x = null;
      for (let j = i - INSTRUCTION_BYTES; j >= i - MENU_X_REACH && x === null; j--)
        if (bytes[j] === OP_LDX_IMMEDIATE) x = bytes.readUInt16LE(j + 1);
      list.push({ cpu, x });
    }
    return list;
  };
  const en = sites(E, (cpu) => enAddresses.has(cpu & WORD_MASK)),
    de = sites(G, (cpu) => {
      if (!(cpu & LOROM_OFFSET)) return false;
      const text = asciiAt(G, cpu);
      return text !== null && text.length >= MENU_TEXT_MIN;
    });
  if (en.length !== de.length)
    throw new Error(`menu call sites differ: ${en.length} / ${de.length}`);
  const byText = new Map();
  en.forEach((site, i) => {
    const other = de[i],
      shift = other.x - site.x;
    if (site.x === null || other.x === null)
      throw new Error(`menu site ${cpuLabel(site.cpu)} has no X`);
    const old = byText.get(site.cpu);
    if (old && (old.german !== other.cpu || old.shift !== shift))
      throw new Error(`menu text ${cpuLabel(site.cpu)} paired twice`);
    byText.set(site.cpu, { german: other.cpu, shift });
  });
  for (const t of enMenu.texts) {
    const cpu = MENU_BANK | labelWord(t.address) | WORD_SIGN,
      p = byText.get(cpu);
    if (!p) throw new Error(`menu text ${t.address} has no call site`);
    menuTexts.push({ address: t.address, text: asciiAt(G, p.german), shift: p.shift });
  }
  // The arrow before the chosen entry: 81:E32F draws it at row + ADC #0410
  // (LDA $0E, XBA, LSR, ADC #; German 81:E357).
  const arrow = (bytes) => {
    const code = Buffer.from(ARROW_CODE, 'hex'),
      found = [];
    for (let at = bytes.indexOf(code); at >= 0; at = bytes.indexOf(code, at + 1))
      if (bytes[at + ARROW_PHX] === OP_PHX) found.push(bytes.readUInt16LE(at + ARROW_OPERAND));
    if (found.length !== 1) throw new Error('menu arrow code not unique');
    return found[0];
  };
  menuArrowShift = arrow(G) - arrow(E);
}

// ---- Intro text and credits (src/data/lz-streams.mjs) -------------------------
// The packed streams of the intro text screen (81:DDFB, list 81:F768) and
// the credits (81:CE64, list 81:F529): text, character map and font. The
// German version adds umlaut tiles to its fonts and maps, so all three come
// from the German ROM together. German addresses from its code: the LDA #
// operands of 81:DE0D/DE1A and CE76/CE83, the unpack commands of its scene
// lists 81:F850 (VRAM 2000) and 81:F5DB (VRAM 1000). Both unpackers read the
// same bit length table (80:A033, German 80:A03F, equal bytes).
const streams = [];
{
  const enTable = offset(LZ_BIT_TABLE),
    deTable = offset(DE_LZ_BIT_TABLE);
  if (
    Buffer.compare(
      E.subarray(enTable, enTable + LZ_TABLE_BYTES),
      G.subarray(deTable, deTable + LZ_TABLE_BYTES),
    )
  )
    throw new Error('LZ bit tables differ');
  const bitsFor = lzBits((i) => e8(LZ_BIT_TABLE + i));
  const unpack = (read8, cpu) => {
    const length = read8(cpu) | (read8(cpu + 1) << BYTE_BITS),
      found = lzDecode((n) => read8(cpu + 2 + n), length, bitsFor);
    return {
      data: Uint8Array.from(found.data.slice(0, length)),
      tokens: found.tokens,
      bytes: 2 + found.byteLength,
    };
  };
  for (const [english, german, check] of LANGUAGE_STREAMS) {
    const a = unpack(e8, english),
      b = unpack(g8, german);
    if (check === 'length' && a.data.length !== b.data.length)
      throw new Error(
        `stream ${cpuLabel(german)} has ${b.data.length} bytes, English ${a.data.length}`,
      );
    if (
      check === 'font' &&
      (b.data.length < a.data.length || (b.data.length - a.data.length) % FONT_TILE_BYTES)
    )
      throw new Error(`font ${cpuLabel(german)} is no extension of the English one`);
    // Text: printable lines ended by 00, the credits with a count byte per
    // group; 84 is an a umlaut of the German intro text (code page 437).
    if (
      check === 'text' &&
      (!b.data.length ||
        !b.data.every(
          (c) =>
            c <= CREDIT_GROUP_COUNT_MAX ||
            (c >= ASCII_SPACE && c < ASCII_END) ||
            c === CP437_A_UMLAUT,
        ))
    )
      throw new Error(`stream ${cpuLabel(german)} is no text`);
    let bytes = G.subarray(offset(german), offset(german) + b.bytes);
    // Fix (user request 2026-11-05): the German intro text writes the "a
    // umlaut" of its word for mighty as 84, which its character map leaves
    // blank; "$" is the a umlaut of that map. The stream is packed again.
    if (english === INTRO_TEXT && b.data.includes(CP437_A_UMLAUT)) {
      const data = b.data.map((c) => (c === CP437_A_UMLAUT ? MAP_A_UMLAUT : c)),
        packed = lzEncode(data, b.tokens, bitsFor);
      bytes = Buffer.from([data.length & BYTE_MASK, data.length >> BYTE_BITS, ...packed]);
      const check = unpack((cpu) => bytes[cpu - TEMP_BASE], TEMP_BASE);
      if (Buffer.compare(Buffer.from(check.data), Buffer.from(data)))
        throw new Error('repacked intro text differs');
    }
    streams.push({
      english: cpuLabel(english),
      german: cpuLabel(german),
      bytes: bytes.toString('hex').toUpperCase(),
    });
  }
}

// ---- Output -----------------------------------------------------------------
const toUnicode = (text, at) =>
  text.replace(/\^(.)/g, (_, c) => {
    const u = UMLAUTS.find((x) => x.escape === c);
    if (!u) throw new Error(`unknown umlaut escape ^${c} at ${cpuLabel(at)}`);
    return u.char;
  });
const glyphs = UMLAUTS.map(({ char, escape }) => {
  const code = escape.charCodeAt(0) + UMLAUT_GLYPH_OFFSET;
  const rows = Array.from({ length: GLYPH_ROWS }, (_, r) =>
    g8(DE_FONT + GLYPH_ROWS * code + r)
      .toString(HEX_RADIX)
      .toUpperCase()
      .padStart(2, '0'),
  ).join('');
  return { char, width: g8(DE_WIDTHS + code), rows };
});
const texts = [],
  untranslated = [];
for (const t of enTexts) {
  const p = pairs.get(t.word);
  if (!p) {
    untranslated.push(t.address);
    continue;
  }
  const d = deByWord.get(p.de);
  // Menu arrows are font symbols, not translatable words. The German ROM
  // omits the previous/next strings; the English renderer still uses them.
  const symbol = t.text.length > 0 && [...t.text].every((c) => MENU_FONT_SYMBOLS.has(c));
  // User-requested correction of the German cartridge's workshop spelling.
  const translated = toUnicode(d.text, d.cpu);
  texts.push({
    address: t.address,
    text: symbol
      ? t.text
      : t.address === '9D:C4FB'
        ? translated.replace('Werstattgelände', 'Werkstattgelände')
        : translated,
    source: symbol ? 'font symbols' : p.source,
  });
}
const scope =
  'German texts of "Shadowrun (G).sfc" by the address of the English text they replace (vm-texts.json); umlauts as Unicode. glyphs: the seven umlaut glyphs of the German font (width, eight row bytes, glyph at the right edge). source names the structure that pairs the texts. notices: windows of the notice 80:FEC1 that the German version resized for its text (English text number, English and German height and width). untranslated English texts stay English. See tools/extract-texts-de.mjs and src/data/language.mjs.';
await writeFile(
  'assets/vm-texts-de.json',
  `{"format":"${LANGUAGE_FORMAT}",\n"scope":${JSON.stringify(scope)},\n` +
    `"source_rom_sha256":"${DE_SHA256}",\n"english_rom_sha256":"${EN_SHA256}",\n"glyphs":[\n` +
    glyphs.map((g) => JSON.stringify(g)).join(',\n') +
    '],\n"texts":[\n' +
    texts.map((t) => JSON.stringify(t)).join(',\n') +
    '],\n"notices":[\n' +
    [...noticeSizes.values()]
      .sort(
        (p, q) => p.english[1] - q.english[1] || p.english.join().localeCompare(q.english.join()),
      )
      .map((n) => JSON.stringify(n))
      .join(',\n') +
    '],\n"menus":[\n' +
    menuTexts.map((t) => JSON.stringify(t)).join(',\n') +
    `],\n"menuArrowShift":${menuArrowShift},\n"streams":[\n` +
    streams.map((s) => JSON.stringify(s)).join(',\n') +
    '],\n"untranslated":' +
    JSON.stringify(untranslated) +
    '}\n',
);
console.log(
  `${texts.length} of ${enTexts.length} texts paired (${[...sources].map(([s, n]) => `${s} ${n}`).join(', ')}), ` +
    `${untranslated.length} untranslated, ${conflicts.length} conflicts; text numbers: ${numberSummary}, ` +
    `German table ${cpuLabel(deNumbers)} x ${deNumberCount}`,
);
console.log('Dialogs and text number gaps decided by content:\n' + review.join('\n'));
for (const c of conflicts)
  console.log(
    `conflict ${cpuLabel(cpuOf(c.english))} "${enByWord.get(c.english).text}": kept ${c.kept.source} ` +
      `"${deByWord.get(c.kept.de).text}", not ${c.other.source} "${deByWord.get(c.other.de).text}"`,
  );
