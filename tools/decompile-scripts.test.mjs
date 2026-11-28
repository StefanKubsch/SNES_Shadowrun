// The decompiled scripts (src/scripts/, docs/READABLE-GAME.md phase 2) behave as the
// bytecode interpreter does: for every script and several runs with different arguments,
// native and script results and game state, both make the same calls with the same
// arguments, the same state writes in the same order, and end with the same result.
// And src/scripts/ is what tools/decompile-scripts.mjs makes of the current assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { createTask, finishCall, runTask, EXIT_END } from './script-interpreter.mjs';
import { SCRIPTS } from '../src/scripts/index.mjs';
import { ScriptEnd, NATIVE } from '../src/scripts/runtime.mjs';
import { scriptState } from '../src/state/scripts.mjs';
import { decompileAll } from './decompile-scripts.mjs';

const assets = JSON.parse(readFileSync(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const { scripts, nativeFunctions: natives } = assets;
// Bounds of one run: calls, and state reads (a loop that only polls state).
const CALLS = 400,
  READS = 20000,
  RUNS = 16,
  STEER = 5,
  WRAM_START = 0x7e0000,
  WRAM_END = 0x800000;

// A small deterministic generator (xorshift32).
function random(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}
// Words that steer branches: zero, true, small numbers, any word, and now and then one
// of the script's own constants (the values it compares with).
function words(seed, pool = []) {
  const next = random(seed);
  return () => {
    const r = next();
    if (pool.length && r % STEER === STEER - 1) return pool[(r >>> 8) % pool.length];
    switch (r % 4) {
      case 0:
        return 0;
      case 1:
        return 0xffff;
      case 2:
        return (r >>> 8) % 8;
      default:
        return (r >>> 8) & 0xffff;
    }
  };
}
// The constants a script pushes (push_u8, push_i8 and push_u16).
function constants(code) {
  const pool = new Set();
  for (let pc = 0; pc + 2 < code.length; pc++) {
    if (code[pc] === 0x00 || code[pc] === 0x0a) pool.add(code[pc + 1]);
    if (code[pc] === 0x14) pool.add(code[pc + 1] | (code[pc + 2] << 8));
  }
  return [...pool];
}

// A memory whose work memory is seeded, with its state writes logged. A state byte or
// word read for the first time may take one of the script's constants.
function memory(seed, log, pool) {
  const wram = new Uint8Array(0x20000),
    fill = random(seed * 7 + 3),
    steer = words(seed * 5 + 1, pool),
    touched = new Set();
  // Mostly small bytes, so that flags and counters take both ways.
  for (let n = 0; n < wram.length; n++) {
    const r = fill();
    wram[n] = r % 3 === 0 ? 0 : r % 3 === 1 ? r >>> 24 : (r >>> 24) & 7;
  }
  const mem = new VmMemory(cartridge.rom, wram, null, cartridge.present);
  let reads = 0;
  const inWram = (at) => at >= WRAM_START && at < WRAM_END;
  const read8 = mem.read8.bind(mem),
    read16 = mem.read16.bind(mem),
    write8 = mem.write8.bind(mem),
    write16 = mem.write16.bind(mem);
  const first = (at, bytes) => {
    if (!inWram(at)) return;
    if (++reads > READS) throw new Error('reads');
    if (touched.has(at)) return;
    const v = steer();
    for (let n = 0; n < bytes; n++) touched.add(at + n);
    if (v & 1 || v === 0) {
      wram[at - WRAM_START] = v & 0xff;
      if (bytes === 2) wram[at - WRAM_START + 1] = v >>> 8;
    }
  };
  mem.read8 = (at) => (first(at, 1), read8(at));
  mem.read16 = (at) => (first(at, 2), read16(at));
  mem.write8 = (at, v) => (inWram(at) && log.push(['w8', at, v & 0xff]), write8(at, v));
  mem.write16 = (at, v) => (inWram(at) && log.push(['w16', at, v & 0xffff]), write16(at, v));
  return mem;
}

function interpreterRun(id, args, seed) {
  const log = [],
    pool = constants(scripts[id].bytecode),
    mem = memory(seed, log, pool),
    result = words(seed * 13 + 5, pool);
  try {
    const task = createTask(mem, id, args);
    for (let calls = 0; calls < CALLS; calls++) {
      const exit = runTask(mem, task, 1e7);
      if (exit.kind === EXIT_END) {
        log.push(['end', exit.result]);
        return log;
      }
      log.push([exit.kind, exit.id, ...exit.args]);
      const word = result();
      finishCall(mem, task, word);
    }
  } catch (error) {
    log.push(['stop', error.message]);
  }
  return log;
}

function decompiledRun(id, args, seed) {
  const log = [],
    pool = constants(scripts[id].bytecode),
    mem = memory(seed, log, pool),
    result = words(seed * 13 + 5, pool);
  try {
    const run = SCRIPTS[id](scriptState(mem), ...args);
    let next = run.next();
    for (let calls = 0; calls < CALLS; calls++) {
      if (next.done) {
        log.push(['end', next.value]);
        return log;
      }
      const { kind, id: callee, args: callArgs } = next.value;
      log.push([kind, callee, ...callArgs]);
      const word = result();
      const returns = kind === NATIVE ? natives[callee].returnBytes : scripts[callee].returnBytes;
      log.push(['result']);
      next = run.next(returns ? word : undefined);
    }
  } catch (error) {
    if (error instanceof ScriptEnd) log.push(['end', error.result]);
    else log.push(['stop', error.message]);
  }
  return log;
}

// Compare up to the first stop of the interpreter (a frontier the decompiled code may
// meet elsewhere) or the call bound.
function compare(a, b) {
  const stop = a.findIndex((entry) => entry[0] === 'stop');
  const length = stop === -1 ? a.length : stop;
  const strip = (log) => log.filter((entry) => entry[0] !== 'result').slice(0, length);
  return [strip(a), strip(b).slice(0, strip(a).length)];
}

test('every decompiled script calls, writes and ends as the interpreter', () => {
  const failures = [];
  for (const s of scripts) {
    for (let run = 0; run < RUNS; run++) {
      const seed = s.id * 31 + run + 1,
        argument = words(seed * 17 + 11),
        args = Array.from({ length: s.argumentBytes >>> 1 }, argument);
      const [a, b] = compare(interpreterRun(s.id, args, seed), decompiledRun(s.id, args, seed));
      try {
        assert.deepEqual(b, a);
      } catch {
        const at = a.findIndex((entry, n) => JSON.stringify(entry) !== JSON.stringify(b[n]));
        failures.push(
          `${s.id.toString(16)} run ${run}: ${JSON.stringify(a[at])} vs ${JSON.stringify(b[at])}`,
        );
        break;
      }
    }
  }
  assert.deepEqual(failures.slice(0, 20), [], `${failures.length} scripts differ`);
});

test('src/scripts/ is the decompiler output of the current scripts', async () => {
  const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  const files = await decompileAll(mem);
  for (const [name, text] of files)
    assert.equal(
      readFileSync(new URL(`../src/scripts/${name}`, import.meta.url), 'utf8'),
      text,
      `src/scripts/${name} drifts from tools/decompile-scripts.mjs`,
    );
});
