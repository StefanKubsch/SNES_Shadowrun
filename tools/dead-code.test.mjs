import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const map = JSON.parse(readFileSync('analysis/vm-rom-map.json', 'utf8'));
const raw = JSON.parse(readFileSync('assets/vm-raw.json', 'utf8'));
// Code of a class is absent from the data package (build-cartridge.mjs), except a
// first byte behind data, which vm-raw.json keeps for word reads at the end of data.
function assertAbsent(name) {
  const kept = new Set();
  for (const run of raw.code_bytes) {
    const cpu = parseInt(run.address.replace(':', ''), 16);
    for (let i = 0; i < run.hex.length / 2; i++) kept.add(((cpu >> 16) - 0x80) * 0x8000 + ((cpu & 0xFFFF) - 0x8000) + i);
  }
  const classOf = [];
  for (const r of map.ranges) for (let o = parseInt(r.rom_offset, 16); o < parseInt(r.rom_offset, 16) + r.length; o++) classOf[o] = r.class;
  for (const r of map.ranges.filter(r => r.class === name))
    for (let o = parseInt(r.rom_offset, 16); o < parseInt(r.rom_offset, 16) + r.length; o++)
      assert.equal(kept.has(o), !classOf[o - 1].startsWith('code'), `${name} ${o.toString(16)}`);
}

test('Dead code runs sit behind instructions without fallthrough and are kept as data', () => {
  assert.equal(map.dead_code.length, 19);
  for (const d of map.dead_code) assert.match(d.behind, / (RTS|RTL|RTI|JMP|JML|BRA|BRL)$/);
  const bytes = map.dead_code.reduce((n, d) => n + d.bytes, 0);
  assert.equal(bytes, 322);
  assert.equal(map.counts.code_dead, bytes);
  assertAbsent('code_dead');
  assert.equal(map.counts.unknown, 95);
});

test('Code reached only from natives no script names is its own class and left out of the package', () => {
  // The call_native handler 80:F4CB is the only reader of the native table
  // 82:D7B8 and takes the bytecode operand as index (tools/rom-map.mjs).
  assert.equal(map.unused_natives.length, 37);
  const bytes = map.unused_natives.reduce((n, u) => n + u.bytes, 0);
  assert.equal(bytes, 452);
  assert.equal(map.counts.code_unused_native, bytes);
  assert.deepEqual(map.unused_natives.find(u => u.id === '82'), {id: '82', entry: '80:D5D1', bytes: 51});
  assertAbsent('code_unused_native');
});

test('Code reached only from opcodes no script contains is its own class and left out of the package', () => {
  // The dispatcher 80:F390 (JMP (F2B4,X)) is the only reader of the opcode
  // table and takes the bytecode byte as index (tools/rom-map.mjs).
  const bytes = map.unused_opcodes.reduce((n, u) => n + u.bytes, 0);
  assert.equal(bytes, 341);
  assert.equal(map.counts.code_unused_opcode, bytes);
  assert.equal(map.unused_opcodes.reduce((n, u) => n + u.opcodes.length, 0), 48);
  assert.deepEqual(map.unused_opcodes.find(u => u.entry === '80:F5CC'), {opcodes: ['6A'], entry: '80:F5CC', bytes: 18});
  assertAbsent('code_unused_opcode');
});
