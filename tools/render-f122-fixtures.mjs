import { pairEntry, pairFixture } from './render-f03a-fixtures.mjs';
export const wordEntry = { ...pairEntry, status: 0xC5, a: 0xAB34 };
// Synthetic pair state and independent DP96 WORD, no original boot state.
export function wordFixture({ bank = 0x80, address = 0x1234, writeWindows = null, ...pair } = {}) {
  const base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const data = pairFixture({ ...pair, bank, writeWindows: writeWindows ?? [
    [owner + 0x1CE4, owner + 0x1CE7], [0x7E0096,0x7E0097],
    ...([0x7E,0x7F].includes(bank) ? [[base+0x2140,base+0x2142]] : []),
  ] });
  if (address !== null) data.seed(0x96,[address & 255,address >>> 8]); return data;
}
