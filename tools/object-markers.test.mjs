import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import {
  drawObjectMarkers,
  DOOR_KINDS,
  markerPulse,
  markersAllowed,
  usableKind,
  usableObjectBoxes,
} from '../src/video/object-markers.mjs';

// Object markers (src/video/object-markers.mjs, docs/OBJECT-MARKERS.md).
const START = 0x1000,
  DOWN = 0x0400;
const title = (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : k >= 3150 && k < 3154
      ? DOWN
      : 0;
const word = (wram, at) => wram[at] | (wram[at + 1] << 8);

test('items and devices are marked, people, creatures and doors are not', () => {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  // Filing Cabinet, Video Phone, Scalpel, Beretta Pistol, Iced Tea, Door Key, Bronze Gate
  for (const kind of [0x21, 0x22, 0x4e, 0xa8, 0x7b, 0x7c, 0x83])
    assert.ok(usableKind(memory, kind));
  // Mortician, Me (Jake), Orc, Gang member, Akimi, Naga, Sentry Gun; 1F has no name;
  // Wooden Door, Elevator Door
  for (const kind of [0x03, 0x0b, 0x0f, 0x5c, 0xa0, 0xdf, 0x66, 0x1f, 0x18, 0x93])
    assert.equal(usableKind(memory, kind), false);
});

test('the door list holds exactly the kinds named as a door', () => {
  const { kinds } = JSON.parse(readFileSync('assets/vm-kinds.json', 'utf8')),
    names = new Map(
      JSON.parse(readFileSync('assets/vm-texts.json', 'utf8')).texts.map((t) => [
        t.address,
        t.text,
      ]),
    ),
    doors = kinds.flatMap((entry, kind) =>
      entry.name && /\bdoors?$/i.test(names.get(entry.name)) ? [kind] : [],
    );
  assert.deepEqual(
    doors,
    [...DOOR_KINDS].sort((a, b) => a - b),
  );
});

test('the marker is a short pulse at the start of each period', () => {
  assert.equal(markerPulse(0), 0);
  assert.equal(markerPulse(20), 0.5);
  assert.equal(markerPulse(100), -1);
  assert.equal(markerPulse(200), 0);
  const box = [[10, 20, 30, 40, 0]],
    pixels = new Uint8ClampedArray(256 * 224 * 4);
  for (const t of [0, -1]) drawObjectMarkers(pixels, box, t);
  assert.ok(
    pixels.every((v) => v === 0),
    'no pulse, no change',
  );
  drawObjectMarkers(pixels, box, 0.5);
  const red = (x, y) => pixels[(y * 256 + x) * 4];
  // A ring of radius 2.5 around the box centre (20.5, 30.5), strongest at mid-pulse.
  assert.ok(red(23, 30) > 100 && red(17, 30) > 100 && red(20, 27) > 100 && red(20, 33) > 100);
  assert.equal(red(20, 30), 0, 'the object centre stays visible');
  assert.ok(red(10, 20) === 0 && red(30, 40) === 0, 'no box corners');
  let lit = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i]) lit++;
  assert.ok(lit > 12 && lit < 60, 'a small ring only');
});

// The marked rectangle is the glove's own hit area: with the glove at the
// centre of each box, the game's check 80:BCBE names exactly that object.
test(
  'each marker in the apartment is where the glove names its object',
  { timeout: 900000 },
  () => {
    const load = (pad, onFrame) =>
      new LiveGame(cartridge, { sram: new Uint8Array(loadSave('apartment')), pad, onFrame });
    const probe = load(title);
    while (probe.nmis < 4000) probe.step();
    assert.ok(markersAllowed(probe));
    const boxes = usableObjectBoxes(probe.memory),
      kinds = boxes.map((box) => word(probe.memory.wram, 0x3f28 + box[4]));
    // Bed, Filing Cabinet, Ripped Note, Video Phone; not Jake or the Wooden Door.
    assert.deepEqual(kinds, [0xd9, 0x21, 0xff, 0x22]);
    for (const [x0, y0, x1, y1, object] of boxes) {
      let driver = null;
      const game = load((k) => {
        if (k < 4000) return title(k);
        driver ??= livePlanDriver(
          [
            ['press', 'b'],
            ['glove', (x0 + x1) >> 1, (y0 + y1) >> 1],
            ['wait', 20],
          ],
          game.memory.wram,
          () => game.driver.roundsCompleted,
        );
        return driver.pad(k);
      });
      while (!driver?.done()) game.step();
      const wram = game.memory.wram;
      assert.equal(word(wram, 0x01d8), 0xffff, 'action glove open');
      assert.ok(!(word(wram, 0x01da) & 0x8000), 'an object is under the glove');
      assert.equal(word(wram, 0x01de), object);
    }
  },
);
