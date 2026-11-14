import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { buildLanguage, GERMAN, ENGLISH } from '../src/data/language.mjs';
import {
  startMenuWaiting,
  endingMusic,
  musicSilent,
  menuCreditsRunning,
} from '../src/game/credits.mjs';

// The fourth in-game menu row (src/game/credits.mjs), live in both languages from power-on: Start opens
// the start menu 81:E14A; the request leaves its wait loop 81:E29F like the timeout, and the
// frontend loop 80:A18C calls the sequence 81:CDF8 with A = 5 instead of the attract game.
// Every picture is rendered (H-DMA to TM, BG2HOFS and window 1, src/video/hdma.mjs); the German
// credit pages come from the language bank (stream 81:F2BD to 7E:62A8, the bank's last stream
// read with the unpacker's word fetch). B ends the sequence, and the start menu waits again.
// The start menu plays no music; the credits play the ending room's music (81:EF47 with the
// music byte of room 5) and stop it afterwards (81:EF94).
const START = 0x1000,
  B = 0x8000,
  CREDIT_PAGES = 0x62a8,
  SHOWN = 1500,
  WINDOW = 200, // NMIs per loudness window
  AUDIBLE = 1000, // peak sample of every window during the credits
  SONG = 0x8b; // sound driver ARAM: current song (src/apu/sound-driver-memory.mjs)
for (const language of [ENGLISH, GERMAN])
  test(
    `the fourth start-menu row plays the ${language} credits and returns`,
    {
      timeout: 900000,
    },
    () => {
      const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8')));
      let text = '',
        requested = -1,
        ended = -1,
        pictures = 0,
        phase = 'title',
        music = null,
        peak = 0,
        windowEnd = 0,
        menuRead = -1,
        selected = false;
      const peaks = [];
      const game = new LiveGame(cartridge, {
        languages: { [GERMAN]: german },
        language,
        pad: (k) => {
          if (phase === 'title') {
            if (startMenuWaiting(game)) {
              menuRead = game.nmis;
              phase = 'menu';
              return 0;
            }
            return k >= 3000 && k % 150 < 4 ? START : 0;
          }
          if (phase === 'menu') {
            const elapsed = game.nmis - menuRead;
            if (language === GERMAN) {
              if (elapsed < 4) return 0x0800; // Up wraps from New Game to Credits.
              if (elapsed < 8) return 0;
            } else if (elapsed < 24) {
              return elapsed % 8 < 4 ? 0x0400 : 0; // Down crosses Saved Game and Options.
            }
            selected = game.memory.read16(0x0e) === 3;
            requested = game.nmis;
            phase = 'credits';
            game.apu.enableOutput(1);
            return B;
          }
          if (phase === 'credits' && pictures > SHOWN) {
            const pages = game.memory.wram.subarray(CREDIT_PAGES, CREDIT_PAGES + 0x400);
            text = Buffer.from(pages).toString('latin1');
            ended = game.nmis;
            phase = 'ending';
          }
          return phase === 'ending' && game.nmis - ended < 4
            ? language === GERMAN
              ? B
              : START
            : 0;
        },
        onFrame: () => {
          if (requested >= 0) pictures++;
        },
      });
      let left = false;
      while (game.nmis < 12000 && !(phase === 'ending' && left && startMenuWaiting(game))) {
        game.step();
        if (requested >= 0 && !startMenuWaiting(game)) left = true;
        if (phase === 'credits' && menuCreditsRunning(game.vm)) {
          music ??= { silent: musicSilent(game.memory.wram), song: game.apu.ram[SONG] !== 0 };
          for (const v of game.apu.takeOutput()) peak = Math.max(peak, Math.abs(v));
          if (game.nmis >= windowEnd) {
            if (windowEnd) peaks.push(peak);
            peak = 0;
            windowEnd = game.nmis + WINDOW;
          }
        } else if (requested >= 0) game.apu.takeOutput();
      }
      assert.ok(requested >= 0, 'requested while the start menu waited');
      assert.ok(left, 'the menu left its wait loop');
      assert.ok(selected, 'navigation selects the fourth row');
      assert.match(text, language === GERMAN ? /SYSTEMPROGRAMMIERUNG/ : /PROGRAMMING/i);
      assert.ok(ended > 0, 'exit pressed during the credits');
      assert.ok(startMenuWaiting(game), 'the start menu waits again');
      assert.ok(game.nmis - ended < 1000, `back soon after exit (${game.nmis - ended} NMIs)`);
      assert.equal(game.vm.creditsRequested, false, 'request taken');
      assert.deepEqual(music, { silent: false, song: true }, 'a song plays during the credits');
      assert.equal(endingMusic(game.memory), 5, 'room 5 plays music 5');
      assert.ok(peaks.length >= 5, `${peaks.length} loudness windows`);
      assert.ok(
        peaks.every((p) => p >= AUDIBLE),
        `music audible in every window: ${peaks.join(' ')}`,
      );
      assert.ok(musicSilent(game.memory.wram), 'the music stops after the credits');
    },
  );
