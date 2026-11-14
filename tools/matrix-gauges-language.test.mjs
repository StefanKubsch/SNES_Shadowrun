import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { exploreLive } from './explore-live.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { buildLanguage } from '../src/data/language.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';

const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json')));
const plan = [
  ['wait', 2989],
  ['press', 'start', 150],
  ['press', 'down', 150],
  ['press', 'start', 300],
  ['press', 'start', 1400],
  ['matrix', 3, 345, 0, 3],
  ['wait', 1100],
];

test(
  'German matrix gauges use the original shared font, matching English pixels and gauge words',
  { timeout: 180000 },
  () => {
    const results = [];
    for (const language of ['en', 'de']) {
      const result = exploreLive(plan, {
        cartridge,
        sram: loadSave('apartment'),
        onCommand(index, command, game) {
          if (command[0] === 'matrix') {
            game.languages.de = german;
            game.setLanguage(language);
          }
        },
      });
      const { game } = result,
        memory = game.memory;
      assert.equal(memory.read16(0x175c), 0x1a16, 'the system 3 matrix grid is active');
      const bits = lzBits((n) => memory.read8(0x80a033 + n));
      const font = lzDecode(
        (n) => memory.read8(0x85fc15 + 2 + n),
        memory.read16(0x85fc15),
        bits,
      ).data;
      const map = lzDecode(
        (n) => memory.read8(0x85fd38 + 2 + n),
        memory.read16(0x85fd38),
        bits,
      ).data;
      assert.deepEqual(
        game.bus.ppu.vram.subarray(0, font.length),
        font,
        `${language}: original gauge graphics reached VRAM`,
      );
      assert.deepEqual(
        memory.wram.subarray(0x100c0, 0x100d4),
        map.subarray(0xc0, 0xd4),
        `${language}: full, partial, empty and cap tile words remain original`,
      );
      results.push({
        frame: renderMode1Frame(game.bus.ppu, { objects: true, rows: hdmaRows(game.bus) }),
        health: memory.read16(0x1754),
        healthRow: game.bus.ppu.vram.slice(0xec1 * 2, 0xec1 * 2 + 28),
        memoryRow: game.bus.ppu.vram.slice(0xf01 * 2, 0xf01 * 2 + 20),
      });
    }
    assert.ok(results[0].health > 0);
    assert.deepEqual(
      results[1],
      results[0],
      'language changes neither gauge values nor actual rendered matrix pixels',
    );
  },
);
