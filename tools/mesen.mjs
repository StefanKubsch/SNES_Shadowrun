// Mesen2 as a test oracle (STRATEGY.md, section 2): in tools and tests only,
// never in src/. Mesen lies outside the repository; MESEN_PATH names its folder or Mesen.exe.
import {existsSync, statSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, renameSync, createReadStream, createWriteStream} from 'node:fs';
import {join, dirname, basename, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createGzip, createGunzip} from 'node:zlib';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {processTempDir} from './temp-dir.mjs';

// Fixed emulator settings for reproducible runs, independent of settings.json.
export const MESEN_OVERRIDES = ['--snes.ramPowerOnState=AllZeros', '--snes.enableRandomPowerOnState=false', '--snes.region=Auto'];

// Path to Mesen.exe, or null (with a reason) when no emulator is available.
export function findMesen(env = process.env) {
  const configured = env.MESEN_PATH;
  if (!configured) return {exe: null, reason: 'MESEN_PATH not set'};
  const exe = existsSync(configured) && statSync(configured).isDirectory() ? join(configured, 'Mesen.exe') : configured;
  return existsSync(exe) ? {exe, reason: null} : {exe: null, reason: `Mesen.exe not found: ${exe}`};
}

// Lua template with its parameters as a temporary file. Each script gets its own numbered
// subdirectory (same file name) in one directory per process, removed at process exit.
let scriptCount = 0;
export function prepareScript(name, parameters) {
  const body = readFileSync(new URL(`./mesen/${name}`, import.meta.url), 'utf8');
  const header = Object.entries(parameters).map(([key, value]) => `local ${key} = ${value}\n`).join('');
  const dir = join(processTempDir('snes-mesen-'), String(++scriptCount));
  mkdirSync(dir);
  const path = join(dir, name);
  writeFileSync(path, header + body);
  return path;
}

// Starts the headless test runner and passes every stdout line to onLine.
// Mesen's warnings about uninitialised reads are dropped.
// Every run gets its own ROM copy with a unique name: Mesen keeps the saved game
// (Saves/<name>.srm) per ROM name; a shared saved game made parallel runs
// depend on each other. So the run starts with fresh SRAM (or with sram, 8 KiB, as the saved game), and the
// saved game is removed afterwards.
export async function runMesen(exe, rom, script, onLine, {timeoutMs = 300000, sram = null, overrides = [], keep = null} = {}) {
  const cached = recordingCache(exe, rom, script, timeoutMs, sram, overrides, keep);
  if (cached?.hit) return replayRecording(cached, exe, onLine);
  const copy = join(mkdtempSync(join(tmpdir(), 'snes-rom-')), `run-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.smc`);
  copyFileSync(rom, copy);
  const save = join(dirname(exe), 'Saves', basename(copy).replace(/\.smc$/, '.srm'));
  if (sram) { mkdirSync(dirname(save), {recursive: true}); writeFileSync(save, sram); }
  const sink = cached ? openSink(cached) : null;
  try {
    const result = await spawnMesen(exe, copy.replaceAll('\\', '/'), script, sink ? line => { sink.write(line); onLine(line); } : onLine, timeoutMs, overrides);
    if (sink) await sink.finish(result);
    return result;
  } finally { sink?.discard(); rmSync(dirname(copy), {recursive: true, force: true}); rmSync(save, {force: true}); }
}

// Recording cache: SNES_MESEN_CACHE=1 (verify:release) replays, or records and stores;
// record (verify:release:full) always records afresh and overwrites the entry. With fixed overrides Mesen is deterministic: the same program file,
// core, settings.json, ROM, Lua script, arguments and saved game give the same lines.
// Only a run with code 0 that the caller confirms as complete through keep() is
// stored. The comparison of the VM against the lines runs in full on every replay.
const cacheDir = () => process.env.SNES_MESEN_CACHE_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'mesen');
const fileHashes = new Map();
function fileHash(path) {
  if (!existsSync(path)) return 'missing';
  const info = statSync(path), tag = info.size + ':' + info.mtimeMs, hit = fileHashes.get(path);
  if (hit?.tag === tag) return hit.value;
  const value = createHash('sha256').update(readFileSync(path)).digest('hex');
  fileHashes.set(path, {tag, value}); return value;
}
export function recordingCache(exe, rom, script, timeoutMs, sram, overrides, keep) {
  const mode = process.env.SNES_MESEN_CACHE;
  if (mode !== '1' && mode !== 'record' || typeof keep !== 'function') return null;
  const parts = {format: 1, exe: fileHash(exe), core: fileHash(join(dirname(exe), 'MesenCore.dll')), settings: fileHash(join(dirname(exe), 'settings.json')),
    rom: fileHash(rom), script: createHash('sha256').update(readFileSync(script)).digest('hex'),
    args: ['--testrunner', `--timeout=${Math.ceil(timeoutMs/1000)}`, ...MESEN_OVERRIDES, ...overrides],
    sram: sram ? createHash('sha256').update(sram).digest('hex') : null};
  const key = createHash('sha256').update(JSON.stringify(parts)).digest('hex'), base = join(cacheDir(), key);
  return {lines: base + '.lines.gz', head: base + '.json', keep, hit: mode === '1' && existsSync(base + '.json')};
}
// Lines as latin1 with \n, gzipped; the head (code, stderr, run time, line count) is written last
// and makes the recording valid.
export function openSink(cached) {
  mkdirSync(cacheDir(), {recursive: true});
  const temp = cached.lines + '.' + process.pid + '-' + Math.random().toString(36).slice(2, 8) + '.tmp';
  const gzip = createGzip({level: 1}), file = createWriteStream(temp);gzip.pipe(file);
  let lines = 0, done = false;
  return {
    write(line) { lines++; gzip.write(Buffer.from(line + '\n', 'latin1')); },
    async finish({code, stderr, elapsedMs}) {
      gzip.end();await once(file, 'close');done = true;
      if (code !== 0 || !cached.keep()) return;
      renameSync(temp, cached.lines);
      const head = cached.head + '.' + process.pid + '.tmp';
      writeFileSync(head, JSON.stringify({code, stderr, elapsedMs, lines}));renameSync(head, cached.head);
    },
    discard() { if (!done) { gzip.destroy(); file.destroy(); } rmSync(temp, {force: true}); },
  };
}
export async function replayRecording(cached, exe, onLine) {
  // For the release cache Mesen remains an input, even when it does not start.
  process.emit('snes-track-external', exe);
  const head = JSON.parse(readFileSync(cached.head, 'utf8'));
  const stream = createReadStream(cached.lines).pipe(createGunzip());stream.setEncoding('latin1');
  let rest = '', lines = 0;
  for await (const chunk of stream) {
    const parts = (rest + chunk).split('\n');rest = parts.pop();
    for (const line of parts) { lines++; onLine(line); }
  }
  if (rest || lines !== head.lines) throw Error('Mesen recording cache damaged: ' + cached.lines);
  return {code: head.code, stderr: head.stderr, elapsedMs: head.elapsedMs, cached: true};
}

function spawnMesen(exe, rom, script, onLine, timeoutMs, overrides) {
  return new Promise((resolve, reject) => {
    // Mesen defaults to 100 seconds, independently of our process watchdog.
    // Pass the caller's deadline to both; reducing parallelism does not fix
    // an inner timeout that silently expires before the requested budget.
    const started=Date.now();
    const child = spawn(exe, ['--testrunner', `--timeout=${Math.ceil(timeoutMs/1000)}`, rom, script, ...MESEN_OVERRIDES, ...overrides], {stdio: ['ignore', 'pipe', 'pipe']});
    let rest = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(Error(`Mesen time limit ${timeoutMs} ms`)); }, timeoutMs);
    child.stdout.setEncoding('latin1');
    child.stdout.on('data', chunk => {
      const lines = (rest + chunk).split('\n'); rest = lines.pop();
      for (const line of lines) if (!line.startsWith('[CPU] Uninitialized')) onLine(line.replace(/\r$/, ''));
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (rest) onLine(rest.replace(/\r$/, ''));
      resolve({code, stderr, elapsedMs:Date.now()-started});
    });
  });
}
