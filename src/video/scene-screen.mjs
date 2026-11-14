// The screen registers of a scene (lifted from 81:EBE9; register-level version in
// src/task/main-scene-video.mjs): BG1 map at VRAM word 0000, BG2 at 0400, BG3 at
// 0800, the character bases and sprite sizes of the scenes, mode 1 with BG3
// priority, and BG1-3 with sprites on the main screen.
import {
  BG12NBA,
  BG1SC,
  BG2SC,
  BG34NBA,
  BG3SC,
  BGMODE,
  OBJSEL,
  TM,
} from '../constants/hardware-registers.mjs';
import {
  BGMODE_BG3_PRIORITY,
  BGMODE_MODE_1,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
} from '../constants/ppu.mjs';

const SCENE_REGISTERS = [
  [BG1SC, 0],
  [BG2SC, 4], // magic-number-ok: BG2 map at VRAM word 0400
  [BG3SC, 8], // magic-number-ok: BG3 map at VRAM word 0800
  [BG12NBA, 0x24], // magic-number-ok: character bases of BG1 (low) and BG2 (high nibble)
  [BG34NBA, 1], // magic-number-ok: character base of BG3
  [OBJSEL, 0x43], // magic-number-ok: sprite sizes and name base of the scenes
  [BGMODE, BGMODE_MODE_1 | BGMODE_BG3_PRIORITY],
  [TM, LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_OBJ],
];

export function setSceneScreen(video) {
  for (const [register, value] of SCENE_REGISTERS) video.write(register, value, 1);
}
