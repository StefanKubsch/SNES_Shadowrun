// Runner defaults as records. The asset reader is the temporary content boundary
// until phase 4 loads the decoded assets directly.
import { readRunners, RUNNERS, RUNNER_EQUIPMENT_ROWS } from '../data/runners.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, HEX_RADIX } from '../constants/bits.mjs';

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
