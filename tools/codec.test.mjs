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
import { createScriptRunner } from '../proof/script/runtime.mjs';
import { inspectRom } from './rom.mjs';
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

test('Native runner handles word wrapping, sign extension, shift counts, and original boolean values', () => {
  const runner = (ops, stack) =>
    createScriptRunner(Uint8Array.from([...ops, 0x56]), { localBytes: 0, returnBytes: 2 })(stack)
      .value;
  assert.equal(runner([0x5c], [65535, 1]), 0);
  assert.equal(runner([0x5e], [0, 1]), 65535);
  assert.equal(runner([0x0a, 0x80], []), 0xff80);
  assert.equal(runner([0xb0], [123, 123]), 65535);
  assert.equal(runner([0xb0], [123, 124]), 0);
  for (const shift of [0, 1, 15, 16, 32, 65535]) {
    assert.equal(runner([0x7a], [0x8001, shift]), shift < 16 ? (0x8001 * 2 ** shift) & 65535 : 0);
    assert.equal(runner([0x7c], [0x8001, shift]), shift < 16 ? Math.floor(0x8001 / 2 ** shift) : 0);
  }
  assert.equal(runner([0xbe], [12]), 65535);
  assert.equal(runner([0xbe], [0]), 0);
});

test('Local byte/word overlap, initialization, local subroutine returns, and loop budgets', () => {
  const code = Uint8Array.from([0x14, 0x34, 0x12, 0x34, 0, 0x00, 0xff, 0x2c, 1, 0x16, 0, 0x56]);
  assert.equal(createScriptRunner(code, { localBytes: 2, returnBytes: 2 })().value, 0xff34);
  const localCall = Uint8Array.from([0x4c, 0x04, 0, 0x56, 0x00, 7, 0x50]);
  assert.equal(createScriptRunner(localCall, { localBytes: 0, returnBytes: 2 })().value, 7);
  // END in a local subroutine ends the script rather than requiring RETURN_LOCAL.
  const localEnd = Uint8Array.from([0x4c, 0x04, 0, 0x56, 0x00, 9, 0x56]);
  assert.equal(createScriptRunner(localEnd, { localBytes: 0, returnBytes: 2 })().value, 9);
  assert.throws(
    () => createScriptRunner(Uint8Array.from([0x16, 0, 0x56]), { localBytes: 2, returnBytes: 2 })(),
    /Uninitialized/,
  );
  assert.throws(
    () => createScriptRunner(Uint8Array.from([0xbc, 0x56]), { localBytes: 0, returnBytes: 0 })(),
    /underflow/,
  );
  assert.throws(
    () => createScriptRunner(Uint8Array.from([0x58, 1, 0x56]), { localBytes: 0, returnBytes: 0 })(),
    /not implemented/,
  );
  assert.throws(
    () =>
      createScriptRunner(Uint8Array.from([0x48, 0, 0]), { localBytes: 0, returnBytes: 0 })([], {
        maxSteps: 10,
      }),
    /budget/,
  );
});

test('Original European script $197 executes correctly for every 16-bit input', () => {
  const { entry, code } = slice(0x197);
  assert.equal(entry.cpu_address, '9B:EE22');
  assert.equal(entry.argument_bytes, 2);
  assert.equal(entry.return_bytes, 2);
  const runner = createScriptRunner(code, {
    localBytes: entry.scratch_bytes,
    returnBytes: entry.return_bytes,
  });
  // Independently transcribed constants from the original thirteen comparisons.
  // The meaning of these IDs in the game is intentionally not guessed.
  const members = new Set([
    0x08b2, 0x1458, 0x089d, 0x15d2, 0x079a, 0x0a4f, 0x0d2e, 0x1b6d, 0x0b52, 0x0ba6, 0x078c, 0x0b3d,
    0x098b,
  ]);
  for (let input = 0; input <= 0xffff; input++) {
    const result = runner([input]);
    assert.equal(result.value, members.has(input) ? 0xffff : 0, `Input $${input.toString(16)}`);
    assert.equal(result.stack.length, 0);
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
  const exported = bundle.scripts[0x197];
  const run = createScriptRunner(Uint8Array.from(exported.bytecode), exported);
  assert.equal(run([0x098b]).value, 65535);
  assert.equal(run([65535]).value, 0);
  assert.throws(() => run([]), /argument count/);
});
