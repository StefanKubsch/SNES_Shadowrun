// Independent window, text and menu storage for the normal live loop.
// Shared lists keep their status/karma/item/spell aliases. The mask storage span
// ends at the camera row buffers; this describes byte ownership, not a new text limit.
// Direct page workspace, saved topics/flags and frontend layer aliases stay with
// their existing owners. Out-of-span accesses use the shared byte boundary.
import {
  ACTION_MENU_FLAGS,
  ACTION_MENU_HOTKEYS,
  ACTION_MENU_NAMES,
  DIALOG_END,
  DIALOG_HDMA_TABLE,
  DIALOG_RECORD_FLAGS,
  DIALOG_WINDOW,
  GLOVE_NAME_WINDOW,
  ITEM_MENU_ACTORS,
  ITEM_MENU_CLASS,
  ITEM_MENU_COUNTS,
  KARMA_BALANCE_WINDOW,
  LOADED_WINDOW_STYLE,
  MAIN_MENU_WINDOW,
  MEMBER_DATAJACK,
  MEMBER_INDEX,
  MEMBER_MENU_ACTIVE,
  MEMBER_MENU_NAMES,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT,
  MEMBER_PORTRAIT_REDRAW,
  MEMBER_STATE_COUNT,
  MENU_COLUMN,
  MENU_DRAW_ROW,
  MENU_HOTKEYS,
  MENU_NAVIGATION_INPUT,
  MENU_PAGE_START,
  MENU_REPEAT_COUNTER,
  MENU_ROW,
  MENU_ROWS_REMAINING,
  MENU_SELECTION,
  MENU_SHOW_NUMBERS,
  NOTICE_EFFECT_FRAMES,
  NOTICE_FRAMES,
  NOTICE_WINDOWS,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_HDMA_TABLE,
  PORTRAIT_PALETTE_START,
  SPELL_CHOICE_RUNS_SCRIPT,
  SPELL_MENU_SPELL_NAMES,
  SPELL_CHOICE_HEADER,
  TIMER_FRAMES,
  STATUS_ITEMS_AT_ONCE,
  TEXT_BITS_REMAINING,
  TEXT_BIT_BUFFER,
  TEXT_BUFFER,
  TEXT_BUFFER_BYTES,
  TEXT_BUFFER_READBACK,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_VRAM_ADDRESS,
  TEXT_MAP_UPLOAD,
  TEXT_MASK_BUFFER,
  TEXT_TILE_UPLOAD,
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_TILE_UPLOAD_BYTES,
  WINDOW_ACTIVE,
  WINDOW_ATTRIBUTES,
  WINDOW_COLUMNS,
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_LEFT_PIXEL,
  WINDOW_MAP_BUFFER,
  WINDOW_MAP_OFFSET,
  WINDOW_MAP_SOURCE,
  WINDOW_MAP_SOURCE_BANK,
  WINDOW_NEXT_TILE,
  WINDOW_ROWS,
  WINDOW_STYLE,
  WINDOW_TILE_COUNT,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
  WINDOW_WIDTH_PIXELS,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const field = (base, count = 1, bytes = 2) => Object.freeze({ base, count, bytes });
export const WINDOW_TEXT_FIELDS = Object.freeze({
  firstWindow: field(WINDOW_FIRST_INDEX),
  lastWindow: field(WINDOW_LAST_INDEX),
  nextTile: field(WINDOW_NEXT_TILE),
  loadedStyle: field(LOADED_WINDOW_STYLE),
  mapSource: field(WINDOW_MAP_SOURCE),
  mapSourceBank: field(WINDOW_MAP_SOURCE_BANK),
  bitsRemaining: field(TEXT_BITS_REMAINING),
  bitBuffer: field(TEXT_BIT_BUFFER),
  tileUpload: field(TEXT_TILE_UPLOAD),
  mapUpload: field(TEXT_MAP_UPLOAD),
  bufferUpload: field(TEXT_BUFFER_UPLOAD),
  bufferReadback: field(TEXT_BUFFER_READBACK),
  tileAddress: field(TEXT_TILE_UPLOAD_ADDRESS),
  tileBytes: field(TEXT_TILE_UPLOAD_BYTES),
  bufferAddress: field(TEXT_BUFFER_VRAM_ADDRESS),
  bufferBytes: field(TEXT_BUFFER_BYTES),
  noticeEffectFrames: field(NOTICE_EFFECT_FRAMES),
  gloveNameWindow: field(GLOVE_NAME_WINDOW),
  mainWindow: field(MAIN_MENU_WINDOW),
  dialogWindow: field(DIALOG_WINDOW),
  dialogEnd: field(DIALOG_END),
  pageStart: field(MENU_PAGE_START),
  selection: field(MENU_SELECTION),
  column: field(MENU_COLUMN),
  row: field(MENU_ROW),
  drawRow: field(MENU_DRAW_ROW),
  rowsRemaining: field(MENU_ROWS_REMAINING),
  repeatCounter: field(MENU_REPEAT_COUNTER),
  navigationInput: field(MENU_NAVIGATION_INPUT),
  showNumbers: field(MENU_SHOW_NUMBERS),
  hotkeys: field(MENU_HOTKEYS),
  memberPortrait: field(MEMBER_PORTRAIT),
  memberDatajack: field(MEMBER_DATAJACK),
  portraitRedraw: field(MEMBER_PORTRAIT_REDRAW),
  memberNumber: field(MEMBER_NUMBER),
  memberObject: field(MEMBER_OBJECT),
  memberCount: field(MEMBER_STATE_COUNT),
  memberIndex: field(MEMBER_INDEX),
  memberActive: field(MEMBER_MENU_ACTIVE),
  itemsAtOnce: field(STATUS_ITEMS_AT_ONCE),
  itemClass: field(ITEM_MENU_CLASS),
  spellRunsScript: field(SPELL_CHOICE_RUNS_SCRIPT),
  portraitRequest: field(PORTRAIT_DMA_REQUEST),
  portraitPaletteStart: field(PORTRAIT_PALETTE_START),
  dialogFlags: field(DIALOG_RECORD_FLAGS),
  active: field(WINDOW_ACTIVE, 16, 2),
  mapOffsets: field(WINDOW_MAP_OFFSET, 16, 2),
  columns: field(WINDOW_COLUMNS, 16, 2),
  rows: field(WINDOW_ROWS, 16, 2),
  tileStarts: field(WINDOW_TILE_START, 16, 2),
  tileInitial: field(WINDOW_TILE_INITIAL, 16, 2),
  tileCounts: field(WINDOW_TILE_COUNT, 16, 2),
  cursorTiles: field(WINDOW_CURSOR_TILE, 16, 2),
  cursorPixels: field(WINDOW_CURSOR_PIXEL, 16, 2),
  leftPixels: field(WINDOW_LEFT_PIXEL, 16, 2),
  widthPixels: field(WINDOW_WIDTH_PIXELS, 16, 2),
  styles: field(WINDOW_STYLE, 16, 2),
  reserved2160: field(0x2160, 16, 2),
  attributes: field(WINDOW_ATTRIBUTES, 16, 2),
  text: field(TEXT_BUFFER, 0x200, 1),
  map: field(WINDOW_MAP_BUFFER, 0x740 / 2, 2),
  mask: field(TEXT_MASK_BUFFER, 0x200, 1),
  noticeWindows: field(NOTICE_WINDOWS, 4, 2),
  noticeFrames: field(NOTICE_FRAMES, 4, 2),
  listNames: field(MEMBER_MENU_NAMES, (ITEM_MENU_ACTORS - MEMBER_MENU_NAMES) / 2, 2),
  listIndices: field(ITEM_MENU_ACTORS, (ITEM_MENU_COUNTS - ITEM_MENU_ACTORS) / 2, 2),
  listValues: field(ITEM_MENU_COUNTS, (SPELL_MENU_SPELL_NAMES - ITEM_MENU_COUNTS) / 2, 2),
  spellNames: field(SPELL_MENU_SPELL_NAMES, 7, 2),
  portraitHdma: field(PORTRAIT_HDMA_TABLE, 13, 1),
  menuWindows: field(KARMA_BALANCE_WINDOW, 4, 2),
  actionNames: field(ACTION_MENU_NAMES, 12, 2),
  actionHotkeys: field(ACTION_MENU_HOTKEYS, 11, 2),
  actionFlags: field(ACTION_MENU_FLAGS, 8, 2),
  dialogHdma: field(DIALOG_HDMA_TABLE, 16, 1),
  topicChoices: field(0x154, (DIALOG_RECORD_FLAGS - 0x154) / 2),
  spellChoices: field(SPELL_CHOICE_HEADER, (TIMER_FRAMES - SPELL_CHOICE_HEADER) / 2),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes }] of Object.entries(WINDOW_TEXT_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * bytes + byte] = { name, index, shift: byte * BYTE_BITS };

export const windowsText = (wram) => tables.get(wram);
export function detachWindowsText(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes }] of Object.entries(WINDOW_TEXT_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * bytes] | (bytes === 2 ? wram[base + i * bytes + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function windowTextByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setWindowTextByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
