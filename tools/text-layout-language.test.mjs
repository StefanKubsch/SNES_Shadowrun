import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { buildLanguage, GERMAN } from '../src/data/language.mjs';
import { ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';

const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8')));
const apartment = new Uint8Array(loadSave('apartment'));
const TITLE = (k) =>
  [3000, 3300, 3600].some((at) => k >= at && k < at + 4)
    ? 0x1000
    : k >= 3150 && k < 3154
      ? 0x0400
      : 0;

function live(language, plan, fourSlots = false) {
  let game, driver;
  game = new LiveGame(cartridge, {
    languages: { [GERMAN]: german },
    language,
    gameplay: fourSlots ? { ...ORIGINAL_GAMEPLAY, fourSaveSlots: true } : ORIGINAL_GAMEPLAY,
    sram: apartment.slice(),
    pad: (k) => {
      if (k < 5000) return TITLE(k);
      driver ??= livePlanDriver(plan, game.memory.wram, () => game.driver.roundsCompleted);
      return driver.pad(k);
    },
  });
  const draws = [];
  while (game.nmis < 5000) game.step();
  const texts = german.texts;
  game.memory.language = {
    get(id) {
      const codes = texts.get(id);
      // FE69 has already installed the requested id in DP $02. Layout sizing
      // also calls language.get, but does not pass through the original text reader.
      const rawWindow = game.memory.read16(0);
      if (
        game.memory.read16(2) === id &&
        game.nmis >= 5000 &&
        rawWindow <= 0x1e &&
        !(rawWindow & 1)
      ) {
        const window = rawWindow;
        draws.push({
          nmi: game.nmis,
          id,
          codes: codes && [...codes],
          width: codes?.reduce((sum, code) => sum + game.memory.read8(0x81ac0c + code), 0),
          columns: game.memory.read16(0x7e2020 + window),
          top: Math.floor(game.memory.read16(0x7e2000 + window) / 64),
          rows: game.memory.read16(0x7e2040 + window),
          cursor: game.memory.read16(0x7e20c0 + window) - game.memory.read16(0x7e2060 + window),
          pixel: game.memory.read16(0x7e20e0 + window),
        });
      }
      return codes;
    },
  };
  while (!driver?.done() && game.nmis < 8000) game.step();
  assert.ok(driver?.done(), 'live input plan completed');
  return { game, draws };
}

function assertMenuRowsFit(draws, predicate, label) {
  const rows = draws.filter((draw) => predicate(draw) && draw.columns > 0);
  assert.ok(rows.length, `${label} was drawn through FE69`);
  for (const draw of rows) {
    const width = draw.width;
    // Each menu entry is positioned on a separate row by A617. Leave the
    // cursor column and frame border clear, and require the actual text to fit.
    assert.ok(width < (draw.columns - 3) * 8, `${label} text ${draw.id.toString(16)} fits one row`);
    assert.ok(draw.codes?.length, `${label} text ${draw.id.toString(16)} is nonempty`);
    assert.ok(
      [0, 1].includes(draw.cursor % (draw.columns - 2)),
      `${label} cursor remains at a row boundary`,
    );
  }
  return rows;
}

const BED_SAVE = [
  ['press', 'b'],
  ['glove', 122, 155],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 400],
  ['press', 'down', 20],
  ['press', 'b', 100],
  ['wait', 60],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 100],
  ['wait', 60],
  ['press', 'y', 40],
  ['wait', 60],
];

for (const fourSlots of [false, true]) {
  test(
    `German apartment bed menus fit ${fourSlots ? 'four' : 'two'} save slots and close cleanly`,
    { timeout: 180000 },
    () => {
      const { game, draws } = live(GERMAN, BED_SAVE, fourSlots);
      const saveRows = assertMenuRowsFit(
        draws,
        (d) => [0x7088, 0x7421, 0x7428, 0x7411, 0x7419, 0x0100, 0x0101].includes(d.id),
        'bed save menu',
      );
      const required = fourSlots
        ? [0x7088, 0x7411, 0x7419, 0x0100, 0x0101]
        : [0x7088, 0x7411, 0x7419];
      for (const id of required)
        assert.ok(
          saveRows.some((d) => d.id === id),
          `menu entry ${id.toString(16)} appears`,
        );
      assert.equal(game.memory.read16(0x1f62), 0, 'menus are closed after cancellation');
      assert.equal(game.memory.read16(0x204), 0xfffe, 'all temporary windows are released');
      assert.equal(game.dataOutsideBlank, 0);
    },
  );
}

test('German inventory action menu draws both actions on stable rows', { timeout: 180000 }, () => {
  const plan = [
    ['press', 'start', 200],
    ['wait', 120],
    ['press', 'down', 20],
    ['press', 'b', 100],
    ['wait', 160],
    ['press', 'down', 20],
    ['press', 'b', 200],
    ['wait', 80],
    ['press', 'select', 40],
    ['wait', 60],
  ];
  const { game, draws } = live(GERMAN, plan);
  const actionRows = assertMenuRowsFit(
    draws,
    (d) => [0x7088, 0x70d9, 0x70e3, 0x7077, 0x707a, 0x7074].includes(d.id),
    'inventory action menu',
  );
  for (const id of [0x7088, 0x70d9, 0x70e3])
    assert.ok(
      actionRows.some((d) => d.id === id),
      `action menu entry ${id.toString(16)} appears`,
    );
  for (const id of [0x7077, 0x707a, 0x7074]) {
    const source = german.texts.get(id);
    assert.ok(source?.length, `translated control text ${id.toString(16)} remains available`);
  }
  assert.equal(game.dataOutsideBlank, 0);
});

test('German apartment videophone notices fit their allocated lines', { timeout: 180000 }, () => {
  const plan = [
    ['hold', 'up', 50],
    ['press', 'b'],
    ['glove', 135, 95],
    ['wait', 8],
    ['press', 'b', 40],
    ['press', 'down', 20],
    ['press', 'down', 20],
    ['press', 'b', 400],
    ['wait', 300],
  ];
  const { draws } = live(GERMAN, plan);
  for (const id of [0x7614, 0x7629]) {
    const notice = draws.find((draw) => draw.id === id && draw.columns > 0);
    assert.ok(notice, `videophone notice ${id.toString(16)} is drawn`);
    assert.ok(notice.codes?.length, `videophone notice ${id.toString(16)} text is nonempty`);
    assert.ok(notice.columns >= 12, `videophone notice ${id.toString(16)} uses its fitted width`);
  }
});

test(
  'German karma skill details stay below the category list and fit one row',
  { timeout: 180000 },
  () => {
    const plan = [
      ['press', 'b'],
      ['glove', 122, 155],
      ['wait', 8],
      ['press', 'b', 40],
      ['press', 'down', 20],
      ['press', 'b', 80],
      ['wait', 400],
      ['press', 'down', 20],
      ['press', 'down', 20],
      ['press', 'b', 200],
      ['wait', 60],
      ['press', 'down', 20],
      ['press', 'down', 20],
      ['press', 'b', 200],
      ['wait', 300],
    ];
    const { game, draws } = live(GERMAN, plan);
    const skills = draws.filter((d) => d.top === 18 && d.rows === 9 && d.codes?.length);
    assert.ok(skills.length, 'karma skill detail labels are drawn');
    for (const id of [0x7088, 0x745d, 0x6dee])
      assert.ok(
        skills.some((draw) => draw.id === id),
        `karma skill ${id.toString(16)} is drawn`,
      );
    for (const draw of skills) {
      assert.ok(draw.top >= 18, `skill row ${draw.id.toString(16)} starts below the category list`);
      assert.ok(
        draw.width < (draw.columns - 3) * 8,
        `skill row ${draw.id.toString(16)} fits beside its value`,
      );
    }
    assert.equal(game.dataOutsideBlank, 0);
  },
);
