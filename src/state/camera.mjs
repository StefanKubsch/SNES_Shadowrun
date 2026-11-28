// Camera tracking and room-bound workspace over shared named owners.
// Projected coordinates and box-copy bytes retain their compatibility aliases.
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { CAMERA_MAP_FIELDS, cameraMaps } from './camera-maps.mjs';
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { stateField } from './named-fields.mjs';
import { readStateByte, writeStateByte } from './objects.mjs';
import { BYTE_BITS, WORD_BITS } from '../constants/bits.mjs';
const CAMERA_SCRATCH = {
  projectedX: 0x0e,
  projectedY: 0x11,
  boxPointer: 0x3e,
  axisA: 0x41,
  axisB: 0x44,
  doubleY: 0x47,
  clampedLimit: 0x4a,
};
const BOX_COPY = 0x3e,
  BOX_BANK = 0x40,
  BOX_BYTES = 3;
const states = new WeakMap();
export function cameraState(wram) {
  let state = states.get(wram);
  if (state) return state;
  const mem = workspaceMemory(wram),
    descriptors = {};
  for (const name of ['x', 'y', 'speedX', 'speedY'])
    descriptors[name] = stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, name);
  descriptors.player = stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, 'playerObject');
  for (const [name, at] of Object.entries(CAMERA_SCRATCH)) descriptors[name] = scratchWord(mem, at);
  const box = Array.from({ length: BOX_BYTES }, (_, index) =>
    stateField(mem, CAMERA_MAP_FIELDS, cameraMaps, 'box', index),
  );
  descriptors.boxSourceHigh = { get: () => box[1].get() | (box[2].get() << BYTE_BITS) };
  descriptors.boxAddress = {
    get: () => state.boxPointer | (readStateByte(wram, BOX_BANK) << WORD_BITS),
  };
  state = Object.defineProperties(
    {
      copyBoxSource() {
        for (let n = 0; n < BOX_BYTES; n++) writeStateByte(wram, BOX_COPY + n, box[n].get());
      },
    },
    descriptors,
  );
  states.set(wram, state);
  return state;
}
