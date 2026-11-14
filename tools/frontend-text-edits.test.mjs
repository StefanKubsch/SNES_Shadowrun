import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { buildTextEdits, TEXT_EDITS_FILE, TEXT_EDITS_FORMAT } from '../src/data/text-edits.mjs';
import { FRONTEND_TEXT_LIMIT } from '../src/data/frontend-text-edits.mjs';
import { buildLanguage, languageMenuText, languageMenuArrowShift } from '../src/data/language.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { FRONTEND_TEXT_ROUTINES } from '../src/task/main-frontend-text.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { saveSlotCount } from '../src/game/save-slots.mjs';
import {
  drawMenuText,
  drawOptionsMenu,
  drawResumeMenu,
  drawStartMenu,
  moveArrow,
  toggleMenuHighlight,
  validSaveSlot,
} from '../src/frontend/start-menu.mjs';
import { TILE_PALETTE_STEP, TILE_PRIORITY } from '../src/constants/ppu.mjs';

// Menu characters with priority and palette 1; a disabled row XORs palette 1 back to
// 0; the highlight swaps palettes 1 and 2 (src/frontend/start-menu.mjs).
const MENU_TEXT_ATTRIBUTES = TILE_PRIORITY | TILE_PALETTE_STEP,
  MENU_DISABLED_XOR = TILE_PALETTE_STEP,
  MENU_HIGHLIGHT_TOGGLE = TILE_PALETTE_STEP * 3;
import {
  MENU_TILEMAP,
  MENU_TILEMAP_BYTES,
  MENU_FONT_TILES,
  DP_MENU_CURSOR,
  DP_MENU_TEXT_XOR,
  SETTINGS_CONTROL,
} from '../src/task/wram.mjs';
import { ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';
import { SLOT_OFFSETS_FOUR } from '../src/game/save-slots.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';

const originals = JSON.parse(readFileSync('assets/vm-texts.json')).texts;
const menus = JSON.parse(readFileSync('assets/vm-menu-texts.json')).texts;
const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
const asset = (en = [], de = []) => ({ format: TEXT_EDITS_FORMAT, en, de });
const entry = (address, text) => ({ address, text });
const build = (edits) => buildTextEdits(edits, originals, menus);
const chars = (value) => value && String.fromCharCode(...value.codes);
function gameFor(edits, language = 'en', options = {}) {
  return new LiveGame(
    { ...cartridge, textEdits: structuredClone(build(edits)) },
    {
      languages: { de: german },
      language,
      gameplay: { ...ORIGINAL_GAMEPLAY, fourSaveSlots: true },
      ...options,
    },
  );
}
function invoke(game, target, { a = 0, x = 0, y = 0 } = {}) {
  const accessor = new TaskAccessor({
    mem: game.memory,
    a,
    x,
    y,
    s: 0x1ef0,
    d: 0,
    dbr: 0x81,
    p: 0,
    pc: target,
    gameplay: game.gameplay,
    startMenuCredits: game.vm.startMenuCredits,
  });
  accessor.load();
  accessor.ctx.programBank = 0x81;
  const h = dialogAccess(accessor),
    m = sceneRuntime(h);
  // The lifted menu functions of the original routines.
  const run = {
    0x81d531: () => drawMenuText(m.mem, x, 0x810000 | y),
    0x81e38d: () => drawStartMenu(m),
    0x81e3da: () =>
      drawResumeMenu(
        m,
        saveSlotCount(accessor),
        validSaveSlot(h, { calls: [] }, FRONTEND_TEXT_ROUTINES),
      ),
    0x81e446: () => drawOptionsMenu(m),
    0x81e343: () => moveArrow(m, a, 0x81),
    0x81e371: () => toggleMenuHighlight(m.mem),
  }[target];
  run();
  return h;
}
function seedFont(memory) {
  for (let c = 0x20; c <= 0x7e; c++) memory.write16(MENU_FONT_TILES + 2 * (c - 0x20), c);
}
const tile = (memory, at) => memory.read16(MENU_TILEMAP + at);
function row(memory, at, text, xor = 0) {
  for (let i = 0; i < text.length; i++)
    assert.equal(
      tile(memory, at + 2 * i),
      (text.charCodeAt(i) | MENU_TEXT_ATTRIBUTES) ^ xor,
      `column ${i}: ${text}`,
    );
}

test('ASCII edits use original IDs, keep package bytes and survive worker cloning and language switching', async () => {
  const edits = asset(
    [
      entry('81:E3B2', 'A different new game label'),
      entry('81:E3D2', ''),
      entry('9D:F411', 'Huffman stays separate'),
    ],
    [entry('81:E3B2', 'NEU')],
  );
  const loaded = await loadCartridge((file) =>
    file === TEXT_EDITS_FILE ? new TextEncoder().encode(JSON.stringify(edits)) : readAsset(file),
  );
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  const game = new LiveGame(structuredClone(loaded), { languages: { de: german } });
  assert.equal(chars(languageMenuText(game.memory, 0x81e3b2)), edits.en[0].text);
  assert.equal(chars(languageMenuText(game.memory, 0x81e3d2)), '');
  assert.equal(languageMenuArrowShift(game.memory), -8);
  game.setLanguage('de');
  assert.equal(chars(languageMenuText(game.memory, 0x81e3b2)), 'NEU');
  assert.equal(chars(languageMenuText(game.memory, 0x81e3d2)), 'OPTIONEN');
  assert.equal(languageMenuArrowShift(game.memory), -10);
  game.setLanguage('en');
  assert.equal(chars(languageMenuText(game.memory, 0x81e3b2)), edits.en[0].text);
  assert.equal(new LiveGame(cartridge).memory.frontendTextEdits, null);
  const fallback = gameFor(edits, 'de');
  // A language asset missing a menu entry uses its English edit.
  fallback.languages.de = { ...german, menus: new Map(german.menus) };
  fallback.languages.de.menus.delete(0x81e3d2);
  fallback.setLanguage('de');
  assert.equal(chars(languageMenuText(fallback.memory, 0x81e3d2)), '');
  assert.equal(gameFor(asset([], [entry('81:E3D2', 'NEU')])).memory.frontendTextEdits, null);
});

test('ASCII input validates identities, printable glyphs, slot templates and the rendered 30-column limit', () => {
  for (const edits of [
    asset([entry('81:E3B3', 'bad')]),
    asset([entry('81:e3b2', 'bad')]),
    asset([entry('81:E3B2', 'x'), entry('81:E3B2', 'y')]),
    asset([], [entry('81:E3D2', 'x'), entry('81:E3D2', 'y')]),
    asset([entry('81:E3B2', null)]),
    asset([entry('81:E3B2', 'x'.repeat(FRONTEND_TEXT_LIMIT + 1))]),
    asset([entry('81:D582', 'x'.repeat(FRONTEND_TEXT_LIMIT + 1))]),
    asset([entry('81:E425', 'No slot')]),
    asset([entry('81:E433', '{slot} and {slot}')]),
    asset([entry('81:E3D2', '{slot}')]),
    asset([entry('81:E425', '{other}')]),
    asset([entry('81:E425', 'x'.repeat(FRONTEND_TEXT_LIMIT) + '{slot}')]),
  ])
    assert.throws(() => build(edits), JSON.stringify(edits));
  for (const bad of ['\0', '\n', '\r', '\t', '\x1f', '\x7f', 'ä', '😀'])
    for (const code of ['en', 'de'])
      assert.throws(
        () => build({ ...asset(), [code]: [entry('81:E3D2', bad)] }),
        /menu_edit_character_required/,
      );
  assert.doesNotThrow(() =>
    build(
      asset([
        entry('81:D582', 'x'.repeat(FRONTEND_TEXT_LIMIT)),
        entry('81:E3B2', 'x'.repeat(FRONTEND_TEXT_LIMIT)),
        entry('81:E425', 'x'.repeat(FRONTEND_TEXT_LIMIT - 1) + '{slot}'),
        entry('81:E433', ''),
      ]),
    ),
  );
});

test('real menu writers keep 30-character rows, arrows, highlight and disabled slots in bounds in both languages', () => {
  const main = 'M'.repeat(FRONTEND_TEXT_LIMIT),
    options = 'O'.repeat(FRONTEND_TEXT_LIMIT),
    copyright = 'C'.repeat(FRONTEND_TEXT_LIMIT),
    save = '1-' + 'S'.repeat(27) + '{slot}';
  const values = [
    entry('81:D582', copyright),
    entry('81:E3B2', main),
    entry('81:E4B9', options),
    entry('81:E425', save),
    entry('81:E433', 'Slot {slot}'),
  ];
  for (const language of ['en', 'de']) {
    const game = gameFor(asset(values, values), language),
      { memory } = game;
    seedFont(memory);
    memory.write8(MENU_TILEMAP - 1, 0xa5);
    memory.write8(MENU_TILEMAP + MENU_TILEMAP_BYTES, 0x5a);
    invoke(game, 0x81e38d);
    assert.equal(languageMenuArrowShift(memory), -16);
    row(memory, 0x404, main);
    row(memory, 0x584, language === 'de' ? 'MITWIRKENDE' : 'CREDITS');
    row(memory, 0x684, copyright);
    invoke(game, 0x81e343, { a: 0 });
    row(memory, 0x400, '#');
    assert.equal(tile(memory, 0x402), MENU_TEXT_ATTRIBUTES, 'one blank tile before the label');
    const before = Array.from({ length: 32 }, (_, i) => tile(memory, 0x400 + i * 2));
    invoke(game, 0x81e371);
    before.forEach((value, i) =>
      assert.equal(tile(memory, 0x400 + i * 2), value ^ MENU_HIGHLIGHT_TOGGLE),
    );
    memory.write8(SETTINGS_CONTROL, 1);
    invoke(game, 0x81e446);
    row(memory, 0x404, options);
    memory.write8(SETTINGS_CONTROL, 0);
    invoke(game, 0x81e446);
    row(memory, 0x404, language === 'en' ? 'CONTROL TYPE B' : 'STEUERUNG TYP B');
    assert.equal(
      languageMenuArrowShift(memory),
      -16,
      'inactive long alternatives keep the shared column',
    );
    invoke(game, 0x81e3da);
    // Zero SRAM has no valid slots. The explicit token is the last column;
    // a literal '1' at the start must not be overwritten for slots 3/4.
    for (const slot of [0, 2, 3])
      row(memory, 0x404 + slot * 0x80, save.replace('{slot}', String(slot + 1)), MENU_DISABLED_XOR);
    row(memory, 0x484, 'Slot 2', MENU_DISABLED_XOR);
    memory.write16(DP_MENU_CURSOR, 0);
    invoke(game, 0x81e343, { a: 4 });
    row(memory, 0x400, ' ');
    row(memory, 0x600, '#');
    assert.equal(memory.read8(MENU_TILEMAP - 1), 0xa5);
    assert.equal(memory.read8(MENU_TILEMAP + MENU_TILEMAP_BYTES), 0x5a);
  }
});

test('short and empty edits preserve row tails and do not manufacture a save digit', () => {
  for (const value of ['', 'X', 'A much longer menu label']) {
    const game = gameFor(asset([entry('81:E3D2', value), entry('81:E425', '')]));
    seedFont(game.memory);
    game.memory.wram.fill(
      0xa5,
      MENU_TILEMAP & 0xffff,
      (MENU_TILEMAP & 0xffff) + MENU_TILEMAP_BYTES,
    );
    game.memory.write16(DP_MENU_TEXT_XOR, 0);
    const shift = languageMenuText(game.memory, 0x81e3d2).shift;
    invoke(game, 0x81d531, { x: 0x514, y: 0xe3d2 });
    row(game.memory, 0x514 + shift, value);
    assert.equal(tile(game.memory, 0x514 + shift + value.length * 2), 0xa5a5);
    invoke(game, 0x81e3da);
    const column = 0x14 + languageMenuArrowShift(game.memory);
    for (const slot of [0, 2, 3]) {
      assert.equal(tile(game.memory, 0x400 + slot * 0x80 + column - 2), MENU_TEXT_ATTRIBUTES);
      for (let i = column; i < 0x40; i += 2)
        assert.equal(tile(game.memory, 0x400 + slot * 0x80 + i), MENU_TEXT_ATTRIBUTES);
    }
  }
});

test('switching language in an open menu keeps its arrow aligned until the labels are rebuilt', () => {
  const game = gameFor(asset([entry('81:E3B2', 'M'.repeat(FRONTEND_TEXT_LIMIT))]));
  const { memory } = game;
  seedFont(memory);
  invoke(game, 0x81e38d);
  invoke(game, 0x81e343, { a: 0 });
  game.setLanguage('de');
  invoke(game, 0x81e343, { a: 1 });
  row(memory, 0x400, ' ');
  row(memory, 0x480, '#');
  row(memory, 0x404, 'M'.repeat(FRONTEND_TEXT_LIMIT));
  invoke(game, 0x81e38d);
  invoke(game, 0x81e343, { a: 0 });
  row(memory, 0x406, '#');
  row(memory, 0x40a, 'NEUES SPIEL STARTEN');
});

test('edited save templates also retain the original two-slot menu and exit row', () => {
  const game = gameFor(
    asset([entry('81:E425', 'ONE {slot}'), entry('81:E433', 'TWO {slot}')]),
    'en',
    { gameplay: ORIGINAL_GAMEPLAY },
  );
  seedFont(game.memory);
  invoke(game, 0x81e3da);
  row(game.memory, 0x414, 'ONE 1', MENU_DISABLED_XOR);
  row(game.memory, 0x494, 'TWO 2', MENU_DISABLED_XOR);
  row(game.memory, 0x514, 'EXIT');
  for (let i = 0; i < 32; i++) assert.equal(tile(game.memory, 0x580 + 2 * i), MENU_TEXT_ATTRIBUTES);
});

test(
  'live title edits keep cursor navigation and disabled slots for four saved games',
  { timeout: 180000 },
  () => {
    const label = 'S'.repeat(FRONTEND_TEXT_LIMIT),
      source = new Uint8Array(loadSave('apartment'));
    const sram = new Uint8Array(0x4000);
    sram.set(source);
    sram.set(source.subarray(0, 0xffe), SLOT_OFFSETS_FOUR[3]);
    const pad = (k) =>
      (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304)
        ? 0x1000
        : (k >= 3150 && k < 3154) || (k >= 3450 && k < 3454)
          ? 0x0400
          : 0;
    for (const language of ['en', 'de']) {
      const values = [
        entry('81:E3C1', label),
        entry('81:E425', 'RESTORE {slot}'),
        entry('81:E433', 'RESTORE {slot}'),
      ];
      const game = gameFor(asset(values, values), language, { sram, pad });
      while (game.nmis < 3250) game.step();
      // The real font may alias glyphs; compare with its actual tile words.
      const expected =
        game.memory.read16(MENU_FONT_TILES + 2 * ('S'.charCodeAt(0) - 0x20)) | MENU_TEXT_ATTRIBUTES;
      for (let i = 0; i < label.length; i++)
        assert.equal(tile(game.memory, 0x484 + i * 2), expected);
      while (game.nmis < 3480) game.step();
      assert.equal(game.memory.read16(DP_MENU_CURSOR), 3, 'DOWN skips the two empty slots');
      const arrow = game.memory.read16(MENU_FONT_TILES + 2 * (0x23 - 0x20)) | MENU_TEXT_ATTRIBUTES;
      assert.equal(tile(game.memory, 0x580), arrow);
      for (let slot = 0; slot < 4; slot++) {
        const code = 0x31 + slot,
          digit = game.memory.read16(MENU_FONT_TILES + 2 * (code - 0x20));
        assert.equal(
          tile(game.memory, 0x404 + slot * 0x80 + 2 * 8),
          (digit | MENU_TEXT_ATTRIBUTES) ^ ([1, 2].includes(slot) ? MENU_DISABLED_XOR : 0),
        );
      }
      assert.equal(game.dataOutsideBlank, 0);
    }
  },
);
