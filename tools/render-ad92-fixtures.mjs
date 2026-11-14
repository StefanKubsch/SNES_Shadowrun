import { readFile } from 'node:fs/promises';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/render-unpack-data.json', import.meta.url), 'utf8'));
const arithmetic = JSON.parse(await readFile(new URL('../assets/render-af1f-data.json', import.meta.url), 'utf8'));
export const ad92Entry = { bank: 0x80, status: 0xC5, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], waitMode: 'record-observations', waitRead01F8: [0] };
export const ad92Windows = [[0x7E00C3, 0x7E00D3], [0x7E01F8, 0x7E01F9],
  [0x7E23A0, 0x7F2ADF], [0x7F01F8, 0x7F01F9]];
export const seedWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
export const getWord = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
export function ad92Fixture({ bank = 0x80, first = 0, last = 0, flags = [1], counter = 0,
  positions = [], writeWindows = ad92Windows, active = false } = {}) {
  const data = createOriginalRenderData(asset, { writeWindows });
  const base = bank * 65536;
  for (const [address, value] of [[base + 0x1FE, 0xFF40], [base + 0x1F4, 0x81],
    [0x7E1D61, active ? 1 : 0], [base + 0x200, first], [base + 0x204, last], [base + 0x1F8, counter]])
    seedWord(data, address, value);
  if (active) {
    seedOriginalAF1FData(data, arithmetic);
    for (const [address, value] of [[0x7E2DE6, 0], [0x7E3C00, 60], [0x7E33DE, 0]]) seedWord(data, address, value);
  }
  flags.forEach((flag, i) => {
    const x = i * 2; seedWord(data, base + 0x226 + x, flag);
    if (flag) for (const [address, value] of [[0x7E2000 + x, positions[i] ?? 0x200 + i * 0x100],
      [0x7E2020 + x, 4], [0x7E2040 + x, 3], [0x7E2060 + x, 0x2027],
      [0x7E2080 + x, 0x2027], [0x7E20A0 + x, 2], [0x7E2180 + x, 0x800]]) seedWord(data, address, value);
  });
  return data;
}
