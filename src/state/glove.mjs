// Shared glove movement, targeting and name-window state over the existing owners.
// Search scratch and draw-list access remain explicit compatibility bridges.
import { ACTION_OVERRIDE_ROW } from './action-menu.mjs';
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { noticeState } from './notices.mjs';
import { FRONTEND_FIELDS, frontendState } from './frontend.mjs';
import { workspaceMemory, scratchWord } from './workspace.mjs';
import { cameraState } from './camera.mjs';
import { windowManagerState } from './windows.mjs';
import { textDecodingState } from './text-decoding.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { DRAW_LIST, DRAW_LIST_INDEX } from '../data/wram.mjs';
const SEARCH_SCRATCH = {
  screenX: 0x0e,
  screenY: 0x11,
  objectX: 0x14,
  objectY: 0x17,
  kindIndex: 0x1a,
};
const INTERACTION_SCRATCH = { result: 0, actionScratch: 0x6b };
const PLACE_SCRATCH = { pixelX: 0xa8, halfPixelX: 0xa2, pixelY: 0xa5 };
const LOW_MIRROR_END = 0x2000;
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
const states = new WeakMap();
export function gloveState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const raw = workspaceMemory(mem.wram);
  const field = (name) => stateField(mem, COMBAT_FIELDS, combatState, name);
  state = Object.defineProperties(
    {
      camera: cameraState(mem.wram),
      notices: noticeState(mem),
      place: Object.defineProperties(
        {},
        Object.fromEntries(
          Object.entries(PLACE_SCRATCH).map(([name, at]) => [name, scratchWord(raw, at)]),
        ),
      ),
      windows: windowManagerState(mem),
      decoding: textDecodingState(mem.wram),
      search: Object.defineProperties(
        {},
        Object.fromEntries(
          Object.entries(SEARCH_SCRATCH).map(([name, at]) => [name, scratchWord(raw, at)]),
        ),
      ),
      drawObject(offset) {
        if (DRAW_LIST + offset + 1 >= LOW_MIRROR_END)
          taskStop('draw_list_required', { index: offset });
        return raw.read16Bank0(DRAW_LIST + offset);
      },
    },
    {
      ...Object.fromEntries(
        Object.entries(INTERACTION_SCRATCH).map(([name, at]) => [name, scratchWord(raw, at)]),
      ),
      player: stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, 'playerObject'),
      memberMenuActive: stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'memberActive'),
      dialogWindow: stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'dialogWindow'),
      actionOverride: stateField(
        mem,
        WINDOW_TEXT_FIELDS,
        windowsText,
        'actionFlags',
        ACTION_OVERRIDE_ROW,
      ),
      aimingWeapon: field('aimingWeapon'),
      spellTarget: field('spellTarget'),
      kind: field('gloveKind'),
      x: field('gloveX'),
      y: field('gloveY'),
      speedX: field('gloveSpeedX'),
      speedY: field('gloveSpeedY'),
      snapX: field('gloveSnapX'),
      snapY: field('gloveSnapY'),
      baseX: field('gloveBaseX'),
      baseY: field('gloveBaseY'),
      limitKind: field('gloveLimitKind'),
      aimingSpell: field('aimingSpell'),
      scriptChoice: field('scriptGloveChoice'),
      held: stateField(mem, FRONTEND_FIELDS, frontendState, 'padHeld'),
      pressed: stateField(mem, FRONTEND_FIELDS, frontendState, 'padPressed'),
      drawIndex: scratchWord(raw, DRAW_LIST_INDEX),
      targetTag: field('gloveTarget'),
      targetObject: field('gloveObject'),
      nameWindow: stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'gloveNameWindow'),
    },
  );
  states.set(mem, state);
  return state;
}
