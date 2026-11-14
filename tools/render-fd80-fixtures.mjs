import { textEntry, textFixture, textWord, textWindows } from './render-text-compose-fixtures.mjs';

export const numberEntry = { ...textEntry, bank: 0x80, y: 0xBEEF,
  ioRead4214Word: [0], ioRead4216Byte: [5] };
// Synthetic manual input and observed division results; no original scene.
export function numberFixture({ number = 5, writeWindows = textWindows, ...options } = {}) {
  const data = textFixture({ text: [0, 0, 0, 0, 0, 0, 0], width: 64, writeWindows, ...options });
  textWord(data, 2, number); return data;
}
