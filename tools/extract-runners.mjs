// Runner table of bank 80 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-runners.json (src/data/runners.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readRunners, RUNNER_RECORDS, RUNNER_END, RECORD_SIZE} from '../src/data/runners.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const runners = readRunners(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const texts = new Map(JSON.parse(await readFile('assets/vm-texts.json', 'utf8')).texts.map(t => [t.address, t.text]));
if (!runners.every(r => texts.has(r.name))) throw new Error('a runner name is no text start');
// The ROM records must cover 80:9811 to 98E9 without a gap.
const starts = runners.filter(r => r.stats).map(r => parseInt(r.record.replace(':', ''), 16) | 0x800000).sort((a, b) => a - b);
if (starts.some((s, i) => s !== RUNNER_RECORDS + RECORD_SIZE * i) || RUNNER_RECORDS + RECORD_SIZE * starts.length !== RUNNER_END) throw new Error('runner records do not tile 80:9811 to 98E9');
const scope = 'Runner table of bank 80, one row per member (Jake first): object number (9700), member record (971A/9734; inline when in ROM: attributes as the status screen labels them, skills, spell levels), portrait dialog (974E), datajack (9768 to 1F56), name (9782, vm-texts.json), new-game magic points for 7E:3C96 (979C) and the new-game armour and weapon for 7E:3C2E (97A9: object numbers, armour rating, weapon kind, damage and range). See src/data/runners.mjs.';
await writeFile('assets/vm-runners.json', JSON.stringify({format: 'shadowrun-runners-v3', scope, source_rom_sha256: ROM_SHA256, runners}, null, 1)
  .replace(/\{\n(?:\s*"[a-z_]+": (?:-?\d+|"[0-9A-F]{4}"),?\n)+\s*\}/g, m => JSON.stringify(JSON.parse(m))) + '\n');
console.log(`${runners.length} runners: ${runners.map(r => texts.get(r.name)).join(', ')}`);