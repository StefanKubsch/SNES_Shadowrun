import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { buildTextEdits, TEXT_EDITS_FILE, TEXT_EDITS_FORMAT } from '../src/data/text-edits.mjs';
import { MATRIX_EDIT_COLUMNS, MATRIX_EDIT_STREAM_LIMIT } from '../src/data/matrix-text-edits.mjs';
import { buildLanguage } from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import { CHARACTER_TILES, TEXT_ROW } from '../proof/matrix-reference/main-scene-matrix.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';

const originalTexts = JSON.parse(readFileSync('assets/vm-texts.json')).texts;
const originalMenus = JSON.parse(readFileSync('assets/vm-menu-texts.json')).texts;
const originalMatrix = JSON.parse(readFileSync('assets/vm-matrix-texts.json')).texts;
const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
const entry = (address, text) => ({ address, text });
const asset = (en = [], de = []) => ({ format: TEXT_EDITS_FORMAT, en, de });
const build = (edits) => buildTextEdits(edits, originalTexts, originalMenus, originalMatrix);
const chars = (s) => s && String.fromCharCode(...s.bytes.subarray(0, s.bytes.length - 2));
function gameFor(edits = asset(), language = 'en', options = {}) {
  return new LiveGame(
    { ...cartridge, textEdits: structuredClone(build(edits)) },
    {
      languages: { de: german },
      language,
      ...options,
    },
  );
}
function invoke(game, target, x = 0, y = 0) {
  const a = new TaskAccessor({
    mem: game.memory,
    a: 0,
    x,
    y,
    s: 0x1ef0,
    d: 0,
    dbr: 0x81,
    p: 0,
    pc: target & 0xffff,
  });
  a.load();
  a.ctx.programBank = 0x81;
  const h = dialogAccess(a);
  h.push(0x1234, 2);
  MAIN_SCENE_ROUTINES.get(target)(h, { calls: [] }, MAIN_SCENE_ROUTINES);
  return h;
}
function setup(game, columns = 32) {
  invoke(game, 0x81b2a0);
  game.memory.write16(0x1342, columns);
  for (let c = 0x20; c <= 0x7e; c++) game.memory.write16(CHARACTER_TILES + 2 * c, c);
}
const enqueue = (game, pointer) => invoke(game, 0x81b282, pointer & 0xffff, pointer >>> 16);
function drain(game, limit = 4096) {
  const tiles = new Map();
  const batches = [];
  for (let n = 0; n < limit; n++) {
    const h = invoke(game, 0x81b2d1);
    const count = game.memory.read16(0x113e);
    if (game.memory.read16(0x1748)) {
      const start = game.memory.read16(0x1144);
      const words = Array.from({ length: count / 2 }, (_, k) =>
        game.memory.read16(TEXT_ROW + 2 * k),
      );
      words.forEach((v, k) => tiles.set(start + k, v));
      batches.push({ start, words });
    }
    // Explicit synthetic DMA consumption for these writer-only checks.
    game.memory.write16(0x1748, 0);
    game.memory.write16(0x174a, 0);
    if (!(h.ctx.status & 1)) return { tiles, batches, calls: n + 1 };
  }
  assert.fail('matrix stream did not finish');
}
function row(result, at, text, palette = 0) {
  Array.from(text).forEach((c, i) =>
    assert.equal(result.tiles.get(at + i), c.charCodeAt(0) | 0x2000 | palette),
  );
}

test('loader preserves cartridge bytes and clones matrix edits through the existing worker payload', async () => {
  const edits = asset(
    [entry('81:C5C0', '\nA longer edited IC notice\n')],
    [entry('81:C5C0', '\nNeue IC Meldung\n')],
  );
  const loaded = await loadCartridge((file) =>
    file === TEXT_EDITS_FILE ? new TextEncoder().encode(JSON.stringify(edits)) : readAsset(file),
  );
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  const game = new LiveGame(structuredClone(loaded), { languages: { de: german } });
  assert.equal(
    chars(game.memory.matrixTextEdits.get(0x81c5c0)),
    '\x04A longer edited IC notice\x04',
  );
  game.setLanguage('de');
  assert.equal(chars(game.memory.matrixTextEdits.get(0x81c5c0)), '\x04Neue IC Meldung\x04');
  game.setLanguage('en');
  assert.equal(
    chars(game.memory.matrixTextEdits.get(0x81c5c0)),
    '\x04A longer edited IC notice\x04',
  );
  assert.equal(new LiveGame(cartridge).memory.matrixTextEdits, null);
  const fallback = gameFor(asset([entry('81:C5C0', '\nEnglish fallback\n')]), 'de');
  assert.match(chars(fallback.memory.matrixTextEdits.get(0x81c5c0)), /English fallback/);
  assert.equal(
    gameFor(asset([], [entry('81:C5C0', '\nNur Deutsch\n')])).memory.matrixTextEdits,
    null,
  );
});

test('identities, controls, glyphs, line composition, count tokens and stream budgets reject unsafe edits', () => {
  const bad = [
    ['81:C5C1', '\nA\n'],
    ['81:c5c0', '\nA\n'],
    ['81:C5C0', null],
    ['81:C5C0', 'A\n'],
    ['81:C5C0', '\nA'],
    ['81:C5C0', '\nA{wait 2}'],
    ['81:C5C0', '\n{back}\n'],
    ['81:C5C0', '\nA{back}{back}\n'],
    ['81:C5C0', '\n' + 'A'.repeat(MATRIX_EDIT_COLUMNS + 1) + '\n'],
    ['81:C5C0', '\n{wait 0}\n'],
    ['81:C5C0', '\n{wait 256}\n'],
    ['81:C5C0', '\n{palette 3}\n'],
    ['81:C5C0', '\n{x41}\n'],
    ['81:C5C0', '\n{wait 2}\n{'],
    ['81:C5C0', '\n{slot}\n'],
    ['81:C5C0', '\n{count}\n'],
    ['81:C60D', '\nNo count\n'],
    ['81:C60D', '\n{count}{count}\n'],
    ['81:C5C0', '\n' + '{palette 0}'.repeat(MATRIX_EDIT_STREAM_LIMIT) + '\n'],
  ];
  for (const glyph of [
    '\0',
    '\r',
    '\t',
    '\x07',
    '\x1f',
    '\x7f',
    'ä',
    '😀',
    '#',
    '|',
    '\\',
    '/',
    '}',
    ',',
  ])
    bad.push(['81:C5C0', '\n' + glyph + '\n']);
  for (const [address, text] of bad)
    for (const code of ['en', 'de'])
      assert.throws(
        () => build({ ...asset(), [code]: [entry(address, text)] }),
        `${code}: ${address} ${text}`,
      );
  for (const code of ['en', 'de'])
    assert.throws(
      () => build({ ...asset(), [code]: [entry('81:C5C0', ''), entry('81:C5C0', '')] }),
      /matrix_edit_identity_required/,
    );
  for (const text of [
    '',
    '\n' + 'A'.repeat(MATRIX_EDIT_COLUMNS) + '\n',
    '\nAB{wait 255}{back}{back}CD\n',
    '\n{palette 0}{palette 1}{palette 2}OK\n',
  ])
    assert.doesNotThrow(() => build(asset([entry('81:C5C0', text)])));
  const atLimit = '\n' + '{palette 0}'.repeat(MATRIX_EDIT_STREAM_LIMIT - 3) + '\n';
  assert.equal(
    build(asset([entry('81:C5C0', atLimit)])).matrix.en.get(0x81c5c0).bytes.length,
    MATRIX_EDIT_STREAM_LIMIT + 1,
  );
  assert.throws(
    () => build(asset([entry('81:C5C0', atLimit + '\n')])),
    /matrix_edit_stream_required/,
  );
  assert.throws(
    () => build(asset([entry('81:C5C0', atLimit + '{wait 1}')])),
    /matrix_edit_stream_required/,
  );
});

test('all 22 delivered matrix texts fit the editing domain with an explicit dynamic count token', () => {
  const entries = originalMatrix.map(({ address, text }) =>
    entry(address, address === '81:C60D' ? text.replace('X', '{count}') : text),
  );
  const edits = build(asset(entries, entries));
  assert.equal(edits.matrix.en.size, 22);
  assert.equal(edits.matrix.de.size, 22);
});

test('the real writer consumes long streams, palettes, wait operands and backtracking without new ROM reads', () => {
  for (const columns of [16, 32]) {
    const line = 'A'.repeat(29);
    const game = gameFor(
      asset([entry('81:C5C0', '\n{palette 2}' + line + '\nAB{wait 2}{back}C\n')]),
    );
    setup(game, columns);
    enqueue(game, 0x81c5c0);
    const original = game.memory.read8.bind(game.memory);
    game.memory.read8 = (cpu) => {
      assert.ok(
        cpu < 0x81c5c0 || cpu >= 0x81c5d2,
        'edited stream must not read its old bytes or neighboring text',
      );
      return original(cpu);
    };
    const result = drain(game);
    row(result, 0x822, line, 0x800);
    row(result, 0x842, 'AC', 0x800);
    assert.ok(
      result.batches.every(
        ({ start, words }) => (start & 31) >= 2 && (start & 31) + words.length <= 31,
      ),
    );
    assert.equal(game.memory.read16(0x1350), 0x862);
    assert.equal(game.memory.read16(0x34), 0xc5d1, 'completion parks at the original terminator');
    game.memory.read8 = original;
    for (let i = 0; i < 4; i++)
      assert.equal(
        invoke(game, 0x81b2d1).ctx.status & 1,
        0,
        'idle does not replay the original text',
      );
  }
});

test('active and queued messages keep enqueue-time language while new slots adopt the next language', () => {
  const game = gameFor(
    asset([entry('81:C5C0', '\nEN{wait 5}GLISH\n')], [entry('81:C5C0', '\nDEUTSCH\n')]),
  );
  setup(game);
  enqueue(game, 0x81c5c0);
  enqueue(game, 0x81c5c0);
  invoke(game, 0x81b2d1); // the first newline activates the first stream
  const active = game.memory.matrixTextState.active;
  game.setLanguage('de');
  enqueue(game, 0x81c5c0);
  assert.equal(game.memory.matrixTextState.active, active);
  assert.match(chars(game.memory.matrixTextState.slots[1]), /EN/);
  assert.match(chars(game.memory.matrixTextState.slots[2]), /DEUTSCH/);
  const result = drain(game);
  row(result, 0x822, 'ENGLISH');
  row(result, 0x862, 'ENGLISH');
  row(result, 0x8a2, 'DEUTSCH');
  assert.equal(game.memory.read16(0x1712), 12);
  assert.ok(game.memory.matrixTextState.slots.every((s) => s === null));
});

test('IC count snapshots keep each digit and leave the original template and scroll workspace intact', () => {
  const game = gameFor(asset([entry('81:C60D', '\nCOUNT {count}\n')]));
  setup(game);
  const start = 0x7f0140;
  game.memory.wram.fill(0x5a, 0x10140, 0x1015a);
  for (const digit of [0x31, 0x38]) {
    game.memory.write8(start + 8, digit);
    enqueue(game, start);
  }
  game.memory.write8(start + 8, 0x34);
  const before = game.memory.wram.slice(0x10140, 0x1015a);
  const result = drain(game);
  row(result, 0x822, 'COUNT 1');
  row(result, 0x862, 'COUNT 8');
  assert.deepEqual(game.memory.wram.slice(0x10140, 0x1015a), before);
  assert.equal(
    build(asset([entry('81:C60D', '\nCOUNT {count}\n')]))
      .matrix.en.get(0x81c60d)
      .bytes.includes(0x38),
    false,
  );
  const invalid = gameFor(asset([entry('81:C60D', '\n{count}\n')]));
  setup(invalid);
  assert.throws(() => enqueue(invalid, start), /matrix_edit_count_required/);
  assert.equal(invalid.memory.read16(0x1710), 0);
  assert.equal(invalid.memory.matrixTextState, null);
  game.memory.wram.set([4, 0x41, 4, 0], 0x10600);
  enqueue(game, 0x7f0600);
  const nextRow = game.memory.read16(0x1350) + 0x20;
  row(drain(game), nextRow, 'A');
});

test('ring wrap preserves capacity, replaces edited slots with originals and resets all stream state', () => {
  const game = gameFor(asset([], [entry('81:C5C0', '\nDE\n')]));
  setup(game);
  game.setLanguage('de');
  for (let i = 0; i < 8; i++) enqueue(game, 0x81c5c0);
  assert.equal(
    game.memory.read16(0x1710),
    game.memory.read16(0x1712),
    'original ring full equals empty',
  );
  game.setLanguage('en');
  enqueue(game, 0x81c5c0);
  assert.equal(
    game.memory.matrixTextState.slots[0],
    null,
    'unedited overwrite removes stale German bytes',
  );
  const result = drain(game);
  assert.ok(
    [...result.tiles.values()].includes('A'.charCodeAt(0) | 0x2400),
    'original ATTACKED text runs',
  );
  invoke(game, 0x81b2a0);
  assert.equal(game.memory.matrixTextState, null);
  assert.equal(game.memory.read16(0x1710), 0);
  game.setLanguage('de');
  enqueue(game, 0x81c5c0);
  assert.equal(chars(game.memory.matrixTextState.slots[0]), '\x04DE\x04');
});

test('empty overrides finish cleanly and structured stream snapshots retain a partially consumed message', () => {
  const game = gameFor(asset([entry('81:C5C0', ''), entry('81:C60D', '')]));
  setup(game);
  enqueue(game, 0x81c5c0);
  enqueue(game, 0x7f0140);
  assert.equal(drain(game).batches.length, 0);
  const edited = asset([entry('81:C5C0', '\nLONG{wait 2}ER\n')]);
  const first = gameFor(edited);
  setup(first);
  enqueue(first, 0x81c5c0);
  enqueue(first, 0x81c5c0);
  invoke(first, 0x81b2d1);
  const second = gameFor(edited);
  second.memory.wram.set(first.memory.wram);
  second.memory.matrixTextState = structuredClone(first.memory.matrixTextState);
  assert.deepEqual(drain(second), drain(first));
});

test('a maximal palette-only batch stays within the stream budget and finishes through the normal writer', () => {
  const text = '\n' + '{palette 0}'.repeat(MATRIX_EDIT_STREAM_LIMIT - 3) + '\n';
  const game = gameFor(asset([entry('81:C5C0', text)]));
  setup(game);
  enqueue(game, 0x81c5c0);
  assert.equal(drain(game).batches.length, 0);
  assert.equal(game.memory.matrixTextState.active, null);
});

test(
  'live matrix output renders edited login and real IC count in both languages with the installed font',
  { timeout: 180000 },
  () => {
    for (const language of ['en', 'de']) {
      let game,
        requested = false,
        grid = null,
        countSeen = false,
        loginSeen = false;
      const edits = asset(
        [
          entry('81:C72B', '\n{palette 1}EN LOGIN\n'),
          entry('81:C60D', '\n{palette 1}COUNT {count}\n'),
        ],
        [
          entry('81:C72B', '\n{palette 1}DE LOGIN\n'),
          entry('81:C60D', '\n{palette 1}ANZAHL {count}\n'),
        ],
      );
      const label = language === 'en' ? 'EN LOGIN' : 'DE LOGIN';
      const prefix = language === 'en' ? 'COUNT ' : 'ANZAHL ';
      const visible = (text) => {
        const vram = game.bus.ppu.vram;
        const words = Array.from(
          text,
          (c) => game.memory.read16(CHARACTER_TILES + 2 * c.charCodeAt(0)) | 0x2400,
        );
        for (let start = 0x1000; start < 0x1800; start += 2)
          if (words.every((w, i) => (vram[start + 2 * i] | (vram[start + 2 * i + 1] << 8)) === w))
            return true;
        return false;
      };
      game = gameFor(edits, language, {
        sram: new Uint8Array(loadSave('apartment')),
        pad(k) {
          if (k < 5000)
            return [3000, 3300, 3600].some((n) => k >= n && k < n + 4)
              ? 0x1000
              : k >= 3150 && k < 3154
                ? 0x0400
                : 0;
          const m = game.memory;
          if (!requested) {
            requested = true;
            const record = m.read16(0x13a8 + m.read16(0xcc2));
            assert.ok(record > 0);
            m.write16(0x1ce9, 0xfffe);
            m.write16(0x7e2de2, 345);
            m.write8(0x1d8d, 0x40);
            m.write8(0x1d8f, 10);
            m.write8(0x1d8e, 0);
            m.write8(0x1d90, 1);
            m.write8(0x1d8c, 12);
            m.write8(0x1d8b, m.read8(0x7e0000 + record + 2));
            m.write16(0x1d93, record);
          }
          loginSeen ||= visible(label);
          for (let count = 1; count <= 8; count++) countSeen ||= visible(prefix + count);
          if (m.read16(0x1342) === 32 && m.read16(0x175c) === 0x5216) grid ??= k;
          // The map is installed before the fade back in. Start movement
          // after that setup, rather than spending the turn input in the fade.
          const elapsed = grid === null ? -1 : k - grid - 128;
          return elapsed >= 0 && (elapsed < 30 || (elapsed >= 50 && elapsed < 54)) ? 0x800 : 0;
        },
      });
      while (game.nmis < 6200 && !(countSeen && loginSeen)) game.step();
      assert.equal(
        loginSeen,
        true,
        `${language}: edited login reached VRAM through the real matrix NMI`,
      );
      assert.equal(
        countSeen,
        true,
        `${language}: B959 count reached VRAM through the real matrix NMI: ${JSON.stringify({
          grid,
          nmi: game.nmis,
          health: game.memory.read16(0x1754),
          x: game.memory.read16(0x1524),
          y: game.memory.read16(0x1566),
          state: game.memory.read16(0x173e),
          count: game.memory.read8(0x7f0148),
          active: chars(game.memory.matrixTextState?.active),
        })}`,
      );
      assert.equal(
        game.memory.read8(0x7f0142),
        'F'.charCodeAt(0),
        'original FOUND template remains in WRAM',
      );
    }
  },
);
