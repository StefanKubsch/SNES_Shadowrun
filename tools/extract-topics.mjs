// Dialog topic table 8D:8000 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-topics.json (src/data/topics.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readTopics} from '../src/data/topics.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const topics = readTopics(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const texts = new Map(JSON.parse(await readFile('assets/vm-texts.json', 'utf8')).texts.map(t => [t.address, t.text]));
if (!topics.every(t => texts.has(t))) throw new Error('a topic is no text start');
const scope = 'Dialog topics of 80:9215, in topic order: the text address (vm-texts.json) of the menu entry of topic t, from the table 8D:8000. See src/data/topics.mjs.';
await writeFile('assets/vm-topics.json', JSON.stringify({format: 'shadowrun-topics-v1', scope, source_rom_sha256: ROM_SHA256, topics}, null, 1) + '\n');
console.log(`${topics.length} topics: ${topics.slice(0, 4).map(t => texts.get(t)).join(', ')} ...`);
