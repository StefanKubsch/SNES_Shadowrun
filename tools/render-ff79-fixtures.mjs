import { ad92Fixture, ad92Entry, ad92Windows, seedWord } from './render-ad92-fixtures.mjs';

export const ff79Entry = { ...ad92Entry, y: 0x1234, waitRead01F8: [0, 0, 0, 0] };
export const ff79Windows = [...ad92Windows, [0x7E0000, 0x7E0001],
  [0x7E0200, 0x7E0247], [0x7F0200, 0x7F0247]];
// Synthetic slots/parameters/counters; only AD92's0740 compressed stream
// and optional AF1F tables are original ROM data. No original dialog/frame.
export function ff79Fixture({ slots = [0, 2, 4, 6], bank = 0x80, first = 0, last = 6,
  flags = [1, 1, 1, 1], positions = [], active = false, counter = 0,
  writeWindows = ff79Windows } = {}) {
  const data = ad92Fixture({ bank, first, last, flags, positions, active, counter, writeWindows });
  slots.forEach((slot, i) => seedWord(data, 0x7E0216 + i * 2, slot));
  seedWord(data, bank * 65536 + 0x202, 0xABCD);
  for (let i = 0; i < 4; i++) seedWord(data, bank * 65536 + 0x21E + i * 2, 0x300 + i);
  return data;
}
