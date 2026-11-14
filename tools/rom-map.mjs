// ROM map for the ROM-free target (docs/ROM-FREE.md): classifies every byte
// of the European ROM as code, script data or undetermined.
//
// Executed code: every instruction executed in Mesen (analysis/rom-code-observed.json,
// tools/rom-code-coverage.mjs) with its length in the observed state. All code
// classes are absent from the package except bytes read as data or true data margins.
//
// Static code: tracing with the M/X
// state from the observed instructions and proven entries (vectors, native
// table 82:D7B8, opcode table 80:F2B4 with E0 M0 X0 like the dispatch
// listings, all entries of the listings in analysis/*.asm.txt with the state
// proven there). Conditional branches follow both paths, JSR/JSL return with
// the caller's state (assumption), PLP restores the state of the matching
// PHP on the same path. At an observed instruction the observed state
// applies, because a call can return with changed M/X. Indirect jumps end
// the path and are reported. A byte reached with two states, or as both an
// instruction middle and an instruction start, is a conflict; the first
// state stays. Bytes traced only from natives that no script names are
// code_unused_native or code_unused_opcode (see the trace below).
//
// Texts: the Huffman tree from 9D:8000 and the texts that follow it without
// gaps from the end of the tree in bank 9D and from 9E:8000
// (src/data/texts.mjs), as long as each text lies entirely in undetermined
// bytes and decodes.
//
// Room tiles: the table 8D:A41F and the 1536 packed streams (src/data/tiles.mjs),
// per stream exactly the bytes the unpacker uses.
//
// Palettes: the ranges sent to CGRAM by DMA, from analysis/rom-palettes.json.
// Also the palettes of the scene command lists (src/data/scene-lists.mjs).
// Palette cycles: the table 8B:FD75 and its records (src/data/palette-cycles.mjs);
// a palette range inside them belongs to the cycles.
//
// VRAM characters: the ranges sent by DMA from ROM straight to VRAM, from
// analysis/rom-vram.json (tools/rom-vram.mjs, src/data/vram-tiles.mjs), joined
// with the OBJ character sources of the object pictures (src/data/pictures.mjs).
//
// Packed streams of 9F49/9F4D/9F6D from analysis/rom-vram.json: length word
// and exactly the bytes the unpacker uses (src/data/lz-streams.mjs), also
// for every scene record of the table 8B:F9E3, which is claimed as well, and
// for the streams of FIXED_SOURCES and of the scene command lists
// (src/data/scene-lists.mjs).
//
// Tilesets: blocks, attributes and both pointer tables, 8D:D0B0 to 8D:F1B8
// (src/data/tilesets.mjs).
//
// Object types: definitions and their table, 8A:883E to 8A:C7B2
// (src/data/object-types.mjs).
//
// Scene command lists of 81:EC16: their five runs (src/data/scene-lists.mjs).
//
// Menu texts of 81:D531: four runs in bank 81 (src/data/menu-texts.mjs).
//
// Rooms: the table 8D:929D and the two runs of headers in banks 99 and 9A
// (src/data/rooms.mjs).
//
// Actor table: 8D:B01F to the tilesets 8D:D0B0 (src/data/actors.mjs).
//
// Kind table: 8C:EFB0 to the palette table 8C:F622 (src/data/kinds.mjs);
// action lists, records and their table 8C:8000 to 8C:EFB0 (src/data/actions.mjs);
// the object pictures their frames name, two runs in banks 9B and 9C
// (src/data/pictures.mjs).
//
// Dialog topics: the 64 text pointers at 8D:8000 (src/data/topics.mjs).
//
// Runner table: 80:9700 to 98E9 (src/data/runners.mjs).
//
// SPC700 sound driver: 97:8000, 0C55 bytes (src/data/spc-driver.mjs).
//
// Lookup tables of banks 80 and 81 (src/data/tables.mjs).
//
// Matrix texts: 81:C515 to CDB2 (src/data/matrix-texts.mjs).
//
// Text font: 95:F2D0 to F740 (src/data/font.mjs).
//
// Cartridge header and vectors: 80:FFC0 to FFFF (src/data/header.mjs).
//
// Unreferenced scripts: headed scripts no table names and the dead tail
// behind script 33D (src/data/orphan-scripts.mjs).
//
// Filler: remaining unknown runs of one value behind a final script jump,
// up to a bank end or of only 00 or FF (src/data/fillers.mjs).
//
// Dialog records: the table 80:94F7 and the records 8D:80C0 to 929D
// (src/data/dialogs.mjs).
//
// Dialog portraits: the 139 records (stream pointer and colours) and their
// streams (src/data/portraits.mjs).
//
// Sound data: the pointer table 98:FFFA, both directories, their block lists
// and the data chunks (src/data/sound.mjs).
//
// Part graphics: the nine runs and the table 96:C3FA; the 64 bytes at 8D:FD78
// stay vram_tile, the DMA reads them as OBJ characters (src/data/object-graphics.mjs).
//
// Script data: header (2 bytes) and bytecode of every script from
// assets/scripts.json at the address in the script tables (tools/scripts.mjs),
// and the tables themselves.
//
// Bytes read: analysis/rom-reads.json (tools/rom-reads.mjs, recorded in the
// live tests) and the original's data reads in banks 80/81 from the Mesen
// coverage scenarios (reads in analysis/rom-code-observed.json, without the
// script tours with foreign arguments). A read byte
// of executed code stays in the package (code_kept;
// for example the text reader reads a word at the terminator 81:D59D and thus
// the first byte of the following routine). As a margin for such word reads,
// the first code byte after every non-code byte is kept as well.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectRom, cpuToOffset, cpuLabel, hex } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { isDataToCodeBoundary, isHardwareOnlyCodeRead } from './rom-code-retention.mjs';
import { decodeScript } from '../src/script/codec.mjs';
import { inspectScriptTables, europeanTables } from './scripts.mjs';
import { readTextTree, readText, TEXT_TREE } from '../src/data/texts.mjs';
import { readTiles, TILE_TABLE, TILE_STREAMS } from '../src/data/tiles.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { readSceneTable, SCENE_TABLE, SCENES, FIXED_SOURCES } from '../src/data/lz-streams.mjs';
import { readMenuTexts, MENU_TEXT_RUNS } from '../src/data/menu-texts.mjs';
import {
  readPaletteCycles,
  outsideCycles,
  CYCLE_TABLE,
  CYCLE_END,
} from '../src/data/palette-cycles.mjs';
import { readRooms, ROOM_TABLE, ROOM_TABLE_END, ROOM_RUNS } from '../src/data/rooms.mjs';
import { readActors, ACTOR_TABLE, ACTOR_END } from '../src/data/actors.mjs';
import { readKinds, KIND_TABLE, KIND_END } from '../src/data/kinds.mjs';
import { readActions, ACTION_DATA, ACTION_END } from '../src/data/actions.mjs';
import { readPictures, pictureSources, PICTURE_RUNS } from '../src/data/pictures.mjs';
import { mergeVramRanges, C06B_SOURCES } from '../src/data/vram-tiles.mjs';
import { readTopics, TOPIC_TABLE, TOPIC_END } from '../src/data/topics.mjs';
import { soundRanges } from '../src/data/sound.mjs';
import {
  readPortraits,
  portraitStreams,
  outsidePortraits,
  PORTRAIT_SIZE,
  DIALOG_TABLE,
  DIALOGS,
} from '../src/data/portraits.mjs';
import { readSpcDriver, SPC_DRIVER_ROM, SPC_DRIVER_LENGTH } from '../src/data/spc-driver.mjs';
import { LOOKUP_TABLES, MATRIX_ANIMATIONS, MATRIX_ANIMATIONS_END } from '../src/data/tables.mjs';
import { readMatrixTexts, MATRIX_LISTS, MATRIX_END } from '../src/data/matrix-texts.mjs';
import { FONT, FONT_END } from '../src/data/font.mjs';
import { HEADER, HEADER_END } from '../src/data/header.mjs';
import { fillerKind, scriptJumpEnds } from '../src/data/fillers.mjs';
import { ORPHAN_SCRIPTS, SCRIPT_TAILS, readOrphan, readTail } from '../src/data/orphan-scripts.mjs';
import { readDialogs, DIALOG_DATA, DIALOG_END } from '../src/data/dialogs.mjs';
import { readRunners, RUNNER_TABLE, RUNNER_END } from '../src/data/runners.mjs';
import {
  readSceneListStreams,
  readSceneListPalettes,
  mergeRanges,
  readSceneLists,
  LIST_RUNS,
} from '../src/data/scene-lists.mjs';
import { readTilesets, TILESET_DATA, TILESET_END } from '../src/data/tilesets.mjs';
import {
  readObjectTypes,
  OBJECT_DATA,
  OBJECT_TABLE,
  OBJECT_TYPES,
} from '../src/data/object-types.mjs';
import {
  readObjectGraphics,
  GRAPHIC_RUNS,
  GRAPHIC_SHARED,
  GRAPHIC_TABLE,
  GRAPHICS,
} from '../src/data/object-graphics.mjs';
import { COMPARE } from '../src/task/native-scene-sprites.mjs';
import { SUBMENU_SEQUENCES } from '../src/task/native-status-screen.mjs';
import { textCommands } from '../proof/matrix-reference/main-scene-matrix.mjs';
import { stateCalls, directionCalls, trackCalls } from '../proof/matrix-reference/main-matrix-movement.mjs';
import { SCENE_ANIMATION_TARGETS } from '../proof/cutscene-reference/cutscene-animation.mjs';
import { SCENE_VIDEO_COMMANDS } from '../src/task/main-scene-video.mjs';
import { CALLBACKS } from '../src/task/observed-nmi.mjs';

// Jump tables behind indirect jumps (JMP/JSR (abs,X) read the table and the
// target in the program bank): the targets the port has ported for each one.
// The trace goes on at each target with the state at the jump; every target
// must be one of the table's first 64 words in the ROM. The NMI JML [$006E]
// at 80:C14F has no table: its targets are the proven NMI callback roots of
// the port (long addresses, set through 81:C109).
const JUMP_TABLES = new Map([
  ['80:C14F', { targets: [...CALLBACKS], long: true }],
  ['80:B0AC', { table: 0x80b0e3, targets: [...COMPARE.keys()].filter((t) => t < 0xb0e3) }],
  ['80:B0EF', { table: 0x80b126, targets: [...COMPARE.keys()].filter((t) => t > 0xb0e3) }],
  ['80:ECEA', { table: 0x80ed2e, targets: [...SUBMENU_SEQUENCES.keys()] }],
  ['81:B307', { table: 0x81b370, targets: [...textCommands.keys()] }],
  ['81:BA93', { table: 0x81bb56, targets: [...directionCalls.keys()] }],
  ['81:BC09', { table: 0x81bc1b, targets: [...trackCalls.keys()] }],
  ['81:BD52', { table: 0x81bd56, targets: [...stateCalls.keys()] }],
  ['81:CF76', { table: 0x81d41f, targets: [...SCENE_ANIMATION_TARGETS.keys()] }],
  ['81:EC28', { table: 0x81ec2f, targets: [...SCENE_VIDEO_COMMANDS.keys()] }],
]);

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const args = process.argv.slice(2);
const romPath = resolve(args[0] ?? 'Shadowrun (E).smc');
const { bytes, metadata } = inspectRom(await readFile(romPath));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const SIZE = bytes.length;

// Class per byte.
const UNKNOWN = 0,
  CODE = 1,
  STATIC = 2,
  SCRIPT = 3,
  TABLE = 4,
  KEPT = 5,
  TREE = 6,
  TEXT = 7,
  TILE_INDEX = 8,
  TILE_LZ = 9,
  PALETTE = 10,
  VRAM_TILE = 11,
  LZ_STREAM = 12,
  SCENE_TABLE_CLASS = 13,
  TILESET = 14,
  OBJECT_TYPE = 15,
  OBJECT_GRAPHIC = 16,
  SCENE_LIST = 17,
  MENU_TEXT = 18,
  PALETTE_CYCLE = 19,
  ROOM_TABLE_CLASS = 20,
  ROOM = 21,
  ACTOR = 22,
  KIND = 23,
  ACTION = 24,
  PICTURE = 25,
  TOPIC = 26,
  SOUND = 27,
  PORTRAIT = 28,
  DIALOG = 29,
  RUNNER = 30,
  SPC_DRIVER = 31,
  LOOKUP_TABLE = 32,
  MATRIX_TEXT = 33,
  FONT_CLASS = 34,
  HEADER_CLASS = 35,
  FILLER = 36,
  ORPHAN_SCRIPT = 37,
  CODE_DEAD = 38,
  CODE_UNUSED_NATIVE = 39,
  CODE_UNUSED_OPCODE = 40;
const CLASS_NAMES = [
  'unknown',
  'code',
  'code_static',
  'script',
  'script_table',
  'code_kept',
  'text_tree',
  'text',
  'tile_table',
  'tile_lz',
  'palette',
  'vram_tile',
  'lz_stream',
  'scene_table',
  'tileset',
  'object_type',
  'object_graphic',
  'scene_list',
  'menu_text',
  'palette_cycle',
  'room_table',
  'room',
  'actor',
  'kind',
  'action',
  'picture',
  'topic',
  'sound',
  'portrait',
  'dialog',
  'runner',
  'spc_driver',
  'lookup_table',
  'matrix_text',
  'font',
  'header',
  'filler',
  'orphan_script',
  'code_dead',
  'code_unused_native',
  'code_unused_opcode',
];
const kind = new Uint8Array(SIZE);
const cpuOf = (offset) => ((0x80 + (offset >> 15)) << 16) | 0x8000 | (offset & 0x7fff);
const flags = (ps, e) => ({ e, m: e ? 1 : (ps >> 5) & 1, x: e ? 1 : (ps >> 4) & 1, c: null });

// Safe code from Mesen.
const observed = JSON.parse(await readFile('analysis/rom-code-observed.json', 'utf8'));
const observedState = new Map(); // Offset -> state 'emx' of the first observed state
let observedMulti = 0;
for (const [key, states] of Object.entries(observed.starts)) {
  const offset = parseInt(key, 16);
  if (states.length > 1) observedMulti++;
  for (const s of states) {
    const [ps, e] = s.split(' ');
    const state = flags(parseInt(ps, 16), +e),
      ins = decode(bytes, cpuOf(offset), state);
    for (let i = 0; i < ins.length; i++)
      kind[cpuToOffset((ins.cpu & 0xff0000) | ((ins.cpu + i) & 0xffff), SIZE)] = CODE;
    if (!observedState.has(offset)) observedState.set(offset, state);
  }
}

// Static tracing.
const start = new Uint8Array(SIZE),
  stateAt = new Array(SIZE);
const conflicts = [],
  indirect = new Map(),
  outside = new Map(),
  seeds = [];
let callReturns = 0,
  plpUnknown = 0,
  corrected = 0;
const seed = (cpu, e, m, x, source) =>
  seeds.push({ cpu, state: { e, m, x, c: null }, php: [], source });
seed(bytes.readUInt16LE(0x7ffc), 1, 1, 1, 'reset vector');
for (const [name, at] of [
  ['emulation_nmi', 0x7ffa],
  ['emulation_irq', 0x7ffe],
  ['emulation_cop', 0x7ff4],
])
  seed(bytes.readUInt16LE(at), 1, 1, 1, name);
const tables = inspectScriptTables(bytes);
for (const n of tables.native_functions)
  seed(0x800000 | parseInt(n.cpu_address.slice(3).replace(':', ''), 16), 0, 0, 0, `native ${n.id}`);
for (let opcode = 0; opcode <= 0xc2; opcode += 2)
  seed(0x800000 | bytes.readUInt16LE(0x72b4 + opcode), 0, 0, 0, `opcode ${hex(opcode, 2)}`);
const listings = (await readdir('analysis')).filter((f) => f.endsWith('.asm.txt')).sort();
for (const file of listings) {
  for (const m of (await readFile(resolve('analysis', file), 'utf8')).matchAll(
    /^; Entry \$([0-9A-F]{2}):([0-9A-F]{4}); initial E=([01]) M=([01]) X=([01])/gm,
  ))
    seed(parseInt(m[1] + m[2], 16), +m[3], +m[4], +m[5], `analysis/${file}`);
}
for (const [offset, state] of observedState)
  seeds.push({ cpu: cpuOf(offset), state: { ...state }, php: [], source: 'observed' });

const STOPS = new Set(['RTS', 'RTL', 'RTI', 'STP', 'BRK', 'COP']);
const stateKey = (s) => `${s.e}${s.m}${s.x}`;
function trace({ cpu, state, php, source }) {
  for (;;) {
    let offset;
    try {
      offset = cpuToOffset(cpu, SIZE);
    } catch {
      outside.set(cpuLabel(cpu), source);
      return;
    }
    const seen = observedState.get(offset);
    if (seen && stateKey(seen) !== stateKey(state)) {
      corrected++;
      state = { ...seen, c: state.c };
    }
    if (start[offset]) {
      if (stateAt[offset] !== stateKey(state))
        conflicts.push({
          at: cpuLabel(cpu),
          kind: 'state',
          first: stateAt[offset],
          second: stateKey(state),
          source,
        });
      return;
    }
    if (kind[offset] === STATIC || (kind[offset] === CODE && !seen)) {
      conflicts.push({ at: cpuLabel(cpu), kind: 'inside instruction', source });
      return;
    }
    const ins = decode(bytes, cpu, state);
    for (let i = 0; i < ins.length; i++) {
      const o = cpuToOffset((cpu & 0xff0000) | ((cpu + i) & 0xffff), SIZE);
      if (i && start[o])
        conflicts.push({ at: cpuLabel(cpu), kind: 'overlaps instruction start', source });
      if (kind[o] !== CODE) kind[o] = STATIC;
    }
    start[offset] = 1;
    stateAt[offset] = stateKey(state);
    const { mnemonic, mode, value, target } = ins;
    if (STOPS.has(mnemonic)) return;
    const next = { ...state };
    if (mnemonic === 'REP' || mnemonic === 'SEP') {
      const set = mnemonic === 'SEP' ? 1 : 0;
      if (value & 0x20) next.m = state.e ? 1 : set;
      if (value & 0x10) next.x = state.e ? 1 : set;
      if (value & 1) next.c = set;
    } else if (mnemonic === 'CLC') next.c = 0;
    else if (mnemonic === 'SEC') next.c = 1;
    else if (mnemonic === 'XCE') {
      if (next.c === null) {
        conflicts.push({ at: cpuLabel(cpu), kind: 'XCE with unknown carry', source });
        return;
      }
      [next.e, next.c] = [next.c, state.e];
      if (next.e) next.m = next.x = 1;
    } else if (mnemonic === 'PHP') php = [...php, { ...state }].slice(-8);
    else if (mnemonic === 'PLP') {
      if (!php.length) {
        plpUnknown++;
        return;
      }
      Object.assign(next, php[php.length - 1]);
      php = php.slice(0, -1);
    } else next.c = null;
    if (mode === 'indx' || mode === 'ind') {
      indirect.set(cpuLabel(cpu), `${mnemonic} ${ins.operand}`);
      const table = JUMP_TABLES.get(cpuLabel(cpu));
      if (table && !table.done) {
        table.done = true;
        const words = table.long
          ? []
          : Array.from({ length: 64 }, (_, k) =>
              bytes.readUInt16LE(cpuToOffset(table.table + 2 * k, SIZE)),
            );
        for (const t of table.targets) {
          if (!table.long && !words.includes(t & 0xffff))
            throw Error(
              `${cpuLabel(cpu)}: target ${hex(t & 0xffff, 4)} is not in the table ${cpuLabel(table.table)}`,
            );
          work.push({
            cpu: table.long ? t : (cpu & 0xff0000) | (t & 0xffff),
            state: { ...next, c: null },
            php: [],
            source: `${source} > ${cpuLabel(cpu)} table`,
          });
        }
      }
      if (mnemonic !== 'JSR') return; // JSR (abs,X) returns
    }
    if (mnemonic === 'JSR' || mnemonic === 'JSL') {
      if (target !== undefined)
        work.push({
          cpu: target,
          state: { ...next, c: null },
          php: [],
          source: `${source} > ${cpuLabel(cpu)}`,
        });
      callReturns++;
      cpu = ins.next;
      state = { ...next, c: null };
      continue;
    }
    if (mnemonic === 'JMP' || mnemonic === 'JML' || mnemonic === 'BRA' || mnemonic === 'BRL') {
      cpu = target;
      state = next;
      continue;
    }
    if (mode === 'rel8') {
      const taken = { ...next };
      if (mnemonic === 'BCC') taken.c = 0;
      else if (mnemonic === 'BCS') taken.c = 1;
      if (mnemonic === 'BCC') next.c = 1;
      else if (mnemonic === 'BCS') next.c = 0;
      work.push({ cpu: target, state: taken, php, source });
    }
    cpu = ins.next;
    state = next;
  }
}
// Unused natives: the native pointer table 82:D7B8 has one reader, 80:F500
// in the call_native handler 80:F4CB (opcode 58, only reached through the
// opcode table), and its index is the u8 operand of the bytecode. A native
// that no script, unreferenced script or tail names is therefore unreachable
// through the table. Its entry is traced last (pass 2), from every seed
// source; bytes only that pass reaches are code_unused_native. An entry
// shared with a used native stays live. Script bytecode built in WRAM is
// not known and not assumed.
// Unused opcodes the same way: the dispatcher 80:F390 (JMP (F2B4,X)) is the
// only reader of the opcode table 80:F2B4, and X is the bytecode byte at the
// instruction start (LDA ($00),Y, AND #$FF). A handler of opcodes that no
// script, unreferenced script or tail contains, and that no used opcode
// shares, is traced after the unused natives; bytes only that pass reaches
// are code_unused_opcode.
const scriptBundle = JSON.parse(await readFile('assets/scripts.json', 'utf8'));
const usedNatives = new Set(),
  usedOpcodes = new Set();
const noteNatives = (code, entry = 0) => {
  for (const ins of decodeScript(code, entry).instructions) {
    if (ins.pc < entry) continue;
    usedOpcodes.add(ins.opcode);
    if (ins.name === 'call_native') usedNatives.add(ins.operand);
  }
};
const readRom = (cpu) => bytes[cpuToOffset(cpu, SIZE)];
for (const s of scriptBundle.scripts) noteNatives(Uint8Array.from(s.bytecode));
for (const cpu of ORPHAN_SCRIPTS)
  noteNatives(
    Uint8Array.from(
      readOrphan(readRom, cpu, {
        scripts: tables.script_count,
        natives: tables.native_function_count,
      }).bytecode,
    ),
  );
for (const [cpu, id] of SCRIPT_TAILS) {
  const owner = Uint8Array.from(scriptBundle.scripts[id].bytecode);
  noteNatives(Uint8Array.from([...owner, ...readTail(readRom, cpu, owner)]), owner.length);
}
const nativeCpu = (n) => 0x800000 | parseInt(n.cpu_address.slice(3).replace(':', ''), 16);
const liveNativeEntries = new Set(
  tables.native_functions.filter((n) => usedNatives.has(parseInt(n.id, 16))).map(nativeCpu),
);
const unusedNatives = tables.native_functions.filter((n) => !liveNativeEntries.has(nativeCpu(n)));
const opcodeCpu = (op) => 0x800000 | bytes.readUInt16LE(0x72b4 + op);
const opcodeList = Array.from({ length: 0xc4 / 2 }, (_, k) => 2 * k);
const liveOpcodeEntries = new Set(opcodeList.filter((op) => usedOpcodes.has(op)).map(opcodeCpu));
const unusedOpcodes = opcodeList.filter((op) => !liveOpcodeEntries.has(opcodeCpu(op)));
const unusedEntries = new Set([...unusedNatives.map(nativeCpu), ...unusedOpcodes.map(opcodeCpu)]);
// Observed instructions first, so that their states lead the trace.
const pass1 = seeds.filter((s) => s.source === 'observed' || !unusedEntries.has(s.cpu));
const work = [
  ...pass1.filter((s) => s.source !== 'observed'),
  ...pass1.filter((s) => s.source === 'observed'),
];
while (work.length) trace(work.pop());
const passOne = kind.slice(),
  beforeUnused = kind.slice();
const unusedNativeReport = [];
for (const n of unusedNatives) {
  if (unusedNativeReport.some((r) => r.entry === n.cpu_address)) continue;
  work.push({
    cpu: nativeCpu(n),
    state: { e: 0, m: 0, x: 0, c: null },
    php: [],
    source: `unused native ${n.id}`,
  });
  while (work.length) trace(work.pop());
  let reached = 0;
  for (let o = 0; o < SIZE; o++)
    if (kind[o] === STATIC && beforeUnused[o] !== STATIC) {
      beforeUnused[o] = STATIC;
      reached++;
    }
  unusedNativeReport.push({ id: n.id, entry: n.cpu_address, bytes: reached });
}
for (let o = 0; o < SIZE; o++)
  if (kind[o] === STATIC && passOne[o] !== STATIC) kind[o] = CODE_UNUSED_NATIVE;
const unusedOpcodeReport = [];
for (const op of unusedOpcodes) {
  const entry = cpuLabel(opcodeCpu(op)),
    seen = unusedOpcodeReport.find((r) => r.entry === entry);
  if (seen) {
    seen.opcodes.push(hex(op, 2));
    continue;
  }
  work.push({
    cpu: opcodeCpu(op),
    state: { e: 0, m: 0, x: 0, c: null },
    php: [],
    source: `unused opcode ${hex(op, 2)}`,
  });
  while (work.length) trace(work.pop());
  let reached = 0;
  for (let o = 0; o < SIZE; o++)
    if (kind[o] === STATIC && beforeUnused[o] !== STATIC) {
      beforeUnused[o] = STATIC;
      kind[o] = CODE_UNUSED_OPCODE;
      reached++;
    }
  unusedOpcodeReport.push({ opcodes: [hex(op, 2)], entry, bytes: reached });
}

// Scripts and their tables.
const bundle = scriptBundle;
let scriptOverStatic = 0;
for (const s of tables.scripts) {
  const offset = parseInt(s.rom_offset, 16),
    length = 2 + bundle.scripts[parseInt(s.id, 16)].bytecode.length;
  for (let i = 0; i < length; i++) {
    if (kind[offset + i] === CODE)
      throw Error(`Script ${s.id} overlaps executed code at ${hex(offset + i)}`);
    if (kind[offset + i] === STATIC) scriptOverStatic++;
    kind[offset + i] = SCRIPT;
  }
}
const t = europeanTables;
for (let o = t.nativePointers; o < t.scriptArgumentBytes + tables.script_count; o++) {
  if (kind[o] === CODE) throw Error(`Script table overlaps executed code at ${hex(o)}`);
  kind[o] = TABLE;
}

// Texts.
const read8 = (cpu) => bytes[cpuToOffset(cpu, SIZE)],
  read16 = (cpu) => read8(cpu) | (read8(cpu + 1) << 8);
const tree = readTextTree(read16),
  treeEnd = TEXT_TREE + 4 * tree.length;
const allUnknown = (cpu, length) => {
  for (let i = 0; i < length; i++) if (kind[cpuToOffset(cpu + i, SIZE)] !== UNKNOWN) return false;
  return true;
};
if (!allUnknown(TEXT_TREE, treeEnd - TEXT_TREE)) throw Error('Text tree overlaps classified bytes');
for (let cpu = TEXT_TREE; cpu < treeEnd; cpu++) kind[cpuToOffset(cpu, SIZE)] = TREE;
const textRegions = [];
for (const start of [treeEnd, 0x9e8000]) {
  let cpu = start,
    count = 0;
  for (;;) {
    if (!allUnknown(cpu, 1)) break;
    let found;
    try {
      found = readText(
        (c) => ((c & 0xffff) >= 0x8000 && c >>> 16 === start >>> 16 ? read8(c) : 0x100),
        tree,
        cpu,
      );
    } catch {
      break;
    }
    if ((cpu & 0xffff) + found.length > 0x10000 || !allUnknown(cpu, found.length)) break;
    for (let i = 0; i < found.length; i++) kind[cpuToOffset(cpu + i, SIZE)] = TEXT;
    cpu += found.length;
    count++;
  }
  textRegions.push({ start: cpuLabel(start), end: cpuLabel(cpu), texts: count });
}

// Room tiles.
const tileConflicts = [];
const claim = (cpu, length, cls) => {
  for (let i = 0; i < length; i++) {
    const o = cpuToOffset(cpu + i, SIZE);
    if (kind[o] !== UNKNOWN) {
      tileConflicts.push({
        at: cpuLabel(cpu + i),
        class: CLASS_NAMES[kind[o]],
        as: CLASS_NAMES[cls],
      });
      continue;
    }
    kind[o] = cls;
  }
};
claim(TILE_TABLE, 2 * TILE_STREAMS, TILE_INDEX);
for (const s of readTiles(read8)) claim(s.start, s.byteLength, TILE_LZ);
for (const [cpu, length] of outsidePortraits(
  read8,
  outsideCycles(
    mergeRanges([
      ...JSON.parse(await readFile('analysis/rom-palettes.json', 'utf8')).ranges,
      ...readSceneListPalettes(read8),
    ]),
  ),
))
  claim(cpu, length, PALETTE);
for (const p of readPortraits(read8))
  claim(parseInt(p.address.replace(':', ''), 16), PORTRAIT_SIZE, PORTRAIT);
readDialogs(read8);
claim(DIALOG_TABLE, 2 * DIALOGS, DIALOG);
claim(DIALOG_DATA, DIALOG_END - DIALOG_DATA, DIALOG);
readRunners(read8);
claim(RUNNER_TABLE, RUNNER_END - RUNNER_TABLE, RUNNER);
readSpcDriver(read8);
claim(SPC_DRIVER_ROM, SPC_DRIVER_LENGTH, SPC_DRIVER);
for (const t of LOOKUP_TABLES) claim(t.address, t.length, LOOKUP_TABLE);
claim(MATRIX_ANIMATIONS, MATRIX_ANIMATIONS_END - MATRIX_ANIMATIONS, LOOKUP_TABLE);
readMatrixTexts(read8);
claim(MATRIX_LISTS, MATRIX_END - MATRIX_LISTS, MATRIX_TEXT);
claim(FONT, FONT_END - FONT, FONT_CLASS);
claim(HEADER, HEADER_END - HEADER, HEADER_CLASS);
readPaletteCycles(read8);
claim(CYCLE_TABLE, CYCLE_END - CYCLE_TABLE, PALETTE_CYCLE);
const objectPictures = readPictures(
  read8,
  readActions(read8)
    .blocks.filter((b) => b.frames)
    .flatMap((b) => b.frames),
);
for (const [cpu, length] of mergeVramRanges([
  ...JSON.parse(await readFile('analysis/rom-vram.json', 'utf8')).ranges.map((r) => [
    parseInt(r.source.replace(':', ''), 16),
    r.length,
    r.format,
  ]),
  ...pictureSources(objectPictures),
  ...C06B_SOURCES,
]))
  claim(cpu, length, VRAM_TILE);
claim(SCENE_TABLE, 3 * SCENES, SCENE_TABLE_CLASS);
readTilesets(read8);
claim(TILESET_DATA, TILESET_END - TILESET_DATA, TILESET);
readObjectTypes(read8);
claim(OBJECT_DATA, OBJECT_TABLE + 2 * OBJECT_TYPES - OBJECT_DATA, OBJECT_TYPE);
readSceneLists(read8);
for (const [start, end] of LIST_RUNS) claim(start, end - start, SCENE_LIST);
readMenuTexts(read8);
for (const [start, end] of MENU_TEXT_RUNS) claim(start, end - start, MENU_TEXT);
readRooms(read8);
claim(ROOM_TABLE, ROOM_TABLE_END - ROOM_TABLE, ROOM_TABLE_CLASS);
for (const [start, end] of ROOM_RUNS) claim(start, end - start, ROOM);
readActors(read8);
claim(ACTOR_TABLE, ACTOR_END - ACTOR_TABLE, ACTOR);
readKinds(read8);
claim(KIND_TABLE, KIND_END - KIND_TABLE, KIND);
readPictures(
  read8,
  readActions(read8)
    .blocks.filter((b) => b.frames)
    .flatMap((b) => b.frames),
);
claim(ACTION_DATA, ACTION_END - ACTION_DATA, ACTION);
for (const [start, end] of PICTURE_RUNS) claim(start, end - start, PICTURE);
readTopics(read8);
claim(TOPIC_TABLE, TOPIC_END - TOPIC_TABLE, TOPIC);
for (const [start, length] of soundRanges(read8)) claim(start, length, SOUND);
readObjectGraphics(read8);
claim(GRAPHIC_TABLE, 3 * GRAPHICS, OBJECT_GRAPHIC);
for (const [start, end] of GRAPHIC_RUNS) {
  const [shared, sharedEnd] =
    start < GRAPHIC_SHARED[0] && end > GRAPHIC_SHARED[0] ? GRAPHIC_SHARED : [end, end];
  claim(start, shared - start, OBJECT_GRAPHIC);
  claim(sharedEnd, end - sharedEnd, OBJECT_GRAPHIC);
}
const packedSources = new Set([
  ...JSON.parse(await readFile('analysis/rom-vram.json', 'utf8')).streams.map((s) =>
    parseInt(s.source.replace(':', ''), 16),
  ),
  ...readSceneTable(read8),
  ...FIXED_SOURCES.map(([cpu]) => cpu),
  ...readSceneListStreams(read8).map(([cpu]) => cpu),
  ...portraitStreams(read8),
]);
for (const cpu of packedSources) {
  const length = read8(cpu) | (read8(cpu + 1) << 8);
  claim(
    cpu,
    2 +
      lzDecode(
        (n) => read8(cpu + 2 + n),
        length,
        lzBits((n) => read8(0x80a033 + n)),
      ).byteLength,
    LZ_STREAM,
  );
}

// Dead code: unknown instruction runs in banks 80 and 81 that no traced
// instruction, jump table or script table reaches. Each entry [CPU, M, X]
// must decode within unknown bytes, directly behind a traced instruction
// that never falls through (RTS, RTL, RTI, JMP, JML, BRA, BRL), and end with
// such an instruction or run into a traced instruction start of the same
// state. Branch and call targets must be traced instruction starts or lie
// inside the run. A second routine may follow a dead return. No reference
// to these addresses was found in code, jump tables or script tables
// (docs/ROM-FREE.md). Kept like all other code-like bytes.
const DEAD_CODE = [
  [0x80b933, 1, 0],
  [0x80bbf1, 0, 0],
  [0x80ca76, 0, 0],
  [0x80ca8c, 0, 0],
  [0x80cb6f, 0, 0],
  [0x80cb87, 0, 0],
  [0x80d190, 0, 0],
  [0x80f777, 0, 0],
  [0x80f7b9, 0, 0],
  [0x80f7fb, 0, 0],
  [0x80f840, 0, 0],
  [0x8188a2, 0, 0],
  [0x8188e1, 0, 0],
  [0x819389, 0, 0],
  [0x81cfcb, 0, 0],
  [0x81ecd1, 0, 0],
  [0x81ed2e, 0, 0],
  [0x81f28f, 0, 0],
  [0x81f2a6, 0, 0],
];
const NO_FALLTHROUGH = new Set(['RTS', 'RTL', 'RTI', 'JMP', 'JML', 'BRA', 'BRL']);
const keyState = (key) => ({ e: +key[0], m: +key[1], x: +key[2], c: null });
const deadCode = [],
  deadAt = new Map(); // CPU -> dead instruction
for (const [entry, m, x] of DEAD_CODE) {
  const fail = (why) => {
    throw Error(`Dead code ${cpuLabel(entry)}: ${why}`);
  };
  let before = null;
  for (let k = 1; k <= 4 && !before; k++) {
    const o = cpuToOffset(entry - k, SIZE),
      dead = deadAt.get(entry - k);
    if (dead?.length === k) before = dead;
    else if (start[o] && decode(bytes, entry - k, keyState(stateAt[o])).length === k)
      before = decode(bytes, entry - k, keyState(stateAt[o]));
  }
  if (!before || !NO_FALLTHROUGH.has(before.mnemonic))
    fail('not behind an instruction without fallthrough');
  const run = new Map(),
    pending = [[entry, { e: 0, m, x, c: null }]],
    targets = [];
  while (pending.length) {
    let [cpu, state] = pending.pop();
    for (;;) {
      const o = cpuToOffset(cpu, SIZE);
      if (run.has(cpu)) {
        if (stateKey(run.get(cpu).state) !== stateKey(state)) fail('state conflict inside the run');
        break;
      }
      if (kind[o] !== UNKNOWN) {
        if (!start[o] || stateAt[o] !== stateKey(state))
          fail(
            `${cpuLabel(cpu)} is not a traced instruction of the same state (${stateAt[o]} vs ${stateKey(state)})`,
          );
        break;
      }
      const ins = decode(bytes, cpu, state);
      for (let i = 0; i < ins.length; i++)
        if (kind[cpuToOffset(cpu + i, SIZE)] !== UNKNOWN)
          fail('instruction overlaps classified bytes');
      run.set(cpu, ins);
      const next = { ...state };
      if (ins.mnemonic === 'REP' || ins.mnemonic === 'SEP') {
        const set = ins.mnemonic === 'SEP' ? 1 : 0;
        if (ins.value & 0x20) next.m = set;
        if (ins.value & 0x10) next.x = set;
      }
      // The run's state must stay known: PLP only right before a return,
      // no XCE and no indirect jump.
      const plpReturn =
        ins.mnemonic === 'PLP' && ['RTS', 'RTL'].includes(decode(bytes, ins.next, next).mnemonic);
      if (
        (ins.mnemonic === 'PLP' && !plpReturn) ||
        ins.mnemonic === 'XCE' ||
        ins.mode === 'ind' ||
        ins.mode === 'indx'
      )
        fail(`${ins.mnemonic} at ${cpuLabel(cpu)} leaves the state unknown`);
      if (ins.target !== undefined) {
        if (ins.mode === 'rel8' || ins.mode === 'rel16') {
          if (kind[cpuToOffset(ins.target, SIZE)] === UNKNOWN)
            pending.push([ins.target, { ...next }]);
          else targets.push([ins.target, next]);
        } else targets.push([ins.target, null]);
      }
      if (NO_FALLTHROUGH.has(ins.mnemonic)) break;
      cpu = ins.next;
      state = next;
    }
  }
  for (const [target, state] of targets) {
    const o = cpuToOffset(target, SIZE);
    if (!run.has(target) && (!start[o] || (state && stateAt[o] !== stateKey(state))))
      fail(`target ${cpuLabel(target)} is not traced`);
  }
  for (const ins of run.values()) {
    deadAt.set(ins.cpu, ins);
    for (let i = 0; i < ins.length; i++) kind[cpuToOffset(ins.cpu + i, SIZE)] = CODE_DEAD;
  }
  deadCode.push({
    entry: cpuLabel(entry),
    bytes: [...run.values()].reduce((n, i) => n + i.length, 0),
    instructions: run.size,
    behind: `${cpuLabel(before.cpu)} ${before.mnemonic}`,
  });
}

// Unreferenced scripts: after every other claim except filler; their bytes
// must still be unknown (src/data/orphan-scripts.mjs).
const idCounts = { scripts: tables.script_count, natives: tables.native_function_count };
const orphans = ORPHAN_SCRIPTS.map((cpu) => ({
  address: cpu,
  bytecode: readOrphan(read8, cpu, idCounts).bytecode,
}));
const claimUnknown = (cpu, length) => {
  if (!allUnknown(cpu, length))
    throw Error('Unreferenced script overlaps classified bytes at ' + cpuLabel(cpu));
  for (let i = 0; i < length; i++) kind[cpuToOffset(cpu + i, SIZE)] = ORPHAN_SCRIPT;
};
for (const { address, bytecode } of orphans) claimUnknown(address, 2 + bytecode.length);
for (const [cpu, id] of SCRIPT_TAILS) {
  const owner = Uint8Array.from(bundle.scripts[id].bytecode);
  if (cpuOf(parseInt(tables.scripts[id].rom_offset, 16) + 2 + owner.length) !== cpu)
    throw Error('Tail does not follow its script at ' + cpuLabel(cpu));
  claimUnknown(cpu, readTail(read8, cpu, owner).length);
}

// Filler: after every other claim, whole unknown runs of one repeated value
// with a structural reason (src/data/fillers.mjs).
const scriptEnds = scriptJumpEnds([
  ...tables.scripts.map((s) => ({
    address: cpuOf(parseInt(s.rom_offset, 16)),
    bytecode: bundle.scripts[parseInt(s.id, 16)].bytecode,
  })),
  ...orphans,
]);
for (let o = 0; o < SIZE;) {
  // Runs end at bank boundaries; a filler never spans two banks.
  let e = o + 1;
  while (e < SIZE && kind[e] === kind[o] && e % 0x8000) e++;
  if (kind[o] === UNKNOWN && fillerKind(read8, cpuOf(o), e - o, scriptEnds))
    kind.fill(FILLER, o, e);
  o = e;
}

// Bytes read and margin.
const readsFile = JSON.parse(await readFile('analysis/rom-reads.json', 'utf8'));
const readBy = Object.fromEntries(CLASS_NAMES.map((n) => [n, 0])),
  readCode = [];
for (const [offset, length] of readsFile.ranges)
  for (let o = offset; o < offset + length; o++) {
    readBy[CLASS_NAMES[kind[o]]]++;
    if (kind[o] === CODE) {
      readCode.push(hex(o, 5));
      kind[o] = KEPT;
    }
  }
// The original's reads from the coverage scenarios: bytes of every code class change to code_kept,
// since the data package leaves out all code classes (tools/build-cartridge.mjs).
// Excluded are reads the native product never makes, each with its proof:
// - 81:D479 to 81:D577 (ROM offsets D479 to D577), the NMI callback code right behind the
//   terminator 00 at 81:D478 of the channel 7 window HDMA table 81:D463. In tourplay4 Mesen
//   reads it in ascending order within one frame, a few bytes per scan line, while the CPU waits
//   in the sound command loop 81:F00E: a channel enabled during the field continues from its A2
//   address 43x8/43x9 behind that terminator. Book I PDF 144 (420C) has the initial settings made
//   for every field and PDF 152 (43x8) the A2 address count up; the continuation inside a field
//   is Mesen's behaviour, not stated there. src/video/hdma.mjs starts every table at its A1
//   address 43x2 to 43x4 for each frame and never reads past the terminator.
const CODE_CLASSES = new Set([CODE, STATIC, CODE_DEAD, CODE_UNUSED_NATIVE, CODE_UNUSED_OPCODE]);
const observedReadCode = [],
  hardwareOnlyReads = [];
for (const [key, pc] of Object.entries(observed.reads ?? {})) {
  const o = parseInt(key, 16);
  if (!CODE_CLASSES.has(kind[o])) continue;
  if (isHardwareOnlyCodeRead(o)) {
    hardwareOnlyReads.push(`${hex(o, 5)} ${pc}`);
    continue;
  }
  observedReadCode.push(`${hex(o, 5)} ${pc}`);
  kind[o] = KEPT;
}
let margin = 0;
// All code classes are absent from the product; a transition from static,
// unused or dead code to executed code is not a data boundary.
const MARGIN_CODE_CLASSES = new Set([...CODE_CLASSES, KEPT]);
for (let o = 1; o < SIZE; o++)
  if (kind[o] === CODE && isDataToCodeBoundary(kind, o, MARGIN_CODE_CLASSES)) {
    kind[o] = KEPT;
    margin++;
  }

const counts = Object.fromEntries(CLASS_NAMES.map((n) => [n, 0]));
for (let o = 0; o < SIZE; o++) counts[CLASS_NAMES[kind[o]]]++;
const ranges = [];
for (let o = 0; o < SIZE;) {
  let e = o;
  while (e < SIZE && kind[e] === kind[o]) e++;
  ranges.push({ rom_offset: hex(o, 5), length: e - o, class: CLASS_NAMES[kind[o]] });
  o = e;
}
const banks = [];
for (let b = 0; b < SIZE / 0x8000; b++) {
  const c = new Array(CLASS_NAMES.length).fill(0);
  for (let o = b * 0x8000; o < (b + 1) * 0x8000; o++) c[kind[o]]++;
  banks.push({
    bank: hex(0x80 + b, 2),
    ...Object.fromEntries(CLASS_NAMES.map((n, i) => [n, c[i]])),
  });
}
const tracedStarts = [];
for (let o = 0; o < SIZE; o++) if (start[o]) tracedStarts.push(`${hex(o, 5)}:${stateAt[o]}`);
const report = {
  rom_sha256: ROM_SHA256,
  scope:
    'ROM classification for the ROM-free product. Code of every class is left out of the data package except code_kept (bytes a data reader touches); everything else is kept.',
  observed: {
    instruction_starts: observedState.size,
    addresses_with_several_states: observedMulti,
    scenarios: observed.scenarios,
  },
  static_seeds: { total: seeds.length, listings: listings.length },
  counts,
  call_return_assumptions: callReturns,
  observed_state_corrections: corrected,
  plp_without_php: plpUnknown,
  script_bytes_also_traced_statically: scriptOverStatic,
  text_regions: textRegions,
  tile_conflicts: tileConflicts,
  runtime_reads: {
    total: readsFile.bytes,
    by_class_before_keeping: readBy,
    executed_code_read: readCode,
  },
  observed_reads: {
    total: Object.keys(observed.reads ?? {}).length,
    script_tours_not_kept: Object.keys(observed.script_tour_reads ?? {}).length,
    executed_code_read: observedReadCode,
    hardware_only_not_kept: hardwareOnlyReads.length,
  },
  margin_bytes_kept: margin,
  dead_code: deadCode,
  unused_natives: unusedNativeReport,
  unused_opcodes: unusedOpcodeReport,
  // Traced instruction starts with their state (E, M, X) as "offset:emx", for the coverage guard
  // of tools/rom-code-coverage.mjs.
  traced_starts: tracedStarts,
  conflicts: conflicts.length,
  conflict_samples: conflicts.slice(0, 40),
  indirect_jumps: Object.fromEntries([...indirect].sort()),
  targets_outside_rom: Object.fromEntries([...outside].sort()),
  banks,
  ranges,
};
await writeFile('analysis/vm-rom-map.json', JSON.stringify(report, null, 1) + '\n');
console.log(
  JSON.stringify({
    counts,
    conflicts: conflicts.length,
    corrected,
    plpUnknown,
    scriptOverStatic,
    margin,
    executed_code_read: readCode,
    observed_executed_code_read: observedReadCode,
  }),
);
