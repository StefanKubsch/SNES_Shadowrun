// Unreferenced scripts as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-orphan-scripts.json (src/data/orphan-scripts.mjs) from the
// orphan_script ranges of analysis/vm-rom-map.json. Each script and tail is
// decoded again and must cover its range exactly; tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {inspectScriptTables} from './scripts.mjs';
import {ORPHAN_SCRIPTS, SCRIPT_TAILS, readOrphan, readTail} from '../src/data/orphan-scripts.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const map = JSON.parse(await readFile('analysis/vm-rom-map.json', 'utf8'));
if (map.rom_sha256 !== ROM_SHA256) throw new Error('ROM map belongs to another ROM');
const bundle = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
const tables = inspectScriptTables(bytes);
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const counts = {scripts: tables.script_count, natives: tables.native_function_count};
const scripts = ORPHAN_SCRIPTS.map(cpu => ({address: cpuLabel(cpu), ...readOrphan(read8, cpu, counts)}));
const tails = SCRIPT_TAILS.map(([cpu, id]) => {
  const owner = bundle.scripts[id].bytecode;
  return {address: cpuLabel(cpu), script: id, entry: owner.length, bytecode: readTail(read8, cpu, Uint8Array.from(owner))};
});
// The map must hold exactly these bytes as orphan_script.
const expected = new Set();
for (const s of scripts) for (let i = 0; i < 2 + s.bytecode.length; i++) expected.add(cpuToOffset(parseInt(s.address.replace(':', ''), 16) + i, bytes.length));
for (const t of tails) for (let i = 0; i < t.bytecode.length; i++) expected.add(cpuToOffset(parseInt(t.address.replace(':', ''), 16) + i, bytes.length));
let mapped = 0;
for (const r of map.ranges.filter(r => r.class === 'orphan_script'))
  for (let o = parseInt(r.rom_offset, 16); o < parseInt(r.rom_offset, 16) + r.length; o++, mapped++) if (!expected.has(o)) throw new Error('Map range outside the unreferenced scripts at ' + o.toString(16));
if (mapped !== expected.size) throw new Error('ROM map and unreferenced scripts disagree');
const scope = 'Script bytecode no table entry names (src/data/orphan-scripts.mjs): headed scripts with locals, stack header and fully covered bytecode, and a dead tail behind the final end of a table script, decoded in its frame from PC entry. No reader is claimed.';
await writeFile('assets/vm-orphan-scripts.json', JSON.stringify({format: 'shadowrun-orphan-scripts-v1', scope, source_rom_sha256: ROM_SHA256, scripts, tails}, null, 1)
  .replace(/\[\n[\d,\n ]+\]/g, list => list.replace(/\s+/g, '')) + '\n');
console.log(`${scripts.length} unreferenced scripts and ${tails.length} tail, ${expected.size} bytes`);
