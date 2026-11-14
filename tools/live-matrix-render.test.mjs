import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { exploreLive } from './explore-live.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';

test(
  'live system 3 matrix initializes and renders its 16x16 BG layers, then returns to apartment',
  { timeout: 900000 },
  () => {
    const observed = [],
      errors = [];
    const plan = [
      ['wait', 2989],
      ['press', 'start', 150],
      ['press', 'down', 150],
      ['press', 'start', 300],
      ['press', 'start', 1400],
      ['matrix', 3, 345, 0, 3],
      ['wait', 1100],
      ['press', 'x', 30],
      ['wait', 300],
    ];
    const result = exploreLive(plan, {
      cartridge,
      sram: loadSave('apartment'),
      onCommand: (index, command, game) => {
        if (command[0] === 'matrix')
          game.frames.onNmi = () => {
            const p = game.bus.ppu,
              mode = p.register(0x2105),
              tm = p.register(0x212c),
              ts = p.register(0x212d);
            observed.push({ mode, tm, ts });
            try {
              renderMode1Frame(p, { objects: true, rows: hdmaRows(game.bus) });
            } catch (error) {
              if (errors.length === 0)
                errors.push({ frame: game.nmis, message: error.message, details: error.details });
            }
          };
      },
    });
    assert.ok(
      observed.some((v) => (v.mode & 0x33) === 0x31),
      'recorded system 3 enables 16x16 BG1/BG2 in mode 1',
    );
    assert.ok(
      observed.some((v) => (v.tm & 0x03) === 0x03 && (v.ts & 0x03) === 0x00),
      'matrix alternates enabled TM layers and TS state',
    );
    assert.deepEqual(errors, [], 'each observed frame renders');
    assert.equal(
      result.game.memory.wram[0x2de2] | (result.game.memory.wram[0x2de3] << 8),
      345,
      'jack out returns to room 345',
    );
  },
);
