// Lookup tables of banks 80 and 81 as readable JSON (docs/ROM-FREE.md, step 2):
// assets/vm-tables.json (src/data/tables.mjs). tools/build-cartridge.mjs
// checks the way back through the product's loader.
import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { readTables, readAnimations } from '../src/data/tables.mjs';
import { scriptOpcodes } from '../src/script/opcodes.mjs';
import { directionCalls, stateCalls, trackCalls } from '../proof/matrix-reference/main-matrix-movement.mjs';
import { textCommands } from '../proof/matrix-reference/main-scene-matrix.mjs';
import { SCENE_ANIMATION_TARGETS } from '../proof/cutscene-reference/cutscene-animation.mjs';
import { KARMA_LISTS } from '../src/task/native-main-menu.mjs';
import { SUBMENU_SEQUENCES } from '../src/task/native-status-screen.mjs';
import { SCENE_VIDEO_COMMANDS } from '../src/task/main-scene-video.mjs';
import { COMPARE } from '../src/task/native-scene-sprites.mjs';

const ROM_SHA256 = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== ROM_SHA256)
  throw new Error('ROM differs from the researched European revision');
const read8 = (cpu) => bytes[cpuToOffset(cpu, bytes.length)];
const tables = readTables(read8),
  animations = readAnimations(read8);
// The rules the comments of src/data/tables.mjs state must hold.
const byName = Object.fromEntries(tables.map((t) => [t.name, t.values]));
const reverse = (v) => parseInt(v.toString(2).padStart(8, '0').split('').reverse().join(''), 2);
const rules = {
  lz_bit_lengths: (v, n) => v === (n ? Math.floor(Math.log2(n)) + 1 : 0),
  random_masks: (v, k) => v === 0xffff >> k,
  motion_offsets: (v, k) => v === 0x20 * k,
  bit_reverse: (v, n) => v === reverse(n),
  obj_size_clear_masks: (v, n) => v === (~(2 << (2 * (n & 3))) & 255),
  obj_x_high_bits: (v, n) => v === 1 << (2 * (n & 3)),
  decimal_powers: (v, k) => v === 10 ** (9 - k),
};
for (const [name, rule] of Object.entries(rules))
  if (!byName[name].every(rule)) throw new Error(`${name} breaks its rule`);
// Every text pointer must name a text start.
const texts = new Set(
  JSON.parse(await readFile('assets/vm-texts.json', 'utf8')).texts.map((t) => t.address),
);
for (const t of tables)
  if (t.values.some((v) => /^9[DE]:/.test(v)) && !t.values.every((a) => a === 0 || texts.has(a)))
    throw new Error(`${t.name} names no text start`);
// Spell scripts are script numbers; the motion tables equal the asset the
// native motion code reads.
const scriptCount = JSON.parse(await readFile('assets/scripts.json', 'utf8')).scripts.length;
if (![...byName.spell_scripts_a, ...byName.spell_scripts_b].every((n) => n < scriptCount))
  throw new Error('a spell script number names no script');
const motion = JSON.parse(await readFile('assets/slot-motion-direction-data.json', 'utf8')).bytes;
const motionWords = Array.from(
  { length: 32 },
  (_, k) => ((motion[2 * k] | (motion[2 * k + 1] << 8)) << 16) >> 16,
);
if (
  motionWords.join() !==
  ['motion_x_a', 'motion_y_a', 'motion_x_b', 'motion_y_b'].flatMap((n) => byName[n]).join()
)
  throw new Error('the motion tables differ from slot-motion-direction-data.json');
// The karma tables are those the port's KARMA_LISTS name.
const at = (name) => parseInt(tables.find((t) => t.name === name).address.slice(3), 16);
const karma = Object.values(KARMA_LISTS)
  .map((l) => [l.pointers, l.names, l.limits].join())
  .sort();
if (
  karma.join('|') !==
  ['attribute', 'skill', 'spell']
    .map((k) => ['stats', 'names', 'limits'].map((p) => at(`karma_${k}_${p}`)).join())
    .sort()
    .join('|')
)
  throw new Error('the karma tables differ from KARMA_LISTS');
// The handler of every ported opcode, and only ported matrix call targets at
// the indexes the dispatch accepts.
const label = (a) =>
  `${(a >> 16).toString(16).toUpperCase()}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
for (const [opcode, { handler }] of Object.entries(scriptOpcodes))
  if (byName.opcode_handlers[opcode / 2] !== label(0x800000 | handler))
    throw new Error(`opcode ${opcode} names another handler`);
for (const [name, targets, step, firstZero] of [
  ['matrix_direction_calls', directionCalls, 1],
  ['matrix_track_calls', trackCalls, 2],
  ['matrix_state_calls', stateCalls, 1],
  ['matrix_text_commands', textCommands, 1],
  ['scene_animation_calls', SCENE_ANIMATION_TARGETS, 1],
  [
    'status_submenu_calls',
    new Set([...SUBMENU_SEQUENCES.keys()].map((t) => 0x800000 | t)),
    1,
    true,
  ],
  ['scene_list_commands', SCENE_VIDEO_COMMANDS, 1, true],
  ...['compare_calls_b0e3', 'compare_calls_b126'].map((name) => [
    name,
    new Set([...COMPARE.keys()].map((t) => 0x800000 | t)),
    1,
    true,
  ]),
])
  if (
    !byName[name].every((t, k) =>
      k % step || (firstZero && k === 0) ? t === 0 : targets.has(parseInt(t.replace(':', ''), 16)),
    )
  )
    throw new Error(`${name} names a target the port lacks`);
// An HDMA table is a line count and one unit of bytes per entry up to the end
// byte 00; the counts have no C bit (Book I chapter 17.2, PDF 87 and 149-152;
// one byte in mode 0, two in mode 1).
const hdma = (name, unit) => {
  const v = byName[name],
    step = unit + 1;
  if (
    v.at(-1) !== 0 ||
    (v.length - 1) % step ||
    v.slice(0, -1).some((c, k) => k % step === 0 && (c === 0 || c >= 0x80))
  )
    throw new Error(`${name} is no HDMA table`);
};
hdma('matrix_bg3_hdma', 1);
for (const t of ['a', 'b', 'c']) hdma(`scene_window_hdma_${t}`, 2);
hdma('dialog_window_hdma', 2);
hdma('weapon_window_hdma', 2);
hdma('intro_window_hdma', 2);
// Menu item lists end with 0 and hold no other 0.
for (const name of [
  'status_menu_items',
  'dialog_menu_items',
  'modal_menu_items',
  'save_menu_items',
  'main_menu_items',
  'karma_menu_items',
])
  if (byName[name].indexOf(0) !== byName[name].length - 1)
    throw new Error(`${name} breaks its layout`);
const hdmaStarts = new Set(
  ['a', 'b', 'c'].map((t) => tables.find((x) => x.name === `scene_window_hdma_${t}`).address),
);
if (!byName.scene_window_hdma.every((p) => hdmaStarts.has(p)))
  throw new Error('scene_window_hdma names no HDMA table');
// Intro frames name the 49 pictures or end with -1/-2; the event lists hold
// entries of three words in time order and end with FFFF.
if (
  ![...byName.intro_frames, ...byName.intro_frames_df77].every(
    (v) => v === -1 || v === -2 || (v >= 0 && v < 49),
  )
)
  throw new Error('an intro frame names no picture');
for (const name of [
  'intro_events_e900',
  'intro_events_e971',
  'intro_spawns',
  'frontend_vram_copies',
  'frontend_vram_uploads',
]) {
  const v = byName[name].map((x) => (typeof x === 'string' ? parseInt(x, 16) : x)),
    times = v.filter((_, k) => k % 3 === 0 && k < v.length - 1);
  if (
    v.at(-1) !== 0xffff ||
    (v.length - 1) % 3 ||
    (name.startsWith('intro_events') && times.some((t, k) => k && t < times[k - 1]))
  )
    throw new Error(`${name} breaks its layout`);
}
// The picture pointers and B8C8 (BEB1) name animation list starts.
const starts = new Set(animations.map((a) => a.address));
if (
  ![...byName.matrix_move_pictures, ...byName.matrix_face_pictures, '81:BEB1'].every(
    (p) => p === 0 || starts.has(p),
  )
)
  throw new Error('a picture pointer names no animation list');
const scope =
  'Lookup tables of banks 80 and 81 read by index: unpacker bit lengths (80:A033), random masks and bytes (80:C540, 80:C58D), tile queue offsets (80:AEB4), the color ramp of 8877 (80:D3D1), the bit reversal table (81:A017), glyph widths and text masks (81:AC0C, 81:AC8D), the text pointers by number (80:D9B8, as text addresses in vm-texts.json), the script opcode handlers (80:F2B4), the matrix control tables of bank 81 (81:B258 to 81:C396), the bar tiles of AF1F (81:B026), the save slot offsets (81:B124), the intro sprite grid, frames and events (81:DADD to DFE6, 81:E991 to EB7A), the intro scene tables of CDF8 with their HDMA window tables (81:D3BF to D478), the OAM high table masks (80:B18A, 80:B85E), the sound words of C46E (80:C4B3) the karma lists of CE6D (80:EFB2 to F005), the spell menu tables of E693 (80:E7C8 to E833), the walk steps and pad directions of E014 (80:DF27 to DF6A), the motion steps (80:C7CC to C80B), the intro spawns (81:DC78), the frontend VRAM copies (81:DC92), the shot and hit tables (80:8A13, 80:8840), the dialog music (80:94EA), the selection steps (80:BBFA), the status screen tables (80:ED0E to ED3B), the decimal powers (80:FE45, long words), further intro and frontend tables of bank 81 and the scene list commands (81:EC2F), window HDMA tables, menu item lists, the depth compare dispatch (80:B0E3, 80:B126), formation, swarm, skill name, upkeep sound and AA9C source tables of bank 80 and small fill and sprite tables of bank 81 and the matrix animation lists 81:BE69 to BEC2 (OBJ picture words, end loop = FFFF, stop = FFFE). Words are little-endian values; signed words are negative numbers, hex words four hex digits, pointers are addresses in the bank of the table, long values 24 bit addresses. See src/data/tables.mjs.';
await writeFile(
  'assets/vm-tables.json',
  JSON.stringify(
    { format: 'shadowrun-tables-v2', scope, source_rom_sha256: ROM_SHA256, tables, animations },
    null,
    1,
  ).replace(/\[\n(?:\s*(?:-?\d+|"[0-9A-F]{2}:[0-9A-F]{4}"|"[0-9A-F]{4}"),?\n)+\s*\]/g, (m) =>
    JSON.stringify(JSON.parse(m)),
  ) + '\n',
);
console.log(tables.map((t) => `${t.name} ${t.values.length}`).join(', '));
