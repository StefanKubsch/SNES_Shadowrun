// The live attract demo enters room AB and runs its main-loop rounds until return.
import { taskStop } from '../system/task-stop.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { roomStartSequence } from '../game/game-start.mjs';
import { MAIN_LOOP_ROUND, MainLoopContinuation } from '../vm/main-loop.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
const MAIN_ROUND = 0x80c1e3 & WORD_MASK;
export function* attractRoundsSequence(
  h,
  e,
  r,
  roomStart = () => roomStartSequence(h, e, h.ctx.a),
) {
  const { ctx } = h;
  const loop = () => ({
    continuation: new MainLoopContinuation(h.a, {
      events: e,
      returnToOwner: true,
    }),
  });
  yield* roomStart();
  yield loop();
  while (ctx.pc === MAIN_LOOP_ROUND) {
    if (typeof e?.round !== 'function') taskStop('main_round_owner_required', { pc: 0x8096c0 });
    yield* dialogCallBody(h, 0x8096c0, 0x80c1e3, function* () {
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
    });
    yield loop();
  }
}
