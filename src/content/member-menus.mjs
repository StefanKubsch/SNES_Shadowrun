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
    content = {
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
