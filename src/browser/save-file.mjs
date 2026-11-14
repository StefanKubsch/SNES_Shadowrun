// Save game in the browser: the cartridge SRAM (8 KiB per the header,
// docs/ROM-ANALYSIS.md). The game writes it itself ("Save game" at a bed,
// two slots); the page keeps it permanently in localStorage and exchanges it as
// an .srm file (raw 8 KiB as in Mesen and other emulators). With the four-slot
// option the SRAM has 16 KiB (src/game/save-slots.mjs): the first 8 KiB stay
// under SAVE_KEY as before, slots 3/4 under SAVE_EXTRA_KEY, and the .srm file
// then has 16 KiB.
import { SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS } from '../vm/memory.mjs';
import { fnv1a } from '../data/fnv.mjs';
export const SAVE_KEY = 'shadowrun.sram.1',
  SAVE_EXTRA_KEY = 'shadowrun.sram.extra.1';
export function importSave(bytes) {
  if (!(bytes instanceof Uint8Array) || ![SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS].includes(bytes.length))
    throw Error(
      `A Shadowrun save game (.srm) has ${SRAM_SIZE} bytes (${SRAM_SIZE_FOUR_SLOTS} with four slots).`,
    );
  return Uint8Array.from(bytes);
}
// The stored save from both texts; a missing or damaged extra part is ignored.
export function storedSave(text, extraText) {
  const save = saveFromText(text);
  if (!save || save.length !== SRAM_SIZE) return null;
  const extra = saveFromText(extraText);
  if (!extra || extra.length !== SRAM_SIZE) return save;
  const both = new Uint8Array(SRAM_SIZE_FOUR_SLOTS);
  both.set(save);
  both.set(extra, SRAM_SIZE);
  return both;
}
// A save reported by the game: an 8 KiB SRAM (original slots) keeps the
// stored slots 3/4 of an earlier 16 KiB save.
export function mergeSave(previous, bytes) {
  if (bytes.length === SRAM_SIZE && previous?.length === SRAM_SIZE_FOUR_SLOTS) {
    const both = previous.slice();
    both.set(bytes);
    return both;
  }
  return bytes;
}
// Base64 of a byte array, in slices so that large arrays stay below the
// argument limit of String.fromCharCode (also used by recording.mjs).
const BASE64_SLICE = 0x8000;
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += BASE64_SLICE)
    s += String.fromCharCode(...bytes.subarray(i, i + BASE64_SLICE));
  return btoa(s);
}
export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const saveToText = toBase64;
export function saveFromText(text) {
  if (!text) return null;
  try {
    return importSave(fromBase64(text));
  } catch {
    return null;
  }
}
// FNV-1a over the bytes (check value on the page for tests).
export const saveHash = fnv1a;
// Called per picture: a changed SRAM counts as saved once it stayed
// unchanged for a whole picture, so that no half-written slot reaches
// the browser. check() then returns a copy, otherwise null.
export class SaveWatch {
  constructor(sram) {
    this.sram = sram;
    this.saved = sram.slice();
    this.pending = null;
  }
  check() {
    const { sram } = this;
    if (same(sram, this.saved)) {
      this.pending = null;
      return null;
    }
    if (!this.pending || !same(sram, this.pending)) {
      this.pending = sram.slice();
      return null;
    }
    this.saved = this.pending;
    this.pending = null;
    return this.saved.slice();
  }
}
function same(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
