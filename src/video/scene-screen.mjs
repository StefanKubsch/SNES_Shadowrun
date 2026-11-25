// The screen layout of a scene (lifted from 81:EBE9; register-level version in
// proof/system/main-scene-video.mjs): BG1 map at VRAM word 0000, BG2 at 0400, BG3 at
// 0800, the character bases and sprite sizes of the scenes, mode 1 with BG3
// priority, and BG1-3 with sprites on the main screen, in the original's order.
import { videoOf } from './video-port.mjs';
import {
  BG_1,
  BG_2,
  BG_3,
  BGMODE_BG3_PRIORITY,
  BGMODE_MODE_1,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
} from '../constants/ppu.mjs';

const BG1_MAP = 0,
  BG2_MAP = 4, // magic-number-ok: BG2 map at VRAM word 0400
  BG3_MAP = 8, // magic-number-ok: BG3 map at VRAM word 0800
  BG12_CHARACTERS = 0x24, // magic-number-ok: character bases of BG1 (low) and BG2 (high nibble)
  BG34_CHARACTERS = 1, // magic-number-ok: character base of BG3
  OBJECT_SELECT = 0x43; // magic-number-ok: sprite sizes and name base of the scenes

export function setSceneScreen(port) {
  const video = videoOf(port);
  video.setMapBase(BG_1, BG1_MAP);
  video.setMapBase(BG_2, BG2_MAP);
  video.setMapBase(BG_3, BG3_MAP);
  video.setCharacterBases(BG_1, BG12_CHARACTERS);
  video.setCharacterBases(BG_3, BG34_CHARACTERS);
  video.setObjectSelectByte(OBJECT_SELECT);
  video.setBgMode(BGMODE_MODE_1 | BGMODE_BG3_PRIORITY);
  video.setMainLayers(LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_OBJ);
}
