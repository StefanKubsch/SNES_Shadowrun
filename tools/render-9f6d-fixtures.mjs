import { createRenderData } from '../src/render/data.mjs';

export const unpack9F6DEntry = { a: 0x9000, x: 0x5250, y: 0x3A80, bank: 0x80, status: 0xC5,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
// Independent synthetic token encoder; does not call native algorithms.
export const lengthBits9F6D = n => [...n.toString(2).slice(1)].flatMap(c => [0, Number(c)]).concat(1);
export const fixedBits9F6D = (value, width) => Array.from({ length: width }, (_, i) => value >>> (width - i - 1) & 1);
export function stream9F6D(header, payload, bits) {
  const result = [header & 255, header >>> 8, payload.length + 2 & 255, (payload.length + 2 & 65535) >>> 8, ...payload];
  const padded = bits.concat(Array((16 - bits.length % 16) % 16).fill(0));
  for (let i = 0; i < padded.length; i += 8) result.push(padded.slice(i, i + 8).reduce((n, bit) => n * 2 + bit, 0));
  return result;
}
// Explicit synthetic headers, literals, bits and writable windows. This is
// not original936C input, initialized5250 state or a scene/device/frame run.
export function unpack9F6DFixture({ header = 1, payload = [0xA7], bits = [1],
  sourceAddress = 0x809000, writeWindows = [[0x7F0000, 0x7FFFFF]], table = true } = {}) {
  const data = createRenderData({ writeWindows });
  data.seed(sourceAddress, stream9F6D(header, payload, bits));
  if (table) data.seed(0x80A033, Array.from({ length: 256 }, (_, n) => n ? n.toString(2).length : 0));
  return data;
}
