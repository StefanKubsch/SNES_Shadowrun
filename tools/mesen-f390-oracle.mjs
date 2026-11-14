// M2: oracle comparison against a real game run in Mesen2.
// At every $F390 Mesen records the registers and all WRAM writes
// (tools/mesen/trace-f390.lua). The VM starts from every recorded state,
// executes exactly one opcode with its permitted natives and must hit the next
// recorded state: registers, flags and every WRAM byte written by either side.
// Intervals with an NMI/IRQ are skipped and counted.
import { readFileSync } from 'node:fs';
import { LIFTED_SCRIPT_NATIVES, inLiftedScratch } from './lifted-script-natives.mjs';
import { availableParallelism } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { VmMemory, VmFault, WRAM_SIZE, SRAM_SIZE } from '../src/vm/memory.mjs';
import { ORACLE_NATIVES } from '../proof/vm/oracle-natives.mjs';
import { ScriptInterpreter, EXIT_BUDGET } from '../src/vm/interpreter.mjs';
import { TaskScheduler, STOP_BUDGET, STOP_NATIVE, STOP_FRONTIER } from '../src/vm/scheduler.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import { runMainLoop, MAIN_LOOP_RESUME, MAIN_LOOP_ROUND } from '../src/vm/main-loop.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { SPECIAL_NATIVES } from '../src/vm/special-natives.mjs';
import { isArithmeticRegister } from '../src/vm/devices.mjs';
import { observationSet } from '../proof/vm/observed-devices.mjs';
import { findMesen, prepareScript, runMesen } from './mesen.mjs';

const ROM_PATH = new URL('../Shadowrun (E).smc', import.meta.url);
const ROM = new Uint8Array(readFileSync(ROM_PATH));
// Scheduler rounds: JSR site -> entry (the return lies at JSR site + 3).
const ROUND_CALLS = new Map([
  [0x96c0, 0xc1e3],
  [0x91d4, 0xc1ca],
  [0xe545, 0xc1ca],
  [0xe78e, 0xc1ca],
]);
const EXIT_NAMES = ['continue', 'end', 'status-return', 'native-call', 'script-call', 'budget'];

// Default window: first room after the intro, input A+Start every 120 frames for 6 frames.
// Optionally from walkFrom the D-pad (right, down, pause, left, up, pause, walkStep frames each)
// or from planFrom a command sequence (see tools/mesen/trace-f390.lua).
export const DEFAULT_TRACE = Object.freeze({
  startFrame: 2400,
  endFrame: 2700,
  inputPeriod: 120,
  inputHold: 6,
  walkFrom: 0,
  walkStep: 40,
});

// Morgue: walk to the partition wall, open the wooden door with the action glove (B, glove,
// B, "Open", B). The mortician flees (native $8371).
export const MORGUE_DOOR_PLAN = Object.freeze([
  ['hold', 'left', 170],
  ['hold', 'up', 90],
  ['press', 'b'],
  ['glove', 123, 100],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
]);

// On out of the morgue (walkthrough): scalpel from the trolley, open both refrigerators,
// slap patch from the second, through the office to the exit door (object $50), open, out into the corridor.
export const MORGUE_EXIT_PLAN = Object.freeze([
  ...MORGUE_DOOR_PLAN,
  ['wait', 150],
  ['hold', 'down', 170],
  ['hold', 'left', 30],
  ['press', 'b'],
  ['glove', 56, 156],
  ['wait', 6],
  ['press', 'b', 40],
  ['press', 'down', 15],
  ['press', 'down', 15],
  ['press', 'b', 60],
  ['hold', 'up', 60],
  ['hold', 'left', 60],
  ['press', 'b'],
  ['glove', 38, 128],
  ['wait', 6],
  ['press', 'b', 40],
  ['press', 'down', 15],
  ['press', 'b', 60],
  ['wait', 30],
  ['hold', 'up+right', 15],
  ['press', 'b'],
  ['glove', 53, 117],
  ['wait', 10],
  ['press', 'b', 40],
  ['press', 'down', 15],
  ['press', 'b', 60],
  ['wait', 30],
  ['press', 'b'],
  ['glove', 57, 122],
  ['wait', 10],
  ['press', 'b', 40],
  ['press', 'down', 15],
  ['press', 'down', 15],
  ['press', 'b', 60],
  ['wait', 60],
  ['hold', 'up+right', 60],
  ['hold', 'left+up', 40],
  ['hold', 'left', 150],
  ['press', 'b'],
  ['glove', 47, 140],
  ['wait', 10],
  ['press', 'b', 40],
  ['press', 'down', 15],
  ['press', 'b', 60],
  ['hold', 'down', 120],
]);

// Corridor to the right to its end, then out onto the street (the red-haired punk waits on the right).
export const STREET_PLAN = Object.freeze([
  ...MORGUE_EXIT_PLAN,
  ['hold', 'right', 400],
  ['hold', 'down', 150],
]);

// End the punk dialog with B (Exit), follow the punk along the front pavement (down), at the
// corner up left: scene change into the south-west area (about frame 7320).
export const SOUTHWEST_PLAN = Object.freeze([
  ...STREET_PLAN,
  ['wait', 400],
  ['press', 'b', 30],
  ['hold', 'down', 700],
  ['hold', 'up+left', 700],
]);

// From the south-west down left into the alley: scene change, the orc assassin speaks and shoots (about frame 7720).
export const ALLEY_PLAN = Object.freeze([...SOUTHWEST_PLAN, ['hold', 'down+left', 700]]);

// The fight in the alley to its end: walk to the Beretta beside the dead man (object $4C), pick it up with R, in the status menu
// Weapon, Beretta Pistol, Use; A for the crosshair, then aim at the orc as it moves (object $52, position
// $0ED2/$0E7A divided by 4 plus an offset for the fixed camera of this run) and fire until he falls ($855E).
const AIM_ORC = ['aim', 0x52, 0xed2, 0xe7a, -175, -260];
export const ALLEY_FIGHT_PLAN = Object.freeze([
  ...ALLEY_PLAN,
  ['hold', 'down', 40],
  ['hold', 'down+left', 40],
  ['hold', 'left', 30],
  ['hold', 'down', 20],
  ['hold', 'right', 24],
  ['press', 'b'],
  ['glove', 150, 132],
  ['wait', 8],
  ['press', 'r', 40],
  ['press', 'start', 80],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'b', 40],
  ['press', 'b', 60],
  ['press', 'a', 20],
  ...Array.from({ length: 50 }, () => [AIM_ORC, ['press', 'a', 16]]).flat(),
]);

// After the fight: leave the crosshair with B, walk to the dog (object $54, script $2C7); close to it
// dialog 0 starts (frame 10451). Ask about with the only topic $17: the record has no entry for it, the
// fallback FFFD carries the topic action (script $396, growl through $C46E): $9178 appends the task ($C34A) and
// visits it at once ($C1CA, frame 10752). Then B on Exit.
export const DOG_DIALOG_PLAN = Object.freeze([
  ...ALLEY_FIGHT_PLAN,
  ['wait', 120],
  ['press', 'b', 20],
  ['hold', 'up+right', 28],
  ['hold', 'up+left', 300],
  ['wait', 270],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'b', 260],
  ['press', 'b', 60],
]);

// Group overview after the dog dialog: Select ($E014 -> $ED3C, native interval frames 11141-11362), B closes.
// The glyph output $FB39 needs the eight mask words that the NMI reads from VRAM to $01FC (oracle test
// "Select overview"). Call: node tools/mesen-f390-oracle.mjs 11000 11500 select
export const SELECT_PLAN = Object.freeze([
  ...DOG_DIALOG_PLAN,
  ['wait', 80],
  ['press', 'select', 20],
  ['wait', 200],
  ['press', 'b', 20],
  ['wait', 100],
]);

// Item list after the dog dialog: Y ($E014 -> JSR $EA8E at $E037, native interval frames 11141-11379), B closes.
// Call: node tools/mesen-f390-oracle.mjs 11000 11500 items
export const ITEMS_PLAN = Object.freeze([
  ...DOG_DIALOG_PLAN,
  ['wait', 80],
  ['press', 'y', 20],
  ['wait', 200],
  ['press', 'b', 20],
  ['wait', 100],
]);

// Route to Jake's apartment (Tenth Street, apartment 6) from the street map, without alley and fight; coordinates of the
// player figure (object $0CC2, x $0E80+id, y $0E28+id) and photos from tools/mesen-explore.mjs. End the punk dialog with B,
// right along the street, around the park into the scene with the archway house (frame 7507), through the archway into the corridor (8370).
const KEY_ROUTE = [
  ['wait', 400],
  ['press', 'b', 30],
  ['hold', 'right', 570],
  ['hold', 'down+left', 20],
  ['hold', 'down+right', 150],
  ['hold', 'up+right', 60],
  ['hold', 'down', 400],
  ['hold', 'down+right', 400],
  ['hold', 'up', 500],
  ['hold', 'right', 20],
  ['hold', 'up+right', 15],
  ['hold', 'up', 150],
  ['wait', 30],
  // Open the left door in the corridor (office, frame 8802), examine the corpse ("There's a key in his pocket", script $343) and
  // pick up the key beside it with R; back into the corridor and out (frame 9786).
  ['hold', 'up+left', 120],
  ['press', 'b'],
  ['glove', 62, 100],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['hold', 'up+left', 100],
  ['wait', 40],
  ['press', 'b'],
  ['glove', 122, 143],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'b', 80],
  ['press', 'b', 80],
  ['press', 'b'],
  ['glove', 126, 151],
  ['wait', 8],
  ['press', 'r', 40],
  ['hold', 'down+right', 30],
  ['wait', 30],
  ['hold', 'down+right', 300],
  ['hold', 'down', 120],
];
// To the monorail station, into the alley at the top between the archway house and the station (frame 10300), along the passage by
// the railway grounds to the apartment house and through its archway (frame 10805; a pillar on the facade is walked around).
const HOME_ROUTE = [
  ['hold', 'up+right', 350],
  ['hold', 'up', 60],
  ['hold', 'left', 40],
  ['hold', 'up+right', 120],
  ['hold', 'up+left', 250],
  ['hold', 'down+left', 60],
  ['hold', 'down+right', 20],
  ['hold', 'down+left', 40],
  ['hold', 'up+left', 150],
  ['wait', 20],
  // In the corridor in front of apartment 6 (third door on the right), one step back, or the swinging door hits Jake ($8371,
  // sound $20) and closes again. Items, Door Key, Use, the glove exactly on the door: it opens by itself.
  ['hold', 'up+left', 120],
  ['hold', 'up+right', 30],
  ['hold', 'up+left', 36],
  ['hold', 'up+right', 10],
  ['wait', 20],
  ['hold', 'down+right', 12],
  ['press', 'start', 80],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 60],
  ['glove', 121, 100],
  ['wait', 8],
  ['press', 'b', 60],
  ['wait', 30],
  // Inside (frame 11641).
  ['hold', 'up+right', 100],
  ['wait', 40],
];
export const APARTMENT_PLAN = Object.freeze([...STREET_PLAN, ...KEY_ROUTE, ...HOME_ROUTE]);
// To the bed and Use: script $1D4 sleeps, $D079 refills the ammunition, $CE6D shows the menu (frame 12087).
export const BED_PLAN = Object.freeze([
  ...APARTMENT_PLAN,
  ['hold', 'down', 30],
  ['press', 'b'],
  ['glove', 122, 155],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
]);

// In the menu of the bed ($CE6D): Save game, Save game 1 (SRAM through $81:B17D), then Use karma (karma 0), back and Exit.
// Call: node tools/mesen-f390-oracle.mjs 12000 12700 bed
export const BED_SAVE_KARMA_PLAN = Object.freeze([
  ...BED_PLAN,
  ['wait', 200],
  ['press', 'down', 20],
  ['press', 'b', 60],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['wait', 60],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'b', 80],
  ['press', 'b', 80],
  ['wait', 100],
]);

// In the apartment: to the night table, the glove on the shades (object $50), pick them up with R (A835, script $099, D16D), Y for
// the item list, Shades, Use ("I'll just put these on..."), B closes the text.
// Call: node tools/mesen-f390-oracle.mjs 11800 12600 shades
export const SHADES_PLAN = Object.freeze([
  ...APARTMENT_PLAN,
  ['hold', 'right', 40],
  ['hold', 'down', 20],
  ['press', 'b'],
  ['glove', 149, 142],
  ['wait', 8],
  ['press', 'r', 60],
  ['wait', 60],
  ['press', 'y', 20],
  ['wait', 150],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 140],
  ['wait', 80],
]);

// On in the apartment (walkthrough): to the desk, file cabinet (object $4E) Open and Examine ("Twenty nuyen", $CCDB),
// torn note on the desk ($4C) Examine ("Sassie 702-826.", phone number through $E1B3), to the video phone ($52)
// and Examine: Drake's recorded message.
// Call: node tools/mesen-f390-oracle.mjs 12600 13900 desk
export const DESK_PHONE_PLAN = Object.freeze([
  ...SHADES_PLAN,
  ['wait', 100],
  ['hold', 'up', 40],
  ['hold', 'right', 15],
  ['press', 'b'],
  ['glove', 192, 112],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'b'],
  ['glove', 192, 112],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 80],
  ['press', 'b'],
  ['glove', 175, 100],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 100],
  ['hold', 'left', 25],
  ['hold', 'up', 15],
  ['press', 'b'],
  ['glove', 135, 95],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 300],
]);

// Saved games for long routes (tools/mesen/saves/, recreate with node tools/mesen-save.mjs <name>). A window with
// save starts Mesen with this SRAM; LOAD_SLOT1 picks "Start saved game" and "Resume game 1" in the title menu.
// apartment: after DESK_PHONE_PLAN to the bed, Use, Save game in slot 1 (shades on, 20 nuyen, no weapon).
export const LOAD_SLOT1 = Object.freeze([
  ['wait', 600],
  ['press', 'start', 60],
  ['wait', 200],
  ['press', 'down', 20],
  ['press', 'start', 80],
  ['press', 'b', 120],
]);
export const SAVES = Object.freeze({
  apartment: Object.freeze({
    file: 'apartment.srm',
    sha256: 'e8ff7e35b0ecb295fd5d8bbed973cffbec0cde5001e3cb9ccc540a1f42d3f3e1',
    plan: Object.freeze([
      ...DESK_PHONE_PLAN,
      ['hold', 'down', 50],
      ['press', 'b'],
      ['glove', 122, 155],
      ['wait', 8],
      ['press', 'b', 40],
      ['press', 'down', 20],
      ['press', 'b', 80],
      ['wait', 200],
      ['press', 'down', 20],
      ['press', 'b', 60],
      ['press', 'down', 20],
      ['press', 'b', 120],
      ['wait', 60],
    ]),
  }),
});
// SRAM of a saved game; the checksum binds the file to its plan.
export function loadSave(name) {
  const save = SAVES[name];
  if (!save) throw Error(`Unknown saved game: ${name}`);
  const bytes = readFileSync(new URL(`./mesen/saves/${save.file}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== SRAM_SIZE || sha256 !== save.sha256)
    throw Error(`Saved game ${name} does not match the checksum (${sha256})`);
  return bytes;
}

// From the saved game apartment to the business man (walkthrough lines 1300-1440). Player figure: slot $0CC2, x $0E28+slot,
// y $0E80+slot (divided by 4; explored with "track" in tools/mesen-explore.mjs). Out of the apartment, down the corridor, along
// the railway grounds to the monorail station, past the park to the archway house, onto the square before the morgue (frame 3740),
// around the fountain park to the south-west exit (frame 4570) and the street north-west up to the Grim Reaper Club.
const CLUB_ROUTE = [
  ['hold', 'up', 30],
  ['hold', 'left', 40],
  ['hold', 'down+left', 60],
  ['wait', 40],
  ['hold', 'down+right', 300],
  ['hold', 'right', 60],
  ['wait', 80],
  ['hold', 'down+right', 150],
  ['hold', 'up+right', 40],
  ['hold', 'up+left', 20],
  ['hold', 'up+right', 60],
  ['hold', 'down+right', 250],
  ['wait', 200],
  ['hold', 'right', 40],
  ['hold', 'down', 60],
  ['hold', 'down+left', 300],
  ['hold', 'up', 120],
  ['hold', 'up+left', 100],
  ['hold', 'up+right', 150],
  ['hold', 'down', 200],
  ['hold', 'down+left', 80],
  ['hold', 'up+left', 200],
  ['wait', 30],
  ['hold', 'down+left', 210],
  ['hold', 'up+left', 270],
  ['hold', 'down+left', 150],
  ['hold', 'up+left', 250],
  ['wait', 60],
  ['hold', 'up+left', 40],
  ['hold', 'down+left', 120],
  ['hold', 'up+left', 60],
  ['hold', 'up+left', 400],
  ['hold', 'up+right', 90],
  ['hold', 'up+left', 60],
  ['wait', 60],
];
// In the club: bartender ($54) Talk, after a while he puts the iced tea ($48) on the counter, R picks it up; to the guest at
// the left table ($4E), Y, Iced Tea, Give on him. Talk ("tickets"), Ask about Tickets, Ask about Grinder: keyword Lone Star.
const LONE_STAR_ROUTE = [
  ['hold', 'up+left', 30],
  ['press', 'b'],
  ['glove', 190, 92],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 200],
  ['press', 'b', 60],
  ['wait', 900],
  ['hold', 'up+right', 20],
  ['hold', 'up+left', 10],
  ['press', 'b'],
  ['glove', 171, 114],
  ['wait', 8],
  ['press', 'r', 80],
  ['hold', 'down+left', 50],
  ['hold', 'left', 80],
  ['press', 'y', 20],
  ['wait', 150],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['glove', 91, 107],
  ['wait', 8],
  ['press', 'b', 200],
  ['press', 'b'],
  ['glove', 91, 107],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 250],
  ['press', 'down', 20],
  ['press', 'b', 250],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 60],
  ['press', 'down', 20],
  ['press', 'b', 300],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 60],
  ['press', 'b', 300],
  ['press', 'b', 60],
];
// Out through the open club door (down right from the entry point), back along the street to the entrance at x 407, in the
// corridor past the little bench to the second door ($50, R opens), in to the Business Man ($54): Talk, Ask about Lone Star starts script
// $04D (frame 10930): offer through $933A, yes/no $CD43, Yes, money check 150 through $CD20 (frame 11177) fails with 20 nuyen
// ("You ain't got enough cash, chum!").
// Call: node tools/mesen-f390-oracle.mjs 10900 11300 badge
export const BADGE_OFFER_PLAN = Object.freeze([
  ...LOAD_SLOT1,
  ['wait', 60],
  ...CLUB_ROUTE,
  ...LONE_STAR_ROUTE,
  ['hold', 'right', 69],
  ['hold', 'down+right', 105],
  ['wait', 60],
  ['hold', 'down+left', 80],
  ['hold', 'down+right', 228],
  ['hold', 'up+right', 80],
  ['wait', 100],
  ['hold', 'down+right', 20],
  ['hold', 'up+right', 250],
  ['hold', 'down+left', 45],
  ['hold', 'up+left', 10],
  ['press', 'b'],
  ['glove', 120, 100],
  ['wait', 8],
  ['press', 'r', 20],
  ['hold', 'up', 100],
  ['wait', 80],
  ['press', 'b'],
  ['glove', 140, 106],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 200],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 250],
  ['press', 'b', 120],
  ['press', 'b', 120],
]);

// Oracle windows of the tests (tools/mesen-oracle.test.mjs) and of the coverage measurement (tools/mesen-coverage.mjs).
// From 2650 the figure walks with pauses: $E014/$DEC7 with stop, start and walking.
const ROOM_TRACE = {
  startFrame: 2640,
  endFrame: 2760,
  inputPeriod: 120,
  inputHold: 6,
  walkFrom: 2650,
  walkStep: 15,
};
const INPUT = { inputPeriod: 120, inputHold: 6 };
export const ORACLE_WINDOWS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      room: ROOM_TRACE,
      // Open the morgue door with the action glove: the mortician flees ($8371 collision).
      door: { ...INPUT, startFrame: 3330, endFrame: 3400, planFrom: 3000, plan: MORGUE_DOOR_PLAN },
      // Through the exit door into the corridor: scene change $DE7E.
      exit: { ...INPUT, startFrame: 5000, endFrame: 5400, planFrom: 3000, plan: MORGUE_EXIT_PLAN },
      // Onto the street: scene set-up with $C716, whose equation Mesen exposed as wrong ($0CD2 instead of $0CC2).
      street: { ...INPUT, startFrame: 5700, endFrame: 5760, planFrom: 3000, plan: STREET_PLAN },
      // South-west area: target choice $8BC5 with random $C51F and line of sight $81A25F.
      southwest: {
        ...INPUT,
        startFrame: 7300,
        endFrame: 7700,
        planFrom: 3000,
        plan: SOUTHWEST_PLAN,
      },
      // Alley: the orc assassin shoots ($8AB5) shortly after the scene change.
      alley: { ...INPUT, startFrame: 7650, endFrame: 7800, planFrom: 3000, plan: ALLEY_PLAN },
      // End of the fight: Jake shoots the orc with the Beretta, $855E takes him out of the fight list (frame 9755).
      fight: { ...INPUT, startFrame: 9730, endFrame: 9790, planFrom: 3000, plan: ALLEY_FIGHT_PLAN },
      // Punk dialog: $936C from frame 5904 to 6160 (greeting, menu, Exit with B, scene rebuilt).
      dialog: { ...INPUT, startFrame: 5900, endFrame: 6165, planFrom: 3000, plan: SOUTHWEST_PLAN },
      // Dog in the alley: dialog 0 (frame 10451) with the topic action through the nested round (frames 10749-10754).
      dog: { ...INPUT, startFrame: 10446, endFrame: 11030, planFrom: 3000, plan: DOG_DIALOG_PLAN },
      // Status screen: Start in $E014 ($EA89, frame 8497), Weapon, Beretta Pistol, Use: $E4F3 creates the object through
      // $A835 and visits its task as a nested round ($E545, frame 8739).
      status: {
        ...INPUT,
        startFrame: 8480,
        endFrame: 9100,
        planFrom: 3000,
        plan: ALLEY_FIGHT_PLAN,
      },
      // Select after the dog dialog: group overview $ED3C from $E014 (native from frame 11141 to 11362). The glyph output
      // $FB39 waits through $AEFC for $01FC; meanwhile the NMI reads 16 VRAM bytes by DMA to $7E2AE0.
      select: { ...INPUT, startFrame: 11130, endFrame: 11380, planFrom: 3000, plan: SELECT_PLAN },
      // Y after the dog dialog: item list through JSR $EA8E at $E037 (native from frame 11141 to 11379).
      items: { ...INPUT, startFrame: 11130, endFrame: 11400, planFrom: 3000, plan: ITEMS_PLAN },
      // Jake's bed in apartment 6: script $1D4, ammunition $D079, menu $CE6D with saving (SRAM) and karma (from frame 12087).
      bed: {
        ...INPUT,
        startFrame: 12060,
        endFrame: 12800,
        planFrom: 3000,
        plan: BED_SAVE_KARMA_PLAN,
      },
      // Apartment 6: pick up the shades with R ($A835, $D16D) and use them through Y (script in the nested round at $E545).
      shades: { ...INPUT, startFrame: 11850, endFrame: 12560, planFrom: 3000, plan: SHADES_PLAN },
      // File cabinet (20 nuyen through $CCDB), torn note ($E1B3) and Drake's message at the video phone.
      desk: { ...INPUT, startFrame: 12600, endFrame: 13900, planFrom: 3000, plan: DESK_PHONE_PLAN },
      // The business man's offer from the saved game apartment: script $04D with $933A, yes/no $CD43 and money check $CD20
      // (frames 10930-11177, 20 nuyen are not enough for the Lone Star badge).
      badge: {
        ...INPUT,
        startFrame: 10900,
        endFrame: 11300,
        planFrom: 1,
        save: 'apartment',
        plan: BADGE_OFFER_PLAN,
      },
      // Short windows for natives that run on these routes but in no window above (coverage measurement,
      // tools/mesen-coverage.mjs): morgue $9D6A, refrigerator with modal $CBF7 and $9DEC, before the punk $D1D2,
      // south-west with random $C51F directly and $CAA2, archway scene $D134, alley at the monorail station $CCB9/$CCCC,
      // after the dog $9159, key on the door with $FF79 and target choice $9BC6. Into bed ($1D4, frame 11886): $CD9D
      // switches the glove off before $1D4 waits 200 frames (the window bed starts only after that).
      morgue: {
        ...INPUT,
        startFrame: 3885,
        endFrame: 3905,
        planFrom: 3000,
        plan: MORGUE_EXIT_PLAN,
      },
      fridge: {
        ...INPUT,
        startFrame: 4540,
        endFrame: 4560,
        planFrom: 3000,
        plan: MORGUE_EXIT_PLAN,
      },
      punk: { ...INPUT, startFrame: 5870, endFrame: 5890, planFrom: 3000, plan: SOUTHWEST_PLAN },
      random: { ...INPUT, startFrame: 7255, endFrame: 7275, planFrom: 3000, plan: SOUTHWEST_PLAN },
      arch: { ...INPUT, startFrame: 7498, endFrame: 7515, planFrom: 3000, plan: BED_PLAN },
      rail: { ...INPUT, startFrame: 10292, endFrame: 10310, planFrom: 3000, plan: BED_PLAN },
      afterdog: {
        ...INPUT,
        startFrame: 11050,
        endFrame: 11065,
        planFrom: 3000,
        plan: DOG_DIALOG_PLAN,
      },
      doorkey: { ...INPUT, startFrame: 11440, endFrame: 11620, planFrom: 3000, plan: BED_PLAN },
      sleep: { ...INPUT, startFrame: 11860, endFrame: 11900, planFrom: 3000, plan: BED_PLAN },
      // Start from the saved game apartment: title menu, Resume game 1, scene set-up $DE7E (frame 1134), a few steps.
      loaded: {
        ...INPUT,
        startFrame: 1100,
        endFrame: 1300,
        planFrom: 1,
        save: 'apartment',
        plan: [...LOAD_SLOT1, ['hold', 'right', 40], ['hold', 'down', 20]],
      },
    }).map(([name, trace]) => [name, Object.freeze({ name, ...trace })]),
  ),
);

const luaValue = (value) =>
  Array.isArray(value)
    ? `{${value.map(luaValue).join(', ')}}`
    : typeof value === 'string'
      ? JSON.stringify(value)
      : String(value);

const hexBytes = (hex) => Uint8Array.from(Buffer.from(hex, 'hex'));
const SECTIONS = new Set(['r', 'w', 'q']);
const section = (tokens, marker) => {
  const at = tokens.indexOf(marker);
  if (at < 0) return [];
  const out = [];
  for (const t of tokens.slice(at + 1)) {
    if (SECTIONS.has(t)) break;
    out.push(t);
  }
  return out;
};
// "w <off>=<v>" in order, "!" = in the NMI handler, "S" = SRAM -> [offset, value, nmi]; SRAM offsets lie behind
// the WRAM (SRAM_BASE + offset).
const SRAM_BASE = WRAM_SIZE;
// Free stack bytes: below the stack pointer (S points at the next free byte) in the
// main stack 7E:0100-01C9 or the NMI stack 7E:1C7C-1CBB. Register-level routines
// leave their pushes there, lifted code does not (docs/MATRIX-LIFT.md, "not
// produced"); no code reads them before it pushes again.
const STACKS = [
  [0x0100, 0x01ca],
  [0x1c7c, 0x1cbc],
];
// The scheduler's S while a task runs (src/vm/layout.mjs OUTER_STACK), the flags a lifted
// native does not produce (carry, overflow); its direct page scratch is in
// tools/lifted-script-natives.mjs.
const OUTER_STACK_WORD = 0x01f2,
  LIFTED_NATIVE_FLAGS = 0x41;
// The NMI stack holds only the handler's saved registers and return frames, which no
// game code reads: it is free as a whole (game state only, docs/STRATEGY.md 2026-11-14).
const [, NMI_STACK] = STACKS;
export const freeStack = (a, s) =>
  (a >= NMI_STACK[0] && a < NMI_STACK[1]) ||
  STACKS.some(([from, to]) => s >= from && s < to && a >= from && a <= s);
function parseWrites(tokens) {
  return section(tokens, 'w').map((t) => {
    const nmi = t[0] === '!',
      sram = t[0] === 'S',
      [a, v] = (nmi || sram ? t.slice(1) : t).split('=');
    return [(sram ? SRAM_BASE : 0) + parseInt(a, 16), parseInt(v, 16), nmi];
  });
}
// "r <adr>=<v>@<pc>"; pc is Mesen's PC after the operands.
function parseReads(tokens, marker = 'r') {
  return section(tokens, marker).map((t) => {
    const [a, rest] = t.split('='),
      [v, pc] = rest.split('@');
    return { address: parseInt(a, 16), value: parseInt(v, 16), pcAfter: parseInt(pc, 16) };
  });
}

// Checks the sequence number of a recorder line and returns the line without it (null = not a recorder line).
export function sequencedLine(line, expected) {
  if (!/^[WMSRCED]( |$)/.test(line)) return null;
  const match = / #(\d+)$/.exec(line);
  if (!match || Number(match[1]) !== expected)
    throw Error(`Mesen output damaged at line ${expected}: ${line.slice(0, 60)}`);
  return line.slice(0, match.index);
}
// Mesen run -> {initial, steps, tail, final}. Every recorder line carries a sequence number, the
// final line N their count: lost, duplicate or torn lines are an error. Lines after N
// do not count (emu.stop does not halt at once; under load further frames ran afterwards and spoiled the
// self-check).
// Mesen's default 100-second limit is overridden by runMesen with the same budget
// as our process watchdog. Exit code -1 is ambiguous (timeout, ROM load or script
// stop), so it must not be treated as proof of contention and retried blindly.
// User target: eight recordings, bounded by half the available threads.
// Time waiting in the queue does not count; Mesen starts only when it gets its place.
const RECORDER_SLOTS = Math.max(1, Math.min(8, availableParallelism() >> 1)),
  waiting = [];
let recording = 0;
async function recorderSlot() {
  if (recording >= RECORDER_SLOTS) await new Promise((resolve) => waiting.push(resolve));
  else recording++;
}
function releaseSlot() {
  const next = waiting.shift();
  if (next) next();
  else recording--;
}
export async function recordTrace(exe, trace = DEFAULT_TRACE) {
  await recorderSlot();
  try {
    return await recordTraceOnce(exe, trace);
  } catch (error) {
    error.message = `Mesen-Fenster ${trace.startFrame}–${trace.endFrame} (${trace.save ?? 'neues Spiel'}): ${error.message}`;
    throw error;
  } finally {
    releaseSlot();
  }
}
async function recordTraceOnce(exe, trace) {
  const script = prepareScript('trace-f390.lua', {
    START_FRAME: trace.startFrame,
    END_FRAME: trace.endFrame,
    INPUT_PERIOD: trace.inputPeriod,
    INPUT_HOLD: trace.inputHold,
    WALK_FROM: trace.walkFrom ?? 0,
    WALK_STEP: trace.walkStep ?? 40,
    PLAN_FROM: trace.planFrom ?? 0,
    PLAN: luaValue(trace.plan ?? []),
    WAIT_LOOPS: luaValue(WAIT_LOOPS),
  });
  let initial = null,
    sram = null,
    final = null,
    tail = null,
    received = 0,
    announced = null,
    damage = null;
  const steps = [];
  const { code, stderr, elapsedMs } = await runMesen(
    exe,
    fileURLToPath(ROM_PATH).replaceAll('\\', '/'),
    script,
    (raw) => {
      // After the final line N nothing counts any more (Mesen may still execute frames until it halts).
      if (damage || announced !== null) return;
      if (raw.startsWith('N ')) {
        announced = Number(raw.slice(2));
        return;
      }
      let line;
      try {
        line = sequencedLine(raw, received + 1);
      } catch (error) {
        damage = error;
        return;
      }
      if (line === null) return;
      received++;
      const kind = line[0];
      if (kind === 'W') initial = hexBytes(line.slice(2));
      else if (kind === 'M') sram = hexBytes(line.slice(2));
      else if (kind === 'D') final = hexBytes(line.slice(2));
      else if (kind === 'S' || kind === 'R' || kind === 'C') {
        const t = line.split(' '),
          n = (i) => parseInt(t[i], 16);
        steps.push({
          kind,
          pc: kind !== 'S' ? parseInt(t[10].slice(1), 16) : 0xf390,
          a: n(1),
          x: n(2),
          y: n(3),
          s: n(4),
          d: n(5),
          bank: n(6),
          status: n(7),
          programBank: n(8),
          frame: +t[9],
          interrupted: t.includes('i'),
          unknown: t.includes('u'),
          reads: parseReads(t),
          writes: parseWrites(t),
          queue: section(t, 'q'),
        });
      } else if (kind === 'E') {
        const t = line.split(' ');
        tail = { unknown: t.includes('u'), writes: parseWrites(t) };
      }
    },
    {
      sram: trace.save ? loadSave(trace.save) : null,
      keep: () => !damage && announced !== null && announced === received,
    },
  );
  if (code !== 0)
    throw Object.assign(
      Error(
        `Mesen ended with ${code} after ${elapsedMs} ms; ${received} recorder lines, last frame ${steps.at(-1)?.frame ?? 'unknown'}: ${stderr.slice(0, 500)}`,
      ),
      { mesenCode: code },
    );
  if (damage) throw damage;
  if (announced !== received)
    throw Error(`Mesen output incomplete: ${announced} lines announced, ${received} received`);
  if (
    !initial ||
    !sram ||
    !final ||
    !tail ||
    initial.length !== WRAM_SIZE ||
    sram.length !== SRAM_SIZE ||
    final.length !== WRAM_SIZE
  )
    throw Error('Mesen recording incomplete');
  return { trace, initial, sram, steps, tail, final, recording: { elapsedMs, lines: received } };
}

// Memory that collects the WRAM offsets written by the VM (and SRAM as SRAM_BASE + offset).
class TouchMemory extends VmMemory {
  constructor(rom, wram, sram) {
    super(rom, wram, sram);
    this.touched = [];
  }
  write8(address, value) {
    const bank = address >>> 16,
      offset = address & 0xffff;
    if (bank === 0x7e || bank === 0x7f) this.touched.push(address - 0x7e0000);
    else if (!(bank & 0x40) && offset < 0x2000) this.touched.push(offset);
    else if ((bank & 0x7f) >= 0x70 && (bank & 0x7f) < 0x7e && offset < 0x8000)
      this.touched.push(SRAM_BASE + (offset & 0x1fff));
    super.write8(address, value);
  }
}

// LoROM byte at a program address.
const romByte = (address) => ROM[(((address >>> 16) & 0x7f) << 15) | (address & 0x7fff)];
// Instruction address of a device read: Mesen reports the PC behind the operands;
// absolute (3 bytes) or long (4 bytes), recognised by the operand in the ROM.
export function instructionPc({ address, pcAfter }) {
  for (const length of [3, 4]) {
    const pc = (pcAfter & 0xff0000) | ((pcAfter - length) & 0xffff);
    if ((romByte(pc + 1) | (romByte(pc + 2) << 8)) !== (address & 0xffff)) continue;
    if (length === 3 || romByte(pc + 3) === address >>> 16) return pc;
  }
  return -1;
}

// Wait loop in the ROM: LDA abs ($AD lo hi) directly followed by BNE to itself ($D0 $FB).
const isWaitLoop = (pc) =>
  pc >= 0 && romByte(pc) === 0xad && romByte(pc + 3) === 0xd0 && romByte(pc + 4) === 0xfb;
// All wait loops on WRAM words (LDA abs < $2000, BNE or BPL to itself) for the recorder:
// [pc, word address, 1 = exit on a negative value (BPL) / 0 = on 0 (BNE), NMI words read afterwards].
// Waiting for the job list ($1562): the NMI ($81A958) sets DP82 meanwhile, which the code reads afterwards.
// Waiting for $01FC (glyph output $FB39 through $AEFC): the NMI reads 16 VRAM bytes by DMA to $2AE0.
const TEXT_MASK_WORDS = Array.from({ length: 8 }, (_, n) => 0x2ae0 + 2 * n);
export const WAIT_LOOPS = Object.freeze(
  (() => {
    const loops = [];
    for (let o = 0; o + 4 < ROM.length; o++) {
      const operand = ROM[o + 1] | (ROM[o + 2] << 8);
      if (
        ROM[o] === 0xad &&
        (ROM[o + 3] === 0xd0 || ROM[o + 3] === 0x10) &&
        ROM[o + 4] === 0xfb &&
        operand < 0x2000
      )
        loops.push([
          ((0x80 | (o >>> 15)) << 16) | 0x8000 | (o & 0x7fff),
          operand,
          ROM[o + 3] === 0x10 ? 1 : 0,
          operand === 0x1562 ? [0x82] : operand === 0x1fc ? TEXT_MASK_WORDS : [],
        ]);
    }
    return loops;
  })(),
);
// Section "q" of the recorder -> wait and input observations in call order.
export function queueObservations(queue) {
  const wait = [],
    input = [];
  for (const token of queue) {
    if (token[0] === 'b')
      wait.push({ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value: parseInt(token.slice(1), 16) });
    else if (token[0] === 'z') {
      const [pcText, rest] = token.slice(1).split('='),
        [value, dbr] = rest.split('@').map((v) => parseInt(v, 16)),
        pc = parseInt(pcText, 16);
      wait.push({
        pc,
        address: (dbr << 16) | romByte(pc + 1) | (romByte(pc + 2) << 8),
        width: 2,
        value,
      });
    } else if (token[0] === 'n') {
      // WRAM offset; above $1FFF without the bank 0 mirror, so in bank $7E.
      const [pcText, rest] = token.slice(1).split(':'),
        [offset, value] = rest.split('=').map((v) => parseInt(v, 16));
      wait.push({
        pc: parseInt(pcText, 16),
        address: offset < 0x2000 ? offset : 0x7e0000 + offset,
        width: 2,
        value,
      });
    } else if (token[0] === 'j') {
      const [value, dbr] = token
        .slice(1)
        .split('@')
        .map((v) => parseInt(v, 16));
      input.push({ pc: 0x809e1a, address: (dbr << 16) | 0x1ca, width: 2, value });
    } else throw Error('Unknown observation ' + token);
  }
  return { wait, input };
}

// Device reads of an interval without the arithmetic unit (VmMemory models it itself). Two byte reads
// of the same instruction at consecutive addresses are one 16-bit read.
function ioObservations(reads) {
  const bytes = reads.filter((r) => !isArithmeticRegister(r.address, false)),
    io = [];
  for (let i = 0; i < bytes.length; i++) {
    const low = bytes[i],
      high = bytes[i + 1];
    if (high && high.pcAfter === low.pcAfter && high.address === low.address + 1) {
      io.push({
        pc: instructionPc(low),
        address: low.address,
        width: 2,
        value: low.value | (high.value << 8),
      });
      i++;
    } else io.push({ pc: instructionPc(low), address: low.address, width: 1, value: low.value });
  }
  return io;
}

// Device reads and wait loops of an interval as the observation set for the one
// special native in it. The arithmetic unit is modelled by VmMemory itself; its reads are not included.
class IntervalDevices {
  constructor() {
    this.reads = [];
    this.wait = [];
    this.input = [];
    this.taken = null;
  }
  // Recorded observations (section "q") come first; addWait supplies missing zeros.
  next(reads, queue = []) {
    const q = queueObservations(queue);
    this.reads = reads;
    this.wait = q.wait;
    this.input = q.input;
    this.taken = null;
  }
  // The original leaves wait loops (LDA $01Fx / BNE to itself) only with the value 0;
  // the number of passes does not change the final state. One observation 0 per loop entry
  // is therefore enough. The module reports which loop follows (pc, address); real loops only.
  addWait(details) {
    if (!details || !isWaitLoop(details.pc) || details.width !== 2) return false;
    if (details.observationIndex !== undefined && details.observationIndex !== this.wait.length)
      return false;
    this.wait.push(Object.freeze({ pc: details.pc, address: details.address, width: 2, value: 0 }));
    return true;
  }
  peek(target) {
    if (this.taken !== null || !SPECIAL_NATIVES.has(target)) return null;
    return observationSet(target, {
      io: ioObservations(this.reads),
      wait: this.wait,
      input: this.input,
    });
  }
  take(target) {
    const set = this.peek(target);
    if (set !== null) this.taken = target;
    return set;
  }
  write() {}
}

// Native ID -> target through the pointer table $82:D7B8.
const NATIVE_TARGET = (id) => 0x800000 | ROM[0x157b8 + id * 2] | (ROM[0x157b9 + id * 2] << 8);
const hex = (v, w = 4) => '$' + v.toString(16).toUpperCase().padStart(w, '0');

// Compares all intervals; returns counters, differences and the self-check.
// If a native calls a scheduler round itself (dialog: JSR $C1CA at $91D4), the recording splits it at C and R.
// The VM still runs the native in one piece: at the round it compares with C, the intervals of the
// round run from their recorded states like all others, from R the native continues with the observations
// of the interval after R, and its end is compared with the point after it.
export function compareTrace({ initial, sram, steps, tail, final }, { maxMismatches = 20 } = {}) {
  const truth = initial.slice(),
    work = initial.slice(),
    truthSram = sram.slice();
  // SRAM writes (saving) appear as SRAM_BASE + offset in the same lists as the WRAM.
  const memory = new TouchMemory(ROM, work, sram.slice()),
    vm = new ScriptInterpreter(memory);
  const get = (wram, sramBytes) => (a) => (a < SRAM_BASE ? wram[a] : sramBytes[a - SRAM_BASE]);
  const put = (wram, sramBytes) => (a, v) => {
    if (a < SRAM_BASE) wram[a] = v;
    else sramBytes[a - SRAM_BASE] = v;
  };
  const truthAt = get(truth, truthSram),
    workAt = get(work, memory.sram),
    setTruth = put(truth, truthSram),
    setWork = put(work, memory.sram);
  const where = (a) =>
    a < SRAM_BASE ? `WRAM ${hex(0x7e0000 + a, 6)}` : `SRAM ${hex(0x700000 + a - SRAM_BASE, 6)}`;
  const nativesRun = new Map(),
    implementation = (target) => {
      pending = target;
      return nativeTarget(target);
    };
  let pending = null;
  const devices = new IntervalDevices();
  const oracle = new Map(
    [...ORACLE_NATIVES].map(([target, native]) => [
      target,
      {
        ...native,
        run: (accessor, outer) => {
          pending = target;
          return native.run(accessor, outer);
        },
      },
    ]),
  );
  // Open intervals; a native with a round keeps its own open until the round is compared.
  const active = [];
  vm.natives = new NativeCalls(vm, {
    admitted: nativeOpcodeTargets,
    implementation,
    devices,
    oracle,
    rounds: (entry) => nestedRound(entry),
  });
  // Every executed native call (X = table offset as in canCall) counts for the current interval.
  const callNative = vm.natives.call.bind(vm.natives);
  vm.natives.call = () => {
    active.at(-1)?.called.push(0x800000 | ROM[0x157b8 + vm.x] | (ROM[0x157b9 + vm.x] << 8));
    callNative();
  };
  // No caller outside: returnS never hits, a round end ends as STOP_FRONTIER.
  const scheduler = new TaskScheduler(vm);
  scheduler.returnS = -1;
  const counts = {},
    mismatches = [],
    faults = [],
    opcodes = new Map(),
    missingNatives = new Map(),
    frontiers = new Map();
  // Coverage of equal intervals: script base (word at D in the task frame, bank DBR) and every native target of opcode $58.
  const scriptBases = new Map(),
    nativesCalled = new Map();
  const mainLoopStops = new Map();
  const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  const count = (key) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };
  const apply = (writes) => {
    for (const [a, v] of writes) {
      setTruth(a, v);
      setWork(a, v);
    }
  };
  // Differences against a recorded point: registers and every byte written by either side.
  // The NMI handler does not run in the VM: bytes whose last change in the interval comes from it
  // are taken over by the VM as outside values.
  // After a lifted script native (tools/lifted-script-natives.mjs) the carry and
  // overflow, the free main stack below the scheduler's S and the sample loader's
  // scratch are not produced.
  // lifted is the lifted native's target or null.
  const differencesTo = (got, to, ignore = [], lifted = null) => {
    const differences = [],
      flags = (status) => (lifted ? status & ~LIFTED_NATIVE_FLAGS : status);
    if (got.pc !== to.pc) differences.push(`pc VM ${hex(got.pc)} Mesen ${hex(to.pc)}`);
    for (const key of ['a', 'x', 'y', 's', 'd', 'bank'])
      if (got[key] !== to[key])
        differences.push(`${key} VM ${hex(got[key])} Mesen ${hex(to[key])}`);
    if (flags(got.status) !== flags(to.status))
      differences.push(`status VM ${hex(got.status)} Mesen ${hex(to.status)}`);
    const expected = new Map(memory.touched.map((a) => [a, truthAt(a)]));
    for (const [a, v] of to.writes) expected.set(a, v);
    const last = new Map();
    for (const [a, v, nmi] of to.writes) last.set(a, nmi ? v : -1);
    for (const [a, v] of last) if (v >= 0) setWork(a, v);
    for (const a of ignore) expected.delete(a);
    for (const a of [...expected.keys()]) if (freeStack(a, to.s)) expected.delete(a);
    if (lifted) {
      const outer = workAt(OUTER_STACK_WORD) | (workAt(OUTER_STACK_WORD + 1) << 8);
      for (const a of [...expected.keys()])
        if (freeStack(a, outer) || inLiftedScratch(lifted, a)) expected.delete(a);
    }
    for (const [a, v] of expected)
      if (workAt(a) !== v)
        differences.push(`${where(a)} VM ${hex(workAt(a), 2)} Mesen ${hex(v, 2)}`);
    return differences;
  };
  const mismatch = (entry, differences) => {
    count('mismatch');
    if (mismatches.length < maxMismatches)
      mismatches.push({ ...entry, differences: differences.slice(0, 8) });
  };
  // Interval end: VM bytes back to the truth, then the recorded writes.
  const settle = (to) => {
    for (const a of memory.touched) setWork(a, truthAt(a));
    memory.touched.length = 0;
    apply(to.writes);
  };

  // Round from the running native (NativeCalls.round): the JSR frame lies on the stack, the other
  // VM registers are those of the native before the jump.
  function nestedRound(entry) {
    const frame = active.at(-1),
      at = frame.end,
      call = steps[at],
      site = (vm.peek16(1) - 2) & 0xffff;
    if (!call || call.kind !== 'C' || call.pc !== site || ROUND_CALLS.get(site) !== entry)
      throw new VmFault('oracle_round_unrecorded', 0x800000 | site);
    // Mesen records C before the JSR; the inner interval compares the return word already pushed.
    const differences = differencesTo({ ...vm.context(), s: (vm.s + 2) & 0xffff, pc: site }, call, [
      (vm.s + 1) & 0xffff,
      (vm.s + 2) & 0xffff,
    ]);
    if (differences.length) {
      const native = frame.native();
      mismatch(
        {
          index: frame.k,
          frame: steps[frame.k].frame,
          opcode: steps[frame.k].x & 0xff,
          scheduled: 'native-round-start',
          native: native === null ? null : hex(native, 6),
          context: steps[frame.k],
        },
        differences,
      );
      throw Object.assign(new VmFault('oracle_round_start_mismatch', 0x800000 | site), {
        counted: true,
      });
    }
    count('equal-native-round-start');
    settle(call);
    frame.nested = true;
    const taken = devices.taken;
    // The round ends with R at the return site with the same stack pointer.
    let next = at;
    do {
      if (next >= steps.length - 1) throw new VmFault('oracle_round_open', 0x800000 | site);
      next = runInterval(next);
    } while (!(
      steps[next].kind === 'R' &&
      steps[next].pc === ((site + 3) & 0xffff) &&
      steps[next].s === call.s
    ));
    const end = steps[next];
    vm.a = end.a;
    vm.x = end.x;
    vm.y = end.y;
    vm.s = end.s;
    vm.d = end.d;
    vm.dbr = end.bank;
    vm.p = end.status;
    vm.pc = end.pc;
    devices.taken = taken;
    // If the recording ends in the rest of the native, the outer interval stops at R.
    frame.end = next + 1 < steps.length ? next + 1 : next;
    if (frame.end === next) throw new VmFault('oracle_native_open_after_round', 0x800000 | site);
    const after = steps[frame.end],
      queue = queueObservations(after.queue),
      frozen = (list) => Object.freeze(list.map((o) => Object.freeze(o)));
    return {
      io: frozen(ioObservations(after.reads)),
      wait: frozen(queue.wait),
      input: frozen(queue.input),
    };
  }

  // Main loop from R ($96C3) to the next C ($96C0, src/vm/main-loop.mjs). If it reaches a routine not
  // bound yet, the interval is taken over as before and the boundary is counted per target.
  function mainLoop(k) {
    const from = steps[k],
      to = steps[k + 1],
      accessor = vm.natives.accessor;
    for (const a of memory.touched) setWork(a, truthAt(a));
    memory.touched.length = 0;
    vm.setContext(from);
    vm.pc = from.pc;
    const queue = queueObservations(to.queue);
    const frozen = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
    const events = {
      mode: 'record-observations',
      values: frozen(queue.wait),
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: frozen(queue.input),
      inputIndex: 0,
    };
    accessor.load();
    accessor.entry = 0x800000 | MAIN_LOOP_RESUME;
    accessor.io = ioObservations(to.reads);
    accessor.ioIndex = 0;
    let stop = null;
    try {
      runMainLoop(accessor, events);
      if (
        accessor.ioIndex !== accessor.io.length ||
        events.waitIndex !== events.values.length ||
        events.inputIndex !== events.inputs.length
      )
        throw new VmFault('main_loop_observation_unused');
    } catch (error) {
      if (error?.taskBoundary)
        stop =
          error.reason === 'main_loop_frontier' ? 'frontier ' + hex(error.target, 6) : error.reason;
      else if (error instanceof VmFault) stop = 'fault ' + error.reason;
      else throw error;
    } finally {
      accessor.io = null;
    }
    if (stop === null) {
      accessor.store();
      const differences = differencesTo(vm.context(), to);
      if (differences.length)
        mismatch(
          {
            index: k,
            frame: from.frame,
            opcode: -1,
            scheduled: 'main-loop',
            native: null,
            context: from,
          },
          differences,
        );
      else {
        count('equal-main-loop');
        if (to.interrupted) count('equal-with-nmi');
      }
    } else {
      count('main-loop-stop');
      mainLoopStops.set(stop, (mainLoopStops.get(stop) ?? 0) + 1);
    }
    settle(to);
    return k + 1;
  }

  // One interval from steps[k]; returns the index of the next start point.
  function runInterval(k) {
    const from = steps[k],
      first = steps[k + 1];
    // After a round end, code outside the scheduler runs up to the next round start.
    if (from.kind === 'R') {
      if (
        from.pc === MAIN_LOOP_RESUME &&
        first.kind === 'C' &&
        first.pc === MAIN_LOOP_ROUND &&
        !first.unknown
      )
        return mainLoop(k);
      count('outside-scheduler');
      apply(first.writes);
      return k + 1;
    }
    if (first.unknown) {
      count('skipped-unmapped-write');
      apply(first.writes);
      return k + 1;
    }
    if (from.programBank !== 0x80) {
      count('skipped-program-bank');
      apply(first.writes);
      return k + 1;
    }
    const frame = {
      k,
      end: k + 1,
      nested: false,
      called: [],
      native: () => devices.taken ?? pending,
    };
    const base =
      from.kind === 'S'
        ? (from.bank << 16) | truthAt(from.d) | (truthAt((from.d + 1) & 0xffff) << 8)
        : -1;
    const opcode = from.kind === 'C' ? -1 : from.x & 0xff,
      callsBefore = vm.natives.calls;
    // One opcode with its permitted natives; exits (task end, script call, native wait)
    // are carried on by the scheduler up to the next $F390, as the original does between two opcodes.
    // If a special native lacks a wait observation, it is added and the attempt repeated from the
    // same state (see IntervalDevices.wait), no longer after a round in the native.
    let result, scheduled;
    active.push(frame);
    devices.next(first.reads, first.queue);
    try {
      for (let attempt = 0; ; attempt++) {
        for (const a of memory.touched) setWork(a, truthAt(a));
        memory.touched.length = 0;
        vm.setContext(from);
        devices.taken = null;
        pending = null;
        frame.called.length = 0;
        result = null;
        scheduled = null;
        try {
          let stop = STOP_BUDGET;
          if (from.kind === 'C') {
            // JSR to the round: push the return word, run the scheduler up to the first opcode or round end.
            scheduled = 'round';
            vm.push16((from.pc + 2) & 0xffff);
            vm.pc = ROUND_CALLS.get(from.pc);
            stop = scheduler.resume(0);
          } else {
            const exit = vm.run(1);
            // Native exit: the scheduler serves it itself (native wait $C401), without natives.call.
            if (EXIT_NAMES[exit] === 'native-call') frame.called.push(NATIVE_TARGET(vm.exitId));
            if (exit !== EXIT_BUDGET) {
              scheduled = EXIT_NAMES[exit];
              stop = scheduler.resume(0);
            }
          }
          if (stop === STOP_NATIVE) result = 'exit-native-call';
          else if (stop === STOP_FRONTIER && vm.pc !== steps[frame.end].pc)
            result = 'scheduler-frontier';
          else if (stop !== STOP_BUDGET && stop !== STOP_FRONTIER)
            result = 'scheduler-stop-' + stop;
          if (result === 'scheduler-frontier')
            frontiers.set(vm.pc, (frontiers.get(vm.pc) ?? 0) + 1);
        } catch (error) {
          if (!(error instanceof VmFault)) throw error;
          if (error.counted) {
            result = 'native-round-start-mismatch';
            break;
          }
          if (
            error.reason === 'native_boundary:task_wait_observation_required' &&
            !frame.nested &&
            attempt < 1024 &&
            devices.addWait(error.details)
          )
            continue;
          result = 'fault-' + error.reason;
          const native = frame.native();
          if (faults.length < maxMismatches)
            faults.push({
              index: k,
              frame: from.frame,
              native: native === null ? null : hex(native, 6),
              reason: error.reason,
              address: error.address === null ? null : hex(error.address, 6),
              details: error.details,
            });
        }
        break;
      }
    } finally {
      active.pop();
    }
    const to = steps[frame.end];
    if (result === null && to.unknown) result = 'skipped-unmapped-write';
    if (result === null) {
      // Target: the next opcode ($F390) or the return from the scheduler round, as in Mesen.
      const native = frame.native(),
        differences = differencesTo(
          vm.context(),
          to,
          [],
          LIFTED_SCRIPT_NATIVES.has(native) ? native : null,
        );
      if (differences.length)
        mismatch(
          {
            index: k,
            frame: from.frame,
            opcode,
            scheduled,
            native: native === null ? null : hex(native, 6),
            context: from,
          },
          differences,
        );
      else {
        if (to.kind === 'R') count('equal-round-end');
        if (to.interrupted) count('equal-with-nmi');
        if (frame.nested) count('equal-native-round-end');
        count(
          scheduled
            ? 'equal-scheduler-' + scheduled
            : vm.natives.calls > callsBefore
              ? 'equal-native'
              : 'equal',
        );
        if (vm.natives.calls > callsBefore)
          nativesRun.set(native, (nativesRun.get(native) ?? 0) + 1);
        if (opcode >= 0) opcodes.set(opcode, (opcodes.get(opcode) ?? 0) + 1);
        if (base >= 0) tally(scriptBases, base);
        for (const target of frame.called) tally(nativesCalled, target);
      }
    } else {
      count(result);
      if (result === 'exit-native-call') {
        const target = NATIVE_TARGET(vm.exitId);
        missingNatives.set(target, (missingNatives.get(target) ?? 0) + 1);
      }
    }
    settle(to);
    return frame.end;
  }

  for (let k = 0; k + 1 < steps.length;) k = runInterval(k);
  apply(tail.writes);
  let selfCheck = tail.unknown ? 'unmapped-write-after-last-step' : 'equal';
  for (let a = 0; a < WRAM_SIZE && selfCheck === 'equal'; a++)
    if (truth[a] !== final[a]) selfCheck = `differs at ${hex(0x7e0000 + a, 6)}`;
  return {
    intervals: Math.max(0, steps.length - 1),
    counts,
    mismatches,
    faults,
    selfCheck,
    opcodes: Object.fromEntries(
      [...opcodes].sort((a, b) => a[0] - b[0]).map(([o, n]) => [hex(o, 2), n]),
    ),
    nativesEqual: Object.fromEntries(
      [...nativesRun].sort((a, b) => b[1] - a[1]).map(([t, n]) => [hex(t, 6), n]),
    ),
    scriptBases: Object.fromEntries(
      [...scriptBases].sort((a, b) => a[0] - b[0]).map(([b, n]) => [hex(b, 6), n]),
    ),
    mainLoopStops: Object.fromEntries([...mainLoopStops].sort((a, b) => b[1] - a[1])),
    nativesCalled: Object.fromEntries(
      [...nativesCalled].sort((a, b) => a[0] - b[0]).map(([t, n]) => [hex(t, 6), n]),
    ),
    missingNatives: Object.fromEntries(
      [...missingNatives].sort((a, b) => b[1] - a[1]).map(([t, n]) => [hex(t, 6), n]),
    ),
    frontiers: Object.fromEntries(
      [...frontiers].sort((a, b) => b[1] - a[1]).map(([pc, n]) => [hex(pc), n]),
    ),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { exe, reason } = findMesen();
  if (!exe) {
    console.log(`Mesen oracle skipped: ${reason}`);
    process.exit(0);
  }
  // Third argument: frame for the walk input, "door", "exit" or "street" (plans from frame 3000).
  const [startFrame, endFrame] = process.argv.slice(2, 4).map(Number),
    third = process.argv[4];
  const trace = {
    ...DEFAULT_TRACE,
    ...(startFrame ? { startFrame } : {}),
    ...(endFrame ? { endFrame } : {}),
    ...(third === 'door'
      ? { planFrom: 3000, plan: MORGUE_DOOR_PLAN }
      : third === 'exit'
        ? { planFrom: 3000, plan: MORGUE_EXIT_PLAN }
        : third === 'street'
          ? { planFrom: 3000, plan: STREET_PLAN }
          : third === 'southwest'
            ? { planFrom: 3000, plan: SOUTHWEST_PLAN }
            : third === 'alley'
              ? { planFrom: 3000, plan: ALLEY_PLAN }
              : third === 'fight'
                ? { planFrom: 3000, plan: ALLEY_FIGHT_PLAN }
                : third === 'dog'
                  ? { planFrom: 3000, plan: DOG_DIALOG_PLAN }
                  : third === 'select'
                    ? { planFrom: 3000, plan: SELECT_PLAN }
                    : third === 'items'
                      ? { planFrom: 3000, plan: ITEMS_PLAN }
                      : third === 'bed'
                        ? { planFrom: 3000, plan: BED_SAVE_KARMA_PLAN }
                        : third === 'shades'
                          ? { planFrom: 3000, plan: SHADES_PLAN }
                          : third === 'desk'
                            ? { planFrom: 3000, plan: DESK_PHONE_PLAN }
                            : third === 'badge'
                              ? { planFrom: 1, save: 'apartment', plan: BADGE_OFFER_PLAN }
                              : third
                                ? { walkFrom: Number(third) }
                                : {}),
  };
  const t0 = Date.now(),
    recorded = await recordTrace(exe, trace),
    t1 = Date.now(),
    report = compareTrace(recorded);
  console.log(
    JSON.stringify({ trace, recordMs: t1 - t0, compareMs: Date.now() - t1, ...report }, null, 1),
  );
  if (report.mismatches.length || report.selfCheck !== 'equal') process.exitCode = 1;
}
