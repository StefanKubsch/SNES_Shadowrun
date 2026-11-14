// Performance of the product frame path (src/browser/game-worker.mjs without the page):
// the live game from reset over title and menu into the morgue, with picture and sound
// output per NMI. Reports milliseconds per NMI split into picture (onNmi: renderMode1Frame,
// hdmaRows), audio time (Apu.advance) and the rest (VM, natives, devices), plus heap use.
// Usage: node --expose-gc tools/live-benchmark.mjs [nmis]
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';

// Start on the title and in the menu, then A taps through the opening dialog, then a
// walk in a square (up, right, down, left).
const DIRECTIONS = [0x0800, 0x0100, 0x0400, 0x0200];
const pad = (k) =>
  k >= 3000 && k < 3400
    ? k % 150 < 4
      ? 0x1000
      : 0
    : k >= 3400 && k < 5200
      ? k % 60 < 4
        ? 0x0080
        : 0
      : k >= 5200
        ? DIRECTIONS[Math.floor(k / 90) % 4]
        : 0;

export function liveBenchmark(nmis = 9000) {
  const game = new LiveGame(cartridge, {
    pad,
    counter: counterBytes(12345),
    onFrame: () => game.apu.takeOutput(),
  });
  game.apu.enableOutput(256);
  let audioMs = 0,
    pictureMs = 0;
  const advance = game.apu.advance.bind(game.apu),
    onNmi = game.frames.onNmi;
  game.apu.advance = (samples) => {
    const start = performance.now();
    advance(samples);
    audioMs += performance.now() - start;
  };
  game.frames.onNmi = (k) => {
    const start = performance.now();
    onNmi(k);
    pictureMs += performance.now() - start;
  };
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed,
    start = performance.now();
  while (game.nmis < nmis) game.step();
  const ms = performance.now() - start,
    n = game.nmis,
    per = (value) => +(value / n).toFixed(3);
  globalThis.gc?.();
  return {
    nmis: n,
    seconds: +(ms / 1000).toFixed(2),
    msPerNmi: per(ms),
    pictureMsPerNmi: per(pictureMs),
    audioMsPerNmi: per(audioMs),
    restMsPerNmi: per(ms - pictureMs - audioMs),
    ownsGame: game.driver.ownsGame,
    heapUsedBytes: process.memoryUsage().heapUsed,
    heapGrowthBytes: process.memoryUsage().heapUsed - heapBefore,
    gcMeasured: typeof globalThis.gc === 'function',
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`)
  console.log(JSON.stringify(liveBenchmark(Number(process.argv[2] ?? 9000)), null, 2));
