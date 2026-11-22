// Keep the most recent unobstructed game picture in the current room. The
// worker samples before markers and transfers; no game or device state changes.
import { readStateByte } from '../state/objects.mjs';
import { ROOM, WINDOW_LAST_INDEX, GLOVE_KIND } from '../data/wram.mjs';
import { BYTE_BITS, WORD_SIGN } from '../constants/bits.mjs';
import { SCREEN_WIDTH, SCREEN_HEIGHT, RGBA_BYTES } from '../constants/ppu.mjs';
import { saveAnywhereReachable } from '../game/save-anywhere.mjs';
import { roomHeader, ROOM_ENTRIES } from '../data/rooms.mjs';

const PREVIEW_SCALE = 2;
// The bed briefly enters another room before restoring the saved room. Retain
// both recent views by room header. Multiple entrance entries share one header.
const CACHED_ROOMS = 2;
export const PREVIEW_WIDTH = SCREEN_WIDTH / PREVIEW_SCALE,
  PREVIEW_HEIGHT = SCREEN_HEIGHT / PREVIEW_SCALE;
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
export const previewRoomKeys = (read8) =>
  Array.from({ length: ROOM_ENTRIES }, (_, entry) => roomHeader(read8, entry));

export class SavePreview {
  constructor(roomKeys = null) {
    this.room = null;
    this.rooms = new Map();
    this.roomKeys = roomKeys;
  }

  key(room) {
    return this.roomKeys ? (this.roomKeys[room] ?? null) : room;
  }

  observe(game, pixels) {
    const wram = game.memory.wram,
      room = word(wram, ROOM),
      key = this.key(room);
    this.room = room;
    // Window release leaves a negative last index when no windows remain.
    // Keep the earlier room view throughout bed menus and dialogs.
    if (
      key === null ||
      !saveAnywhereReachable(game) ||
      !(word(wram, WINDOW_LAST_INDEX) & WORD_SIGN) ||
      word(wram, GLOVE_KIND)
    )
      return;
    let sample = this.rooms.get(key);
    if (!sample) sample = new Uint8ClampedArray(PREVIEW_WIDTH * PREVIEW_HEIGHT * RGBA_BYTES);
    this.rooms.delete(key);
    this.rooms.set(key, sample);
    if (this.rooms.size > CACHED_ROOMS) this.rooms.delete(this.rooms.keys().next().value);
    for (let y = 0; y < PREVIEW_HEIGHT; y++)
      for (let x = 0; x < PREVIEW_WIDTH; x++) {
        const from = (y * PREVIEW_SCALE * SCREEN_WIDTH + x * PREVIEW_SCALE) * RGBA_BYTES,
          to = (y * PREVIEW_WIDTH + x) * RGBA_BYTES;
        for (let channel = 0; channel < RGBA_BYTES; channel++)
          sample[to + channel] = pixels[from + channel];
      }
  }

  take(room = this.room) {
    const sample = this.rooms.get(this.key(room));
    return sample ? { room, pixels: sample.slice() } : null;
  }
}

// Called only on save notifications, outside the frame rendering path.
export function encodeSavePreview(preview, document) {
  if (
    !preview ||
    !(preview.pixels instanceof Uint8ClampedArray) ||
    preview.pixels.length !== PREVIEW_WIDTH * PREVIEW_HEIGHT * RGBA_BYTES
  )
    return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    canvas
      .getContext('2d')
      .putImageData(new ImageData(preview.pixels, PREVIEW_WIDTH, PREVIEW_HEIGHT), 0, 0);
    return { room: preview.room, image: canvas.toDataURL('image/png') };
  } catch {
    return null;
  }
}
