import { toWram } from './to-wram.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import {
  buildTextEdits,
  TEXT_EDITS_FILE,
  TEXT_EDITS_FORMAT,
  TEXT_EDIT_LIMIT,
} from '../src/data/text-edits.mjs';
import {
  buildLanguage,
  installLanguage,
  languageText,
  languageTextWidth,
  fitNoticeWindow,
} from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { printText } from '../src/game/text-print.mjs';
import { translatedListWindow } from '../src/data/menu-layout.mjs';
import { TEXT_BUFFER, WINDOW_MAP_BUFFER, WRAM, GLOVE_NAME_WINDOW } from '../src/data/wram.mjs';
import { ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';
import { loadSave } from './mesen-plans.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';

const originals = JSON.parse(readFileSync('assets/vm-texts.json')).texts;
const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
const address = '9D:F411',
  id = 0x7411;
const asset = (en = [], de = []) => ({ format: TEXT_EDITS_FORMAT, en, de });
const entry = (text, at = address) => ({ address: at, text });
const text = (codes) => codes && String.fromCharCode(...codes);
function gameFor(edits, language = 'en', fourSaveSlots = false) {
  return new LiveGame(
    { ...cartridge, textEdits: buildTextEdits(edits, originals) },
    {
      languages: { de: german },
      language,
      gameplay: { ...ORIGINAL_GAMEPLAY, fourSaveSlots },
    },
  );
}

test('loader keeps all original bytes and carries independently editable content through structured clone', async () => {
  const edits = asset([entry('An independently longer save label')]);
  const loaded = await loadCartridge((file) =>
    file === TEXT_EDITS_FILE ? new TextEncoder().encode(JSON.stringify(edits)) : readAsset(file),
  );
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  const game = new LiveGame(structuredClone(loaded));
  assert.equal(text(languageText(game.memory, id)), edits.en[0].text);
});

test('language edits win over translations, English edits fill missing translations and empty edits remain present', () => {
  const untranslated = originals.find(
    (t) =>
      !german.texts.has(
        (parseInt(t.address.slice(3), 16) & 0x7fff) | (t.address.startsWith('9E') ? 0x8000 : 0),
      ),
  );
  assert.ok(untranslated);
  const fallbackId =
    (parseInt(untranslated.address.slice(3), 16) & 0x7fff) |
    (untranslated.address.startsWith('9E') ? 0x8000 : 0);
  const game = gameFor(
    asset(
      [
        entry('English edit'),
        entry('Fallback', untranslated.address),
        entry('Port edit', 'port:0100'),
      ],
      [entry(''), entry('Deutsch', 'port:0100')],
    ),
    'de',
    true,
  );
  assert.equal(languageText(game.memory, id).length, 0);
  assert.equal(text(languageText(game.memory, fallbackId)), 'Fallback');
  assert.equal(text(languageText(game.memory, 0x100)), 'Deutsch');
  game.setLanguage('en');
  assert.equal(text(languageText(game.memory, id)), 'English edit');
  assert.equal(text(languageText(game.memory, 0x100)), 'Port edit');
  game.setLanguage('de');
  assert.equal(languageText(game.memory, id).length, 0);
  const translated = gameFor(asset([entry('English edit')]), 'de');
  assert.deepEqual(languageText(translated.memory, id), german.texts.get(id));
});

test('edits reject unknown and duplicate IDs, unsupported controls, missing glyphs and buffer overflow', () => {
  for (const edits of [
    asset([entry('x', '9D:8000')]),
    asset([entry('x'), entry('y')]),
    asset([entry('x', 'port:0102')]),
    asset([entry(null)]),
    asset([entry('x'.repeat(TEXT_EDIT_LIMIT + 1))]),
  ])
    assert.throws(() => buildTextEdits(edits, originals));
  for (const invalid of ['\0', '\n', '\r', '\t', '\x1a', '\x13', 'é', 'ä', '😀'])
    assert.throws(
      () => buildTextEdits(asset([entry(invalid)]), originals),
      /text_edit_character_required/,
    );
  assert.throws(() => buildTextEdits({ format: TEXT_EDITS_FORMAT, en: [] }, originals));
  assert.equal(
    buildTextEdits(asset([entry('x'.repeat(TEXT_EDIT_LIMIT))]), originals).en.get(id).length,
    TEXT_EDIT_LIMIT,
  );
  assert.doesNotThrow(() => buildTextEdits(asset([], [entry('ÄÖÜäöüß |bold \u0001')]), originals));
});

test('FE69 and real FADD agree on longer, empty and port edits without changing source identities or reading edited streams', () => {
  for (const [value, at, word] of [
    ['Longer save name', address, id],
    ['', address, id],
    ['Port save name', 'port:0100', 0x100],
    ['x'.repeat(TEXT_EDIT_LIMIT), address, id],
  ]) {
    const { memory } = gameFor(asset([entry(value, at)]), 'en', true);
    memory.write16(WRAM + 2, word);
    memory.write8(WRAM + WINDOW_MAP_BUFFER, 0xa5);
    const seq = printText({ a: { mem: memory } }, {});
    seq.next().value(); // The initial segment ends before FB39 mutates style markers.
    assert.equal(text(toWram(memory).subarray(TEXT_BUFFER, TEXT_BUFFER + value.length)), value);
    assert.equal(memory.read8(WRAM + TEXT_BUFFER + value.length), 0);
    assert.equal(memory.read8(WRAM + WINDOW_MAP_BUFFER), 0xa5);
    assert.equal(memory.read16(2), word);
    seq.return();
    const expected = [...value].reduce(
      (sum, c) => sum + memory.read8(0x81ac0c + c.charCodeAt(0)),
      0,
    );
    assert.equal(languageTextWidth(memory, word), expected);
  }
});

test('English edits activate menu fitting and edited notices bypass obsolete German dimensions', () => {
  const { memory } = gameFor(asset([entry('A longer save label that requires a wider menu')]));
  const shape = { left: 20, top: 3, columns: 8, rows: 4 };
  const fitted = translatedListWindow(memory, shape, [id]);
  assert.ok(fitted.columns > shape.columns && fitted.columns <= 30 && fitted.left >= 1);
  const values = new Map([
    [0xc, 240],
    [0xa, 64],
    [8, 2048],
    [6, 3],
    [4, 15],
    [2, 17],
    [0, 2],
  ]);
  const noticeId = memory.read16(0x80d9b8 + 2 * 64);
  memory.language.set(noticeId, new TextEncoder().encode('word '.repeat(20)));
  memory.languageData = {
    texts: new Map(),
    notices: new Map([[[...values.values()].join(','), [3, 15]]]),
  };
  fitNoticeWindow(
    memory,
    (o) => values.get(o),
    (o, v) => values.set(o, v),
  );
  assert.ok(values.get(6) > 3 || values.get(4) > 15);
  installLanguage(memory, null);
  assert.ok(memory.language, 'English edits survive a language switch');
});

test('bold layout includes the FB39 placeholder and resets at spaces', () => {
  const { memory } = gameFor(asset([entry('|WW W')]));
  const w = memory.read8(0x81ac0c + 'W'.charCodeAt(0));
  const expected = memory.read8(0x81ac0c + 0x1a) + 1 + 3 * w + 2 + memory.read8(0x81ac0c + 0x20);
  assert.equal(languageTextWidth(memory, id), expected);
  assert.equal(languageTextWidth(memory, id), expected);
});

for (const language of ['en', 'de'])
  test(
    `${language}: oversized edited status labels stay within screen and leave scene graphics intact`,
    { timeout: 120000 },
    () => {
      const probe = new LiveGame(cartridge);
      const ids = Array.from({ length: 7 }, (_, row) => probe.memory.read16(0x80ed1e + 2 * row));
      const edits = ids.map((word) =>
        entry(
          'Longlabel'.repeat(20),
          `${word & 0x8000 ? '9E' : '9D'}:${(word | 0x8000).toString(16).toUpperCase()}`,
        ),
      );
      const textEdits = buildTextEdits(
        language === 'de' ? asset([], edits) : asset(edits),
        originals,
      );
      let pad = 0;
      const live = new LiveGame(
        { ...cartridge, textEdits },
        {
          languages: { de: german },
          language,
          pad: (k) =>
            k < 5000 ? ([3000, 3300, 3600].some((at) => k >= at && k < at + 4) ? 0x1000 : 0) : pad,
        },
      );
      const advance = (count) => {
        const end = live.nmis + count;
        while (live.nmis < end) live.step();
      };
      while (live.nmis < 5100) live.step();
      const tiles = live.screen.vram.slice(0xe000, 0xf000);
      pad = 0x1000;
      advance(2);
      pad = 0;
      advance(240);
      const menu = live.memory.read16(0x1f4e);
      assert.equal(live.memory.read16(0x7e2020 + menu), 30);
      assert.ok((live.memory.read16(0x7e2000 + menu) % 64) / 2 >= 1);
      pad = 0x2000;
      advance(2);
      pad = 0;
      advance(100);
      assert.equal(live.memory.read16(0x1f62), 0);
      assert.equal(live.memory.read16(0x204), 0xfffe);
      assert.deepEqual(live.screen.vram.slice(0xe000, 0xf000), tiles);
    },
  );

test(
  'an oversized edited glove name clamps its real window without persistent scene writes',
  { timeout: 120000 },
  () => {
    const textEdits = buildTextEdits(asset([entry('W'.repeat(100), '9D:EEAB')]), originals);
    const plan = [
      ['press', 'b'],
      ['glove', 122, 155],
      ['wait', 60],
    ];
    let live, driver;
    live = new LiveGame(
      { ...cartridge, textEdits },
      {
        sram: new Uint8Array(loadSave('apartment')),
        pad: (k) => {
          if (k < 5000)
            return [3000, 3300, 3600].some((at) => k >= at && k < at + 4)
              ? 0x1000
              : k >= 3150 && k < 3154
                ? 0x0400
                : 0;
          driver ??= livePlanDriver(plan, live.memory.wram, () => live.loop.rounds);
          return driver.pad(k);
        },
      },
    );
    while (live.nmis < 5000) live.step();
    const tiles = live.screen.vram.slice(0xe000, 0xf000);
    while (!driver?.done() && live.nmis < 6000) live.step();
    assert.ok(driver?.done());
    const window = live.memory.read16(WRAM + GLOVE_NAME_WINDOW);
    assert.ok(window < 0x20, 'the glove allocated its name window');
    assert.equal(live.memory.read16(0x7e2020 + window), 29);
    assert.deepEqual(live.screen.vram.slice(0xe000, 0xf000), tiles);
  },
);
