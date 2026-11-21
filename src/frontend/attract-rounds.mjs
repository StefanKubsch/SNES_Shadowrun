// The live attract demo enters its room (AB; A in the original, a parameter here, user
// decision 2026-11-17) and runs its main-loop rounds until return.
import { taskStop } from '../system/task-stop.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { roomStartSequence } from '../game/game-start.mjs';
import { update, endOfFrame } from '../game/frame-loop.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
const MAIN_ROUND = 0x80c1e3 & WORD_MASK;
export function* attractRoundsSequence(h, e, r, room, roomStart) {
  yield* runAttractRounds(h, e, r, room, roomStart);
  h.rts();
}

// Ordinary demo playback and its live scheduler rounds return to their caller.
export function* runAttractRounds(h, e, r, room, roomStart = () => roomStartSequence(h, e, room)) {
  yield* roomStart();
  for (;;) {
    yield* endOfFrame(h, e);
    if (typeof e?.round !== 'function') taskStop('main_round_owner_required', { pc: 0x8096c0 });
    const visit = function* () {
      let more;
      if (typeof e.nestedRound === 'function') {
        const round = e.nestedRound(MAIN_ROUND);
        yield { continuation: round };
        more = round.result;
      } else
        yield () => {
          more = e.round(MAIN_ROUND);
        };
      if (more?.wait?.length) e.values = Object.freeze([...e.values, ...more.wait]);
      if (more?.input?.length) e.inputs = Object.freeze([...e.inputs, ...more.input]);
    };
    if (e.valueRounds) yield* visit();
    else yield* dialogCallBody(h, 0x8096c0, 0x80c1e3, visit);
    if (yield* update(h, e)) break;
  }
}
