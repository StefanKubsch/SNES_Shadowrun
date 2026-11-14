// Exploration of routes in the game with Mesen2 (tools/mesen/explore.lua), not part of the tests.
// node tools/mesen-explore.mjs <name> '<commands as JSON>' [--after door|exit|street|...] [--start 3000] [--limit 9000] [--out dir]
//   [--sram file.srm] [--timeout ms]
// With --after the checked plans of tools/mesen-f390-oracle.mjs run first. Prints natives (N),
// object changes under the glove (O), object areas as a summary and screenshots (PNG in --out).
// Test runner limit: about 100 s by default (timeoutMs raises it). With --sram Mesen starts with this save game (the
// command "sram" writes one to --out); in the title menu Start, down, Start, B loads slot 1 (Jake is in the room from
// about frame 1134).
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {findMesen, prepareScript, runMesen} from './mesen.mjs';
import {MORGUE_DOOR_PLAN, MORGUE_EXIT_PLAN, STREET_PLAN, SOUTHWEST_PLAN, ALLEY_PLAN, ALLEY_FIGHT_PLAN, DOG_DIALOG_PLAN,
  APARTMENT_PLAN, BED_PLAN, SHADES_PLAN, DESK_PHONE_PLAN} from './mesen-f390-oracle.mjs';

const PLANS = {door: MORGUE_DOOR_PLAN, exit: MORGUE_EXIT_PLAN, street: STREET_PLAN, southwest: SOUTHWEST_PLAN, alley: ALLEY_PLAN, fight: ALLEY_FIGHT_PLAN,
  dog: DOG_DIALOG_PLAN, apartment: APARTMENT_PLAN, bed: BED_PLAN, shades: SHADES_PLAN, desk: DESK_PHONE_PLAN};
const luaValue = value => Array.isArray(value) ? `{${value.map(luaValue).join(', ')}}` : typeof value === 'string' ? JSON.stringify(value) : String(value);

export async function explore(exe, commands, {start = 3000, limit = 9000, out = null, sram = null, cover = false, timeoutMs = 120000, onLine = () => {}} = {}) {
  const script = prepareScript('explore.lua', {START: start, LIMIT: limit, CMDS: luaValue(commands), COVER: cover ? 1 : 0});
  const result = {natives: [], objects: new Map(), shots: [], seeks: [], end: null};
  const {code} = await runMesen(exe, fileURLToPath(new URL('../Shadowrun (E).smc', import.meta.url)).replaceAll('\\', '/'), script, line => {
    const t = line.split(' ');
    if (t[0] === 'SRAM') {
      if (out) { const path = join(out, `${t[1]}.srm`); writeFileSync(path, Buffer.from(t[2], 'hex')); onLine(`sram ${path}`); }
      onLine(line);
      return;
    }
    if (t[0] === 'PNG') {
      if (out) { const path = join(out, `${t[1]}.png`); writeFileSync(path, Buffer.from(t[2], 'hex')); result.shots.push(path); onLine(`shot ${path}`); }
      return;
    }
    if (t[0] === 'N') result.natives.push({frame: +t[1], target: '$80' + t[2].toUpperCase()});
    else if (t[0] === 'O' && t[4] !== 'none') {
      const box = result.objects.get(t[4]) ?? {id: '$' + t[4].toUpperCase(), x0: 255, y0: 255, x1: 0, y1: 0, hits: 0};
      box.x0 = Math.min(box.x0, +t[2]); box.x1 = Math.max(box.x1, +t[2]); box.y0 = Math.min(box.y0, +t[3]); box.y1 = Math.max(box.y1, +t[3]); box.hits++;
      result.objects.set(t[4], box);
    } else if (t[0] === 'SEEK') result.seeks.push({id: '$' + t[1].toUpperCase(), found: t[2] === 'found', x: +t[3], y: +t[4]});
    else if (t[0] === 'END') result.end = +t[1];
    onLine(line);
  }, {timeoutMs, sram});
  if (code !== 0) throw Error(`Mesen ended with ${code} (test runner limit, about 100 s?)`);
  return {...result, objects: [...result.objects.values()]};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, json, ...rest] = process.argv.slice(2);
  const option = key => { const at = rest.indexOf(key); return at < 0 ? undefined : rest[at + 1]; };
  const {exe, reason} = findMesen();
  if (!exe || !name || !json) { console.log(exe ? 'Usage: node tools/mesen-explore.mjs <name> <commands> [--after door|exit|street] [--start n] [--limit n] [--out dir]' : `Mesen missing: ${reason}`); process.exit(1); }
  const out = option('--out') ?? join(tmpdir(), 'snes-explore', name);
  mkdirSync(out, {recursive: true});
  const commands = [...(PLANS[option('--after')] ?? []), ...JSON.parse(json)];
  const sram = option('--sram') ? readFileSync(option('--sram')) : null;
  const result = await explore(exe, commands, {start: +(option('--start') ?? 3000), limit: +(option('--limit') ?? 9000), out, sram,
    timeoutMs: +(option('--timeout') ?? 120000),
    onLine: line => { if (/^(N|T|P|X|SEEK|END|CTR|RD|shot|sram|W )/.test(line) || (process.env.EXPLORE_O && /^O /.test(line))) console.log(line); }});
  for (const box of result.objects) console.log(`OBJ ${box.id} x ${box.x0}..${box.x1} y ${box.y0}..${box.y1} (${box.hits})`);
}
