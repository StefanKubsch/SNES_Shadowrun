// Input plans of the Mesen runs and the live tests (commands of tools/mesen/trace-f390.lua
// and tools/live-plan-driver.mjs) and the saved games they start from. Data only: the
// oracle (tools/mesen-f390-oracle.mjs) and the live tests share it.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SRAM_SIZE } from '../src/vm/memory.mjs';

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
