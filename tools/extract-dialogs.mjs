// Dialog records and their table as readable JSON (docs/ROM-FREE.md,
// step 2): assets/vm-dialogs.json (src/data/dialogs.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readDialogs} from '../src/data/dialogs.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const dialogs = readDialogs(cpu => bytes[cpuToOffset(cpu, bytes.length)]);
const texts = new Set(JSON.parse(await readFile('assets/vm-texts.json', 'utf8')).texts.map(t => t.address));
const portraits = new Set(JSON.parse(await readFile('assets/vm-portraits.json', 'utf8')).portraits.map(p => p.address));
if (!dialogs.every(d => portraits.has(d.portrait) && d.entries.every(e => texts.has(e.text)))) throw new Error('a dialog names no portrait or text start');
const scope = 'Dialog records of 80:936C/9178 in address order (8D:80C0 on): dialog number (table 80:94F7), portrait record (vm-portraits.json), music (80:94E8, 0 keeps), mirror (second portrait), entries per key (greeting FF, talk FE, fallback FD or topic number): topic numbers added to the topic list, optional script appended by the action, text address (vm-texts.json). See src/data/dialogs.mjs.';
await writeFile('assets/vm-dialogs.json', JSON.stringify({format: 'shadowrun-dialogs-v1', scope, source_rom_sha256: ROM_SHA256, dialogs}, null, 1)
  .replace(/\{\n\s*"key"[^}]*\}/g, m => JSON.stringify(JSON.parse(m))) + '\n');
console.log(`${dialogs.length} dialogs, ${dialogs.reduce((n, d) => n + d.entries.length, 0)} entries`);