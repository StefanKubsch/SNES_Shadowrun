// The dialog's screen effects on the SNES picture (presentation layer,
// docs/READABLE-GAME.md; lifted from 81:886A and the dialog close 80:92C5).
//
// Clearing the colour effect sets a black fixed colour (COLDATA red, green and blue
// planes at 0) and no colour math layers (CGADSUB). Hiding the portraits sets the sprite
// sizes and name base back (OBJSEL 0). Restoring the font sends the two font blocks
// 8D:FB78 and 8D:FD78 (40 bytes each) to VRAM words 0000 and 0100, where the portraits
// lay.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { videoOf } from '../video/picture-video.mjs';

const fontSites = (address, bytes, source, bank, target, increment, mode, start) =>
  Object.freeze({ address, bytes, source, bank, target, increment, mode, start });
// The font blocks: VRAM word address, source and the sites of their eight writes.
const FONT_BLOCKS = Object.freeze([
    [
      0,
      0x8dfb78,
      fontSites(0x8092d8, 0x8092de, 0x8092e4, 0x8092eb, 0x8092f0, 0x8092f5, 0x8092fa, 0x8092ff),
    ],
    [
      0x100,
      0x8dfd78,
      fontSites(0x809307, 0x80930d, 0x809313, 0x80931a, 0x80931f, 0x809324, 0x809329, 0x80932e),
    ],
  ]),
  FONT_BYTES = 0x40;
const FIXED_COLOUR_BLACK = 0xe0,
  COLDATA_SITE = 0x81886e,
  CGADSUB_SITE = 0x818871,
  OBJSEL_SITE = 0x8092cb;

const video = (h) => videoOf(sceneRuntime(h).port);

// Clear the colour effect: a black fixed colour and no colour math.
export function clearColourEffect(h) {
  video(h).setFixedColour(FIXED_COLOUR_BLACK, COLDATA_SITE);
  video(h).setColourMathLayers(0, CGADSUB_SITE);
}

// Take the portraits' sprite setting back.
export function hidePortraits(h) {
  video(h).setObjectSelect(0, OBJSEL_SITE);
}

// Put the font back where the portraits lay.
export function restoreFont(h) {
  for (const [vram, source, sites] of FONT_BLOCKS)
    video(h).sendToVram(source, FONT_BYTES, vram, sites);
}
