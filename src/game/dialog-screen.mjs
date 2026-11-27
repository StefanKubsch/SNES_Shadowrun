// The dialog's screen (docs/READABLE-GAME.md, dialog pilot): the portraits of Jake and the
// partner, the colour effect cleared when a dialog opens, and the screen put back when it
// closes. This module still speaks to the picture back end in the original's terms; the
// next pilot steps turn it into a neutral description (portraits as images, the portrait
// window as an opening rectangle).
import { segmentSequence } from '../system/sequence-runner.mjs';
import { reloadObjectTiles } from './object-tiles.mjs';
import { buildSpritesInPlace } from './sprite-list.mjs';
import { closePortraitWindow } from './portrait-window.mjs';
import {
  unpackPortraitStream,
  shiftPortraitRowsInPlace,
  uploadFirstPortrait,
  uploadSecondPortrait,
} from './portrait-upload.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { videoOf } from '../video/picture-video.mjs';
import { dialogContent } from '../content/dialogs.mjs';
import { romAddress } from '../data/rom-bytes.mjs';
import {
  DP_PORTRAIT_BANK,
  DP_PORTRAIT_POINTER,
  PORTRAIT_BUFFER,
  PORTRAIT_OBJSEL,
  FIXED_COLOUR_BLACK,
} from '../system/native-dialog-portrait.mjs';
import { PALETTE_UPLOAD_LIST_BYTES } from '../data/wram.mjs';
import { writeStateByte } from '../state/objects.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The two font blocks the dialog's close puts back: VRAM word address and source, each
// with the sites of its eight writes.
const fontSites = (address, bytes, source, bank, target, increment, mode, start) =>
  Object.freeze({ address, bytes, source, bank, target, increment, mode, start });
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
const OBJSEL_SITE = 0x809412,
  CLOSE_OBJSEL_SITE = 0x8092cb,
  COLDATA_SITE = 0x81886e,
  CGADSUB_SITE = 0x818871;

const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Clear the colour effect: a black fixed colour and no colour math.
export function clearFixedColourInPlace(h) {
  const video = videoOf(sceneRuntime(h).port);
  video.setFixedColour(FIXED_COLOUR_BLACK, COLDATA_SITE);
  video.setColourMathLayers(0, CGADSUB_SITE);
}

// Load a portrait into the portrait buffer: its record is the one the picture's palette
// upload reads, its packed picture is unpacked and its rows spread apart.
function* loadPortrait(h, portrait) {
  const { mem } = h.a,
    { wram } = mem,
    record = romAddress(dialogContent(mem).portraits[portrait].address);
  let stream;
  yield () => {
    setWord(wram, DP_PORTRAIT_POINTER, record & WORD_MASK);
    writeStateByte(wram, DP_PORTRAIT_BANK, record >>> WORD_BITS);
    stream = [longWord(mem, record), mem.read8((record + 2) & LONG_MASK)];
  };
  yield () => unpackPortraitStream(h, ...stream, PORTRAIT_BUFFER);
  yield () => shiftPortraitRowsInPlace(h);
}

// Show Jake's portrait on the left and the partner's on the right.
export function* showPortraits(h, events, jake, partner) {
  yield () => {
    videoOf(sceneRuntime(h).port).setObjectSelect(PORTRAIT_OBJSEL, OBJSEL_SITE);
    setWord(h.a.mem.wram, PALETTE_UPLOAD_LIST_BYTES, 0);
  };
  yield* loadPortrait(h, jake);
  yield* uploadFirstPortrait(h, events);
  yield* loadPortrait(h, partner);
  yield* uploadSecondPortrait(h, events);
}

// Close the dialog's screen: the portrait window closes, the portraits go, the objects'
// pictures and the font come back, one frame passes, the pad is read and the sprites are
// rebuilt.
export function* closeDialog(h, events) {
  const video = videoOf(sceneRuntime(h).port);
  yield* closePortraitWindow(h, events);
  yield () => video.setObjectSelect(0, CLOSE_OBJSEL_SITE);
  yield* reloadObjectTiles(h, events);
  yield* waitForCounterWord(h, events);
  yield () => {
    for (const [vram, source, sites] of FONT_BLOCKS)
      video.sendToVram(source, FONT_BYTES, vram, sites);
  };
  yield* segmentSequence(() => takePad(h, events));
  yield () => buildSpritesInPlace(h);
}
