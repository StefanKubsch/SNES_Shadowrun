// Labels and rows of member menus, decoded once per game's content.
import { readTables } from '../data/tables.mjs';
import { textPointerWord } from '../data/rom-bytes.mjs';
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
    const tables = Object.fromEntries(
        readTables((at) => mem.read8(at)).map((table) => [table.name, table.values]),
      ),
      fields = ['charisma', 'strength', 'magic', 'body'];
    content = {
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
