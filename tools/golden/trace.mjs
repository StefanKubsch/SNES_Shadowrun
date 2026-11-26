// Golden traces (docs/STATE-MODEL-REBUILD.md): the behaviour of the current game on a
// fixed scenario, recorded once and replayed against every later rebuild of src/.
//
// A trace keeps layout-free inputs: the pad word per frame (as a change list), the
// stream of random counter bytes, and the WRAM writes a test plan made itself
// (pokes) at the frame where it made them. Per frame it keeps five FNV-1a hashes:
// picture, game state, video memory, audio and SRAM. Every SNAPSHOT_EVERY frames it
// keeps the masked WRAM so that a difference can be located by address.
import { WRAM } from '../../src/data/wram.mjs';
import { toWram } from '../to-wram.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync, constants as zlib } from 'node:zlib';
import { LiveGame } from '../../src/video/live-game.mjs';
import { renderFrame } from '../../src/video/frame-renderer.mjs';
import { fnv1a, FNV_OFFSET } from '../../src/data/fnv.mjs';

export const TRACE_FORMAT = 'shadowrun-golden-trace-1';
export const SNAPSHOT_EVERY = 1000;
// The five hashes of a frame, in their order in `frames`.
export const CATEGORIES = Object.freeze(['picture', 'state', 'video', 'audio', 'sram']);
// WRAM that is not game state (docs/MATRIX-LIFT.md, "What the same result means"):
// direct page scratch, the unpacker and sample loader state, the main stack, the
// interrupted A and S saved by the NMI and the NMI stack. Half-open ranges.
export const SCRATCH = Object.freeze([
  [0x0000, 0x0034],
  [0x0089, 0x008c],
  [0x008f, 0x009a],
  [0x00db, 0x00f3],
  // A direct page local word of several routines (the move's old coordinate, sprite,
  // palette and scene scratch), each writing it before reading it.
  [0x006b, 0x006d],
  [0x0100, 0x01ca],
  [0x1c78, 0x1cbc],
]);
const HASH_BYTES = Uint32Array.BYTES_PER_ELEMENT,
  HEX = 16,
  ADDRESS_DIGITS = 4,
  LISTED_ADDRESSES = 16,
  FNV_PRIME = 0x01000193;

// The compared game state: the typed fields projected to the original addresses,
// with scratch set to zero.
export function gameState(game, into = new Uint8Array(game.memory.wram.length)) {
  toWram(game.memory, into);
  return maskScratch(into);
}

function maskScratch(into) {
  for (const [from, to] of SCRATCH) into.fill(0, from, to);
  return into;
}

// FNV-1a over 32-bit words (four times fewer steps than over bytes); byte arrays whose
// view is not word aligned fall back to the byte form.
function hash(array, h = FNV_OFFSET) {
  const view =
    array instanceof Uint8Array
      ? array
      : new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  if (view.byteOffset % HASH_BYTES || view.byteLength % HASH_BYTES) return fnv1a(view, h);
  const words = new Uint32Array(view.buffer, view.byteOffset, view.byteLength / HASH_BYTES);
  for (let n = 0; n < words.length; n++) h = Math.imul(h ^ words[n], FNV_PRIME) >>> 0;
  return h;
}

// The picture at NMI entry, as LiveGame's onFrame draws it; none before the first
// write to 2100. `key` hashes everything the renderer reads (video memories, the
// picture settings and, with HDMA on, the WRAM tables); an unchanged key gives the
// previous picture without drawing it again. The video memory hash takes the palette
// as 16-bit little-endian colours, the CGRAM bytes the traces were first recorded with.
function picture(game, cache, key) {
  if (!game.picture.displaySet) return FNV_OFFSET;
  if (cache.key === key) return cache.picture;
  cache.key = key;
  cache.picture = hash(renderFrame(game.picture.describe()));
  return cache.picture;
}
function frameHashes(game, state, cache) {
  const p = game.picture;
  const video = hash(p.oam, hash(p.palette, hash(p.vram)));
  const audio = hash(game.apu.dsp.regs, hash(game.apu.ram));
  toWram(game.memory, state);
  let key = hash(p.settings(), video);
  if (p.hdma) key = hash(state, key);
  const gameHash = hash(maskScratch(state));
  return [picture(game, cache, key), gameHash, video, audio, hash(game.memory.sram)];
}

// Hooks a game for the trace: wraps its pad and counter and hashes each frame at NMI
// entry. Without `inputs` it records the game's own pad, pokes and counter; with them it
// feeds the recorded ones. Returns the collector.
export function attach(game, inputs = null) {
  const frames = [],
    snapshots = [],
    pads = [],
    pokes = [],
    counter = [],
    state = new Uint8Array(game.memory.wram.length),
    cache = { key: null, picture: 0 };
  const loop = game.frames,
    devices = game.devices;
  if (!inputs) {
    const pad = loop.pad,
      count = devices.counter,
      before = new Uint8Array(game.memory.wram.length),
      after = new Uint8Array(before.length);
    let last = -1;
    loop.pad = (k) => {
      const { wram } = game.memory;
      toWram(game.memory, before);
      const word = pad(k);
      toWram(game.memory, after);
      if (Buffer.compare(before, after) !== 0)
        for (let at = 0; at < wram.length; at++)
          if (before[at] !== after[at]) pokes.push([k, at, after[at]]);
      if (word !== last) pads.push([k, word]);
      last = word;
      return word;
    };
    devices.counter = (port, pc) => {
      const value = count(port, pc);
      counter.push(value);
      return value;
    };
  } else {
    let nextPad = 0,
      nextPoke = 0,
      nextCounter = 0,
      word = 0;
    loop.pad = (k) => {
      while (nextPoke < inputs.pokes.length && inputs.pokes[nextPoke][0] <= k) {
        const [, at, value] = inputs.pokes[nextPoke++];
        game.memory.write8(WRAM + at, value);
      }
      while (nextPad < inputs.pads.length && inputs.pads[nextPad][0] <= k)
        word = inputs.pads[nextPad++][1];
      return word;
    };
    devices.counter = () => {
      if (nextCounter >= inputs.counter.length) throw Error('golden counter stream exhausted');
      return inputs.counter[nextCounter++];
    };
  }
  const onNmi = loop.onNmi,
    collector = { frames, snapshots, pads, pokes, counter, firstNmi: null };
  loop.onNmi = (k) => {
    onNmi?.(k);
    collector.firstNmi ??= k;
    frames.push(...frameHashes(game, state, cache));
    if (k % SNAPSHOT_EVERY === 0) snapshots.push([k, gzipSync(gameState(game)).toString('base64')]);
  };
  return collector;
}

// Records a scenario. scenario.record(cartridge, hook) runs it to its end and calls
// hook(game) once, right after the game is made and before its first step.
export function recordScenario(scenario, cartridge) {
  let game = null,
    collector = null;
  scenario.record(cartridge, (made) => {
    game = made;
    collector = attach(made);
  });
  return {
    format: TRACE_FORMAT,
    scenario: scenario.name,
    nmis: game.nmis,
    pads: collector.pads,
    pokes: collector.pokes,
    counter: Buffer.from(collector.counter).toString('base64'),
    frames: Buffer.from(Uint32Array.from(collector.frames).buffer).toString('base64'),
    snapshots: collector.snapshots,
  };
}

export const traceFile = (name) => new URL(`./traces/${name}.json.gz`, import.meta.url);
export const writeTrace = (trace) =>
  writeFileSync(
    traceFile(trace.scenario),
    gzipSync(JSON.stringify(trace), { level: zlib.Z_BEST_COMPRESSION }),
  );
export function readTrace(name) {
  const trace = JSON.parse(gunzipSync(readFileSync(traceFile(name))));
  if (trace.format !== TRACE_FORMAT) throw Error(`${name}: unknown trace format ${trace.format}`);
  const raw = Buffer.from(trace.frames, 'base64');
  return {
    ...trace,
    counter: [...Buffer.from(trace.counter, 'base64')],
    frames: new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / HASH_BYTES),
  };
}

// The first differing WRAM addresses between a snapshot and the current game state.
function stateDifferences(snapshot, current) {
  const expected = gunzipSync(Buffer.from(snapshot, 'base64')),
    found = [];
  for (let at = 0; at < expected.length && found.length < LISTED_ADDRESSES; at++)
    if (expected[at] !== current[at])
      found.push(
        `7E:${at.toString(HEX).padStart(ADDRESS_DIGITS, '0')} ${expected[at]}->${current[at]}`,
      );
  return found;
}

// Replays a trace from the scenario's start options (scenario.options(), LiveGame's)
// with the picture back end of live play, and compares every frame. Returns null when equal, else the first difference: its
// NMI, the categories that differ and, for the game state, the differing addresses at
// the next snapshot.
export function replayScenario(scenario, cartridge, trace = readTrace(scenario.name)) {
  const game = new LiveGame(cartridge, scenario.options());
  const collector = attach(game, trace);
  const width = CATEGORIES.length,
    snapshots = new Map(trace.snapshots);
  const recorded = trace.frames.length / width;
  let checked = 0,
    difference = null;
  try {
    while (game.nmis < trace.nmis && !difference) {
      game.step();
      for (; checked < Math.min(recorded, collector.frames.length / width); checked++) {
        const at = checked * width,
          differing = CATEGORIES.filter(
            (_, c) => collector.frames[at + c] !== trace.frames[at + c],
          );
        if (differing.length) {
          difference = { nmi: collector.firstNmi + checked, categories: differing };
          break;
        }
      }
    }
  } catch (error) {
    difference = { nmi: game.nmis, error: error.message };
  }
  if (difference?.categories?.includes('state')) {
    // Run on to the next snapshot and name the addresses, taken at that very NMI (a step
    // can run past it).
    const next = [...snapshots.keys()].find((k) => k >= difference.nmi);
    if (next !== undefined) {
      const onNmi = game.frames.onNmi;
      game.frames.onNmi = (k) => {
        onNmi(k);
        if (k !== next) return;
        difference.snapshot = next;
        difference.addresses = stateDifferences(snapshots.get(next), gameState(game));
      };
      try {
        while (!difference.snapshot) game.step();
      } catch (error) {
        difference.snapshotError = error.message;
      }
    }
  }
  if (!difference && collector.frames.length / width < recorded)
    difference = { nmi: game.nmis, error: 'ended early' };
  return difference;
}
