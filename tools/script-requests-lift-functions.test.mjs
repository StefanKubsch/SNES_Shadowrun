// Random per-function tests of the lifted room, scene and main loop requests
// (src/game/script-requests.mjs through their natives in src/task) against their
// register-level references (proof/game-reference/script-requests.mjs): 80:CC97 (room),
// 80:CC33 (scene), 80:D016 (reload) and 80:D9A0 (exit). Both sides run the native from
// its script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  changeRoomReference,
  changeSceneReference,
  requestMainLoopExitReference,
  requestRoomReloadReference,
} from '../proof/game-reference/script-requests.mjs';
import { changeRoom } from '../src/task/native-room-change.mjs';
import { changeScene } from '../src/task/native-scene-change.mjs';
import { requestRoomReload } from '../src/task/native-room-reload.mjs';
import { requestMainLoopExit } from '../src/task/native-main-loop-exit.mjs';

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
const request = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 200,
  reference: (h) => reference(h.a, false),
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
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
    request('changeRoom 80:CC97', 0x80cc97, changeRoomReference, changeRoom),
    request('changeScene 80:CC33', 0x80cc33, changeSceneReference, changeScene),
    request('requestRoomReload 80:D016', 0x80d016, requestRoomReloadReference, requestRoomReload),
    request(
      'requestMainLoopExit 80:D9A0',
      0x80d9a0,
      requestMainLoopExitReference,
      requestMainLoopExit,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
