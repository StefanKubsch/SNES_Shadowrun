import { readFile } from 'node:fs/promises';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { textFixture } from './render-text-compose-fixtures.mjs';

const original = JSON.parse(await readFile(new URL('../assets/render-unpack-data.json', import.meta.url), 'utf8'));
export const heldEntry = { bank: 0x80, status: 0xC5, x: 0xBEEF, y: 0x1234,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF],
  ioMode: 'record-requests', ioRead2134: [1], ioRead4214: [0, 1], ioRead4216: [0, 0],
  waitMode: 'record-observations', waitRead01F6: [0], waitRead01F8: [0, 0],
  waitRead01FA: [0], waitRead01FC: [0] };
export const heldWindows = [[0x7E0000, 0x7E01E9], [0x7E01F4, 0x7E0247],
  [0x7E2000, 0x7F2AFF], [0x7F01CA, 0x7F0247]];
export const heldWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
export const heldGet = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
export function heldFixture({ bank = 0x80, gate = 1, input = 0, type = 1,
  currentType = 0xFFFF, currentSlot = 2, oldIndex = 2, cursor = 0, head = 0,
  slot = 2, action = false, fallback = false, tracked = false, wrap = false,
  positionX = 0x1000, positionY = 0x1000, velocityX = 0, velocityY = 0,
  writeWindows = heldWindows } = {}) {
  const data = createRenderData({ writeWindows }), base = bank * 65536;
  if (wrap) cursor = 0x1E;
  for (const [address, value] of textFixture().snapshot().bytes) data.seed(address, [value]);
  data.seed(original.table.address, original.table.bytes);
  for (const source of original.sources) data.seed(source.address, source.bytes);
  for (const [address, value] of [[base + 0x1CA, input], [base + 0x1D8, gate],
    [base + 0x1D0, velocityX], [base + 0x1D2, velocityY],
    [base + 0x1D4, positionX], [base + 0x1D6, positionY],
    [base + 0x1DA, tracked ? type : currentType], [base + 0x1DE, currentSlot], [base + 0x1DC, oldIndex],
    [base + 0x1E0, 0], [base + 0x1E2, 16], [base + 0x1E4, 64], [base + 0x1E6, 128],
    [base + 0x14B0, head], [base + 0x14B2 + (head & 0x7FFF), slot],
    [base + 0x1090 + slot, 1], [0x7E3F28 + slot, type],
    [base + 0xF30 + slot, 0], [base + 0xED8 + slot, 0], [base + 0xCC6, 0],
    [base + 0xE80 + slot, 0], [base + 0xE28 + slot, 0], [base + 0xCC4, 0],
    [0x7E4240 + slot, 0], [0x7E42F0 + slot, 0], [0x7E43A0 + slot, 0],
    [0x7E4298 + slot, 80], [0x7E4348 + slot, 0],
    [0x8CEFB0 + ((type * 6 + (type >>> 14 & 1)) & 65535), 0x10],
    [base + 0x1458 + slot, action ? 3 : 0], [base + 0x150A + slot, fallback ? 0x9999 : 0x10C],
    [base + 0x204, cursor], [base + 0x200, 0], [base + 0x212, 0x2027],
    [base + 0x226, 0], [base + 0x228, 0], [0x7E2060, 0x2027],
    [base + 0x1F6, 0], [base + 0x1F8, 0], [base + 0x1FE, 0xFF40], [base + 0x1F4, 0x81], [0x7E1D61, 0]])
    if (renderAddress(address) !== null && renderAddress(address + 1) !== null) heldWord(data, address, value);
  for (let i = 0; i < 13; i++) { heldWord(data, 0x809700 + i * 2, 0x100 + i); heldWord(data, 0x809782 + i * 2, 0x10); }
  heldWord(data, 0x819780, 0x10);
  if (wrap) for (const x of [27, 65]) for (const [offset, value] of
    [[0x2020, x === 27 ? 2 : 3], [0x2040, 3], [0x2060, 32], [0x2080, 256],
      [0x20C0, 32], [0x20E0, 0], [0x2100, 0], [0x2140, 0]]) heldWord(data, 0x7E0000 + offset + x, value);
  return data;
}
