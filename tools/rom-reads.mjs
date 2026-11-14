// Überträgt die mit tools/rom-reads-hook.mjs aufgezeichneten ROM-Lesungen (.cache/rom-reads.bin)
// in analysis/rom-reads.json (Bereiche als [Offset, Länge]), vereinigt mit dem vorhandenen Stand.
// Eingabe der ROM-Karte (tools/rom-map.mjs, docs/ROM-FREE.md). Nur Werkzeug.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const OUT = 'analysis/rom-reads.json', SIZE = 0x100000;
const seen = new Uint8Array(SIZE);
if (existsSync(OUT)) for (const [offset, length] of JSON.parse(readFileSync(OUT, 'utf8')).ranges) seen.fill(1, offset, offset + length);
const before = seen.reduce((n, v) => n + v, 0);
const recorded = readFileSync('.cache/rom-reads.bin');
for (let i = 0; i < SIZE; i++) seen[i] |= recorded[i];
const ranges = [];
for (let o = 0; o < SIZE;) {
  if (!seen[o]) { o++; continue; }
  let e = o; while (e < SIZE && seen[e]) e++;
  ranges.push([o, e - o]); o = e;
}
const total = seen.reduce((n, v) => n + v, 0);
writeFileSync(OUT, JSON.stringify({format: 1, scope: 'ROM bytes read by the native product in recorded live runs (tools/rom-reads-hook.mjs).', bytes: total, ranges}) + '\n');
console.log(`${total} gelesene Bytes (${total - before} neu), ${ranges.length} Bereiche`);
