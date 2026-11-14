// Filler bytes as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-fillers.json (src/data/fillers.mjs) from the filler ranges of
// analysis/vm-rom-map.json. Each run is checked again against its kind rule;
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {inspectScriptTables} from './scripts.mjs';
import {fillerKind, scriptJumpEnds} from '../src/data/fillers.mjs';
import {ORPHAN_SCRIPTS, readOrphan} from '../src/data/orphan-scripts.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const map = JSON.parse(await readFile('analysis/vm-rom-map.json', 'utf8'));
if (map.rom_sha256 !== ROM_SHA256) throw new Error('ROM map belongs to another ROM');
const bundle = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
const cpuOf = offset => (0x80 + (offset >> 15)) << 16 | 0x8000 | (offset & 0x7FFF);
const tables = inspectScriptTables(bytes), read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
// Unreferenced scripts end like table scripts (src/data/orphan-scripts.mjs).
const orphans = ORPHAN_SCRIPTS.map(cpu => ({address: cpu, bytecode: readOrphan(read8, cpu, {scripts: tables.script_count, natives: tables.native_function_count}).bytecode}));
const scriptEnds = scriptJumpEnds([...tables.scripts
  .map(s => ({address: cpuOf(parseInt(s.rom_offset, 16)), bytecode: bundle.scripts[parseInt(s.id, 16)].bytecode})), ...orphans]);
const fillers = [];
for (const range of map.ranges.filter(r => r.class === 'filler')) {
  // A map range may join runs of two banks; each bank part is one filler.
  for (let o = parseInt(range.rom_offset, 16), end = o + range.length; o < end;) {
    const e = Math.min(end, (o >> 15) + 1 << 15), cpu = cpuOf(o), kind = fillerKind(read8, cpu, e - o, scriptEnds);
    if (!kind) throw new Error('Filler rule fails at ' + cpuLabel(cpu));
    fillers.push({address: cpuLabel(cpu), length: e - o, value: read8(cpu), kind});
    o = e;
  }
}
const counts = Object.fromEntries(['script_end', 'bank_end', 'zero_run', 'ff_run'].map(k => [k, fillers.filter(f => f.kind === k).length]));
const scope = 'Unknown runs of one repeated byte with a structural reason and no reader (src/data/fillers.mjs): script_end is the unreachable end opcode 56 behind a final script jump, bank_end FF up to a bank end, zero_run and ff_run other runs of only 00 or FF.';
await writeFile('assets/vm-fillers.json', JSON.stringify({format: 'shadowrun-fillers-v1', scope, source_rom_sha256: ROM_SHA256, counts, fillers}, null, 1) + '\n');
console.log(`${fillers.length} filler runs, ${fillers.reduce((n, f) => n + f.length, 0)} bytes: ${JSON.stringify(counts)}`);
