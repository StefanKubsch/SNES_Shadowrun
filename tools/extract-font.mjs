// The text font 95:F2D0 as a lossless BMP (docs/ROM-FREE.md, step 2):
// assets/vm-font.bmp (src/data/font.mjs). tools/build-cartridge.mjs checks the
// way back through the product's loader.
import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import {
  readFont,
  placeFont,
  FONT,
  FONT_GLYPHS,
  FONT_WIDTH,
  FONT_HEIGHT,
} from '../src/data/font.mjs';
import { writeBmp, readBmp } from '../src/data/tiles.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const read8 = (cpu) => bytes[cpuToOffset(cpu, bytes.length)];
const bmp = writeBmp(readFont(read8), FONT_WIDTH, FONT_HEIGHT);
// The BMP must place back to the ROM bytes.
const rom = new Uint8Array(0x100000),
  present = new Uint8Array(0x100000);
placeFont(rom, present, readBmp(bmp));
for (let n = 0; n < 8 * FONT_GLYPHS; n++)
  if (rom[romOffset(FONT + n)] !== read8(FONT + n)) throw new Error('the font does not place back');
await writeFile('assets/vm-font.bmp', bmp);
console.log(`${FONT_GLYPHS} characters, ${FONT_WIDTH} x ${FONT_HEIGHT}`);
