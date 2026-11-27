// Random per-function tests of the lifted room, scene and main loop requests
// (src/game/script-requests.mjs through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their
// former register-level references (proof/game-reference/script-requests.mjs): 80:CC97 (room),
// 80:CC33 (scene), 80:D016 (reload), 80:D9A0 (exit), 80:CDCF (dialog end) and 80:DE7E
// (player control reset). Both sides run the native from
// its script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { changeRoom as changeRoomLifted } from '../src/script/native-room-change.mjs';
import { changeScene as changeSceneLifted } from '../src/script/native-scene-change.mjs';
import { requestRoomReload as requestRoomReloadLifted } from '../src/script/native-room-reload.mjs';
import { requestMainLoopExit as requestMainLoopExitLifted } from '../src/script/native-main-loop-exit.mjs';
import { endDialog as endDialogLifted } from '../src/script/native-dialog-end.mjs';
import { resetPlayerControl as resetPlayerControlLifted } from '../src/script/native-player-control-reset.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const changeRoom = leafRts(changeRoomLifted);
const changeScene = leafRts(changeSceneLifted);
const requestRoomReload = leafRts(requestRoomReloadLifted);
const requestMainLoopExit = leafRts(requestMainLoopExitLifted);
const endDialog = leafRts(endDialogLifted);
const resetPlayerControl = leafRts(resetPlayerControlLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const request = (name, entry, run) => ({
  name,
  entry,
  samples: 200,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    request('changeRoom 80:CC97', 0x80cc97, changeRoom),
    request('changeScene 80:CC33', 0x80cc33, changeScene),
    request('requestRoomReload 80:D016', 0x80d016, requestRoomReload),
    request('requestMainLoopExit 80:D9A0', 0x80d9a0, requestMainLoopExit),
    request('endDialog 80:CDCF', 0x80cdcf, endDialog),
    request('resetPlayerControl 80:DE7E', 0x80de7e, resetPlayerControl),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
