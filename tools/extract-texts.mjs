// Texte als bearbeitbares JSON (docs/ROM-FREE.md, Schritt 2): Huffman-Baum und
// alle Texte der Klasse text aus analysis/vm-rom-map.json nach
// assets/vm-texts.json (Format in src/data/texts.mjs). Der Rückweg wird in
// tools/build-cartridge.mjs über den Lader des Produkts bytegleich geprüft.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';
import {readTextTree, readText} from '../src/data/texts.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const map = JSON.parse(await readFile('analysis/vm-rom-map.json', 'utf8'));
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)], read16 = cpu => read8(cpu) | read8(cpu + 1) << 8;
const tree = readTextTree(read16), texts = [];
for (const region of map.text_regions) {
  const start = parseInt(region.start.replace(':', ''), 16), end = parseInt(region.end.replace(':', ''), 16);
  for (let cpu = start; cpu < end;) {
    const {text, length} = readText(read8, tree, cpu);
    texts.push({address: cpuLabel(cpu), text});
    cpu += length;
  }
}
await writeFile('assets/vm-texts.json', JSON.stringify({
  format: 'shadowrun-texts-v1',
  scope: 'Dialogue and term texts, decoded from the Huffman bit stream read by $80:FE69. Each text must keep its address; see src/data/texts.mjs.',
  source_rom_sha256: ROM_SHA256,
  tree,
  texts,
}, null, 1) + '\n');
console.log(`${texts.length} Texte, Baum mit ${tree.length} Knoten`);
