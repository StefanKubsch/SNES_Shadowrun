import { readFile } from 'node:fs/promises';
import { menuEntry, menuFixture, menuWindows } from './render-menu-fixtures.mjs';
import { ad92Fixture } from './render-ad92-fixtures.mjs';
import { textWord } from './render-text-compose-fixtures.mjs';

const source = JSON.parse(await readFile(new URL('../analysis/render-selection.json', import.meta.url), 'utf8'));
export const choice9215Tokens = [...Buffer.from(source.tables[1].machine_bytes, 'hex')];
export const choice9215Entry = { ...menuEntry, stackWindow: [0x1FE4, 0x1FFF],
  ioRead2134: [108], waitRead01F8: [0, 0], divisionMode: null };
export const choice9215Windows = [...menuWindows, [0x7E0154, 0x7E0247], [0x7E1D63, 0x7E1D64]];
// Original token table and AD92's compressed stream are separate source
// data; all lists/flags/dictionary/font/buffers/input are synthetic fixtures.
export function choice9215Fixture({ ids = [0, 1, 255], flags = [0, 0, 0, 0], bank = 0x80,
  held = 0x2000, cursor = 0, active = false, writeWindows = choice9215Windows, ...options } = {}) {
  const data = menuFixture({ ...options, held, bank, writeWindows });
  const render = ad92Fixture({ bank, first: 0, last: cursor, flags: [0, 0], active, writeWindows });
  for (const [a, v] of render.snapshot().bytes) data.seed(a, [v]);
  const base = bank * 65536;
  for (const [address, value] of [[base + 0x204, cursor], [base + 0x212, 0x2027],
    [base + 0x226 + ((cursor + 2) & 65535), 0], [0x7E2060, 0x2027],
    [base + 0x1F6, 0], [base + 0x1F8, 0], [base + 0x1D63, 0x1234]]) textWord(data, address, value);
  data.seed(0x7E3CA3, [...ids, 0]); data.seed(0x7E3CD6, [...flags, 0]);
  data.seed(0x8D8000, choice9215Tokens);
  for (const id of ids.filter(id => id < 255)) {
    const token = choice9215Tokens[id * 2] | choice9215Tokens[id * 2 + 1] << 8;
    data.seed((token & 0x8000 ? 0x9E0000 : 0x9D0000) + (token | 0x8000), [0x40, 0]);
  }
  if (bank === 0x7E || bank === 0x7F) textWord(data, base + 0x2134, 108);
  return data;
}
