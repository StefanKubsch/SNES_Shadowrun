import { heldFixture, heldEntry, heldWord } from './render-be6d-fixtures.mjs';

export const noticeEntry = { ...heldEntry, waitRead01F8: [0, 0, 0] };
// Explicit synthetic manual notice; original0740 stream only for AD92's
// conversion. Table/text/slot initialization is not an original scene.
export function noticeFixture({ occupied = [], lifetimes = [60, 60, 60, 60], bank = 0x80,
  cursor = 30, writeWindows } = {}) {
  const data = heldFixture({ bank, cursor, ...(writeWindows ? { writeWindows } : {}) }), base = bank * 65536;
  for (const [address, value] of [[0, 2], [2, 2], [4, 10], [6, 8], [8, 0], [10, 0], [12, 60]]) heldWord(data, address, value);
  heldWord(data, base + 0xD9B8, 0x10);
  for (let index = 0; index < 4; index++) {
    heldWord(data, 0x7E0216 + index * 2, occupied[index] ?? 65535);
    heldWord(data, base + 0x21E + index * 2, lifetimes[index]);
  }
  for (let index = 0; index <= 30; index += 2) heldWord(data, base + 0x226 + index, 0);
  return data;
}
