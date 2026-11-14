import { textEntry, textFixture, textWord, textWindows } from './render-text-compose-fixtures.mjs';
import { renderAddress } from '../src/render/data.mjs';

export const listWindows = [...textWindows, [0x7E1D95, 0x7E1DA6]];
export const listEntry = { ...textEntry, bank: 0x80, y: 2, ioRead4216: Array(100).fill(0),
  ioRead4214: Array(100).fill(0), ioRead4214Word: Array(100).fill(0), ioRead4216Byte: Array(100).fill(5),
  waitRead01FA: Array(100).fill(0), waitRead01FC: Array(100).fill(0) };
// Explicit synthetic list/menu/dictionary/font bytes only, no original scene.
export function listFixture({ bank = 0x80, tokens = [0x10, 0], numbers = [], count = 1,
  row = 1, column = 1, scroll = 0, numberFlag = 0, pointer = 0x7E1800,
  numberPointer = 0x1900, index = 2, width = 64, height = 8, writeWindows = listWindows } = {}) {
  const data = textFixture({ width, index, writeWindows }), base = bank * 65536;
  textWord(data, 6, count); textWord(data, 8, pointer & 65535); data.seed(10, [pointer >>> 16]);
  textWord(data, 12, numberPointer);
  for (const [address, value] of [[0x1D95, scroll], [0x1D99, column], [0x1D9B, row], [0x1DA5, numberFlag]])
    if (renderAddress(base + address) !== null) textWord(data, base + address, value);
  textWord(data, 0x7E2040 + index, height);
  for (const [i, token] of tokens.entries()) textWord(data, pointer + i * 2 & 0xFFFFFF, token);
  for (const [i, number] of numbers.entries()) textWord(data, base + numberPointer + i * 2 & 0xFFFFFF, number);
  for (const token of [0x7074, 0x7077, 0x707A, 0x707D]) data.seed(0x9D0000 + (token | 0x8000), [0x40, 0]);
  return data;
}
