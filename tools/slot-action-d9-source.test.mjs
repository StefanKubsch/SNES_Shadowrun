import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { disassembleBlock } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/slot-action-d9.json', import.meta.url), 'utf8'));

test('D9 analysis preserves the full original body/helper, ABI and exact byte coverage in this ROM revision', () => {
  const hash = createHash('sha256').update(rom).digest('hex');
  assert.equal(hash, '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256, hash);
  assert.equal(rom.readUInt16LE(0x157B8 + 0xD9 * 2), 0x8D4E);assert.equal(rom[0x15A4C + 0xD9], 2);assert.equal(rom[0x15970 + 0xD9], 2);
  assert.deepEqual(report.coverage, [{ start: '808D4E', end_exclusive: '808D7F', covered_bytes: 49 }, { start: '808D95', end_exclusive: '808E36', covered_bytes: 161 }]);
  assert.equal(rom.subarray(0xD4E, 0xD7F).toString('hex').toUpperCase(), '6404A5020A0A0A38E502E502A8C8B7F30A0A85B4C8C8B7F30A0A85B7C8C8B7F30A0A85BA20958D18B9D00D65B199D00D60');
  assert.equal(rom.subarray(0xD95, 0xE36).toString('hex').toUpperCase(), '64A864AB64AEA40038A5B4F9280E100649FFFF1AC6A885A238A5B7F9800E100649FFFF1AC6AB85A538A5BAF9D80E100649FFFF1AC6AE8D04421865A265A54A4A4A4AE604D0014AC90000D003A90100E2208D0642C22085004A85B1A5AE4D144210011A99D00DA5A28D0442E220A5008D0642C220EAEAEAEAA5A84D144210011A99200DA5A58D0442E220A5008D0642C220EAEAEAEAA5AB4D144210011A99780D60');
  for (const block of [...report.source_blocks, ...report.candidate_pointer_writes.source_blocks]) {
    const start = cpuToOffset(parseInt(block.entry, 16), rom.length);const bytes = Buffer.from(block.machine_bytes, 'hex');
    assert.deepEqual(rom.subarray(start, start + bytes.length), bytes);
  }
});

test('Every one of eight taken helper branches joins a decoded word-mode instruction and the sole RTS restores native mode', () => {
  const block = disassembleBlock(rom, 0x808D95, { e: 0, m: 0, x: 0 }, 256);
  const instructions = new Map(block.instructions.map(ins => [ins.cpu, ins]));
  const edges = block.instructions.filter(ins => ins.target !== undefined).map(ins => [ins.cpu, ins.target]);
  assert.deepEqual(edges, [[0x808DA3, 0x808DAB], [0x808DB3, 0x808DBB], [0x808DC3, 0x808DCB], [0x808DD9, 0x808DDC], [0x808DDF, 0x808DE4], [0x808DF5, 0x808DF8], [0x808E12, 0x808E15], [0x808E2F, 0x808E32]]);
  for (const [from, to] of edges) {
    assert.equal(instructions.get(from).state.m, 0);assert.equal(instructions.get(to).state.m, 0);
    assert.equal(instructions.get(from).state.x, 0);assert.equal(instructions.get(to).state.x, 0);
  }
  assert.equal(block.stop, 'RTS boundary');assert.equal(block.instructions.at(-1).state.m, 0);assert.equal(block.instructions.at(-1).state.x, 0);
  assert.equal(block.instructions.some(ins => ['JSR', 'JSL', 'PLP', 'XCE'].includes(ins.mnemonic)), false);
  assert.deepEqual(report.helper_mode, { entry: 'E0 M0 X0', return: 'E0 M0 X0', further_calls: 0,
    branch_edges: edges.map(([from, to]) => ({ from: `80:${(from & 0xFFFF).toString(16).toUpperCase()}`, to: `80:${(to & 0xFFFF).toString(16).toUpperCase()}`, mode: 'E0 M0 X0' })) });
  const bank = disassembleBlock(rom, 0x80A44E, { e: 0, m: 0, x: 0 }, 128);
  assert.equal(bank.instructions.find(ins => ins.cpu === 0x80A45D).state.m, 1);
  assert.equal(bank.instructions.find(ins => ins.cpu === 0x80A452).mnemonic, 'ADC');
});
