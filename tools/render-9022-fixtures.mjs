import { createRenderData } from '../src/render/data.mjs';
export const fields9022Entry = { bank: 0x80, status: 0xC5, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1FFC, 0x1FFF],
  ioMode: 'record-requests', waitMode: 'record-observations', waitRead0140: [0, 0x8001] };
export const fields9022Bytes = [...Array.from({ length: 128 }, (_, n) => 0x7E3F05 - n * 4),
  ...Array.from({ length: 32 }, (_, n) => 0x7E3F08 + n), 0x7E3D0C, 0x7E3D0E, 0x7E3D0F];
export function fields9022Windows(bank = 0x80) {
  const base = (bank === 0x7F ? 0x7F : 0x7E) * 65536;
  return [[base + 0x140, base + 0x143], ...fields9022Bytes.map(a => [a, a]),
    ...([0x7E, 0x7F].includes(bank) ? [[base + 0x2115, base + 0x2115], [base + 0x4300, base + 0x4306]] : [])];
}
// Synthetic writable metadata/field windows only, no original936C scene.
// Missing destination permissions remain explicit, no implicit source bytes.
export function fields9022Fixture({ bank = 0x80, writeWindows = fields9022Windows(bank), initial = null } = {}) {
  const data = createRenderData({ writeWindows });
  if (initial !== null) data.seed((bank === 0x7F ? 0x7F0000 : 0x7E0000) + 0x140,
    [initial & 255, initial >>> 8]);
  return data;
}
