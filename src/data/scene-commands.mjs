// Resolve the original scene_list_commands table (81:EC2F) at the data boundary.
// Edited aliases of established targets retain their meaning; unsupported targets
// keep their address for the caller's existing frontier diagnostic.
import { decodeOnce, tableEntries } from './named-tables.mjs';

export const SCENE_COMMAND_NOOP = 'noop',
  SCENE_COMMAND_CALLBACK = 'callback',
  SCENE_COMMAND_PALETTE = 'palette',
  SCENE_COMMAND_PACKED_VRAM = 'packed-vram',
  SCENE_COMMAND_REGISTER = 'register';

const OPERATIONS = new Map([
  [0x81ec41, SCENE_COMMAND_NOOP],
  [0x81ec42, SCENE_COMMAND_CALLBACK],
  [0x81ec4f, SCENE_COMMAND_PALETTE],
  [0x81ec68, SCENE_COMMAND_PACKED_VRAM],
  [0x81ecb7, SCENE_COMMAND_REGISTER],
  [0x81ecce, SCENE_COMMAND_NOOP],
  [0x81eccf, SCENE_COMMAND_NOOP],
  [0x81ecd0, SCENE_COMMAND_NOOP],
]);
const COMMAND_BANK = 0x810000;

export function sceneListCommands(mem) {
  return decodeOnce(mem, 'scene_list_operations', (image) =>
    tableEntries(image, 'scene_list_commands').map((offset) => {
      const target = COMMAND_BANK | offset;
      return { target, operation: OPERATIONS.get(target) ?? null };
    }),
  );
}
