// Named text composition workspace. Byte views preserve neighbouring scratch bytes;
// mask and text buffers retain live overflow aliases through the existing owners.
import { workspaceMemory, scratchWord, scratchByte } from './workspace.mjs';
import { windowState, windowManagerState } from './windows.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
const DRAWING_SCRATCH = {
  initialMask: 0xa2,
  wordState: 0xa5,
  linePixels: 0xa8,
  pendingBytes: 0xab,
  style: 0xae,
  glyphRow: 0xb1,
  glyphBits: 0xb4,
  pixelOffset: 0xb7,
  workWord: 0xba,
  lineWidth: 0xbd,
  linePosition: 0xc0,
  characterIndex: 0xd2,
  windowArgument: 0,
};
const BYTE_SCRATCH = {
  wordStateByte: 0xa5,
  styleByte: 0xae,
  glyphRowByte: 0xb1,
  glyphBitsByte: 0xb4,
  glyphHighByte: 0xb5,
  workLowByte: 0xba,
};
const states = new WeakMap();
export function textDrawingState(wram) {
  let state = states.get(wram);
  if (state) return state;
  const mem = workspaceMemory(wram),
    descriptors = {};
  for (const [name, at] of Object.entries(DRAWING_SCRATCH))
    descriptors[name] = scratchWord(mem, at);
  for (const [name, at] of Object.entries(BYTE_SCRATCH)) descriptors[name] = scratchByte(wram, at);
  for (const [name, field] of Object.entries({
    readbackRequest: 'bufferReadback',
    uploadRequest: 'bufferUpload',
    uploadAddress: 'bufferAddress',
    uploadBytes: 'bufferBytes',
  }))
    descriptors[name] = stateField(mem, WINDOW_TEXT_FIELDS, windowsText, field);
  state = Object.defineProperties(
    {
      buffer: windowManagerState(mem),
      record: (handle) => windowState(mem, handle),
    },
    descriptors,
  );
  const bytes = new Map(),
    byte = (index) => {
      let field = bytes.get(index);
      if (!field) {
        field = stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'mask', index);
        bytes.set(index, field);
      }
      return field;
    };
  state.readMaskByte = (index) => byte(index).get();
  state.writeMaskByte = (index, value) => byte(index).set(value);
  state.readMaskWord = (index) => byte(index).get() | (byte(index + 1).get() << BYTE_BITS);
  state.writeMaskWord = (index, value) => {
    byte(index).set(value);
    byte(index + 1).set(value >>> BYTE_BITS);
  };
  states.set(wram, state);
  return state;
}
