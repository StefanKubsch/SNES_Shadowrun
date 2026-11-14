import { selectionEntry, selectionFixture, selectionZeroFixture } from './render-f25a-fixtures.mjs';
export const ef47Entry = { ...selectionEntry };

// Synthetic inputs and writable cache, never original initialization or APU
// evidence. The full cache WORD is supplied by EF47's first actual store.
export function ef47Fixture({ zeroFixture = false, bank = 0x80, writeWindows = null, ...options } = {}) {
  const owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const windows = [[owner + 0x1CDE, owner + 0x1CDF], [owner + 0x1CE4, owner + 0x1CE7],
    [0x7E0089, 0x7E0099],
    ...([0x7E, 0x7F].includes(bank) ? [[bank * 65536 + 0x2140, bank * 65536 + 0x2143]] : [])];
  return (zeroFixture ? selectionZeroFixture : selectionFixture)({ ...options, bank,
    writeWindows: writeWindows ?? windows });
}
