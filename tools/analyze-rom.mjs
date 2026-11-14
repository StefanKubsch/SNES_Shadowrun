import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { inspectRom, hex, offsetToCpu, cpuLabel } from './rom.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';
import { inspectScriptTables } from './scripts.mjs';

const romPath = resolve(process.argv[2] ?? 'Shadowrun (E).smc');
const out = resolve('analysis');
const { bytes, metadata } = inspectRom(await readFile(romPath));
const expected = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
if (metadata.rom_sha256 !== expected) throw new Error('ROM differs from the researched European revision; do not reuse addresses');
if (!metadata.checksum_valid || !metadata.complement_valid) throw new Error('ROM checksum failed');
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'rom.json'), JSON.stringify({ source_file: basename(romPath), ...metadata }, null, 2) + '\n');

const banks = [];
for (let offset = 0; offset < bytes.length; offset += 0x8000) {
  const data = bytes.subarray(offset, offset + 0x8000);
  const counts = new Array(256).fill(0);
  for (const byte of data) counts[byte]++;
  const entropy = counts.reduce((s, n) => n ? s - (n / data.length) * Math.log2(n / data.length) : s, 0);
  banks.push({ rom_offset: hex(offset), cpu_window: `${cpuLabel(offsetToCpu(offset))}-${cpuLabel(offsetToCpu(offset + 0x7FFF))}`, size: data.length, entropy_bits_per_byte: +entropy.toFixed(4), zero_bytes: counts[0], ff_bytes: counts[255] });
}
await writeFile(resolve(out, 'banks.json'), JSON.stringify(banks, null, 2) + '\n');

const ascii = [];
const re = /[ -~]{6,}/g;
const text = bytes.toString('latin1');
for (const match of text.matchAll(re)) {
  if (/[A-Za-z]{4}/.test(match[0])) ascii.push({ rom_offset: hex(match.index), cpu_address: cpuLabel(offsetToCpu(match.index)), byte_length: match[0].length, text: match[0] });
}
await writeFile(resolve(out, 'ascii-candidates.json'), JSON.stringify({ warning: 'Raw ASCII candidates only. Binary data can match; this is not a decoded dialogue database.', entries: ascii }, null, 2) + '\n');

// Main entry state follows directly from the reset tail REP #$30 / JML.
// The NMI entry has unknown incoming M/X; REP #$30 is its first opcode,
// independent of incoming widths. Its following block starts at $00:C114.
const seeds = [
  ['reset', 0x00E382, { e: 1, m: 1, x: 1, c: null }],
  ['main-entry', 0x80A133, { e: 0, m: 0, x: 0, c: null }],
  ['main-first-callee', 0x80A15C, { e: 0, m: 0, x: 0, c: null }],
  ['nmi-after-rep', 0x00C114, { e: 0, m: 0, x: 0, c: null }],
  ['default-interrupt', 0x00F2B3, { e: 0, m: 0, x: 0, c: null }],
  ['script-allocation-tables', 0x80C2C8, { e: 0, m: 0, x: 0, c: null }],
  ['script-return-table', 0x80F4A7, { e: 0, m: 0, x: 0, c: null }],
  ['native-argument-table', 0x80F4D6, { e: 0, m: 0, x: 0, c: null }],
  ['native-pointer-table', 0x80F4EC, { e: 0, m: 0, x: 0, c: null }],
  ['native-return-table', 0x80F51B, { e: 0, m: 0, x: 0, c: null }],
  ['native-dispatch', 0x80F52F, { e: 0, m: 0, x: 0, c: null }],
  ['nmi-dispatch', 0x80C14F, { e: 0, m: 0, x: 0, c: null }],
  ['script-opcode-dispatch', 0x80F389, { e: 0, m: 0, x: 0, c: null }],
  ['script-push-zero', 0x80F393, { e: 0, m: 0, x: 0, c: null }],
  ['script-push-u8', 0x80F398, { e: 0, m: 0, x: 0, c: null }],
  ['script-push-u16', 0x80F3B1, { e: 0, m: 0, x: 0, c: null }],
  ['script-drop', 0x80F8BB, { e: 0, m: 0, x: 0, c: null }],
];
if (bytes[0x4112] !== 0xC2 || bytes[0x4113] !== 0x30) throw new Error('NMI entry assumption failed');
const refs = [];
for (const [name, address, state] of seeds) {
  const block = disassembleBlock(bytes, address, state);
  await writeFile(resolve(out, `${name}.asm.txt`), formatBlock(block));
  refs.push({ name, entry: cpuLabel(address), stop: block.stop, references: block.references });
}
await writeFile(resolve(out, 'entry-references.json'), JSON.stringify(refs, null, 2) + '\n');
const scripts = inspectScriptTables(bytes);
await writeFile(resolve(out, 'script-inventory.json'), JSON.stringify(scripts, null, 2) + '\n');
console.log(`${metadata.title}: ${metadata.rom_size_bytes} bytes, ${metadata.mapping}, checksum $${metadata.stored_checksum} OK`);
console.log(`${banks.length} ROM banks, ${ascii.length} raw ASCII candidates. Reports: ${out}`);
console.log(`${scripts.script_count} script entries, ${scripts.native_function_count} native script-function entries.`);
