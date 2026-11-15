// Only the independently proved native contracts actually reached by the
// connected boot test. No leaf admission and no arbitrary SPECIAL_NATIVES dispatch.
import { showNoticeObserved } from '../proof/replay/native-notice.mjs';
import { playSoundEffect } from '../src/system/native-audio-compose.mjs';
import { redrawWindowListObserved } from '../proof/replay/native-window-list-redraw.mjs';
import { controlPlayerObserved } from '../proof/replay/native-player-control.mjs';
import { runTaskActionsObserved } from '../proof/replay/native-actions.mjs';
import { randomBelow, randomByte } from '../src/system/native-random.mjs';
import { talkWithObjectObserved } from '../proof/replay/native-dialog.mjs';
import { appendToFightListReference as appendToFightList } from '../proof/game-reference/fight-list-append.mjs';
import { chooseEnemyTarget } from '../proof/game-reference/enemy-target-choice.mjs';
import {
  shootAtObjectObserved,
  shootAtGloveTargetObserved,
} from '../proof/replay/native-object-shoot.mjs';
import { removeFromFightListObserved } from '../proof/replay/native-fight-list-remove.mjs';

export const BOOT_NATIVE_CONTRACTS = new Map([
  [
    0x80fec1,
    { id: 0xc8, metadata: 0x0007, result: false, run: (a, o) => showNoticeObserved(a, o, false) },
  ],
  [
    0x80c46e,
    {
      id: 0x4c,
      metadata: 0x0104,
      result: false,
      run: (a) => playSoundEffect(a, { calls: [] }, false),
    },
  ],
  [
    0x80cda8,
    {
      id: 0xc2,
      metadata: 0x0100,
      result: true,
      run: (a, o) => redrawWindowListObserved(a, o, false),
    },
  ],
  [
    0x80e014,
    { id: 0xd0, metadata: 0x0200, result: true, run: (a, o) => controlPlayerObserved(a, o, false) },
  ],
  [
    0x809ba0,
    {
      id: 0x13,
      metadata: 0x0201,
      result: true,
      run: (a, o) => runTaskActionsObserved(a, o, 0x809ba0, false),
    },
  ],
  [0x80c560, { id: 0x63, metadata: 0x0100, result: true, run: (a) => randomByte(a, false) }],
  [
    0x80936c,
    {
      id: 0x95,
      metadata: 0x0202,
      result: false,
      run: (a, o) => talkWithObjectObserved(a, o, false),
    },
  ],
  [0x80c51f, { id: 0x3e, metadata: 0x0201, result: true, run: (a) => randomBelow(a, false) }],
  [
    0x808521,
    { id: 0xac, metadata: 0x0101, result: false, run: (a) => appendToFightList(a, false) },
  ],
  [0x808bc5, { id: 0x07, metadata: 0x0101, result: true, run: (a) => chooseEnemyTarget(a, false) }],
  [
    0x808ab5,
    { id: 0x10, metadata: 0x0006, result: true, run: (a, o) => shootAtObjectObserved(a, o, false) },
  ],
  [
    0x808a51,
    {
      id: 0x58,
      metadata: 0x0000,
      result: true,
      run: (a, o) => shootAtGloveTargetObserved(a, o, false),
    },
  ],
  [
    0x80855e,
    {
      id: 0xc0,
      metadata: 0x0001,
      result: false,
      run: (a, o) => removeFromFightListObserved(a, o, false),
    },
  ],
]);
