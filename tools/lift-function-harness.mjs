// Random per-function tests of lifted code against the register-level reference
// (docs/MATRIX-LIFT.md). A sample is a random WRAM image; both sides run one
// routine on their own copy and must leave the same game state: the same WRAM (outside
// the ignored scratch, the CPU stacks and the free bytes below the entry S), the same
// device writes, the same picture state and the same result,
// or stop at the same frontier. Game state only (user, 2026-11-14): registers, flags
// and stack bytes count only where a callee or caller reads them as an argument or
// result; stand-ins record their inputs with calleeRecord. Shared by the *-lift-functions tests.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { dialogAccess } from './register-forms/native-dialog-support.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { PictureVideo } from '../src/video/picture-video.mjs';
import { setLiveChannels } from './picture-fixture.mjs';
import {
  DMAP0,
  HDMAEN,
  INIDISP,
  MDMAEN,
  MPYH,
  MPYL,
  RDVRAMH,
  RDVRAML,
  SETINI,
} from '../src/constants/hardware-registers.mjs';

const STACK = 0x1c9,
  // The main and NMI stacks: return words and saved registers, no game state.
  CPU_STACKS = [
    [0x0100, 0x01ca],
    [0x1c7c, 0x1cbc],
  ],
  // The free bytes below the entry S that a routine's own frames and pushes may leave
  // (the task stacks 7E:1E80-1EEF are this deep); no code reads them before it pushes
  // again, so they are not game state (user decision 2026-11-17).
  FREE_STACK_DEPTH = 0x70,
  APU_PORT_0 = 0x2140,
  APU_COMMAND_TOKEN = 0x1ce4,
  // Bank 81 for the data bank and the long caller frame.
  LONG_CALLER_BANK = 0x81,
  SAMPLES = 300,
  CALLER_RETURN = 0x1234,
  BYTE_VALUES = 0x100,
  WORD_VALUES = 0x10000,
  COUNTER_SALT = 0x5a5a5a5a,
  WORD_BANK_SHIFT = 16,
  LISTED_BYTES = 8,
  HEX = 16,
  BYTE_BITS = 8,
  // Frozen vector entries: a flag digit (bit 0 the reference stopped, bit 1 it returned a
  // result) and the first KEY_DIGITS hex digits of the outcome's hash; 0 marks a sample
  // beyond the reference budget.
  STOPPED_FLAG = 1,
  RESULT_FLAG = 2,
  KEY_DIGITS = 12,
  // The last DMA channel register (channel 7, 437F).
  DMA_REGISTERS_END = 0x437f;

// The register ports the picture back end takes: the PPU registers, the DMA starts and
// the DMA channel registers.
const isPicturePort = (at) =>
  (at >= INIDISP && at <= SETINI) ||
  at === MDMAEN ||
  at === HDMAEN ||
  (at >= DMAP0 && at <= DMA_REGISTERS_END);
// The picture state of a side as one byte array: video memory, palette, OAM and the
// scalar settings (removal plan step 5: the frozen tests compare the picture state, not
// the PPU register writes; user decision 2026-11-26).
export function pictureState(picture) {
  const settings = picture.settings(),
    parts = [
      picture.vram,
      new Uint8Array(picture.palette.buffer),
      picture.oam,
      new Uint8Array(settings.buffer, settings.byteOffset, settings.byteLength),
    ],
    out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// One side: a task accessor on its own copy of the sample's WRAM with its device
// writes recorded. The picture back end (src/video/picture-video.mjs) is the device bus:
// lifted code calls it directly, register-level code reaches it through its PPU and
// DMA register writes, and only the other device writes are listed. The sound driver
// echoes the command token on APU port 0; the multiplication product and VRAM read-back
// come from the picture; other reads (beam counters, joypad) get the same sequence of
// the sample on both sides.
// prepare(mem, s) may add language state to the memory.
export function createSide(s, routines, prepare = () => {}) {
  // The sample's SRAM, if it has one.
  const mem = new DialogTestMemory(s.wram.slice(), s.sram?.slice() ?? null);
  prepare(mem, s);
  const a = new TaskAccessor({
    mem,
    a: 0,
    x: 0,
    y: 0,
    s: STACK,
    d: 0,
    dbr: LONG_CALLER_BANK,
    p: 0,
    pc: 0,
  });
  a.load();
  a.ctx.programBank = LONG_CALLER_BANK;
  const writes = [],
    counter = prng(s.seed ^ COUNTER_SALT),
    record = (address, value, width) =>
      writes.push([address & (WORD_VALUES - 1), value, width].join());
  // DMA sources of random states may point at unmapped addresses, where the hardware
  // reads open bus; both sides read 0 there.
  const picture = new PictureVideo({
    read8(address) {
      try {
        return mem.read8(address);
      } catch (error) {
        if (error.reason !== 'unmapped_read') throw error;
        return 0;
      }
    },
    write8: (address, value) => mem.write8(address, value),
  });
  setLiveChannels(picture);
  // The CPU registers of the scene default reach the write list as hardware writes.
  picture.system = record;
  const pictureRead = (at) => {
    if (at === RDVRAML || at === RDVRAMH) return picture.readVram(at);
    if (at >= MPYL && at <= MPYH) return picture.readProduct(at);
    return null;
  };
  a.io = [];
  a.devices = {
    bus: picture,
    read(address, width) {
      const at = address & (WORD_VALUES - 1);
      if (at === APU_PORT_0) return mem.wram[APU_COMMAND_TOKEN];
      const low = pictureRead(at);
      if (low !== null) return width === 1 ? low : low | (pictureRead(at + 1) << BYTE_BITS);
      return (
        Math.floor(counter() * WORD_VALUES) & (width === 1 ? BYTE_VALUES - 1 : WORD_VALUES - 1)
      );
    },
    write(pc, address, value, width) {
      if (isPicturePort(address & (WORD_VALUES - 1))) picture.write(pc, address, value, width);
      else record(address, value, width);
    },
  };
  return { mem, a, h: dialogAccess(a), writes, picture, routines };
}
// A stand-in's record of one call: its target, the direct page words it reads (dp, a list
// of offsets) and the registers it reads as arguments (registers, a list of names such
// as 'a' or 'x'), as one string.
export function calleeRecord(target, h, { dp = [], registers = [] } = {}) {
  const { wram } = h.a.mem,
    words = dp.map((at) => wram[at] | (wram[at + 1] << BYTE_BITS));
  return [target, ...registers.map((name) => h.a.ctx[name]), ...words]
    .map((v) => v.toString(HEX))
    .join(':');
}
export function outcome(state, run, ignored) {
  let result, stop;
  try {
    result = run();
  } catch (error) {
    if (!error.reason) throw error;
    stop = error.reason;
  }
  const wram = state.mem.wram.slice();
  for (const [from, to] of [...CPU_STACKS, ...ignored]) wram.fill(0, from, to);
  return {
    result,
    stop,
    wram,
    sram: state.mem.sram?.slice(),
    writes: state.writes,
    picture: state.picture ? pictureState(state.picture) : null,
  };
}
export function differences({ want, got }) {
  const out = [];
  if (want.stop !== got.stop) out.push(`stop ${want.stop} / ${got.stop}`);
  if (want.stop || got.stop) return out;
  if (want.result !== undefined && want.result !== got.result)
    out.push(`result ${want.result} / ${got.result}`);
  const bytes = [];
  for (let i = 0; i < want.wram.length && bytes.length < LISTED_BYTES; i++)
    if (want.wram[i] !== got.wram[i])
      bytes.push(`${i.toString(HEX)}:${want.wram[i].toString(HEX)}/${got.wram[i].toString(HEX)}`);
  if (bytes.length) out.push(`wram ${bytes.join(' ')}`);
  if (want.sram && want.sram.some((v, i) => v !== got.sram[i])) out.push('sram');
  if (want.writes.join(';') !== got.writes.join(';'))
    out.push(`writes ${want.writes.length} / ${got.writes.length}`);
  if (want.picture && !want.picture.every((v, i) => v === got.picture?.[i])) out.push('picture');
  return out;
}

// A case: entry (the routine in the reference table), long (RTL), prepare(s) (the
// register inputs; may narrow the sample), reference(h, e, r) (instead of the table
// entry), events() (for the reference), lifted(m, input), result(h) (the reference
// result), samples. side(s) builds a side; runtime(h) the lifted runtime.
// shake: invert the ignored bytes of the sample first (see readsIgnoredBytes).
function caseInput(c, s, ignored, shake) {
  const input = { a: 0, x: 0, y: 0, ...c.prepare?.(s) },
    entryStack = input.s ?? STACK,
    free = [...CPU_STACKS, [Math.max(0, entryStack - FREE_STACK_DEPTH), entryStack + 1]];
  ignored = [...ignored, ...free];
  if (shake)
    for (const [from, to] of ignored)
      for (let at = from; at < to; at++) s.wram[at] ^= BYTE_VALUES - 1;
  return { input, ignored };
}
// The lifted side of a case alone (frozen vectors need no reference).
export function liftedOutcome(c, s, { side, runtime, ignored }, shake = false) {
  const prepared = caseInput(c, s, ignored, shake);
  // The reference side is built first in compareCase; building it here too keeps any
  // draw a side makes from the sample in the same order.
  side(s);
  const lifted = side(s);
  return outcome(lifted, () => c.lifted(runtime(lifted.h), prepared.input), prepared.ignored);
}
export function compareCase(c, s, { side, runtime, ignored }, shake = false) {
  const prepared = caseInput(c, s, ignored, shake),
    input = prepared.input;
  ignored = prepared.ignored;
  const reference = side(s);
  Object.assign(reference.a.ctx, input);
  // The routine runs in its own bank; long routines (RTL) get a long caller frame.
  reference.a.ctx.programBank = c.entry >>> WORD_BANK_SHIFT;
  if (c.long) reference.h.pushByte(LONG_CALLER_BANK);
  reference.h.push(CALLER_RETURN, 2);
  const want = outcome(
    reference,
    () => {
      (c.reference ?? reference.routines.get(c.entry))(
        reference.h,
        c.events?.() ?? null,
        reference.routines,
      );
      return c.result?.(reference.h);
    },
    ignored,
  );
  const lifted = side(s);
  const got = outcome(lifted, () => c.lifted(runtime(lifted.h), input), ignored);
  return { want, got };
}

// Whether the lifted outcome of a sample changes with its ignored bytes (scratch and free
// stack bytes): an out-of-range pointer of such a sample reads them, where only the
// register-level reference leaves its pushes and locals (game state only, user decision
// 2026-11-17).
function readsIgnoredBytes(c, sampleOf, options, got) {
  const shaken = compareCase(c, sampleOf(), options, true).got;
  return differences({ want: got, got: shaken }).length > 0;
}

// Frozen reference vectors (user decision 2026-11-25): before a register-level reference
// leaves proof/, its outcome on every sample is kept as a hash in
// tools/lift-vectors/<test>.json.gz, and the lifted side is compared with that hash. The
// samples come from their seeds, so a changed sample function needs new vectors (which
// only the reference can record). LIFT_VECTORS=record runs the references and writes the
// vectors of every case a test file registers.
const VECTOR_DIRECTORY = new URL('./lift-vectors/', import.meta.url);
const recording = process.env.LIFT_VECTORS === 'record',
  // Re-keying (removal plan step 5, 2026-11-26): the frozen vectors are re-hashed from the
  // lifted outcomes after a change that alters what an outcome holds (2026-11-26: the PPU
  // register writes became the picture state; 2026-11-27: register forms of proof/ gave
  // way to lifted ones). A sample of registerCases gets a new vector only when its
  // former outcome (the case's rekeyFrom.lifted, else its lifted) still matches the old
  // one; rekeyFrom.dropResult drops the compared registers (game state only). A caller
  // vector's evidence is a passing run with the old vectors just before. A stop that
  // appears or disappears with the change fails instead of being frozen.
  rekeying = process.env.LIFT_VECTORS === 'rekey';
let vectorFile = null,
  vectors = null;
export function useLiftVectors(testUrl) {
  vectorFile = new URL(
    `${basename(fileURLToPath(testUrl)).replace(/.test.mjs$/, '')}.json.gz`,
    VECTOR_DIRECTORY,
  );
  vectors = existsSync(vectorFile) ? JSON.parse(gunzipSync(readFileSync(vectorFile))) : {};
  beforeEach((t) => {
    currentTest = t.fullName;
    currentSite = 0;
  });
  if (!recording && !rekeying) return;
  const file = vectorFile,
    store = vectors;
  after(() => {
    mkdirSync(VECTOR_DIRECTORY, { recursive: true });
    const sorted = Object.fromEntries(Object.entries(store).sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(file, gzipSync(JSON.stringify(sorted)));
  });
}
// The outcome as one key: a stop alone, otherwise the result (where the reference has
// one), WRAM, SRAM and device writes, as differences() compares them.
function outcomeKey(o, withResult) {
  if (o.stop) return `stop:${o.stop}`;
  const hash = createHash('sha256');
  if (withResult) hash.update(`result:${String(o.result)};`);
  hash.update(o.wram);
  if (o.sram) hash.update(o.sram);
  hash.update(o.writes.join(';'));
  if (o.picture) hash.update(o.picture);
  return hash.digest('hex').slice(0, KEY_DIGITS);
}
const vectorEntry = (want) =>
  `${(want.stop ? STOPPED_FLAG : 0) | (want.result !== undefined ? RESULT_FLAG : 0)}${outcomeKey(
    want,
    want.result !== undefined,
  )}`;
// A single frozen comparison outside registerCases: whether the lifted outcome got matches
// the frozen reference outcome number index of the series name. While recording, want()
// gives the reference outcome, which is kept and compared as before; once the reference
// is retired, want is null and the series can no longer be recorded.
export function matchesFrozen(name, index, want, got) {
  if (recording) {
    if (!want)
      throw new Error(`${name}: the reference is retired; its vectors cannot be recorded again`);
    const reference = want();
    (vectors[name] ??= [])[index] = vectorEntry(reference);
    return differences({ want: reference, got }).length === 0;
  }
  const entry = vectors?.[name]?.[index];
  if (entry === undefined) throw new Error(`no frozen vector ${name} ${index}`);
  if (rekeying) {
    vectors[name][index] = rekeyedEntry(entry, got, name);
    return true;
  }
  return outcomeKey(got, (Number(entry[0]) & RESULT_FLAG) !== 0) === entry.slice(1);
}
// A frozen entry re-hashed from the lifted outcome, with the reference's flags.
function rekeyedEntry(entry, got, name, drop = 0) {
  const flags = Number(entry[0]) & ~drop;
  if (!!(flags & STOPPED_FLAG) !== !!got.stop)
    throw new Error(`${name}: rekeying changed whether the outcome stops (${got.stop})`);
  return `${flags}${outcomeKey(got, (flags & RESULT_FLAG) !== 0)}`;
}

// A canonical text of a caller result for its hash: equal under assert.deepEqual (strict)
// means equal text. Typed arrays keep their type, objects their sorted keys and class.
function canonical(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'undefined':
      return 'u';
    case 'number':
      return Object.is(value, -0) ? 'n-0' : `n${value}`;
    case 'bigint':
      return `i${value}`;
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 't' : 'f';
    case 'object':
      break;
    default:
      throw new Error(`a frozen caller result cannot hold a ${typeof value}`);
  }
  if (ArrayBuffer.isView(value))
    return `${value.constructor.name}(${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')})`;
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(',')}]`;
  if (value instanceof Map)
    return `Map{${[...value].map(([k, v]) => `${canonical(k)}:${canonical(v)}`).join(',')}}`;
  if (value instanceof Set) return `Set{${[...value].map(canonical).join(',')}}`;
  const prototype = Object.getPrototypeOf(value),
    kind = prototype === null ? 'null' : prototype.constructor?.name;
  return `${kind}{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(',')}}`;
}
const callerKey = (value) =>
  createHash('sha256').update(canonical(value)).digest('hex').slice(0, KEY_DIGITS);

// Frozen input data (removal plan step 5): a value only a retired reference can produce,
// such as the WRAM a register-level initialization leaves. While recording, produce()
// makes it and it is stored under name; otherwise the stored value is returned.
export function frozenData(name, produce) {
  if (recording) return (vectors[name] = produce());
  const value = vectors?.[name];
  if (value === undefined) throw new Error(`no frozen data ${name}`);
  return value;
}

// Frozen caller comparisons (removal plan step 3): a caller test compared a fixed scenario
// run with the lifted module and with the former proof/caller module. The former result
// is kept as a hash per test name and comparison site (the n-th call within the test);
// former() runs the former module only while recording (LIFT_VECTORS=record) and is null
// once the module is retired. The test's name comes from a beforeEach hook that
// useLiftVectors installs.
let currentTest = null,
  currentSite = 0;
export function assertFrozenRun(got, former, message) {
  if (currentTest === null) throw new Error('assertFrozenRun needs useLiftVectors');
  const name = `${currentTest}#${currentSite++}`;
  // A retired site keeps its frozen vector while other sites of the file are recorded.
  if (recording && former) {
    const want = former();
    assert.deepEqual(got, want, message);
    const key = callerKey(want);
    assert.equal(callerKey(got), key, `${name}: equal results have one key`);
    vectors[name] = key;
    return;
  }
  const key = vectors?.[name];
  if (key === undefined) throw new Error(`no frozen caller vector ${name}`);
  if (rekeying) {
    vectors[name] = callerKey(got);
    return;
  }
  assert.equal(callerKey(got), key, message ?? `${name}: matches the former caller`);
}

// Register one test per case. outside: lifted stops that mark a sample outside the
// lifted domain (counted, at most 10 %, together with differing samples whose lifted
// outcome depends on free stack bytes); the reference's access budget stop counts as
// unmeasured (at most 2 %).
export function registerCases(
  cases,
  { sample, side, runtime, ignored, samples = SAMPLES, outside = new Set() },
) {
  const store = vectors;
  for (const c of cases)
    test(`${c.name}: the lifted function matches the reference on random states`, () => {
      let stopped = 0,
        unmeasured = 0,
        beyond = 0;
      const count = c.samples ?? samples,
        frozen = !recording && store?.[c.name],
        rekeyed = rekeying ? (store[c.name] = frozen.slice()) : null,
        record = recording && store ? (store[c.name] = []) : null;
      if (frozen) assert.equal(frozen.length, count, 'frozen vectors cover every sample');
      for (let seed = 1; seed <= count; seed++) {
        const sampleOf = () => sample(seed * 7919 + c.entry), // magic-number-ok: a prime that spreads the seeds
          options = { side, runtime, ignored };
        if (frozen) {
          const entry = frozen[seed - 1];
          if (entry === 0) {
            unmeasured++;
            continue;
          }
          const got = liftedOutcome(c, sampleOf(), options);
          if (outside.has(got.stop)) {
            beyond++;
            continue;
          }
          const flags = Number(entry[0]);
          if (rekeyed) {
            // Only a sample whose former outcome still matches its old vector gets a
            // new one; the others keep theirs (outside the domain).
            const former = c.rekeyFrom ? { ...c, lifted: c.rekeyFrom.lifted } : c,
              old = liftedOutcome(former, sampleOf(), options);
            if (outcomeKey(old, (flags & RESULT_FLAG) !== 0) !== entry.slice(1)) beyond++;
            else
              rekeyed[seed - 1] = rekeyedEntry(
                entry,
                got,
                `${c.name} seed ${seed}`,
                c.rekeyFrom?.dropResult ? RESULT_FLAG : 0,
              );
            continue;
          }
          if (outcomeKey(got, (flags & RESULT_FLAG) !== 0) !== entry.slice(1)) {
            const shaken = liftedOutcome(c, sampleOf(), options, true);
            if (differences({ want: got, got: shaken }).length) {
              beyond++;
              continue;
            }
            assert.fail(
              `seed ${seed}: the lifted outcome (stop ${got.stop}, result ${got.result}) differs from the frozen reference`,
            );
          }
          if (flags & STOPPED_FLAG) stopped++;
          continue;
        }
        const pair = compareCase(c, sampleOf(), options);
        record?.push(pair.want.stop === 'native_access_limit' ? 0 : vectorEntry(pair.want));
        // The reference accessor stops after NATIVE_ACCESS_LIMIT accesses, a run time
        // budget, not a game result. Beyond it the reference gives no result.
        if (pair.want.stop === 'native_access_limit') {
          unmeasured++;
          continue;
        }
        if (outside.has(pair.got.stop)) {
          beyond++;
          continue;
        }
        const differing = differences(pair);
        if (differing.length && readsIgnoredBytes(c, sampleOf, options, pair.got)) {
          beyond++;
          continue;
        }
        assert.deepEqual(differing, [], `seed ${seed}`);
        if (pair.want.stop) stopped++;
      }
      assert.ok(stopped < count / 2, `${stopped} of ${count} samples stopped at a frontier`);
      assert.ok(unmeasured < count / 50, `${unmeasured} samples beyond the reference budget`); // magic-number-ok: 2 %
      assert.ok(beyond < count / 10, `${beyond} samples outside the lifted domain`); // magic-number-ok: 10 %
    });
}
