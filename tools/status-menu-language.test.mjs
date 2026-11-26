import { toWram } from './to-wram.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { buildLanguage, languageTextWidth } from '../src/data/language.mjs';
import { applyCheats } from '../src/game/cheats.mjs';
import { CHEAT_MASK } from '../src/game/cheat-settings.mjs';

const languages = { de: buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json'))) };
for (const language of ['en', 'de'])
  test(
    `${language}: status entries and all submenus fit with cheats off/on and leave scene tiles intact`,
    { timeout: 120000 },
    () => {
      let game,
        mask = 0,
        word = 0,
        wordUntil = 0;
      game = new LiveGame(cartridge, {
        languages,
        language,
        counter: counterBytes(0x1234567),
        pad: (k) => {
          game.vm.cheats = mask;
          applyCheats(game);
          if (k < 5000) return [3000, 3300, 3600].some((at) => k >= at && k < at + 4) ? 0x1000 : 0;
          return k < wordUntil ? word : 0;
        },
      });
      const steps = (frames) => {
        const end = game.nmis + frames;
        while (game.nmis < end) game.step();
      };
      const press = (bits) => {
        word = bits;
        wordUntil = game.nmis + 2;
        steps(12);
        word = 0;
        steps(8);
      };
      while (game.nmis < 5100) game.step();
      const memory = game.memory;
      // Window allocation ends at tile 2400 (F963). Its 2-bpp glyph uploads
      // belong below E000; overflowing German rows used to overwrite the
      // room's graphics here and leave cyan floor artifacts after closing.
      const sceneTiles = game.screen.vram.slice(0xe000, 0xf000);
      for (mask of [0, CHEAT_MASK]) {
        for (let choice = 1; choice <= 6; choice++) {
          press(0x1000);
          steps(200);
          assert.equal(memory.read16(0x1f62), 65535);
          const menu = memory.read16(0x1f4e),
            columns = memory.read16(0x7e2020 + menu);
          if (language === 'en') assert.equal(columns, 8, 'English keeps its original layout');
          else
            for (let row = 0; row < 7; row++)
              assert.ok(
                languageTextWidth(memory, memory.read16(0x80ed1e + row * 2)) < (columns - 3) * 8,
                `status label ${row} fits beside the arrow on one row`,
              );
          for (let i = 0; i < choice; i++) press(0x0400);
          assert.equal(memory.read16(0x1d97), choice * 2, 'the intended submenu is selected');
          press(0x1000);
          steps(200);
          const submenu = memory.read16(0x1f50);
          if (language === 'de' && memory.read16(0x204) === 4 && [1, 2, 3, 4].includes(choice)) {
            // Item lists reserve count columns only when a row shows a count.
            let counted = false;
            for (let offset = 2; offset < 16 && memory.read16(0x1da9 + offset); offset += 2)
              counted ||= memory.read16(0x1eaf + offset) !== 0;
            const width = memory.read16(0x7e2020 + submenu),
              extra = choice !== 2 && counted ? 3 : 0;
            for (let offset = 0; offset < 16; offset += 2) {
              const id = memory.read16(0x1da9 + offset);
              if (!id) break;
              assert.ok(
                languageTextWidth(memory, id) < (width - 3 - extra) * 8,
                `submenu ${choice}, text ${id.toString(16)} fits its row and values`,
              );
            }
          }
          for (let tries = 0; tries < 3 && memory.read16(0x1f62); tries++) {
            press(0x2000);
            steps(25);
          }
          assert.equal(memory.read16(0x1f62), 0, 'status closes back to the scene');
          assert.equal(memory.read16(0x204), 65534, 'all windows are released');
          assert.deepEqual(
            game.screen.vram.slice(0xe000, 0xf000),
            sceneTiles,
            `choice ${choice}, mask ${mask}: no persistent scene tile corruption`,
          );
        }
      }
    },
  );

// User report 2026-11-17: examining DF_ÄRGER in the German status screen drew its // language-ok
// description (text number 561) over the status window. The status window (672
// tiles), the translated menu and item list leave fewer text tiles than the notice
// needs, and F963 wraps past 2400 to the status window's first tiles. The notice now
// stays below 2400 and shows its text in pages, each after a confirming key.
test(
  'de: a long item description in the status screen pages instead of wrapping its tiles',
  {
    timeout: 120000,
  },
  () => {
    let game,
      word = 0,
      wordUntil = 0;
    game = new LiveGame(cartridge, {
      languages,
      language: 'de',
      counter: counterBytes(0x1234567),
      pad: (k) => {
        if (k < 5000) return [3000, 3300, 3600].some((at) => k >= at && k < at + 4) ? 0x1000 : 0;
        return k < wordUntil ? word : 0;
      },
    });
    const steps = (frames) => {
      const end = game.nmis + frames;
      while (game.nmis < end) game.step();
    };
    const press = (bits) => {
      word = bits;
      wordUntil = game.nmis + 2;
      steps(12);
      word = 0;
      steps(8);
    };
    while (game.nmis < 5100) game.step();
    const memory = game.memory,
      notice = 6,
      tileEnd = () => memory.read16(0x7e2060 + notice) + memory.read16(0x7e20a0 + notice);
    // Jake (object 08B2) holds DF_ÄRGER (actor 5544, state record 39F9). // language-ok
    memory.write16(0x7e0000 + 0x39f9 + 3, 0x08b2);
    press(0x1000);
    steps(200);
    press(0x0400);
    press(0x1000);
    steps(200);
    assert.equal(memory.read16(0x1e2d + 2), 5544, 'DF_ÄRGER heads the item list'); // language-ok
    press(0x0400);
    press(0x1000);
    steps(300);
    press(0x0400);
    press(0x0080);
    steps(100);
    const status = memory.read16(0x7e2060);
    assert.equal(memory.read16(0x204), notice, 'the description notice is the last window');
    assert.ok(memory.read16(0x7e2060 + notice) > status, 'the notice keeps its own tiles');
    assert.ok(tileEnd() < 0x2400, 'the notice ends below tile 2400');
    const pages = [];
    for (let page = 0; page < 2; page++) {
      const state = toWram(memory);
      pages.push(Buffer.from(state.subarray(0x21a0, state.indexOf(0, 0x21a0))));
      press(0x0080);
      steps(100);
    }
    assert.equal(memory.read16(0x204), 4, 'the second key releases the notice');
    assert.equal(
      pages.map((page) => page.toString('latin1')).join(' '),
      Buffer.from(languages.de.texts.get(0xa968)).toString('latin1'),
      'both pages together show the complete description',
    );
  },
);
