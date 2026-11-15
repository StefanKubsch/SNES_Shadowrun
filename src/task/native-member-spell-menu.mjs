import { SKILLS_START, SPELLS_START, SPELL_COUNT } from '../data/runners.mjs';

// Word scratch of the times-six kind index (and of EA6E's row loop).
export const DP_SCRATCH = 0x6b;

// Texts: "none" and a blank field.
export const TEXT_NONE = 0x712e,
  TEXT_BLANK_FIELD = 0x707f;

// E9C5 rows of the status window and their value column; dermal armour adds 2.
export const STATUS_LAYOUT = Object.freeze({
  valueColumn: 0x0a,
  spellRow: 0x14,
  weaponRow: 0x15,
  armourRow: 0x16,
});

// E693: spell slots relative to [F9] = record + skills, the spell window 0B/0F/12
// with three rows more than spells and seven visible rows, and the tables of
// src/data/tables.mjs indexed by 2 slot (level names by 12 (level - 1) + 2 slot).
export const SPELL_SLOT_FIRST = SPELLS_START - SKILLS_START,
  SPELL_SLOT_END = SPELL_SLOT_FIRST + SPELL_COUNT,
  SPELL_SLOT_INDEX_BIAS = 2 * SPELL_SLOT_FIRST;

export const SPELL_WINDOW = Object.freeze({
  left: 0x0b,
  top: 0x0f,
  columns: 0x12,
  extraRows: 3,
  visibleRows: 7,
});

export const SPELL_LEVEL_NAMES = 0xe7c8,
  SPELL_SCRIPTS_A = 0xe810,
  SPELL_SCRIPTS_B = 0xe81c,
  SPELL_NAMES = 0xe828;
