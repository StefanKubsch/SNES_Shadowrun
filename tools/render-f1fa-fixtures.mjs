import { sampleEntry, sampleFixture, sampleWord } from './render-f130-fixtures.mjs';
export const modeEntry = { ...sampleEntry, status: 0xE5, a: 0xAB06 };
delete modeEntry.y;
// Explicitly synthetic shared mode list/sample directory, never an original
// initialized scene or inferred APU reply. Loader fixtures remain separate.
export function modeFixture({ header = 0x40, entries = [6, 7, 0], directory = 0x908000,
  bank = 0x80, writeWindows = null, ...options } = {}) {
  const owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const data = sampleFixture({ ...options, directory, bank, writeWindows: writeWindows ??
    [[0x7E0089, 0x7E0099], [owner + 0x1CE4, owner + 0x1CE7],
      ...([0x7E, 0x7F].includes(bank) ? [[bank * 65536 + 0x2140, bank * 65536 + 0x2143]] : [])] });
  sampleWord(data, directory, header);
  for (const [n, value] of entries.entries()) data.seed(directory + ((header + n) & 65535) & 0xFFFFFF, [value]);
  return data;
}
