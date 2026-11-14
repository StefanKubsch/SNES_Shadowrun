import { createRenderData } from '../src/render/data.mjs';

// Explicit synthetic data only. These generous test windows are not runtime
// ownership declarations or inferred original scene initialization.
export const textWindows = [[0x7E0000, 0x7E00D3], [0x7E01FA, 0x7E0211],
  [0x7E2000, 0x7F2AFF]];
export const textEntry = { bank: 0x7E, status: 0xC5, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4214: [0, 1],
  ioRead4216: [0, 0], waitMode: 'record-observations', waitRead01FA: [0], waitRead01FC: [0] };
// $01FC-Warten in $FB39: die acht Wörter, die der NMI per DMA aus dem VRAM nach $2AE0 liest. Standard ist der
// vorbelegte Pufferinhalt, damit der Altvergleich ohne NMI-Modell gleich bleibt.
export const textMaskWords = (value = 0xAAAA) => Array.from({ length: 8 },
  (_, n) => ({ pc: 0x81ACC9, address: 0x7E2AE0 + 2 * n, width: 2, value: Array.isArray(value) ? value[n] : value }));
export const textWord = (data, address, n) => data.seed(address, [n & 255, n >>> 8]);
export function textFixture({ text = [65, 0, 0], index = 2, style = 0, offset = 0,
  width = 10, glyphWidth = 4, cursor = 0x20, sourceOffset = 0x10, writeWindows = textWindows,
  omit = null } = {}) {
  const data = createRenderData({ writeWindows });
  const seed = (address, bytes) => {
    for (const [i, byte] of bytes.entries()) if (address + i !== omit) data.seed(address + i, [byte]);
  };
  const word = (address, n) => seed(address, [n & 255, n >>> 8]);
  word(0, index); word(2, sourceOffset);
  for (const [address, n] of [[0x2020, width], [0x2040, 8], [0x2060, cursor],
    [0x2080, 0x100], [0x20C0, cursor], [0x20E0, offset], [0x2100, 0], [0x2140, style]])
    word(0x7E0000 + address + index, n);
  word(0x7E01FA, 0); word(0x7E01FC, 0); word(0x7E0208, 0);
  seed(0x7E2AE0, Array(256).fill(0xAA)); seed(0x7E21A0, text);
  seed(0x81AC0C, Array(128).fill(glyphWidth)); seed(0x81AC8D, Array(128).fill(0));
  for (let character = 0; character < 128; character++) seed(0x95F2D0 + character * 8, [15, 1, 2, 4, 8, 16, 32, 64]);
  word(0x9D8000, 0xC100); word(0x9D8002, 0x8A00);
  seed((sourceOffset & 0x8000 ? 0x9E0000 : 0x9D0000) + (sourceOffset | 0x8000), [0x40, 0]);
  return data;
}
