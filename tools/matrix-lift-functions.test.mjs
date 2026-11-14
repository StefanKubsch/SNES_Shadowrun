// Random per-function tests of the lifted matrix (src/matrix) against the
// register-level reference (proof/matrix-reference), for the edge cases the seven
// live sessions of tools/matrix-lift.test.mjs do not reach (docs/MATRIX-LIFT.md).
// Each sample is a random WRAM image with the matrix words drawn from wide but
// meaningful domains; both sides run one routine on their own copy and must
// leave the same WRAM (outside the scratch both may differ in), the same device
// writes, the same sound commands, the same result, or stop at the same frontier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import {
  createSide,
  differences,
  outcome as harnessOutcome,
  registerCases,
} from './lift-function-harness.mjs';
import { IGNORED_WRAM } from './live-matrix-plan.mjs';
import { matrixRuntime, sendVramCopies, setWord } from '../src/matrix/matrix-runtime.mjs';
import { randomBelow } from '../src/system/random.mjs';
import { readJoypad, takePadPresses } from '../src/system/joypad.mjs';
import { unpack } from '../src/system/unpack.mjs';
import { enableNmiAndJoypad, startSceneScreen } from '../src/system/nmi.mjs';
import { runSceneList } from '../src/system/scene-list.mjs';
import { setMusicMode } from '../src/apu/music-mode.mjs';
import { sendApuCommand } from '../src/apu/apu-command.mjs';
import {
  drawObjects,
  openNodeGates,
  placePersonaAtStart,
  readNodeAhead,
  removeFinishedObjects,
  resetObjects,
  stepPersona,
  takeDamage,
  uploadMap,
  useNodeAhead,
} from '../src/matrix/matrix-world.mjs';
import {
  clearTextMap,
  queueSystemMessages,
  queueText,
  resetTextWindow,
  typeText,
  updateGauges,
} from '../src/matrix/matrix-text.mjs';
import { MATRIX_REFERENCE_ROUTINES } from '../proof/matrix-reference/matrix-scene-loop.mjs';
import { sendMatrixDmaRecords } from '../proof/matrix-reference/main-matrix-nmi.mjs';
import { MATRIX_COUNT_TEXT } from '../src/data/matrix-text-edits.mjs';
import { FLAG_CARRY } from '../src/constants/cpu-flags.mjs';
import { readInput } from '../src/task/native-input-apu.mjs';

const SAMPLES = 300,
  WRAM_BYTES = 0x20000,
  MAP_WRAM = 0x10000;

// Lifted stops outside the compared domain: an index past a named table
// (src/matrix/matrix-tables.mjs) and a stream read in the system area.
const OUTSIDE_SYSTEM_AREA = 'stream_reads_system_area',
  OUTSIDE = new Set(['matrix_table_index_frontier', OUTSIDE_SYSTEM_AREA]);
// The sound directory pointer the game keeps at 7E:008C (from 98:FFFA, 81:F092).
const ROM = new DialogTestMemory(new Uint8Array(0x20000)),
  SOUND_DIRECTORY = [0, 1, 2].map((n) => ROM.read8(0x98fffa + n));
// Packed streams of the cartridge (FIXED_SOURCES of src/data/lz-streams.mjs).
const PACKED_STREAMS = [
  0x81f2bd, 0x81f5ce, 0x81f803, 0x81ff40, 0x85fd38, 0x89e14e, 0x89eb4b, 0x89ec1b, 0x8bfbd2,
];
// Texts of bank 81 (src/data/matrix-texts.mjs) for the ring and the text pointer.
const TEXTS = [0x81c5c0, 0x81c5d2, 0x81c5e6, 0x81c5fb, 0x81c642, 0x81c658, 0x81c6b1, 0x81c6d8];
// Animation lists of bank 81: one picture and FFFF (repeat), four pictures and
// FFFF, eight pictures and FFFE (stop).
const ANIMATIONS = [0xbeb1, 0xbe69, 0xbe6d, 0xbe89, 0xbe93, 0xbea7];
// Map values with a meaning (see src/matrix/matrix-world.mjs) and some others.
const TILES = [
  0, 0, 0, 1, 1, 2, 7, 8, 0xb, 0xf, 0x10, 0x15, 0x18, 0x1d, 0x20, 0x21, 0x24, 0x27, 0x28, 0x40,
  0x41, 0x42, 0x4f, 0x50, 0x58, 0x59, 0x3ff,
];
// Around the persona also the track values 1-6 (81:BC73-BCB2) and more nodes.
// The CPU node 20 ahead and the gate side values 3E and 3F (81:B65A) open gates.
const NEAR_TILES = [
  ...TILES,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  0xc,
  0x10,
  0x13,
  0x18,
  0x1a,
  0x20,
  0x20,
  0x22,
  0x3e,
  0x3f,
  0x3e,
  0x3f,
];
// Map steps of the headings up, right, down, left (81:BB86, 81:B642) and the gate
// value of each side (81:B65A).
const SIDE_STEPS = [-64, 2, 64, -2],
  GATE_VALUES = [0x3f, 0x3e, 0x3f, 0x3e];
// Pad bits of the headings up, right, down, left (PAD_HEADINGS in matrix-world.mjs).
const HEADING_PADS = [0x800, 0x100, 0x400, 0x200];
// A synthetic text in bank 7F: characters, the commands 1-6 (5 with its frame
// byte) and an end; commands 7-1F stop at the frontier on both sides.
const SYNTHETIC_TEXT = 0x7f8000;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  const position = () => (rnd(4) ? rnd(32) * 16 : rnd(0x200)) & 0xffff;
  // The map in bank 7F at an even offset (the game uses 7F:0216 + 800 n). A map
  // from 7F:F800 on would run past the bank end into the low RAM mirror, where the
  // reference reads back its own direct page scratch; the lifted code has none.
  const map = pick([0x2000, 0x2216, 0x2a16, rnd(0x7c00) * 2]);
  word(0x175c, map);
  for (let n = 0; n < 1024; n++)
    word(MAP_WRAM + ((map + n * 2) & 0xffff), pick(TILES) | (rnd(4) ? 0 : rnd(64) << 10));
  // Objects: kinds 0-5, a real animation list, positions near the view.
  for (let n = 0; n < 33; n++) {
    const x = n * 2;
    word(0x1356 + x, rnd(3) ? rnd(6) : 0);
    word(0x1398 + x, pick([0, 1, 0x8000, 0x8001, rnd(65536)]));
    word(0x14a0 + x, pick([0, 0, 1, 0xffff, 2, 0xfffe]));
    word(0x14e2 + x, pick([0, 0, 1, 0xffff, 2, 0xfffe]));
    word(0x1524 + x, position());
    word(0x1566 + x, position());
    word(0x15a8 + x, pick(ANIMATIONS));
    word(0x15ea + x, rnd(9) * 2);
    word(0x162c + x, rnd(3));
    word(0x166e + x, 1 + rnd(7));
  }
  word(0x1734, rnd(2) ? 0 : rnd(0x120));
  word(0x1736, rnd(2) ? 0 : rnd(0x120));
  // Nodes: columns and rows 0-31, FFFF ends the list.
  const nodes = rnd(8),
    noSeven = rnd(16) === 0;
  for (let n = 0; n < 7; n++) {
    word(0x16f2 + n * 2, n < nodes ? rnd(32) : rnd(2) ? 0xffff : 0x8000 | rnd(32));
    word(0x1700 + n * 2, n < nodes ? rnd(32) : rnd(65536));
    // A side of value 07 next to each node, which B56F moves the cell toward; a
    // few samples leave it out (the table frontier of matrix-tables.mjs).
    if (n < nodes && !noSeven) {
      const cell = map + wram[0x1700 + n * 2] * 64 + wram[0x16f2 + n * 2] * 2;
      word(MAP_WRAM + ((cell + pick(SIDE_STEPS)) & 0xffff), 7);
    }
  }
  // Persona state, heading, pad.
  word(0x173e, pick([0, 2, 2, 2, 4, 4, 6, 8, 0xa, rnd(2) ? 0xc : 1]));
  word(0x1740, pick([1, 1, 1, 2, 0]));
  word(0x1742, 1 + rnd(5));
  word(0x141c, pick([0, 4, 8, 12, 0, 4, 8, 12, 2, rnd(8) * 2]));
  word(0x145e, pick([0, 4, 8, 12, 2]));
  word(0x16b0, pick([0, 1, 0xf, 0xffff]));
  word(0x1746, rnd(2));
  word(0x1744, 8 + rnd(8));
  word(0x01ca, pick([0, 0x100, 0x200, 0x400, 0x800, 0x300, 0xc00, rnd(65536)]));
  word(0x01ce, pick([0, 0x80, 0x8000, 0x8080, rnd(65536)]));
  // Half the samples put the persona on a grid point in the control or track state,
  // often with the pad on its heading and A or B just pressed, among chosen tiles.
  if (rnd(2)) {
    const column = 1 + rnd(30),
      row = 1 + rnd(30),
      heading = rnd(4);
    word(0x1524, column * 16);
    word(0x1566, row * 16);
    word(0x173e, pick([2, 2, 4]));
    word(0x1740, 1);
    word(0x141c, heading * 4);
    word(0x01ca, rnd(3) ? HEADING_PADS[heading] : pick([0, ...HEADING_PADS]));
    word(0x01ce, pick([0x80, 0x8000]));
    if (rnd(2)) {
      word(0x1750, 0);
      word(0x174c, 0x40);
    }
    const cell = map + row * 64 + column * 2;
    for (const step of [0, -64, 2, 64, -2])
      word(MAP_WRAM + ((cell + step) & 0xffff), pick(NEAR_TILES));
    // Sometimes a CPU node ahead with the gate values on the other sides.
    if (rnd(4) === 0)
      SIDE_STEPS.forEach((step, side) =>
        word(MAP_WRAM + ((cell + step) & 0xffff), side === heading ? 0x20 : GATE_VALUES[side]),
      );
  }
  wram[0x1d8c] = rnd(8);
  word(0x1d93, rnd(65536));
  // Health, memory and the gauges.
  word(0x1754, pick([0, 1, 5, 100, 200, rnd(65536)]));
  word(0x1752, pick([0, 1, 100, 200, rnd(65536)]));
  word(0x1750, pick([0, 0x10, 0x3f, 0x40, rnd(65536)]));
  word(0x174e, pick([0, 0x10, 0x40, rnd(65536)]));
  word(0x174c, pick([0x40, 0x20, rnd(65536)]));
  // VRAM copy queue, map edit ring.
  // Records end with a zero count; queued records copy from real ROM bytes.
  const records = rnd(4);
  word(0x1748, records * 8);
  word(0x174a, rnd(2));
  for (let n = 0; n < records; n++) {
    word(0x113e + n * 8, 2 + rnd(0x40) * 2);
    wram[0x1140 + n * 8] = 0x80;
    wram[0x1141 + n * 8] = 0x81;
    word(0x1144 + n * 8, rnd(0x8000));
  }
  word(0x113e + records * 8, 0);
  word(0x173c, pick([0, 0x3c, 0x3e, rnd(65536)]));
  // Text window and ring.
  word(0x1342, pick([0x10, 0x20, 1, 0]));
  word(0x134c, pick([9, 0x18]));
  word(0x134a, rnd(0x19));
  word(0x1350, 0x802 + rnd(0x300));
  word(0x1354, pick([1, 1, 2, 0]));
  word(0x170e, rnd(2));
  word(0x1710, rnd(8) * 4);
  word(0x1712, rnd(8) * 4);
  for (let n = 0; n < 8; n++) {
    const text = pick(TEXTS);
    word(0x1714 + n * 4, text & 0xffff);
    word(0x1716 + n * 4, text >>> 16);
  }
  for (let n = 0; n < 0x40; n++) {
    const kind = rnd(10);
    wram[MAP_WRAM + (SYNTHETIC_TEXT & 0xffff) + n] =
      kind < 6 ? 0x20 + rnd(0x3b) : kind < 9 ? 1 + rnd(6) : rnd(4) ? 0 : 7 + rnd(0x19);
  }
  if (rnd(3) === 0) {
    const entry = rnd(8) * 4;
    word(0x1714 + entry, SYNTHETIC_TEXT & 0xffff);
    word(0x1716 + entry, SYNTHETIC_TEXT >>> 16);
  }
  const pointer = rnd(3) ? pick(TEXTS) + rnd(20) : SYNTHETIC_TEXT + rnd(0x20);
  word(0x34, pointer & 0xffff);
  word(0x36, pointer >>> 16);
  // The message lists of the six systems (pointer table 81:C515-C520).
  wram[0x1d90] = rnd(6);
  // A third of the samples carry language edits (src/data/matrix-text-edits.mjs) of
  // some texts and of the IC count text, whose digit goes in at countIndex.
  let edits = null;
  if (rnd(3) === 0) {
    const stream = (digit) => {
      const bytes = [];
      for (let n = rnd(24); n > 0; n--) {
        const command = rnd(8) === 0 ? 1 + rnd(6) : 0;
        bytes.push(command || 0x20 + rnd(0x3b));
        if (command === 5) bytes.push(rnd(4));
      }
      const countIndex = digit ? rnd(bytes.length + 1) : -1;
      if (digit) bytes.splice(countIndex, 0, 0x31);
      return { bytes: Uint8Array.from([...bytes, 0, 0]), countIndex };
    };
    edits = new Map();
    for (const text of TEXTS)
      if (rnd(2)) edits.set(text, { ...stream(false), originalEnd: text + 0x10 });
    edits.set(MATRIX_COUNT_TEXT, { ...stream(true), originalEnd: MATRIX_COUNT_TEXT + 0xe });
  }
  // Edited texts already queued in ring slots or being typed (matrixTextState).
  const slots =
    edits && rnd(2) ? Array.from({ length: 9 }, () => (rnd(2) ? pick(TEXTS) : 0)) : null;
  return { seed, wram, rnd, pick, edits, slots };
}

// One side (tools/lift-function-harness.mjs) with the sample's language edits and
// edit streams already queued.
const side = (s) => createSide(s, MATRIX_REFERENCE_ROUTINES, prepareMemory);
function prepareMemory(mem, s) {
  mem.matrixTextEdits = s.edits;
  const stream = (text) => {
    const edit = s.edits.get(text);
    return edit ? { bytes: edit.bytes, position: 0, originalEnd: edit.originalEnd } : null;
  };
  if (s.slots)
    mem.matrixTextState = { slots: s.slots.slice(0, 8).map(stream), active: stream(s.slots[8]) };
}
const outcome = (state, run) => harnessOutcome(state, run, IGNORED_WRAM);
const carry = (h) => (h.ctx.status & FLAG_CARRY) !== 0;

// entry: the routine in the reference table; prepare(s) gives its register inputs
// (and may narrow the sample); samples overrides SAMPLES for rarely reached branches;
// lifted(m, input) runs the lifted function; result(h) reads the reference result.
const CASES = [
  {
    name: 'uploadMap 81:B4D3',
    entry: 0x81b4d3,
    prepare: (s) => ({
      a: s.wram[0x175c] | (s.wram[0x175d] << 8),
      y: 0x7f,
      x: s.pick([0x2000, 0x2400, s.rnd(65536)]),
    }),
    lifted: (m, r) => uploadMap(m, (r.y << 16) | r.a, r.x),
  },
  { name: 'placePersonaAtStart 81:B818', entry: 0x81b818, lifted: (m) => placePersonaAtStart(m) },
  { name: 'resetObjects 81:BD62', entry: 0x81bd62, lifted: (m) => resetObjects(m) },
  { name: 'drawObjects 81:BD7C', entry: 0x81bd7c, lifted: (m) => drawObjects(m) },
  {
    name: 'removeFinishedObjects 81:B90F',
    entry: 0x81b90f,
    lifted: (m) => removeFinishedObjects(m),
  },
  {
    name: 'openNodeGates 81:B56F',
    entry: 0x81b56f,
    prepare: (s) => ({ a: s.pick([0xfe, 0x02, 0x80, 0, s.rnd(65536)]) }),
    lifted: (m, r) => openNodeGates(m, r.a),
    result: (h) => h.ctx.a,
  },
  {
    name: 'takeDamage 81:B1B5',
    entry: 0x81b1b5,
    prepare: (s) => ({ a: s.pick([0, 1, 5, 0x7fff, 0xffff, s.rnd(65536)]) }),
    lifted: (m, r) => takeDamage(m, r.a),
  },
  { name: 'stepPersona 81:BD44', entry: 0x81bd44, samples: 1000, lifted: (m) => stepPersona(m) },
  { name: 'useNodeAhead 81:C111', entry: 0x81c111, samples: 1000, lifted: (m) => useNodeAhead(m) },
  {
    name: 'readNodeAhead 81:C28C',
    entry: 0x81c28c,
    samples: 1000,
    lifted: (m) => readNodeAhead(m),
  },
  { name: 'resetTextWindow 81:B2A0', entry: 0x81b2a0, lifted: (m) => resetTextWindow(m) },
  {
    name: 'queueText 81:B282',
    entry: 0x81b282,
    prepare: (s) => {
      const text = s.pick(TEXTS);
      return { x: text & 0xffff, y: s.pick([text >>> 16, s.rnd(65536)]) };
    },
    lifted: (m, r) => queueText(m, r.x, r.y),
  },
  { name: 'queueSystemMessages 81:C39F', entry: 0x81c39f, lifted: (m) => queueSystemMessages(m) },
  { name: 'typeText 81:B2D1', entry: 0x81b2d1, lifted: (m) => typeText(m), result: carry },
  { name: 'clearTextMap 81:B228', entry: 0x81b228, lifted: (m) => clearTextMap(m) },
  {
    // A shown value wider than its gauge (health above CF, memory above 47) runs the
    // empty-tile loop through all of bank 7F into the low RAM mirror, over the
    // reference's direct page counters; the game keeps health at most C8 and
    // memory at most 40. The domain ends at the widest gauge that fits its row.
    name: 'updateGauges 81:B485',
    entry: 0x81b485,
    prepare: (s) => {
      const set = (at, v) => {
        s.wram[at] = v & 255;
        s.wram[at + 1] = v >>> 8;
      };
      set(0x1752, s.pick([0, 1, 0x64, 0xc8, 0xcf, s.rnd(0xd0)]));
      set(0x1754, s.pick([0, 1, 0x64, 0xc8, 0xcf, s.rnd(0xd0)]));
      set(0x174e, s.pick([0, 1, 0x40, 0x47, s.rnd(0x48)]));
      set(0x1750, s.pick([0, 1, 0x40, 0x47, s.rnd(0x48)]));
    },
    lifted: (m) => updateGauges(m),
  },
  // Shared routines, lifted for the matrix (src/system, src/apu, VideoPort).
  {
    name: 'randomBelow 80:F2A8',
    long: true,
    entry: 0x80f2a8,
    prepare: (s) => {
      const range = s.pick([0, 1, 2, 7, 0x7f, 0x80, 0x8000, 0xffff, s.rnd(65536)]);
      s.wram[0] = range & 255;
      s.wram[1] = range >>> 8;
      return { range };
    },
    lifted: (m, r) => randomBelow(m.mem, m.port, r.range),
    result: (h) => h.read(0x7e0000, 2),
  },
  {
    name: 'sendApuCommand 81:F007',
    long: true,
    entry: 0x81f007,
    prepare: (s) => ({ a: s.rnd(65536), x: s.rnd(65536) }),
    lifted: (m, r) => sendApuCommand(m.wram, m.port, r.a, r.x),
  },
  {
    name: 'readJoypad 80:F290',
    long: true,
    entry: 0x80f290,
    lifted: (m) => setWord(m.wram, 0x1ca, readJoypad(m.port)),
  },
  {
    // Real packed streams of the cartridge and random WRAM bytes from 7E:2000 as streams,
    // into bank 7F at random offsets (80:F2A4, the 9F6D form).
    name: 'unpack 80:F2A4',
    entry: 0x80f2a4,
    long: true,
    samples: 1000,
    prepare: (s) => {
      const source = s.rnd(2) ? s.pick(PACKED_STREAMS) : 0x7e2000 + s.rnd(0xe000);
      return {
        a: source & 0xffff,
        y: source >>> 16,
        x: s.pick([0, 0x216, 0x8216, s.rnd(0x10000)]),
      };
    },
    // A random stream can run past its bank end into the system area (banks 00-3F and
    // 80-BF, 0000-7FFF): the low RAM mirror, where the reference reads back its own
    // unpacker state, and the hardware registers. Such a sample lies outside the
    // lifted domain; real streams stay in their bank.
    lifted: (m, r) => {
      const read = m.mem.read8.bind(m.mem);
      m.mem.read8 = (address) => {
        if ((address & 0x408000) === 0) throw { reason: OUTSIDE_SYSTEM_AREA };
        return read(address);
      };
      unpack(m.mem, (r.y << 16) | r.a, 0x7f, r.x);
    },
  },
  {
    // The core 80:9E1A of 80:F298; the routine table entry takes the pad word from a
    // recorded observation or runs the interrupt-stepped form.
    name: 'takePadPresses 80:9E1A',
    entry: 0x809e1a,
    reference: (h) => readInput(h.a, false),
    prepare: (s) => {
      const set = (at, v) => {
        s.wram[at] = v & 255;
        s.wram[at + 1] = v >>> 8;
      };
      set(0x1ca, s.pick([0, 0x8000, 0x80, 0x0f00, 0x0001, 0x8080, 0x3030, s.rnd(65536)]));
      set(0x1cc, s.pick([0, 0x8000, s.rnd(65536)]));
    },
    lifted: (m) => takePadPresses(m.wram),
  },
  {
    name: 'enableNmiAndJoypad 81:EB7B',
    entry: 0x81eb7b,
    long: true,
    lifted: (m) => enableNmiAndJoypad(m.wram, m.port),
  },
  {
    name: 'startSceneScreen 81:EB97',
    entry: 0x81eb97,
    long: true,
    lifted: (m) => startSceneScreen(m.wram, m.video, m.port),
  },
  {
    // The matrix list 81:CDB2, or a synthetic list at 7E:2000 of every command
    // (callback, real packed streams to VRAM, palettes from the cartridge, single
    // registers of the PPU and in WRAM, empty commands) and rarely an unknown byte.
    name: 'runSceneList 81:EC16',
    entry: 0x81ec16,
    long: true,
    prepare: (s) => {
      if (s.rnd(4) === 0) return { x: 0xcdb2, y: 0x81 };
      const bytes = [],
        word = (v) => bytes.push(v & 255, (v >>> 8) & 255);
      for (let n = 1 + s.rnd(8); n > 0; n--) {
        const command = s.rnd(30) === 0 ? 9 + s.rnd(247) : 1 + s.rnd(8);
        bytes.push(command);
        if (command === 2) {
          word(s.rnd(65536));
          word(s.pick([0x81, 0x80, s.rnd(65536)]));
        } else if (command === 3) {
          const stream = s.pick(PACKED_STREAMS);
          word(s.rnd(0x8000));
          word(stream & 0xffff);
          word(stream >>> 16);
          word(s.pick([0x800, 0x1000, s.rnd(65536)]));
        } else if (command === 4) {
          word(s.pick([0x80, 0x8080, 0x1010, s.rnd(65536)]));
          word(s.pick([0x89, 0x80, 0x81]));
          word(0x8000 + s.rnd(0x7f00));
        } else if (command === 5) {
          word(s.pick([0x2107, 0x2105, 0x212c, 0x2100, 0x1d90, s.rnd(0x2000), 0x2101]));
          bytes.push(s.rnd(256));
        }
      }
      bytes.push(0);
      s.wram.set(bytes, 0x2000);
      return { x: 0x2000, y: 0x7e };
    },
    lifted: (m, r) => runSceneList(m.mem, m.video, m.port, (r.y << 16) | r.x),
  },
  {
    // Music modes 0-15 with the cartridge's sound directory (its pointer at
    // 7E:008C as the game sets it), random token and pair states.
    name: 'setMusicMode 81:EF47',
    entry: 0x81ef47,
    long: true,
    events: () => ({ calls: [] }),
    prepare: (s) => {
      s.wram[0x1ce6] = s.pick([0, 0, 0xff, 1]);
      if (s.rnd(2)) {
        s.wram.set(SOUND_DIRECTORY, 0x8c);
        return { a: s.pick([0, 8, s.rnd(16), s.rnd(65536)]) };
      }
      // A synthetic directory at 7E:3000: mode lists at +40, sets 1-6 with block
      // lists from 7E:3100 of raw blocks (cartridge bytes) and repeated words.
      const bytes = new Uint8Array(0x800),
        put = (at, v, n = 2) => {
          for (let k = 0; k < n; k++) bytes[at + k] = (v >>> (8 * k)) & 255;
        };
      put(0, 0x40);
      let entry = 5,
        list = 0x100;
      for (let id = 1; id <= 6; id++) {
        bytes[entry] = id;
        put(entry + 1, 0x7e3000 + list, 3);
        entry += 4;
        let at = list + 4,
          total = 0;
        for (let n = 1 + s.rnd(3); n > 0; n--)
          if (s.rnd(2)) {
            const count = 1 + s.rnd(40);
            put(at, count);
            put(at + 2, 0x808000 + s.rnd(0x7f00), 3);
            at += 5;
            total += count;
          } else {
            const words = 1 + s.rnd(20);
            put(at, 0x8000 | words);
            put(at + 2, s.rnd(65536));
            at += 4;
            total += words * 2;
          }
        put(list, total + 2);
        put(list + 2, s.rnd(65536));
        list = at + 8;
      }
      bytes[entry] = 0xff;
      for (let n = 0; n < 8; n++) {
        bytes[0x40 + n * 2] = 1 + s.rnd(15);
        bytes[0x41 + n * 2] = 1 + s.rnd(7);
      }
      bytes[0x50] = 0;
      s.wram.set(bytes, 0x3000);
      s.wram.set([0x00, 0x30, 0x7e], 0x8c);
      return { a: s.pick([1, 2, s.rnd(16)]) };
    },
    lifted: (m, r) => setMusicMode(m.mem, m.port, r.a),
  },
  {
    name: 'copyToOam 81:ED8B',
    long: true,
    entry: 0x81ed8b,
    lifted: (m) => m.video.copyToOam(0x7e0f1e, 544),
  },
];

registerCases(CASES, {
  sample,
  side,
  runtime: matrixRuntime,
  ignored: IGNORED_WRAM,
  outside: OUTSIDE,
});

test('sendVramCopies matches the matrix NMI DMA records on random queues', () => {
  for (let seed = 1; seed <= SAMPLES; seed++) {
    const s = sample(seed);
    const reference = side(s);
    reference.h.push(0x1234, 2);
    const want = outcome(reference, () => {
      sendMatrixDmaRecords(reference.h);
    });
    const lifted = side(s);
    const got = outcome(lifted, () => {
      const m = matrixRuntime(lifted.h);
      sendVramCopies(m.wram, m.video);
    });
    assert.deepEqual(differences({ want, got }), [], `seed ${seed}`);
  }
});

test('an odd heading stops the lifted persona at the table frontier', () => {
  const s = sample(5);
  s.wram[0x173e] = 0xa; // hit state: the face picture of the heading
  s.wram[0x173f] = 0;
  s.wram[0x1740] = 1;
  s.wram[0x1741] = 0;
  s.wram[0x141c] = 3;
  s.wram[0x141d] = 0;
  const lifted = side(s);
  const got = outcome(lifted, () => stepPersona(matrixRuntime(lifted.h)));
  assert.equal(got.stop, 'matrix_table_index_frontier');
});
