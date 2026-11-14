// Sound data catalog as JSON plus one WAV per sample (docs/ROM-FREE.md,
// step 2): assets/vm-sound.json and assets/vm-samples/ (src/data/sound.mjs,
// src/data/brr.mjs). tools/build-cartridge.mjs checks the way back through
// the product's loader.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { readSound } from '../src/data/sound.mjs';
import { writeWav } from '../src/data/brr.mjs';
import { soundCatalog } from './sound-catalog.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const { samples, ...sound } = readSound((cpu) => bytes[cpuToOffset(cpu, bytes.length)]);
// Cross-check with the tool catalog that the data path test pins (tools/sound-catalog.mjs).
const catalog = soundCatalog(bytes)
  .flatMap((d) => [d.base, ...d.items])
  .flatMap((l) => l.chunks.filter((c) => c.kind === 'raw'));
const labels = new Set(sound.data.map((d) => d.address));
if (
  !catalog.every((c) =>
    labels.has(
      `${(c.source >> 16).toString(16).toUpperCase()}:${(c.source & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`,
    ),
  )
)
  throw new Error('a catalog chunk is missing');
const scope =
  'Sound data that 81:F092 and F130 send to the sound driver: the two directories of 98:FFFA with their mode lists (pairs of mode and item that F1FA loads), their block lists and the data chunks. The table chunks (sample directory, header, sounds, vibrato and note tables, pointer tables) and the songs (pieces: song header, track, tempo list, pattern with event strings) are readable here. Each sample names its WAV in vm-samples/ (16-bit mono, decoded from silence, nominal 32 kHz) and keeps its BRR block headers as hex (blocks) and, for blocks whose PCM does not determine the nibbles, those nibbles (nibbles, by block index). Role is the base list section the chunk lands in (0x04E1), aram its destinations. See src/data/sound.mjs and src/data/brr.mjs.';
// Arrays of plain values (events, words) stay on one line.
const compact = (text) =>
  text.replace(/\[\n(?:\s*(?:"[^"\n]*"|-?\d+),?\n)+\s*\]/g, (m) => JSON.stringify(JSON.parse(m)));
await writeFile(
  'assets/vm-sound.json',
  compact(
    JSON.stringify(
      { format: 'shadowrun-sound-v6', scope, source_rom_sha256: ROM_SHA256, ...sound },
      null,
      1,
    ),
  ) + '\n',
);
// Replace the sample folder completely, so a removed sample leaves no file.
await mkdir('assets/vm-samples', { recursive: true });
for (const name of await readdir('assets/vm-samples'))
  if (name.endsWith('.wav')) await rm(`assets/vm-samples/${name}`);
for (const [file, pcm] of Object.entries(samples)) await writeFile(`assets/${file}`, writeWav(pcm));
await rm('assets/vm-sound.bin', { force: true });
const roles = {};
for (const d of sound.data) roles[d.role] = (roles[d.role] ?? 0) + 1;
const kept = sound.data.reduce((n, d) => n + Object.keys(d.nibbles ?? {}).length, 0);
console.log(
  `${sound.directories.length} directories, ${sound.lists.length} lists, ${sound.data.length} chunks, ${Object.keys(samples).length} samples, ${kept} blocks with kept nibbles`,
  roles,
);
