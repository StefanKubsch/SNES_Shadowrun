// The remaining references of src/ to the original system (docs/READABLE-GAME.md): ROM
// and WRAM addresses, direct page and hardware register names, and address notation in
// comments. The presentation layer src/platform/ may speak to the system (decision 6)
// and is counted apart. `node tools/agnostic-counts.mjs` prints the counts and the files with the
// most references; tools/agnostic-ratchet.test.mjs keeps them from growing.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url)),
  PLATFORM = 'platform';
const list = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(join(dir, e.name)) : e.name.endsWith('.mjs') ? [join(dir, e.name)] : [],
  );
const code = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
const comments = (text) => (text.match(/\/\/.*$/gm) ?? []).join('\n');
// The listing: the files with the most references, and the width of the count column.
const LISTED_FILES = 25,
  COUNT_WIDTH = 6;
const count = (text, pattern) => (text.match(pattern) ?? []).length;

// What is counted, by measure: [pattern, part of the file].
const MEASURES = {
  // Long addresses of the ROM banks (80:0000 and up) as literals in code.
  romLiterals: [/\b0x[89a-f][0-9a-f]{5}\b/gi, code],
  // Imports of the WRAM layout and of the hardware register names.
  wramImports: [/from '[./]*(?:\.\.\/)?data\/wram\.mjs'|from '\.\/wram\.mjs'/g, (t) => t],
  hardwareImports: [/hardware-registers\.mjs'/g, (t) => t],
  // Direct page names (DP_...), used anywhere in code.
  directPageNames: [/\bDP_[A-Z0-9_]+/g, code],
  // Address notation such as 80:9022 or 7E:1C76 in comments.
  addressComments: [/\b[0-9A-F]{2}:[0-9A-F]{4}\b/g, comments],
};

export function agnosticCounts() {
  const totals = Object.fromEntries(Object.keys(MEASURES).map((k) => [k, 0])),
    platform = { ...totals },
    perFile = [];
  for (const file of list(SRC)) {
    const inPlatform = file.slice(SRC.length).split(/[\\/]/)[0] === PLATFORM;
    const text = readFileSync(file, 'utf8');
    let sum = 0;
    for (const [name, [pattern, part]] of Object.entries(MEASURES)) {
      const n = count(part(text), pattern);
      if (inPlatform) platform[name] += n;
      else totals[name] += n;
      sum += n;
    }
    if (sum && !inPlatform) perFile.push([sum, file.slice(SRC.length).split('\\').join('/')]);
  }
  perFile.sort((a, b) => b[0] - a[0]);
  return { totals, platform, perFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { totals, platform, perFile } = agnosticCounts();
  console.log(JSON.stringify(totals, null, 2));
  console.log(`src/${PLATFORM}/ (presentation layer, not limited): ${JSON.stringify(platform)}`);
  console.log(`${perFile.length} files; most references:`);
  for (const [n, file] of perFile.slice(0, LISTED_FILES))
    console.log(`${String(n).padStart(COUNT_WIDTH)}  ${file}`);
}
