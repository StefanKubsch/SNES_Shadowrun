import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeOrphanScripts, checkOrphan, checkTail } from '../src/data/orphan-scripts.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';

const rom = readFileSync('Shadowrun (E).smc');
const asset = JSON.parse(readFileSync('assets/vm-orphan-scripts.json', 'utf8'));
const bundle = JSON.parse(readFileSync('assets/scripts.json', 'utf8'));
const layout = JSON.parse(readFileSync('assets/vm-cartridge.json', 'utf8')).scripts;
const counts = { scripts: bundle.scripts.length, natives: bundle.nativeFunctions.length };
const cpuOf = (address) => parseInt(address.replace(':', ''), 16);

test('Placing the unreferenced scripts and the tail restores the original bytes', () => {
  assert.equal(asset.scripts.length, 8);
  assert.deepEqual(
    asset.tails.map((t) => [t.address, t.script, t.entry, t.bytecode.length]),
    [['9C:E720', 0x33d, 7, 71]],
  );
  const out = new Uint8Array(rom.length),
    present = new Uint8Array(rom.length);
  placeOrphanScripts(out, present, asset, layout, bundle);
  let placed = 0;
  for (const { address, localBytes, stackHeaderBytes, bytecode } of asset.scripts) {
    [localBytes, stackHeaderBytes, ...bytecode].forEach((v, i) =>
      assert.equal(rom[romOffset(cpuOf(address) + i)], v),
    );
    placed += 2 + bytecode.length;
  }
  for (const { address, bytecode } of asset.tails) {
    bytecode.forEach((v, i) => assert.equal(rom[romOffset(cpuOf(address) + i)], v));
    placed += bytecode.length;
  }
  for (let o = 0; o < rom.length; o++) if (present[o]) assert.equal(out[o], rom[o]);
  assert.equal(
    present.reduce((n, v) => n + v, 0),
    placed,
  );
  assert.equal(placed, 349);
  assert.throws(
    () => placeOrphanScripts(out, present, asset, layout, bundle),
    /orphan_layout_changed/,
  );
});

test('Only complete scripts and tails in their owner frame are accepted', () => {
  assert.equal(checkOrphan(Uint8Array.of(0x48, 0, 0), counts), 3);
  assert.throws(() => checkOrphan(Uint8Array.of(0x56, 0x56), counts), /not a complete script/);
  assert.throws(() => checkOrphan(Uint8Array.of(0x58, 0xff, 0x56), counts), /outside the tables/);
  const owner = Uint8Array.from(bundle.scripts[0x33d].bytecode),
    tail = Uint8Array.from(asset.tails[0].bytecode);
  assert.equal(checkTail(owner, tail), 71);
  // Decoded on its own, the loop jump of the tail misses its frame.
  assert.throws(() => checkTail(Uint8Array.of(0x56), tail));
  const fresh = () => [new Uint8Array(rom.length), new Uint8Array(rom.length)];
  const bad = [
    {
      scripts: [{ ...asset.scripts[0], bytecode: asset.scripts[0].bytecode.slice(0, -1) }],
      tails: [],
    },
    { scripts: [{ ...asset.scripts[0], address: '7E:0000' }], tails: [] },
    { scripts: [], tails: [{ ...asset.tails[0], entry: 6 }] },
    { scripts: [], tails: [{ ...asset.tails[0], address: '9C:E721' }] },
  ];
  for (const data of bad)
    assert.throws(
      () => placeOrphanScripts(...fresh(), data, layout, bundle),
      /orphan_script_required/,
    );
});
