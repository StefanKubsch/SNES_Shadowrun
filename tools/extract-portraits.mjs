// Dialog portrait records as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-portraits.json (src/data/portraits.mjs); their streams are in
// assets/vm-lz.json (tools/extract-lz.mjs). tools/build-cartridge.mjs checks
// the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readPortraits} from '../src/data/portraits.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const portraits = readPortraits(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const scope = 'Dialog portrait records of 80:936C in address order: the packed stream of the 64 OBJ characters (vm-lz.json) and the 15 colours (BGR555 hex) the NMI 80:8FBA sends to CGRAM. See src/data/portraits.mjs.';
await writeFile('assets/vm-portraits.json', JSON.stringify({format: 'shadowrun-portraits-v1', scope, source_rom_sha256: ROM_SHA256,
  portraits}, null, 1).replace(/\[\n(?:\s*"[^"\n]*",?\n)+\s*\]/g, m => JSON.stringify(JSON.parse(m))) + '\n');
console.log(`${portraits.length} portraits, ${new Set(portraits.map(p => p.stream)).size} streams`);
