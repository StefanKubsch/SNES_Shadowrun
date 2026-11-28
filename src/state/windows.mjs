import * as W from '../data/wram.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
// Named window records over the independent window owner. Handles remain opaque;
// the schema bridge preserves unaligned and out-of-span compatibility accesses.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
const games = new WeakMap();
export function windowState(mem, handle) {
  let windows = games.get(mem);
  if (!windows) games.set(mem, (windows = new Map()));
  let window = windows.get(handle);
  if (window) return window;
  const fields = {
    active: 'active',
    mapOffset: 'mapOffsets',
    columns: 'columns',
    rows: 'rows',
    firstTile: 'tileStarts',
    initialTile: 'tileInitial',
    tileCount: 'tileCounts',
    cursorTile: 'cursorTiles',
    cursorPixel: 'cursorPixels',
    leftPixel: 'leftPixels',
    widthPixels: 'widthPixels',
    style: 'styles',
    attributes: 'attributes',
    unidentified: 'reserved2160',
  };
  window = Object.defineProperties(
    { handle },
    Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [
        name,
        stateField(mem, WINDOW_TEXT_FIELDS, windowsText, field, handle / 2),
      ]),
    ),
  );
  windows.set(handle, window);
  return window;
}

const managers = new WeakMap();
export function windowManagerState(mem) {
  let state = managers.get(mem);
  if (state) return state;
  const field = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    raw = (at) => ({
      get: () => mem.read16Bank0(at),
      set(value) {
        mem.write16Bank0(at, value);
      },
    }),
    fields = {
      firstIndex: 'firstWindow',
      lastIndex: 'lastWindow',
      nextTile: 'nextTile',
      loadedStyle: 'loadedStyle',
      tileUploadAddress: 'tileAddress',
      tileUploadBytes: 'tileBytes',
      tileUploadRequest: 'tileUpload',
      mapUploadRequest: 'mapUpload',
    };
  state = Object.defineProperties(
    {
      opening: Object.defineProperties(
        {},
        {
          left: raw(0),
          top: raw(2),
          columns: raw(W.DP_WINDOW_COLUMNS),
          rows: raw(W.DP_WINDOW_ROWS),
          attributes: raw(W.DP_WINDOW_ATTRIBUTES),
        },
      ),
    },
    Object.fromEntries(Object.entries(fields).map(([name, owner]) => [name, field(owner)])),
  );
  Object.defineProperties(state, {
    windowArgument: raw(0),
    valueArgument: raw(2),
    cursorRowArgument: raw(W.DP_CURSOR_ROW),
  });
  const bytes = new Map(),
    byte = (index) => {
      let access = bytes.get(index);
      if (!access) {
        access = field('text', index);
        bytes.set(index, access);
      }
      return access;
    };
  state.readTextByte = (index) => byte(index).get();
  state.writeTextByte = (index, value) => byte(index).set(value);
  state.writeTextWord = (index, value) => {
    byte(index).set(value);
    byte(index + 1).set(value >>> BYTE_BITS);
  };
  managers.set(mem, state);
  return state;
}
