// SPC700 sound driver 97:8000 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-spc-driver.json (src/data/spc-driver.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import {readFile, writeFile} from 'node:fs/promises';
import {inspectRom, cpuToOffset} from './rom.mjs';
import {readSpcDriver, spcDriverBytes, SPC_DRIVER_ROM, SPC_DRIVER_LENGTH} from '../src/data/spc-driver.mjs';
import {decodeDriver} from './sound-driver-source.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const {bytes, metadata} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256) throw new Error('ROM differs from the researched European revision');
const read8 = cpu => bytes[cpuToOffset(cpu, bytes.length)];
const driver = readSpcDriver(read8);
const original = Uint8Array.from({length: SPC_DRIVER_LENGTH}, (_, k) => read8(SPC_DRIVER_ROM + k));
if (spcDriverBytes(driver).some((v, k) => v !== original[k])) throw new Error('the driver does not assemble back to its bytes');
// The listing must start a line at every instruction the recursive decoding reaches.
const starts = new Set(driver.code.map(line => line.slice(0, 4)));
const missed = decodeDriver(original).instructions.filter(d => !starts.has(d.pc.toString(16).toUpperCase().padStart(4, '0')));
if (missed.length) throw new Error(`reached instructions inside other lines: ${missed.map(d => d.pc.toString(16)).join(', ')}`);
const scope = 'SPC700 sound driver of ROM 97:8000, sent to ARAM $0200 (0C55 bytes): the targets of commands 00 to 19 (dispatch tables $02C8/$02E2), the DSP registers of the echo header list $03B5, the voice bits $0471, the vibrato sine $0E14 and every other byte as an instruction line. The native driver (src/apu) runs instead of the code and accepts only these exact bytes. See src/data/spc-driver.mjs.';
await writeFile('assets/vm-spc-driver.json', JSON.stringify({format: 'shadowrun-spc-driver-v1', scope, source_rom_sha256: ROM_SHA256, ...driver}, null, 1)
  .replace(/\[\n(?:\s*(?:-?\d+|"[0-9A-Z_]{1,6}"),?\n)+\s*\]/g, m => JSON.stringify(JSON.parse(m))) + '\n');
console.log(`${driver.code.length} instruction lines, ${driver.commands.length} commands`);
