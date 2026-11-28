// Named camera edge buffers and scrolling workspace over the existing map owner.
// Offsets retain byte units until the map/presentation representation is migrated.
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { cameraState } from './camera.mjs';
import { CAMERA_MAP_FIELDS, cameraMaps } from './camera-maps.mjs';
import { stateField } from './named-fields.mjs';
const SCROLL_SCRATCH = {
  column: 0x0e,
  oldColumn: 0x11,
  row: 0x14,
  oldRow: 0x17,
  rowOffset: 0x1a,
  columnOffset: 0x1d,
  columnEnd: 0x20,
};
const states = new WeakMap();
export function cameraScrollingState(wram) {
  let state = states.get(wram);
  if (state) return state;
  const mem = workspaceMemory(wram),
    descriptors = {};
  for (const [name, at] of Object.entries(SCROLL_SCRATCH)) descriptors[name] = scratchWord(mem, at);
  const buffers = new Map();
  const cell = (name, offset) => {
    let cells = buffers.get(name);
    if (!cells) buffers.set(name, (cells = new Map()));
    let field = cells.get(offset);
    if (!field) {
      field = stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, name, offset / 2);
      cells.set(offset, field);
    }
    return field;
  };
  const edge = (prefix) =>
    Object.defineProperties(
      {
        writeHigh: (offset, value) => cell(prefix + 'Bg1', offset).set(value),
        writeLow: (offset, value) => cell(prefix + 'Bg2', offset).set(value),
      },
      {
        pending: stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, prefix + 'Pending'),
        addressHigh: stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, prefix + 'VramBg1'),
        addressLow: stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, prefix + 'VramBg2'),
      },
    );
  state = Object.defineProperties(
    {
      camera: cameraState(wram),
      columnEdge: edge('column'),
      rowEdge: edge('row'),
      readHigh: (offset) => cell('layerHigh', offset).get(),
      readLow: (offset) => cell('layerLow', offset).get(),
    },
    descriptors,
  );
  states.set(wram, state);
  return state;
}
