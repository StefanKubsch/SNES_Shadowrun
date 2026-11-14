import { readFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const [file, address, e, m, x, limit = '128'] = process.argv.slice(2);
if (!file || !/^[0-9a-fA-F]{6}$/.test(address ?? '') || ![e, m, x].every(v => /^[01]$/.test(v ?? '')) || !/^\d+$/.test(limit) || +limit < 1 || +limit > 4096) {
  console.error('Usage: node tools/disasm-cli.mjs ROM CPU_HEX6 E M X [instruction_limit_1_to_4096]');
  process.exit(1);
}
const { bytes } = inspectRom(await readFile(file));
console.log(formatBlock(disassembleBlock(bytes, parseInt(address, 16), { e: +e, m: +m, x: +x, c: null }, +limit)));
