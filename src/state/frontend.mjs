// Shared frontend input/display state and script-controlled scene motion.
// Intro/title/cutscene objects, fonts, maps, HDMA and random bytes already alias
// independent object/camera/window/scene owners; they must not be copied again.
// The shared script bytes keep their original values without inferred meanings.
import * as W from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const field = (base, count = 1, bytes = 2, stride = bytes) =>
  Object.freeze({ base, count, bytes, stride });
export const FRONTEND_FIELDS = Object.freeze({
  padHeld: field(W.PAD_HELD),
  padPrevious: field(W.PAD_PREVIOUS),
  padPressed: field(W.PAD_PRESSED),
  brightness: field(W.INIDISP_SHADOW),
  mainLayers: field(W.TM_SHADOW),
  subLayers: field(W.TS_SHADOW),
  windowLayers: field(W.TMW_SHADOW),
  hdmaChannels: field(W.HDMAEN_SHADOW),
  fade: field(W.BRIGHTNESS_FADE),
  fadeFrames: field(W.BRIGHTNESS_FADE_FRAMES),
  options: field(W.GAME_OPTIONS),
  randomState: field(W.RANDOM_STATE),
  randomByte: field(W.RANDOM_BYTE, 1, 1),
  scriptedMotion: field(W.MAIN_MENU_WINDOW + 2, (W.PLAYER_IDLE - W.MAIN_MENU_WINDOW - 2) / 2),
  sharedScriptBytes: field(
    W.SCRIPT_GLOVE_CHOICE + 2,
    W.SPELL_CHOICE_HEADER - W.SCRIPT_GLOVE_CHOICE - 2,
    1,
  ),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes, stride }] of Object.entries(FRONTEND_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * stride + byte] = { name, index, shift: byte * BYTE_BITS };
export const frontendState = (wram) => tables.get(wram);
export function detachFrontend(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes, stride }] of Object.entries(FRONTEND_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * stride] | (bytes === 2 ? wram[base + i * stride + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function frontendByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setFrontendByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
