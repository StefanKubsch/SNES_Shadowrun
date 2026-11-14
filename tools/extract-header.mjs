// The cartridge header and vectors 80:FFC0 to FFFF as readable JSON
// (docs/ROM-FREE.md, step 2): assets/vm-header.json (src/data/header.mjs).
// tools/build-cartridge.mjs checks the way back through the product's loader.
import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { readHeader, placeHeader, HEADER, HEADER_END } from '../src/data/header.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const read8 = (cpu) => bytes[cpuToOffset(cpu, bytes.length)];
const header = readHeader(read8);
// The checksum is the sum of all ROM bytes, the complement its inverse.
let sum = 0;
for (let o = 0; o < 0x100000; o++)
  sum = (sum + read8(((0x80 + (o >> 15)) << 16) | 0x8000 | (o & 0x7fff))) & 0xffff;
if (parseInt(header.checksum, 16) !== sum || (parseInt(header.complement, 16) ^ sum) !== 0xffff)
  throw new Error('the header checksum does not match the ROM');
const rom = new Uint8Array(0x100000),
  present = new Uint8Array(0x100000);
placeHeader(rom, present, header);
for (let a = HEADER; a < HEADER_END; a++)
  if (rom[romOffset(a)] !== read8(a)) throw new Error('the header does not place back');
const scope =
  'Cartridge header and interrupt vectors 80:FFC0 to FFFF: the title (trailing spaces removed), the header bytes as hex (Book I, ROM Registration Data; maker code at FFDA in this older header), the checksum and its complement (checked against the ROM), and the 16 vector words FFE0 to FFFF in order. See src/data/header.mjs.';
await writeFile(
  'assets/vm-header.json',
  JSON.stringify(
    { format: 'shadowrun-header-v1', scope, source_rom_sha256: ROM_SHA256, header },
    null,
    1,
  ) + '\n',
);
console.log(`${header.title}, reset ${header.vectors.reset}, nmi ${header.vectors.nmi}`);
