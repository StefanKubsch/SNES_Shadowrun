// Runner defaults as records. The asset reader is the temporary content boundary
// until phase 4 loads the decoded assets directly.
import {
  readRunners,
  RUNNERS,
  RUNNER_EQUIPMENT_ROWS,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
  RUNNER_PORTRAITS,
  RUNNER_DATAJACKS,
  RUNNER_NAMES,
  RECORD_ATTRIBUTE,
  RECORD_SKILL,
  RECORD_SPELL,
} from '../data/runners.mjs';
import { label } from '../data/rom-bytes.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, HEX_RADIX, WORD_MASK, WORD_BITS } from '../constants/bits.mjs';

const cache = new WeakMap();
const namedStats = (stats) =>
  stats && {
    body: stats.body,
    magic: stats.magic,
    strength: stats.strength,
    unidentifiedAttribute: stats.byte3,
    charisma: stats.charisma,
    maxHealth: stats.count_max,
    skills: {
      firearms: stats.skills.firearms,
      unarmedCombat: stats.skills.unarmed_combat,
      armedCombat: stats.skills.armed_combat,
      computer: stats.skills.computer,
      leadership: stats.skills.leadership,
      negotiation: stats.skills.negotiation,
    },
    spells: {
      powerball: stats.spells.powerball,
      heal: stats.spells.heal,
      invisibility: stats.spells.invisibility,
      armour: stats.spells.armour,
      summonSpirit: stats.spells.summon_spirit,
      freeze: stats.spells.freeze,
    },
  };
export function runnerContent(mem) {
  let rows = cache.get(mem);
  if (!rows) {
    rows = readRunners((at) => mem.read8(at)).map((row) => ({
      ...row,
      stats: namedStats(row.stats),
      object: parseInt(row.object, HEX_RADIX),
      armour: { object: parseInt(row.armour.object, HEX_RADIX), rating: row.armour.rating },
      weapon: {
        ...row.weapon,
        object: parseInt(row.weapon.object, HEX_RADIX),
        range: row.weapon.range & BYTE_MASK,
      },
    }));
    cache.set(mem, rows);
  }
  return rows;
}

// Unequipping searches one row beyond the regular runners. It overlaps the first
// immutable attributes in the original content; keep that row rather than dropping it.
export function defaultEquipment(mem, index) {
  if (index < RUNNERS) return runnerContent(mem)[index];
  const at = CODE_BANK_BASE + RUNNER_EQUIPMENT_ROWS + index * 8,
    byte = (n) => mem.read8(at + n),
    word = (n) => byte(n) | (byte(n + 1) << BYTE_BITS);
  return {
    armour: { object: word(0), rating: byte(2) },
    weapon: { object: word(3), kind: byte(5), damage: byte(6), range: byte(7) },
  };
}

// Last matching runner, as the original tables are searched from the end.
export function findRunnerIndex(mem, number) {
  const rows = runnerContent(mem);
  for (let index = rows.length - 1; index >= 0; index--)
    if (rows[index].object === number) return index;
  return -1;
}
export function memberRecordAddress(mem, index) {
  const [bank, offset] = runnerMetadata(mem, index).record.split(':');
  return (parseInt(bank, HEX_RADIX) << WORD_BITS) | parseInt(offset, HEX_RADIX);
}
// The missing-row alias remains a content boundary for diagnostic fixtures.
export function runnerMetadata(mem, index) {
  if (Number.isInteger(index) && index >= 0 && index < RUNNERS) return runnerContent(mem)[index];
  const row = (index * 2) & WORD_MASK,
    pointer = dataBankWord(mem, RUNNER_RECORD_POINTERS, row),
    bank = dataBankWord(mem, RUNNER_RECORD_BANKS, row) & BYTE_MASK,
    address = (bank << WORD_BITS) | pointer,
    byte = (offset) => mem.read8((bank << WORD_BITS) | ((pointer + offset) & WORD_MASK)),
    fields = (offsets) =>
      Object.fromEntries(Object.entries(offsets).map(([name, at]) => [name, byte(at)]));
  return {
    object: dataBankWord(mem, RUNNER_OBJECT_NUMBERS, row),
    record: label(address),
    portrait: dataBankWord(mem, RUNNER_PORTRAITS, row),
    datajack: dataBankWord(mem, RUNNER_DATAJACKS, row) !== 0,
    name: dataBankWord(mem, RUNNER_NAMES, row),
    stats: namedStats({
      ...fields(RECORD_ATTRIBUTE),
      skills: fields(RECORD_SKILL),
      spells: fields(RECORD_SPELL),
    }),
  };
}
