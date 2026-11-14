// Code coverage from Mesen2 for the ROM map (docs/ROM-FREE.md), not part of the tests.
// node tools/rom-code-coverage.mjs [scenario ...]
// Each scenario runs in tools/mesen/explore.lua with COVER = 1 and reports every executed
// instruction start in the ROM with P and E the first time. The result is merged into the
// existing analysis/rom-code-observed.json (same address with another state: both states).
// Every scenario also reports the original's data reads in the code banks 80/81 (explore.lua "XR"),
// merged as reads (ROM offset -> CPU address of the first reading instruction): the ROM map keeps
// those bytes (code_kept). Reads are merged even from guarded tour entries whose starts are dropped.
// Script tours run scripts with foreign arguments, which read whole code ranges through stray
// pointers; their reads go to script_tour_reads, are reported only and never kept.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { findMesen } from './mesen.mjs';
import { explore } from './mesen-explore.mjs';
import { decode } from './disassemble.mjs';
import {
  MORGUE_DOOR_PLAN,
  MORGUE_EXIT_PLAN,
  STREET_PLAN,
  SOUTHWEST_PLAN,
  ALLEY_PLAN,
  ALLEY_FIGHT_PLAN,
  DOG_DIALOG_PLAN,
  APARTMENT_PLAN,
  BED_PLAN,
  SHADES_PLAN,
  DESK_PHONE_PLAN,
  SELECT_PLAN,
  ITEMS_PLAN,
  BED_SAVE_KARMA_PLAN,
  BADGE_OFFER_PLAN,
} from './mesen-f390-oracle.mjs';

const OUT = 'analysis/rom-code-observed.json';
// The read callbacks of the coverage (explore.lua "XR") slow Mesen down; every time limit gets this factor.
const TIME_FACTOR = 3;
// Karma menu 80:EE57 from the bed menu with the karma word 7E:3C11 set to 0400 (128 shown) by
// the coverage-only poke command: Attribute buys Body twice and Strength, karma 0 shows "Not
// enough Karma" (80:F006), Skills buys Firearm, Magic shows only Exit for Jake.
const KARMA = 0x3c11;
const KARMA_PLAN = [
  ...BED_PLAN,
  ['poke', KARMA, 0x0400],
  ['wait', 200],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['poke', KARMA, 0],
  ['press', 'b', 120],
  ['press', 'b', 80],
  ['poke', KARMA, 0x0400],
  ['press', 'up', 20],
  ['press', 'up', 20],
  ['press', 'b', 120],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'up', 20],
  ['press', 'b', 120],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['press', 'b', 120],
  ['press', 'b', 120],
  ['wait', 100],
];
// Status screen 80:EA6E after the morgue: Skills (80:E834) and Cyber (80:E8C8) windows, then
// with poked spells (Jake's record 7E:3BFB: Magic 3 at 3BFC, levels at 3C07..3C0C, magic
// points 7E:3C96) each spell of the Magic list 80:E693 chosen as X spell and cast at "Me".
const SPELL_POKES = [
  ['poke', 0x3bfb, 0x0303],
  ['poke', 0x3c07, 0x0201],
  ['poke', 0x3c09, 0x0101],
  ['poke', 0x3c0b, 0x0101],
  ['poke', 0x3c96, 30],
];
const down = (n) => Array.from({ length: n }, () => ['press', 'down', 30]);
const openStatus = [
  ['press', 'start', 150],
  ['wait', 150],
];
const STATUS_PLAN = [
  ...MORGUE_EXIT_PLAN,
  ...SPELL_POKES,
  ['wait', 100],
  ...[5, 6].flatMap((row) => [
    ...openStatus,
    ...down(row),
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'b', 120],
  ]),
  ...[2, 3, 4, 5, 6, 1].flatMap((spell) => [
    ...openStatus,
    ...down(2),
    ['press', 'b', 120],
    ...down(spell),
    ['press', 'b', 120],
    ['press', 'b', 120],
    ['press', 'x', 30],
    ['press', 'b', 60],
    ['wait', 120],
  ]),
];
// Room tours: at the morgue exit (the first room change 80:A4BF) the explore command tour saves
// the state and visits every entry of the room table 8D:929D (assets/vm-rooms.json, entries
// with a room) for 300 frames without a key, loading the state again for each. The story state
// stays that of the morgue, so a tour is guarded: its new instruction starts are merged only
// when each is a traced instruction start of the ROM map with the same state (romGuard).
const ROOM_ENTRIES = JSON.parse(readFileSync('assets/vm-rooms.json', 'utf8')).entries.flatMap(
  (e, i) => (e?.room === null || e?.room === undefined ? [] : [i]),
);
const TOUR_SIZE = 100,
  TOUR_FRAMES = 300;
const exitRest = MORGUE_EXIT_PLAN.slice(MORGUE_DOOR_PLAN.length);
const tours = Object.fromEntries(
  Array.from({ length: Math.ceil(ROOM_ENTRIES.length / TOUR_SIZE) }, (_, k) => {
    const entries = ROOM_ENTRIES.slice(k * TOUR_SIZE, (k + 1) * TOUR_SIZE);
    return [
      `tour${k + 1}`,
      {
        start: 3000,
        commands: [...MORGUE_DOOR_PLAN, ['tour', TOUR_FRAMES, ...entries], ...exitRest],
        limit: 5400 + entries.length * TOUR_FRAMES,
        timeoutMs: 400000,
        guard: true,
      },
    ];
  }),
);
// Sequences and the matrix start through the request word 1CE9 that 80:CC4B polls in the main
// loop: FFFE calls the matrix 81:C3CA, any other value the sequence 81:CDF8 with A = 1CE9 and
// X = 1CEB; afterwards the room entry 7E:2DE2 is loaded again. From the street (back to entry
// 1F) each request runs after a rewind to the same saved state; all three are guarded like the
// tours. Sequence values are those that scripts pass to native 54 (80:CC33): 5 and 14 are the
// credits (scenario credits, longer). The matrix arguments (system 1D8F, return entry, 1D8E,
// level 1D90) are the 39 distinct calls of script 2E8, which passes them to native 7D (80:E30F).
const SEQUENCE = (value, x, frames) => [
  ['poke', 0x2de2, 0x1f],
  ['poke', 0x1ceb, x],
  ['poke', 0x1ce9, value],
  ['wait', frames],
  ['rewind'],
];
const MATRIX_CALLS = [
  [16, 160, 0, 3],
  [1, 352, 0, 1],
  [2, 353, 0, 1],
  [3, 354, 2, 2],
  [3, 354, 0, 2],
  [4, 381, 0, 2],
  [3, 471, 2, 3],
  [3, 471, 0, 3],
  [5, 355, 0, 2],
  [6, 384, 0, 2],
  [12, 481, 0, 3],
  [7, 422, 0, 2],
  [8, 425, 0, 2],
  [5, 482, 0, 3],
  [14, 483, 2, 3],
  [14, 483, 0, 3],
  [8, 423, 0, 2],
  [4, 424, 0, 2],
  [7, 479, 0, 2],
  [10, 484, 0, 3],
  [9, 485, 0, 3],
  [0, 351, 0, 5],
  [3, 480, 2, 2],
  [3, 480, 0, 2],
  [13, 486, 0, 3],
  [15, 487, 0, 3],
  [6, 466, 0, 2],
  [0, 172, 0, 1],
  [2, 488, 0, 4],
  [9, 490, 0, 4],
  [5, 491, 0, 4],
  [7, 489, 0, 4],
  [9, 492, 2, 4],
  [9, 492, 0, 4],
  [11, 497, 0, 4],
  [10, 493, 0, 4],
  [0, 494, 0, 4],
  [1, 495, 0, 4],
  [2, 496, 0, 4],
];
const MATRIX_STEP = (call) => [
  ['matrix', ...call],
  ['wait', 300],
  ['hold', 'right', 40],
  ['hold', 'up', 40],
  ['hold', 'left', 40],
  ['hold', 'down', 40],
  ['press', 'b', 30],
  ['press', 'a', 30],
  ['wait', 120],
  ['rewind'],
];
// Matrix with input: after the intro countdown (about 650 frames) a fixed pseudo-random run of
// directions and A, B, Y per system (X jacks out); Jake's Computer byte 7E:3C04 is poked to 12.
// Two halves of the 39 systems, each with rewind; guarded like the other requests.
function matrixInputs(seed, frames) {
  const keys = ['up', 'down', 'left', 'right', 'up', 'down', 'left', 'right', 'a', 'b', 'y'],
    out = [];
  let x = seed,
    used = 0;
  while (used < frames) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const key = keys[x % keys.length],
      n = key.length === 1 ? 20 : 8 + ((x >> 8) % 24);
    out.push(key.length === 1 ? ['press', key, n] : ['hold', key, n]);
    used += n;
  }
  return out;
}
const MATRIX_PLAY = (call, k) => [
  ['poke', 0x3c04, 12, 1],
  ['matrix', ...call],
  ['wait', 650],
  ...matrixInputs(k + 1, 900),
  ['rewind'],
];
const REQUESTS = {
  cutscenes: {
    commands: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 5],
      [0x8000, 0],
      [0x8001, 0],
      [0x8002, 0],
    ].flatMap(([v, x]) => SEQUENCE(v, x, 2500)),
    frames: 7 * 2600,
  },
  credits: {
    commands: [
      [5, 0],
      [0x14, 0],
    ].flatMap(([v, x]) => SEQUENCE(v, x, 15000)),
    frames: 2 * 15100,
  },
  matrix: { commands: MATRIX_CALLS.flatMap(MATRIX_STEP), frames: MATRIX_CALLS.length * 700 },
  matrixplay1: { commands: MATRIX_CALLS.slice(0, 20).flatMap(MATRIX_PLAY), frames: 20 * 1600 },
  matrixplay2: {
    commands: MATRIX_CALLS.slice(20).flatMap((c, k) => MATRIX_PLAY(c, k + 20)),
    frames: 19 * 1600,
  },
};
const requests = Object.fromEntries(
  Object.entries(REQUESTS).map(([name, r]) => [
    name,
    {
      start: 3000,
      commands: [...STREET_PLAN, ['wait', 60], ['mark'], ...r.commands],
      limit: 6000 + r.frames,
      timeoutMs: 600000,
      guard: true,
    },
  ]),
);
// Script tours: the first task creation 80:C2C8 in the morgue (frame 3895) saves the state, then
// each script ID replaces X there for 200 frames, rewinding before each. The arguments are those
// of the original task, so many scripts run with foreign values; a run that halts the CPU is
// ended by a reset (explore.lua). Guarded per script: the starts first seen while a script runs
// (explore.lua "XT") are merged only when all of them pass romGuard; other scripts are dropped.
const SCRIPT_COUNT = JSON.parse(readFileSync('assets/scripts.json', 'utf8')).scripts.length;
const SCRIPT_TOUR = 190,
  SCRIPT_FRAMES = 200;
const scriptTours = Object.fromEntries(
  Array.from({ length: Math.ceil(SCRIPT_COUNT / SCRIPT_TOUR) }, (_, k) => {
    const ids = Array.from(
      { length: Math.min(SCRIPT_TOUR, SCRIPT_COUNT - k * SCRIPT_TOUR) },
      (_, i) => k * SCRIPT_TOUR + i,
    );
    return [
      `scripts${k + 1}`,
      {
        start: 3000,
        commands: [...MORGUE_DOOR_PLAN, ['scripts', SCRIPT_FRAMES, ...ids], ...exitRest],
        limit: 4400 + ids.length * (SCRIPT_FRAMES + 10),
        timeoutMs: 600000,
        guard: true,
        foreign: true,
      },
    ];
  }),
);
// Room tours with input (tourplay1 to tourplay5): the same entries, 600 frames each with the
// pseudo-random input of explore.lua (directions, A, B, Y, R, Start), guarded per entry.
const PLAY_FRAMES = 600;
const playTours = Object.fromEntries(
  Array.from({ length: Math.ceil(ROOM_ENTRIES.length / TOUR_SIZE) }, (_, k) => {
    const entries = ROOM_ENTRIES.slice(k * TOUR_SIZE, (k + 1) * TOUR_SIZE);
    return [
      `tourplay${k + 1}`,
      {
        start: 3000,
        commands: [...MORGUE_DOOR_PLAN, ['tourplay', PLAY_FRAMES, ...entries], ...exitRest],
        limit: 5400 + entries.length * PLAY_FRAMES,
        timeoutMs: 900000,
        guard: true,
      },
    ];
  }),
);
// A guarded start must be an instruction start of the ROM map's trace (traced_starts) with the same
// E, M and X, or with another state under which the instruction has the same length (REP #$20 is
// two bytes in either M); then no byte outside traced code becomes code. Starts
// in code_unused_native, code_unused_opcode or code_dead are refused: no well-formed script reaches
// them, so a run that does is broken (for example a script return through a foreign stack).
const UNREACHED = new Set(['code_unused_native', 'code_unused_opcode', 'code_dead']);
function romGuard() {
  const map = JSON.parse(readFileSync('analysis/vm-rom-map.json', 'utf8'));
  const traced = new Map(map.traced_starts.map((s) => s.split(':')));
  for (const r of map.ranges.filter((r) => UNREACHED.has(r.class)))
    for (let o = parseInt(r.rom_offset, 16); o < parseInt(r.rom_offset, 16) + r.length; o++)
      traced.delete(o.toString(16).toUpperCase().padStart(5, '0'));
  const rom = readFileSync('Shadowrun (E).smc'),
    bytes = rom.length % 1024 === 512 ? rom.subarray(512) : rom;
  const length = (offset, [e, m, x]) =>
    decode(bytes, ((0x80 | (offset >> 15)) << 16) | 0x8000 | (offset & 0x7fff), {
      e: +e,
      m: +m,
      x: +x,
      c: null,
    }).length;
  return (key, state) => {
    const [ps, e] = state.split(' '),
      p = parseInt(ps, 16),
      seen = `${e}${(p >> 5) & 1}${(p >> 4) & 1}`,
      known = traced.get(key);
    if (known === undefined) return false;
    return known === seen || length(parseInt(key, 16), known) === length(parseInt(key, 16), seen);
  };
}
// Scenarios: first frame of the commands (before it A+Start every 120 frames), commands, last
// frame, optional save game. select, items, bed and badge reuse the oracle plans of
// tools/mesen-f390-oracle.mjs (group overview, item list, bed menu with save and karma, the
// business man's offer from the save game apartment). intro runs without input from power on
// (the attract sequence repeats before frame 15000; 30000 frames add nothing); newgame starts
// a new game without skipping the opening sequence (only 2 new starts, kept for the record).
export const SCENARIOS = {
  cold: { start: 3000, commands: [['wait', 600]], limit: 3600 },
  intro: { start: 1, commands: [['wait', 15000]], limit: 15000 },
  newgame: {
    start: 1,
    commands: [
      ['wait', 600],
      ['press', 'start', 60],
      ['wait', 200],
      ['press', 'start', 80],
      ['wait', 9000],
    ],
    limit: 10000,
  },
  morgue: { start: 3000, commands: [...MORGUE_DOOR_PLAN, ...MORGUE_EXIT_PLAN], limit: 9000 },
  street: {
    start: 3000,
    commands: [...MORGUE_DOOR_PLAN, ...MORGUE_EXIT_PLAN, ...STREET_PLAN, ...SOUTHWEST_PLAN],
    limit: 12000,
  },
  alley: {
    start: 3000,
    commands: [
      ...MORGUE_DOOR_PLAN,
      ...MORGUE_EXIT_PLAN,
      ...STREET_PLAN,
      ...SOUTHWEST_PLAN,
      ...ALLEY_PLAN,
      ...ALLEY_FIGHT_PLAN,
      ...DOG_DIALOG_PLAN,
    ],
    limit: 20000,
  },
  apartment: {
    start: 3000,
    commands: [...APARTMENT_PLAN, ...BED_PLAN, ...SHADES_PLAN, ...DESK_PHONE_PLAN],
    limit: 20000,
    sram: 'tools/mesen/saves/apartment.srm',
  },
  select: { start: 3000, commands: SELECT_PLAN, limit: 11500 },
  items: { start: 3000, commands: ITEMS_PLAN, limit: 11500 },
  bed: { start: 3000, commands: BED_SAVE_KARMA_PLAN, limit: 12900 },
  karma: { start: 3000, commands: KARMA_PLAN, limit: 14000 },
  status: { start: 3000, commands: STATUS_PLAN, limit: 14000 },
  badge: {
    start: 1,
    commands: BADGE_OFFER_PLAN,
    limit: 11400,
    sram: 'tools/mesen/saves/apartment.srm',
  },
  ...tours,
  ...requests,
  ...scriptTours,
  ...playTours,
};

if (
  import.meta.url === new URL(process.argv[1], 'file:').href ||
  process.argv[1]?.endsWith('rom-code-coverage.mjs')
) {
  const { exe, reason } = findMesen();
  if (!exe) {
    console.log(`Mesen missing: ${reason}`);
    process.exit(1);
  }
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  const merged = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, 'utf8'))
    : { format: 1, scenarios: {}, starts: {} };
  merged.reads ??= {};
  merged.script_tour_reads ??= {};
  // Saved after every scenario, so that a later timeout keeps the finished ones.
  const save = () => {
    merged.starts = Object.fromEntries(Object.entries(merged.starts).sort());
    for (const key of ['reads', 'script_tour_reads'])
      merged[key] = Object.fromEntries(Object.entries(merged[key]).sort());
    writeFileSync(OUT, JSON.stringify(merged) + '\n');
  };
  for (const name of names) {
    const s = SCENARIOS[name];
    if (!s) throw Error(`Unknown scenario ${name}`);
    const started = Date.now();
    let fresh = 0,
      total = 0,
      end = null,
      freshReads = 0;
    const found = [],
      segments = new Map();
    await explore(exe, s.commands, {
      start: s.start,
      limit: s.limit,
      cover: true,
      timeoutMs: (s.timeoutMs ?? 120000) * TIME_FACTOR,
      sram: s.sram ? readFileSync(s.sram) : null,
      onLine: (line) => {
        if (line.startsWith('END ')) end = +line.slice(4);
        if (line.startsWith('XR ')) {
          const [, offset, pc] = line.toUpperCase().split(' '),
            reads = s.foreign ? merged.script_tour_reads : merged.reads;
          if (!(offset in reads)) {
            reads[offset] = `${pc.slice(0, 2)}:${pc.slice(2)}`;
            freshReads++;
          }
        }
        if (line.startsWith('XT ')) {
          const [, entry, offset, ps, e] = line.split(' ');
          segments.set(entry, [
            ...(segments.get(entry) ?? []),
            [offset.toUpperCase(), `${ps} ${e}`],
          ]);
        }
        if (!line.startsWith('XC ')) return;
        const [, offset, ps, e] = line.split(' '),
          key = offset.toUpperCase(),
          state = `${ps} ${e}`;
        total++;
        if (!(merged.starts[key] ?? []).includes(state)) found.push([key, state]);
      },
    });
    const fits = s.guard ? romGuard() : null;
    // Tour entries are judged one by one: an entry with one start off the trace is dropped whole.
    const dropped = new Set(),
      droppedEntries = [];
    if (fits)
      for (const [entry, starts] of segments)
        if (!starts.every(([k, st]) => fits(k, st))) {
          droppedEntries.push(entry);
          for (const [k] of starts) dropped.add(k);
        }
    if (droppedEntries.length) {
      console.log(
        `${name}: ${droppedEntries.length} of ${segments.size} entries dropped (starts off the trace): ${droppedEntries.join(' ')}`,
      );
      found.splice(0, found.length, ...found.filter(([key]) => !dropped.has(key)));
    }
    const outside = fits ? found.filter(([key, st]) => !fits(key, st)) : [];
    if (outside.length) {
      console.log(
        `${name}: ${outside.length} new starts off the trace, nothing merged: ${outside
          .slice(0, 20)
          .map(([k, st]) => `${k} ${st}`)
          .join(', ')}`,
      );
      continue;
    }
    for (const [key, state] of found) {
      const known = merged.starts[key] ?? [];
      if (!known.includes(state)) {
        merged.starts[key] = [...known, state].sort();
        fresh++;
      }
    }
    merged.scenarios[name] = { frames: end, instruction_starts: total };
    console.log(
      `${name}: ${total} instruction starts, ${fresh} new, ${freshReads} new reads, frame ${end}, ${Math.round((Date.now() - started) / 1000)} s`,
    );
    save();
  }
  console.log(
    `${Object.keys(merged.starts).length} instruction starts and ${Object.keys(merged.reads).length} reads (${Object.keys(merged.script_tour_reads).length} in script tours) in total`,
  );
}
