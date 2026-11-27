import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  decodeInstruction,
  encodeInstruction,
  decodeScript,
  encodeScript,
} from '../src/script/codec.mjs';
import { scriptOpcodes, trapOpcodes } from '../src/script/opcodes.mjs';
import { inspectRom } from './rom.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { createTask, runTask, EXIT_END } from './script-interpreter.mjs';

// Run script id with its argument words on the reference interpreter to its end.
function runScript(memory, id, args) {
  const exit = runTask(memory, createTask(memory, id, args));
  assert.equal(exit.kind, EXIT_END);
  return exit;
}
import { inspectScriptTables } from './scripts.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const { bytes } = inspectRom(rom);
const inventory = inspectScriptTables(bytes);
const slice = (id) => {
  const entry = inventory.scripts[id];
  const offset = parseInt(entry.rom_offset, 16);
  const next = Math.min(
    ...inventory.scripts.map((s) => parseInt(s.rom_offset, 16)).filter((o) => o > offset),
    bytes.length,
  );
  return {
    entry,
    code: bytes.subarray(offset + 2, Math.min(next, (Math.floor(offset / 0x8000) + 1) * 0x8000)),
  };
};

test('Every declared event opcode matches the European dispatch table', () => {
  assert.equal(Object.keys(scriptOpcodes).length, 69);
  assert.equal(Object.keys(scriptOpcodes).length + trapOpcodes.length, 98);
  for (const spec of Object.values(scriptOpcodes))
    assert.equal(bytes.readUInt16LE(0x72b4 + spec.opcode), spec.handler);
  for (const op of trapOpcodes) {
    const target = bytes.readUInt16LE(0x72b4 + op);
    assert.ok(
      target === 0xf927 ||
        bytes
          .subarray(target - 0x8000, target - 0x8000 + 3)
          .equals(Buffer.from([0x4c, 0x27, 0xf9])),
    );
  }
});

test('Instruction operands round-trip without original-byte copying', () => {
  for (const spec of Object.values(scriptOpcodes)) {
    for (const value of spec.operand === 'none'
      ? [null]
      : spec.operand === 'u8'
        ? [0, 127, 255]
        : [0, 255, 256, 65535]) {
      const encoded = encodeInstruction({ opcode: spec.opcode, operand: value });
      const decoded = decodeInstruction(encoded, 0);
      assert.equal(decoded.operand, value);
      assert.deepEqual(encodeInstruction(decoded), encoded);
    }
  }
  assert.throws(() => encodeInstruction({ opcode: 0, operand: 256 }));
  assert.throws(() => decodeInstruction(Uint8Array.of(0x14, 0x01), 0), /Truncated/);
  assert.throws(() => decodeInstruction(Uint8Array.of(0x06), 0), /Original trap/);
  assert.throws(() => decodeInstruction(Uint8Array.of(0x01), 0), /Unknown/);
});

test('CFG checks both branch paths and rejects targets inside operands', () => {
  const code = Uint8Array.from([0xc0, 0x44, 0x07, 0x00, 0x00, 0xff, 0x56, 0xc0, 0x56]);
  const decoded = decodeScript(code);
  assert.deepEqual(
    decoded.instructions.map((i) => i.pc),
    [0, 1, 4, 6, 7, 8],
  );
  assert.deepEqual(encodeScript(decoded), code);
  const bad = Uint8Array.from(code);
  bad[2] = 5;
  assert.throws(() => decodeScript(bad), /Overlapping|Unknown/);
  assert.throws(() => decodeScript(Uint8Array.from([0x48, 0xff, 0x7f])), /outside/);
  const gap = decodeScript(Uint8Array.from([0x48, 0x04, 0x00, 0x01, 0x56]));
  assert.deepEqual(gap.gaps, [{ start: 3, end: 4 }]);
  assert.throws(() => encodeScript(gap), /incomplete/);
});

test('All 937 original script CFGs decode; 930 covered regions rebuild byte-exactly', () => {
  let complete = 0;
  let gaps = 0;
  for (let id = 0; id < inventory.script_count; id++) {
    const { code } = slice(id);
    const decoded = decodeScript(code);
    if (!decoded.fullyCovered) {
      gaps++;
      continue;
    }
    assert.deepEqual(
      Buffer.from(encodeScript(decoded)),
      code.subarray(0, decoded.byteLength),
      `Script $${id.toString(16)}`,
    );
    complete++;
  }
  assert.equal(complete, 930);
  assert.equal(gaps, 7);
});

test('Original European script $197 executes correctly for every 16-bit input', () => {
  const { entry, code } = slice(0x197);
  assert.equal(entry.cpu_address, '9B:EE22');
  assert.equal(entry.argument_bytes, 2);
  assert.equal(entry.return_bytes, 2);
  assert.ok(code.length > 0);
  const memory = new VmMemory(bytes);
  // Independently transcribed constants from the original thirteen comparisons.
  // The meaning of these IDs in the game is intentionally not guessed.
  const members = new Set([
    0x08b2, 0x1458, 0x089d, 0x15d2, 0x079a, 0x0a4f, 0x0d2e, 0x1b6d, 0x0b52, 0x0ba6, 0x078c, 0x0b3d,
    0x098b,
  ]);
  for (let input = 0; input <= 0xffff; input++) {
    const exit = runScript(memory, 0x197, [input]);
    assert.equal(exit.result, members.has(input) ? 0xffff : 0, `Input ${input.toString(16)}`);
  }
});

test('Exported browser script assets contain original code bytes and run without reading a ROM', async () => {
  const bundle = JSON.parse(
    await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'),
  );
  assert.equal(bundle.format, 'shadowrun-e-event-scripts-v1');
  assert.equal(
    bundle.source_rom_sha256,
    '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  );
  assert.equal(bundle.scripts.length, 937);
  assert.equal(bundle.nativeFunctions.length, 220);
  for (const script of bundle.scripts) {
    const sourceEntry = inventory.scripts[script.id];
    const offset = parseInt(sourceEntry.rom_offset, 16) + 2;
    assert.deepEqual(
      Buffer.from(script.bytecode),
      bytes.subarray(offset, offset + script.bytecode.length),
    );
    assert.equal(script.argumentBytes, sourceEntry.argument_bytes);
    assert.equal(script.localBytes, sourceEntry.scratch_bytes);
  }
  // The package without the ROM holds the script, and the reference interpreter runs it.
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  assert.equal(runScript(memory, 0x197, [0x098b]).result, 65535);
  assert.equal(runScript(memory, 0x197, [65535]).result, 0);
  assert.throws(
    () => runScript(memory, 0x197, []),
    (error) => error.reason === 'script_argument_count',
  );
});
