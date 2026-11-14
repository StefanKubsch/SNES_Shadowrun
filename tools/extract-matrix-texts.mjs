// Matrix texts of bank 81 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-matrix-texts.json (src/data/matrix-texts.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readMatrixTexts, encodeMatrixText, MATRIX_TEXTS} from '../src/data/matrix-texts.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const {lists, texts} = readMatrixTexts(read8);
// Each text must encode back to its bytes.
let at = MATRIX_TEXTS;
for (const t of texts) {
  const encoded = encodeMatrixText(t.text);
  if (!encoded || encoded.some((v, k) => v !== read8(at + k))) throw new Error(`matrix text ${t.address} does not encode back`);
  at += encoded.length;
}
const scope = 'Matrix texts of bank 81: the six text lists of 81:C515 by matrix screen (1D90, C39F) and the 22 texts 81:C539 to CDB2 that 81:B282/B2D1 print. "\\n" is the new line 04, {palette n} the commands 01 to 03, {wait n} 05 n, {back} 06, {xHH} any other byte. See src/data/matrix-texts.mjs.';
await writeFile('assets/vm-matrix-texts.json', JSON.stringify({format: 'shadowrun-matrix-texts-v1', scope, source_rom_sha256: ROM_SHA256, lists, texts}, null, 1)
  .replace(/\[\n\s*("[0-9A-F]{2}:[0-9A-F]{4}",?\n\s*)+\]/g, m => JSON.stringify(JSON.parse(m))) + '\n');
console.log(`${lists.length} lists, ${texts.length} texts`);
