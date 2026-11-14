import { menuEntry, menuFixture, menuWindows } from './render-menu-fixtures.mjs';
import { textWord } from './render-text-compose-fixtures.mjs';

export const choice91E2Entry = { ...menuEntry, stackWindow: [0x1FEA, 0x1FFF] };
export const choice91E2Windows = [...menuWindows, [0x7E1D63, 0x7E1D64]];
// Only this eight-byte list is original ROM data. Dictionary/font, buffer,
// input and chronological hardware observations are explicitly synthetic.
export const choice91E2Table = [0x88, 0x70, 0x8C, 0x70, 0x90, 0x70, 0, 0];
export function choice91E2Fixture({ initial = 2, bank = 0x80,
  writeWindows = choice91E2Windows, ...options } = {}) {
  const data = menuFixture({ ...options, bank, writeWindows });
  textWord(data, 0x17, initial);
  textWord(data, bank * 65536 + 0x1D63, 0x1234);
  data.seed(0x80920D, choice91E2Table);
  for (const token of [0x7088, 0x708C, 0x7090]) data.seed(0x9D0000 + (token | 0x8000), [0x40, 0]);
  return data;
}
