// The game NMI jobs for recorded runs: each entry runs the lifted job of
// src/game/game-nmi.mjs with lag-free frames and its register-level reference
// otherwise. The live game binds the lifted handler directly (main-frontend-nmi.mjs).
import { GAME_NMI_LIFTED_ROUTINES } from '../caller/game-nmi-jobs.mjs';
import { GAME_NMI_ROUTINES } from '../system/main-game-nmi.mjs';
import { lagFree } from '../../src/system/main-wait-interrupt.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../../src/system/native-call-continuation.mjs';

// The table entries, bound after the register-level ones in MAIN_SCENE_ROUTINES
// (proof/replay/main-scene.mjs): the lifted jobs with lag-free frames; a recorded run, whose
// accessor replays observed memory and devices, keeps the register-level jobs.
export const GAME_NMI_LIFTED_JOBS = new Map(
  [...GAME_NMI_LIFTED_ROUTINES].map(([target, run]) => {
    const reference = GAME_NMI_ROUTINES.get(target);
    return [
      target,
      (h, events, routines) => (lagFree(events) ? run(h) : reference(h, events, routines)),
    ];
  }),
);
// The handler's register-level reference pauses at its joypad wait in recorded runs, so
// that continuation is kept for them; with lag-free frames the lifted handler runs whole.
const HANDLER = 0x80c152;
NATIVE_CALL_CONTINUATIONS.set(GAME_NMI_LIFTED_JOBS.get(HANDLER), {
  run: GAME_NMI_LIFTED_JOBS.get(HANDLER),
  create: (call) =>
    lagFree(call.events) ? null : NATIVE_CALL_CONTINUATIONS.get(HANDLER).create(call),
});
