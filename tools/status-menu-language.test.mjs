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
      const sceneTiles = game.bus.ppu.vram.slice(0xe000, 0xf000);
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
            const width = memory.read16(0x7e2020 + submenu),
              extra = choice === 2 ? 0 : 3;
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
            game.bus.ppu.vram.slice(0xe000, 0xf000),
            sceneTiles,
            `choice ${choice}, mask ${mask}: no persistent scene tile corruption`,
          );
        }
      }
    },
  );
