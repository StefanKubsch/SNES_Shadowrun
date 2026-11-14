import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cpuToOffset, offsetToCpu, stripCopierHeader, inspectRom } from './rom.mjs';
import { decode, disassembleBlock, opcodes } from './disassemble.mjs';
import { inspectScriptTables } from './scripts.mjs';

test('LoROM bank aliases, hardware/RAM exclusion, and physical bounds', () => {
  assert.equal(cpuToOffset(0x00E382, 0x100000), 0x6382);
  assert.equal(cpuToOffset(0x80E382, 0x100000), 0x6382);
  assert.equal(cpuToOffset(0x81C000, 0x100000), 0xC000);
  assert.equal(cpuToOffset(0x9FFFFF, 0x100000), 0xFFFFF);
  for (const addr of [0x002100, 0x7E8000, 0x7F8000, 0x700000, 0xA08000, -1, 0x1000000]) {
    assert.throws(() => cpuToOffset(addr, 0x100000));
  }
  for (const offset of [0, 0x7FFF, 0x8000, 0x6382, 0xFFFFF]) {
    assert.equal(cpuToOffset(offsetToCpu(offset), 0x100000), offset);
  }
});

test('Copier header is removed only for the 512-byte size signature', () => {
  assert.equal(stripCopierHeader(Buffer.alloc(0x100000)).copierHeaderBytes, 0);
  assert.equal(stripCopierHeader(Buffer.alloc(0x100200)).bytes.length, 0x100000);
});

test('65816 M/X flags change immediate widths independently', () => {
  const bytes = Buffer.alloc(0x8000);
  bytes.set([0xA9, 0x34, 0x12, 0xA2, 0x78, 0x56]);
  assert.equal(decode(bytes, 0x008000, { e: 0, m: 0, x: 1 }).operand, '#$1234');
  assert.equal(decode(bytes, 0x008000, { e: 0, m: 1, x: 0 }).operand, '#$34');
  assert.equal(decode(bytes, 0x008003, { e: 0, m: 1, x: 0 }).operand, '#$5678');
  assert.equal(decode(bytes, 0x008003, { e: 0, m: 0, x: 1 }).operand, '#$78');
  assert.throws(() => decode(bytes, 0x008000, { e: 1, m: 0, x: 0 }));
  assert.equal(opcodes.length, 256);
});

test('Reset mode transition and REP/SEP preserve correct instruction boundaries', () => {
  const bytes = Buffer.alloc(0x8000);
  bytes.set([0x18, 0xFB, 0xC2, 0x30, 0xA9, 0x34, 0x12, 0xE2, 0x20, 0xA9, 0x56, 0x60]);
  const block = disassembleBlock(bytes, 0x008000, { e: 1, m: 1, x: 1, c: null });
  assert.deepEqual(block.instructions.map(i => i.mnemonic), ['CLC', 'XCE', 'REP', 'LDA', 'SEP', 'LDA', 'RTS']);
  assert.equal(block.instructions[3].operand, '#$1234');
  assert.equal(block.instructions[5].operand, '#$56');
  bytes.set([0xC2, 0x30, 0xA9, 0x12, 0x60]);
  assert.equal(disassembleBlock(bytes, 0x008000, { e: 1, m: 1, x: 1 }).instructions[1].length, 2);
});

test('Calls, unknown status, indirect jumps, and returns stop static inference', () => {
  for (const raw of [[0x20, 0x20, 0x80], [0x22, 0x20, 0x80, 0x81], [0x28], [0xFB], [0x6C, 0x00, 0x80], [0xDC, 0x00, 0x80], [0x40]]) {
    const bytes = Buffer.alloc(0x8000);
    bytes.set(raw);
    assert.equal(disassembleBlock(bytes, 0x008000, { e: 0, m: 0, x: 0, c: null }).instructions.length, 1);
  }
});

test('Branch offsets are signed and wrap the PC within the program bank', () => {
  const bytes = Buffer.alloc(0x8000);
  bytes.set([0xD0, 0xFE, 0x82, 0xFA, 0xFF]);
  assert.equal(decode(bytes, 0x808000, { e: 0, m: 0, x: 0 }).target, 0x808000);
  assert.equal(decode(bytes, 0x808002, { e: 0, m: 0, x: 0 }).target, 0x807FFF);
  bytes[0x7FFF] = 0xA9;
  // $40:0000 is a ROM mirror. Fetching $40:FFFF's operand wraps to it.
  const large = Buffer.alloc(0x208000);
  large[0x207FFF] = 0xA9;
  large[0x200000] = 0x7B;
  assert.equal(decode(large, 0x40FFFF, { e: 0, m: 1, x: 1 }).operand, '#$7B');
});

test('Actual European ROM checksum, vectors, and reset handoff are consistent', async () => {
  const file = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const { bytes, metadata } = inspectRom(file);
  assert.equal(metadata.rom_sha256, '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(metadata.checksum_valid, true);
  assert.equal(metadata.complement_valid, true);
  assert.equal(metadata.vectors.reset.cpu_address, '00:E382');
  const block = disassembleBlock(bytes, 0x00E382, { e: 1, m: 1, x: 1, c: null });
  const last = block.instructions.at(-1);
  assert.equal(last.mnemonic, 'JML');
  assert.equal(last.target, 0x80A133);
  assert.deepEqual({ e: last.state.e, m: last.state.m, x: last.state.x }, { e: 0, m: 0, x: 0 });
});

test('European script tables are tied to actual code references and valid ROM addresses', async () => {
  const file = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const { bytes } = inspectRom(file);
  const inventory = inspectScriptTables(bytes);
  assert.equal(inventory.script_count, 937);
  assert.equal(inventory.native_function_count, 220);
  assert.equal(inventory.scripts[0].cpu_address, '9C:E497');
  for (const entry of inventory.scripts) {
    assert.equal(entry.argument_bytes % 2, 0);
    assert.equal(entry.return_bytes % 2, 0);
  }
  for (const entry of inventory.native_functions) assert.equal(entry.return_bytes % 2, 0);
  const damaged = Buffer.from(bytes);
  damaged[0x42C9] ^= 1;
  assert.throws(() => inspectScriptTables(damaged), /signature mismatch/);
});
