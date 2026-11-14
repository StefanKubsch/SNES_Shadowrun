// Erzeugt einen Spielstand aus SAVES (tools/mesen-f390-oracle.mjs) in Mesen2 neu und legt ihn unter tools/mesen/saves/ ab.
// node tools/mesen-save.mjs <name>
// Der Plan läuft ab Frame 3000 wie die Orakelpläne; danach gibt der Befehl "sram" den Spielstand aus. Die ausgegebene
// Prüfsumme gehört in SAVES[name].sha256.
import {mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {findMesen} from './mesen.mjs';
import {explore} from './mesen-explore.mjs';
import {SAVES} from './mesen-f390-oracle.mjs';

export async function createSave(exe, name) {
  const save = SAVES[name];
  if (!save) throw Error(`Unbekannter Spielstand: ${name}`);
  let bytes = null;
  await explore(exe, [...save.plan, ['sram', name]], {start: 3000, limit: 30000, onLine: line => {
    if (line.startsWith(`SRAM ${name} `)) bytes = Buffer.from(line.slice(6 + name.length), 'hex');
  }});
  if (!bytes || bytes.length !== 0x2000) throw Error(`Kein Spielstand ${name} ausgegeben`);
  return bytes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2], {exe, reason} = findMesen();
  if (!exe || !SAVES[name]) { console.log(exe ? `Aufruf: node tools/mesen-save.mjs <${Object.keys(SAVES).join('|')}>` : `Mesen fehlt: ${reason}`); process.exit(1); }
  const bytes = await createSave(exe, name), dir = new URL('./mesen/saves/', import.meta.url);
  mkdirSync(dir, {recursive: true});
  writeFileSync(new URL(SAVES[name].file, dir), bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  console.log(`${name}: ${SAVES[name].file}, sha256 ${sha256}${sha256 === SAVES[name].sha256 ? ' (wie eingetragen)' : ' (neu, in SAVES eintragen)'}`);
}
