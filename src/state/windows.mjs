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
