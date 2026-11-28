import { WORD_MASK } from '../constants/bits.mjs';
import { SKILL_NAMES, SPELL_NAMES } from '../state/jake.mjs';
// Labels and rows of member menus, decoded once per game's content.
import { readTables } from '../data/tables.mjs';
import { textPointerWord, romAddress } from '../data/rom-bytes.mjs';
const cache = new WeakMap();
export const textId = (label) => {
  if (!label) return 0;
  if (typeof label === 'number') return label;
  const [bank, offset] = label.split(':');
  return textPointerWord(bank, offset);
};
export function memberMenuContent(mem) {
  let content = cache.get(mem);
  if (!content) {
    const decoded = readTables((at) => mem.read8(at)),
      tables = Object.fromEntries(decoded.map((table) => [table.name, table.values])),
      fields = ['charisma', 'strength', 'magic', 'body'];
    const levelTable = decoded.find((table) => table.name === 'spell_level_names'),
      levelNames = tables.spell_level_names.map(textId);
    const upgrades = (group, fields) =>
      fields.map((field, index) => ({
        field,
        text: textId(tables['karma_' + group + '_names'][index]),
        limit: tables['karma_' + group + '_limits'][index],
      }));
    content = {
      karmaCategories: tables.karma_menu_items.filter(Boolean).map(textId),
      karma: {
        attributes: {
          text: 0x7490,
          upgrades: upgrades('attribute', ['body', 'magic', 'strength', 'charisma']),
        },
        skills: {
          text: 0x70bb,
          upgrades: upgrades('skill', [
            'skills.firearms',
            'skills.computer',
            'skills.leadership',
            'skills.negotiation',
          ]),
        },
        spells: {
          text: 0x709d,
          upgrades: upgrades('spell', [
            'spells.powerball',
            'spells.invisibility',
            'spells.summonSpirit',
            'spells.freeze',
            'spells.heal',
            'spells.armour',
          ]),
        },
      },
      spells: SPELL_NAMES.map((field, index) => ({
        field,
        name: textId(tables.spell_names[index]),
        script: tables.spell_scripts_a[index],
        leaderScript: tables.spell_scripts_b[index],
      })),
      spellLevelName(index, level, carry = 0) {
        const offset = (((level - 1) * 12) & WORD_MASK) + index * 2 + carry;
        if (!(offset & 1) && offset >= 0 && offset / 2 < levelNames.length)
          return levelNames[offset / 2];
        return mem.read16(romAddress(levelTable.address) + offset);
      },
      skills: SKILL_NAMES.map((field, index) => ({
        field,
        text: textId(tables.skill_names[index]),
      })),
      attributes: fields
        .map((field, index) => ({
          field,
          row: tables.status_attribute_rows[index],
          text: textId(tables.status_attribute_names[index]),
        }))
        .reverse(),
    };
    cache.set(mem, content);
  }
  return content;
}
