// Existing map-edge uploads and layer scroll register writes. Drawing order, DMA
// parameters and byte widths are unchanged; neutral presentation is phase 5 work.
import { readStateByte, writeStateByte } from '../state/objects.mjs';
import {
  CAMERA_X,
  CAMERA_Y,
  MAP_COLUMN_BG1,
  MAP_COLUMN_BG2,
  MAP_COLUMN_UPLOAD,
  MAP_COLUMN_VRAM_BG1,
  MAP_COLUMN_VRAM_BG2,
  MAP_LINE_BYTES,
  MAP_ROW_BG1,
  MAP_ROW_BG2,
  MAP_ROW_UPLOAD,
  MAP_ROW_VRAM_BG1,
  MAP_ROW_VRAM_BG2,
} from '../data/wram.mjs';
import { videoOf } from '../video/picture-video.mjs';
import { BG_1, BG_2, VMAINC_INCREMENT_AFTER_HIGH, VMAINC_STEP_32 } from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const MAP_CHANNEL = 3,
  SCROLL_SHIFT = 2;
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
export function uploadMapEdges(wram, video) {
  const v = videoOf(video);
  for (const [pending, bg1, bg2, vram1, vram2, increment] of [
    [
      MAP_COLUMN_UPLOAD,
      MAP_COLUMN_BG1,
      MAP_COLUMN_BG2,
      MAP_COLUMN_VRAM_BG1,
      MAP_COLUMN_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH | VMAINC_STEP_32,
    ],
    [
      MAP_ROW_UPLOAD,
      MAP_ROW_BG1,
      MAP_ROW_BG2,
      MAP_ROW_VRAM_BG1,
      MAP_ROW_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH,
    ],
  ]) {
    if (!word(wram, pending)) continue;
    v.transfer(
      MAP_CHANNEL,
      { to: 'vram', source: bg1, bytes: MAP_LINE_BYTES, address: word(wram, vram1), increment },
      ['source', 'bytes', 'address', 'increment', 'start'],
    );
    v.transfer(
      MAP_CHANNEL,
      { to: 'vram', source: bg2, bytes: MAP_LINE_BYTES, address: word(wram, vram2) },
      ['source', 'bytes', 'address', 'start'],
    );
    setWord(wram, pending, 0);
  }
  // Each scroll offset takes the low byte, then a zero high byte: both horizontal
  // offsets, then both vertical ones.
  for (const [position, vertical] of [
    [CAMERA_X, false],
    [CAMERA_Y, true],
  ]) {
    const scroll = (word(wram, position) >>> SCROLL_SHIFT) & BYTE_MASK;
    for (const layer of [BG_1, BG_2])
      if (vertical) v.setVerticalScroll(layer, scroll);
      else v.setHorizontalScroll(layer, scroll);
  }
}
