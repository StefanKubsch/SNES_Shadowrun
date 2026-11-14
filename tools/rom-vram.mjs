// Summary of the VRAM probe (tools/rom-vram-hook.mjs, docs/ROM-FREE.md):
// merges .cache/rom-vram/*.json into analysis/rom-vram.json. One entry per
// distinct DMA (ROM source, length, DMA mode, VMAIN, VRAM word address) with
// its count and the uses marked on screen: kind (map, bg2, bg4, obj4) and,
// where the used unit starts in the same transfer, its byte phase in that
// transfer (kind@phase). A transfer has a format when all its uses agree on
// one kind at phase 0. A transfer never seen on screen (unused) takes the one
// format of the other transfers to the same VRAM word address. ranges: the
// ROM sources merged per format (src/data/vram-tiles.mjs); fill transfers
// (fixed source byte) are left out, a source with two formats is an error.
// streams: the packed streams of the unpacker 9F49/9F4D/9F6D per ROM source
// (the length word; src/data/lz-streams.mjs) with entries, WRAM destinations,
// count and the uses of their output. A stream gets the format of the kind
// whose phase-0 uses hold at least 95 % of all its marked bytes, if its
// length is a multiple of that unit; else bytes. The rest are bytes that only
// equal the stream's output by chance (ownership is checked by value, and
// zero bytes are common): 87:D71A has 2.3 % obj4 at phase 24, 84:D8DD 0.06 %
// obj4 beside its map.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {inspectRom, cpuToOffset, cpuLabel} from './rom.mjs';

const {bytes: rom} = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));

const dir = '.cache/rom-vram/', merged = new Map(), packed = new Map();
for (const name of await readdir(dir)) for (const t of JSON.parse(await readFile(dir + name, 'utf8'))) {
  if (t.type === 'lz') {
    const [, at, source, destination] = t.key.split(',').map(Number);
    const p = packed.get(source) ?? {source, entries: new Set(), destinations: new Set(), count: 0, uses: {}};
    p.entries.add(cpuLabel(at)); p.destinations.add(cpuLabel(destination)); p.count += t.count;
    for (const [k, n] of Object.entries(t.uses)) p.uses[k] = (p.uses[k] ?? 0) + n;
    packed.set(source, p);
    continue;
  }
  const m = merged.get(t.key) ?? {key: t.key, count: 0, uses: {}};
  m.count += t.count;
  for (const [k, n] of Object.entries(t.uses)) m.uses[k] = (m.uses[k] ?? 0) + n;
  merged.set(t.key, m);
}
const transfers = [...merged.values()].map(({key, count, uses}) => {
  const [source, length, mode, target, vmain, vram] = key.split(',').map(Number);
  return {source, length, mode, target, vmain, vram, count, uses};
}).sort((a, b) => a.source - b.source || a.length - b.length || a.vram - b.vram);

const UNIT = {map: 2, bg2: 16, bg4: 32, obj4: 32};
const format = t => {
  if (t.mode & 8) return 'fill';
  if (t.target !== 0x2118 || (t.mode & 7) !== 1 || t.vmain !== 0x80) return 'layout';
  const kinds = new Set(), phases = new Set();
  for (const k of Object.keys(t.uses)) { const [kind, phase] = k.split('@'); kinds.add(kind); if (phase !== undefined) phases.add(+phase); }
  if (!kinds.size) return 'unused';
  if (kinds.size > 1) return 'mixed';
  const [kind] = kinds;
  return [...phases].every(p => p === 0) && t.length % UNIT[kind] === 0 ? kind : 'misaligned';
};
const report = {
  scope: 'General DMA from ROM to VRAM in all live tests (tools/rom-vram-hook.mjs). uses: bytes marked per NMI as BG tilemap (map), BG 2/4 bpp characters (bg2, bg4) or OBJ characters (obj4); kind@n where the unit starts n bytes into the same transfer. format: the agreed kind, else fill, layout (not a linear word DMA), unused, mixed or misaligned.',
  transfers: transfers.map(t => ({source: cpuLabel(t.source), length: t.length, mode: t.mode, target: t.target.toString(16), vmain: t.vmain.toString(16),
    vram_word: t.vram.toString(16).padStart(4, '0'), count: t.count, format: format(t), uses: t.uses})),
};
const slot = new Map();
for (const t of report.transfers) if (UNIT[t.format]) slot.set(t.vram_word, (slot.get(t.vram_word) ?? new Set()).add(t.format));
const sources = [];
for (const t of report.transfers) {
  if (t.format === 'fill') continue;
  let f = t.format;
  if (f === 'unused' && slot.get(t.vram_word)?.size === 1) [f] = slot.get(t.vram_word);
  if (!UNIT[f]) throw new Error(`No format for ${t.source} (${t.format})`);
  sources.push([parseInt(t.source.replace(':', ''), 16), t.length, f]);
}
sources.sort((a, b) => a[0] - b[0]);
const ranges = [];
for (const [cpu, length, f] of sources) {
  const last = ranges.at(-1);
  if (last && cpu <= last[0] + last[1]) {
    if (last[2] !== f && cpu < last[0] + last[1]) throw new Error(`Formats ${last[2]} and ${f} overlap at ${cpuLabel(cpu)}`);
    if (last[2] === f && cpu >>> 16 === last[0] >>> 16) { last[1] = Math.max(last[1], cpu + length - last[0]); continue; }
  }
  ranges.push([cpu, length, f]);
}
// A range that shares bytes with a CGRAM palette (analysis/rom-palettes.json)
// leaves those units to the palette: 95:F140 sends 48 bytes to CGRAM, and its
// last 16 are the first 2 bpp tile of 95:F160.
const palette = JSON.parse(await readFile('analysis/rom-palettes.json', 'utf8')).ranges;
const inPalette = cpu => palette.some(([start, length]) => cpu >= start && cpu < start + length);
for (const r of ranges) {
  const unit = UNIT[r[2]], shared = n => [...Array(unit).keys()].some(i => inPalette(r[0] + n + i));
  while (r[1] && shared(0)) { r[0] += unit; r[1] -= unit; }
  while (r[1] && shared(r[1] - unit)) r[1] -= unit;
  for (let n = 0; n < r[1]; n += unit) if (shared(n)) throw new Error(`Palette inside ${cpuLabel(r[0] + n)}`);
}
report.ranges = ranges.filter(r => r[1]).map(([cpu, length, f]) => ({source: cpuLabel(cpu), length, format: f}));
report.streams = [...packed.values()].sort((a, b) => a.source - b.source).map(p => {
  const length = rom[cpuToOffset(p.source, rom.length)] | rom[cpuToOffset(p.source + 1, rom.length)] << 8;
  const total = Object.values(p.uses).reduce((n, v) => n + v, 0);
  const [kind] = Object.entries(p.uses).find(([k, n]) => k.endsWith('@0') && n >= 0.95 * total)?.[0].split('@') ?? [];
  const format = kind && length % UNIT[kind] === 0 ? kind : 'bytes';
  return {source: cpuLabel(p.source), length, entries: [...p.entries].join(' '), destinations: [...p.destinations].join(' '), count: p.count, format, uses: p.uses};
});
const counts = {};
for (const t of report.transfers) { counts[t.format] ??= {transfers: 0, bytes: 0}; counts[t.format].transfers++; counts[t.format].bytes += t.length; }
report.counts = counts;
// One line per range, stream and transfer.
const {transfers: rows, ranges: kept, streams, ...head} = report;
const lines = list => list.map(r => JSON.stringify(r)).join(',\n');
await writeFile('analysis/rom-vram.json', JSON.stringify(head).slice(0, -1) +
  `,\n"ranges":[\n${lines(kept)}],\n"streams":[\n${lines(streams)}],\n"transfers":[\n${lines(rows)}]}\n`);
console.log(JSON.stringify(counts), `${ranges.length} ranges, ${ranges.reduce((n, r) => n + r[1], 0)} bytes`);
