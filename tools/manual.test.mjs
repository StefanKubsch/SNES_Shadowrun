import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BINDABLE, bind, parseBindings } from '../src/browser/controls.mjs';
import { controlName } from '../src/browser/ui-language.mjs';
import { CONTROL_ACTIONS, resolveControlText } from '../src/browser/control-help.mjs';
import {
  MANUAL_ARTICLES,
  MANUAL_CHAPTERS,
  MANUAL_EQUIPMENT,
  MANUAL_SOURCES,
  MANUAL_SPELLS,
  manualMatches,
} from '../src/browser/manual-data.mjs';

test('the handbook entries have unique stable IDs, bilingual prose and traceable sources', () => {
  const entries = [...MANUAL_ARTICLES, ...MANUAL_EQUIPMENT, ...MANUAL_SPELLS];
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const chapter of MANUAL_CHAPTERS) {
    assert.ok(chapter.title.en && chapter.title.de);
    assert.ok(MANUAL_ARTICLES.some((entry) => entry.chapter === chapter.id));
  }
  for (const entry of [...MANUAL_ARTICLES, ...MANUAL_SPELLS]) {
    assert.ok(
      MANUAL_CHAPTERS.some((chapter) => chapter.id === entry.chapter),
      entry.id,
    );
    for (const language of ['en', 'de']) {
      assert.ok(entry.title[language]?.trim(), entry.id);
      assert.ok(entry.text[language]?.trim(), entry.id);
    }
  }
  for (const entry of entries) {
    if (entry.browser) assert.equal(entry.source, undefined);
    else {
      assert.ok(Object.values(MANUAL_SOURCES).includes(entry.source), entry.id);
      assert.equal(entry.source.pdfPage, entry.source.manualPage + 2);
      assert.equal(entry.source.document, 'shadowrun-snes-us-manual');
    }
  }
});

test('the complete guide covers every gameplay page and all remaining chapter groups', () => {
  assert.deepEqual(
    MANUAL_CHAPTERS.map((chapter) => chapter.id),
    [
      'getting-started',
      'controls',
      'interface',
      'character',
      'inventory',
      'equipment',
      'combat',
      'magic',
      'skills',
      'recovery',
      'karma',
      'dialogue',
      'matrix',
    ],
  );
  const entries = [...MANUAL_ARTICLES, ...MANUAL_EQUIPMENT, ...MANUAL_SPELLS];
  const coveredPages = [
    ...new Set(entries.flatMap((entry) => (entry.source ? [entry.source.pdfPage] : []))),
  ].sort((a, b) => a - b);
  // Printed pages 1–36 are PDF pages 3–38; PDF page 4 is the contents page.
  assert.deepEqual(
    coveredPages,
    Array.from({ length: 36 }, (_, index) => index + 3).filter((page) => page !== 4),
  );
  assert.ok(
    MANUAL_ARTICLES.filter((entry) => entry.chapter === 'matrix').length >= 8,
    'Matrix includes equipment, movement, IC, storage, CPU and exit instructions',
  );
});

test('source identity, equipment requirements and six-spell coverage follow the checked US pages', () => {
  const pdf = readFileSync('Ressources/Shadowrun.pdf');
  assert.equal(
    createHash('sha256').update(pdf).digest('hex'),
    'd4944fc6b84e1de7306161a781ff43b43db355fa1d319803afcd9239371b4924',
  );
  assert.equal(MANUAL_EQUIPMENT.filter((entry) => entry.category === 'weapon').length, 12);
  assert.equal(MANUAL_EQUIPMENT.filter((entry) => entry.category === 'armor').length, 6);
  assert.equal(MANUAL_EQUIPMENT.find((entry) => entry.id === 'ares-viper').requiredStrength, 2);
  assert.equal(MANUAL_EQUIPMENT.find((entry) => entry.id === 'uzi-iii').requiredStrength, 4);
  for (const entry of MANUAL_EQUIPMENT) {
    assert.ok(Number.isInteger(entry.requiredStrength) && entry.requiredStrength >= 1);
    assert.equal(entry.source.pdfPage, 19);
    assert.equal('damage' in entry, false, 'requirements must not turn into damage');
  }
  assert.deepEqual(
    MANUAL_SPELLS.map((entry) => entry.name),
    ['Heal', 'Armor', 'Invisibility', 'Powerball', 'Summon Spirit', 'Freeze'],
  );
  assert.match(MANUAL_SPELLS.find((entry) => entry.id === 'heal').text.en, /5 Stamina/);
});

test('search crosses languages, normalizes accents and case, requires all words and treats HTML literally', () => {
  const heal = MANUAL_SPELLS.find((entry) => entry.id === 'heal');
  assert.ok(manualMatches(heal, 'HEAL'));
  assert.ok(manualMatches(heal, 'Heilung'));
  assert.ok(manualMatches(heal, 'heal 5'));
  assert.ok(
    manualMatches(
      MANUAL_ARTICLES.find((entry) => entry.id === 'equipping'),
      'ausrusten',
    ),
  );
  assert.ok(manualMatches(heal, '   '));
  assert.equal(manualMatches(heal, 'heal shotgun'), false);
  assert.equal(manualMatches(heal, '<img src=x onerror=alert(1)>'), false);
  assert.ok(
    manualMatches(
      MANUAL_EQUIPMENT.find((entry) => entry.id === 'uzi-iii'),
      'Uzi III',
    ),
  );
});

test('instructions use current inputs, preserve ordinary prose and expose unbound functions', () => {
  const bindings = bind(parseBindings(null), 'A', 'key:k');
  bindings.X = [];
  assert.equal(
    resolveControlText('A target: {A}. Type A and B.', bindings, 'en'),
    'A target: K. Type A and B.',
  );
  assert.equal(resolveControlText('{X}', bindings, 'de'), 'Nicht belegt');
  assert.equal(resolveControlText('{L}', bindings, 'de'), 'Linke Maustaste oder Q');
  for (const language of ['en', 'de']) {
    for (const name of BINDABLE) {
      assert.ok(CONTROL_ACTIONS[name][language]);
      assert.ok(controlName(language, name));
      assert.notEqual(
        controlName(language, name),
        name,
        'function names replace controller labels',
      );
    }
    for (const entry of MANUAL_ARTICLES) {
      const text = resolveControlText(entry.text[language], bindings, language);
      assert.doesNotMatch(text, /\{\w+\}/, entry.id);
      assert.doesNotMatch(entry.text[language], /\}[\p{L}]/u, 'tokens must not split a word');
    }
  }
  const firing = MANUAL_ARTICLES.find((entry) => entry.id === 'firing');
  const current = resolveControlText(firing.text.de, bindings, 'de');
  assert.match(current, /mit K das Fadenkreuz/);
  assert.ok(manualMatches(firing, 'K Fadenkreuz', current));
});
