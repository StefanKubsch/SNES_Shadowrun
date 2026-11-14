// Runner table in bank 80 (docs/ROM-FREE.md, step 2): Jake and the twelve
// runners, row n at index 2 n (the readers search 9700 from X = 18 down).
// - 80:9700 object number (8860, CECB, CF2E, D067, D079, E014, EA6E, A2FA),
// - 80:971A/9734 the long pointer of the member record (word, then the bank
//   in the low byte of a word; Jake 7E:3BFB in WRAM, the others 18 bytes
//   each from 80:9811 to 98E9). The status screen 80:EA6E shows bytes 0, 1,
//   2 and 4 as Body, Magic, Strength and Charisma (labels 80:ED16), byte 5
//   as the maximum of the state count 1F5E (CECB caps it there, D079 sets
//   it; 10 x Body in all twelve) and 10 x byte 1 as the maximum of the
//   magic points 7E:3C96 (CF2E, D079); byte 3 is skipped and has no reader
//   known: the karma list 80:EFB2 names 3BFB, 3BFC, 3BFD and 3BFF (bytes 0,
//   1, 2, 4), the new game 80:991D sets every byte of Jake's record but
//   3BFE, no code reads a record at Y = 3, and the live tests read only
//   bytes 1 and 5 of the ROM records. The values (1 to 7) stay as data.
//   Bytes 6 to 11 are the skills of 80:E834 (names 80:E8BC: Firearms, Unarmed combat, Armed combat, Computer, Leadership,
//   Negotiation; 8860 rolls hits with 6, 7 and 8, E30F takes 9), bytes 12
//   to 17 the spell levels of the menu 80:E693 through F254 (names 80:E7BC:
//   Powerball, Heal, Invisibility, Armour, Summon spirit, Freeze),
// - 80:974E the dialog number of the portrait (EA6E to 1F54; Jake 4E),
// - 80:9768 a word EA6E copies to 1F56; the notes window 80:E8C8 lists
//   "Datajack" (text 05B9) for a runner when it is not zero (FFFF in four
//   rows, 0000 in the others; Jake has his own cyberware flags),
// - 80:9782 the name (text pointer, bit 15 selects bank 9E; E014, 9BC6,
//   BE6D),
// - 80:979C one byte each, copied by 80:98E9 (MVN) to the magic points
//   7E:3C96 for a new game (8B43 takes from them, CF2E and D079 add; 10 x
//   Magic in all twelve with a ROM record),
// - 80:97A9 eight bytes each, copied by 98E9 to 7E:3C2E (9D3D/9D50 copy
//   them back from here): word 0 the object number of the armour (FFFF:
//   none; 8B16 sets it with byte 2), byte 2 its rating (A1E6/A2FA copy it
//   to the object's 7E:43F8, +2 for the leader with dermal armour 7E:3C18;
//   8691 takes it from the damage roll), word 3 the object number of the
//   weapon (8B9F sets it with bytes 5 to 7; E014 refuses aiming when it is
//   negative), bytes 5 to 7 its kind, damage and signed range (8860). The
//   window 80:E9C5 shows both object names and the rating.
// The tables have 13 rows: the first ends at 971A where the second begins,
// and 98E9 copies 13 and 104 bytes. Rows and records keep their addresses
// (runner_layout_changed).
// Native form assets/vm-runners.json: one row per runner, the record
// inline with named fields for records in ROM.
import { VmFault } from '../vm/memory.mjs';
import { hex, romWriter, wordReader, textPointerLabel, textPointerWord } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  BYTE_HEX_DIGITS,
  BYTE_VALUES,
  INT8_MAX,
  INT8_MIN,
  WORD_HEX_DIGITS,
} from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';

export const RUNNER_TABLE = 0x809700,
  RUNNERS = 13,
  RUNNER_RECORDS = 0x809811,
  RUNNER_END = 0x8098e9,
  RECORD_SIZE = 18;
const COLUMNS = {
  object: 0x809700,
  pointer: 0x80971a,
  bank: 0x809734,
  portrait: 0x80974e,
  datajack: 0x809768,
  name: 0x809782,
};
// Bank-80 offsets of the columns for the absolute,X readers, which search
// from the last row index down.
export const RUNNER_OBJECT_NUMBERS = COLUMNS.object & WORD_MASK,
  RUNNER_RECORD_POINTERS = COLUMNS.pointer & WORD_MASK,
  RUNNER_RECORD_BANKS = COLUMNS.bank & WORD_MASK,
  RUNNER_PORTRAITS = COLUMNS.portrait & WORD_MASK,
  RUNNER_DATAJACKS = COLUMNS.datajack & WORD_MASK,
  RUNNER_LAST_INDEX = 2 * (RUNNERS - 1);
export const RUNNER_NAMES = COLUMNS.name & WORD_MASK;
// Jake's object number in row 0 and his own portrait dialog with 7E:3C17 set.
export const JAKE_OBJECT_NUMBER = 0x08b2,
  JAKE_PORTRAIT_DIALOG = 0x4e,
  JAKE_ALTERNATE_PORTRAIT_DIALOG = 0x4f;
const ATTRIBUTES = ['body', 'magic', 'strength', 'byte3', 'charisma', 'count_max'];
const SKILLS = [
  'firearms',
  'unarmed_combat',
  'armed_combat',
  'computer',
  'leadership',
  'negotiation',
];
const SPELLS = ['powerball', 'heal', 'invisibility', 'armour', 'summon_spirit', 'freeze'];
// Record: the attributes, then the skills from byte 6, the spells from byte 12.
export const SKILLS_START = ATTRIBUTES.length,
  SPELLS_START = SKILLS_START + SKILLS.length,
  SKILL_COUNT = SKILLS.length,
  SPELL_COUNT = SPELLS.length;
// EA6E shows 10 x this byte as the maximum of the magic points (CF2E, D079).
export const RECORD_MAGIC = ATTRIBUTES.indexOf('magic'),
  RECORD_COUNT_MAX = ATTRIBUTES.indexOf('count_max');
// 80:E30F copies the Computer skill byte to 7E:1D8C for the matrix.
export const RECORD_COMPUTER = SKILLS_START + SKILLS.indexOf('computer');
// Record byte of each attribute, skill and spell by name (the new game 80:991D
// writes Jake's record by these offsets).
const recordOffsets = (names, start) =>
  Object.freeze(Object.fromEntries(names.map((name, k) => [name, start + k])));
export const RECORD_ATTRIBUTE = recordOffsets(ATTRIBUTES, 0),
  RECORD_SKILL = recordOffsets(SKILLS, SKILLS_START),
  RECORD_SPELL = recordOffsets(SPELLS, SPELLS_START);
// Magic points and equipment rows (eight bytes: armour object word and rating,
// weapon object word, kind, damage and signed range).
const MAGIC_POINTS = 0x80979c,
  EQUIPMENT = 0x8097a9,
  EQUIPMENT_BYTES = 8,
  ARMOUR_RATING = 2,
  WEAPON_OBJECT = 3,
  WEAPON_KIND = 5,
  WEAPON_DAMAGE = 6,
  WEAPON_RANGE = 7;
// Bank-80 offsets of the magic point and equipment rows; 98E9 copies all
// RUNNERS rows of both to WRAM with MVN.
export const RUNNER_MAGIC_POINT_ROWS = MAGIC_POINTS & WORD_MASK,
  RUNNER_EQUIPMENT_ROWS = EQUIPMENT & WORD_MASK,
  RUNNER_EQUIPMENT_BYTES = EQUIPMENT_BYTES;
// Absolute,X columns used by the default-equipment copies 80:9D3D/9D50.
// Keep DBR-relative accesses, including the original stores to the weapon columns.
export const RUNNER_DEFAULT_ARMOUR = RUNNER_EQUIPMENT_ROWS,
  RUNNER_DEFAULT_ARMOUR_RATING = RUNNER_EQUIPMENT_ROWS + ARMOUR_RATING,
  RUNNER_DEFAULT_WEAPON = RUNNER_EQUIPMENT_ROWS + WEAPON_OBJECT,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE = RUNNER_EQUIPMENT_ROWS + WEAPON_KIND,
  RUNNER_DEFAULT_WEAPON_RANGE = RUNNER_EQUIPMENT_ROWS + WEAPON_RANGE;
// 80:9CE4/9D15 start at 104, one stride beyond the last regular row (96).
export const RUNNER_EQUIPMENT_SCAN_START = RUNNERS * RUNNER_EQUIPMENT_BYTES;
const signedByte = (v) => (v > INT8_MAX ? v - BYTE_VALUES : v);
const decodeStats = (b) => ({
  ...Object.fromEntries(ATTRIBUTES.map((n, k) => [n, b[k]])),
  skills: Object.fromEntries(SKILLS.map((n, k) => [n, b[SKILLS_START + k]])),
  spells: Object.fromEntries(SPELLS.map((n, k) => [n, b[SPELLS_START + k]])),
});
const encodeStats = (s) => [
  ...ATTRIBUTES.map((n) => s?.[n]),
  ...SKILLS.map((n) => s?.skills?.[n]),
  ...SPELLS.map((n) => s?.spells?.[n]),
];

export function readRunners(read8) {
  const word = wordReader(read8);
  return Array.from({ length: RUNNERS }, (_, n) => {
    const col = (name) => word(COLUMNS[name] + 2 * n),
      bank = col('bank');
    if (bank > BYTE_MASK) throw new VmFault('runner_bank_required', COLUMNS.bank + 2 * n);
    if (col('datajack') !== 0 && col('datajack') !== WORD_MASK)
      throw new VmFault('runner_value_required', COLUMNS.datajack + 2 * n);
    const record = (bank << WORD_BITS) | col('pointer'),
      e = Array.from({ length: EQUIPMENT_BYTES }, (_, k) =>
        read8(EQUIPMENT + EQUIPMENT_BYTES * n + k),
      );
    const word2 = (k) => e[k] | (e[k + 1] << BYTE_BITS);
    const row = {
      object: hex(col('object'), WORD_HEX_DIGITS),
      record: `${hex(bank, BYTE_HEX_DIGITS)}:${hex(record & WORD_MASK, WORD_HEX_DIGITS)}`,
      portrait: col('portrait'),
      datajack: col('datajack') !== 0,
      name: textPointerLabel(col('name')),
      magic_points: read8(MAGIC_POINTS + n),
      armour: { object: hex(word2(0), WORD_HEX_DIGITS), rating: e[ARMOUR_RATING] },
      weapon: {
        object: hex(word2(WEAPON_OBJECT), WORD_HEX_DIGITS),
        kind: e[WEAPON_KIND],
        damage: e[WEAPON_DAMAGE],
        range: signedByte(e[WEAPON_RANGE]),
      },
    };
    if (record >= RUNNER_RECORDS && record + RECORD_SIZE <= RUNNER_END)
      row.stats = decodeStats(Array.from({ length: RECORD_SIZE }, (_, k) => read8(record + k)));
    else if (bank !== WRAM_BANK) throw new VmFault('runner_record_required', record);
    return row;
  });
}

export function placeRunners(rom, present, { runners }) {
  if (runners?.length !== RUNNERS) throw new VmFault('runner_layout_changed', RUNNER_TABLE);
  const put = romWriter(rom, present, 'runner_layout_changed');
  const word = (cpu, v) => {
    put(cpu, v);
    put(cpu + 1, v >> BYTE_BITS);
  };
  const value = (v, max, at) => {
    if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('runner_value_required', at);
    return v;
  };
  const hexWord = (text, at) => {
    if (!new RegExp(`^[0-9A-F]{${WORD_HEX_DIGITS}}$`).test(text ?? ''))
      throw new VmFault('runner_value_required', at);
    return parseInt(text, HEX_RADIX);
  };
  runners.forEach((r, n) => {
    const at = RUNNER_TABLE + 2 * n,
      rec = /^([0-9A-F]{2}):([0-9A-F]{4})$/.exec(r?.record ?? ''),
      name = /^(9D|9E):([89A-F][0-9A-F]{3})$/.exec(r?.name ?? '');
    if (!rec || !name || !r.armour || !r.weapon || typeof r.datajack !== 'boolean')
      throw new VmFault('runner_value_required', at);
    const bank = parseInt(rec[1], HEX_RADIX),
      pointer = parseInt(rec[2], HEX_RADIX);
    word(COLUMNS.object + 2 * n, hexWord(r.object, at));
    word(COLUMNS.pointer + 2 * n, pointer);
    word(COLUMNS.bank + 2 * n, bank);
    word(COLUMNS.portrait + 2 * n, value(r.portrait, WORD_MASK, at));
    word(COLUMNS.datajack + 2 * n, r.datajack ? WORD_MASK : 0);
    word(COLUMNS.name + 2 * n, textPointerWord(name[1], name[2]));
    put(MAGIC_POINTS + n, value(r.magic_points, BYTE_MASK, at));
    const q = r.weapon,
      e = EQUIPMENT + EQUIPMENT_BYTES * n;
    word(e, hexWord(r.armour.object, at));
    put(e + ARMOUR_RATING, value(r.armour.rating, BYTE_MASK, at));
    word(e + WEAPON_OBJECT, hexWord(q.object, at));
    put(e + WEAPON_KIND, value(q.kind, BYTE_MASK, at));
    put(e + WEAPON_DAMAGE, value(q.damage, BYTE_MASK, at));
    if (!Number.isInteger(q.range) || q.range < INT8_MIN || q.range > INT8_MAX)
      throw new VmFault('runner_value_required', at);
    put(e + WEAPON_RANGE, q.range & BYTE_MASK);
    if (r.stats) {
      const record = (bank << WORD_BITS) | pointer;
      if (record < RUNNER_RECORDS || record + RECORD_SIZE > RUNNER_END)
        throw new VmFault('runner_layout_changed', at);
      encodeStats(r.stats).forEach((v, k) => put(record + k, value(v, BYTE_MASK, at)));
    }
  });
}
