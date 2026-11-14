// Register-level reference of the outer game owner 80:A139/A157 and the no-countdown
// marker 80:E24E (the lifted owner is src/frontend/game-owner.mjs; the lifted
// attract demo stores the marker's word itself).
import { frontendCallSequence } from '../../src/task/main-frontend-text.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/task/native-call-continuation.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { MAIN_START } from '../../src/task/main-start.mjs';
import {
  GAME_OPTIONS,
  OPTION_MUSIC,
  OPTION_MUSIC_RESTORE,
  SETTINGS_MUSIC,
  TIMER,
} from '../../src/task/wram.mjs';
import {
  GAME_OWNER_ENTRY,
  GAME_OWNER_RESUME,
  GAME_OWNER_RETURN_WORD,
} from '../../src/frontend/game-owner.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';

// E24E is the original menu/game marker, with its ordinary RTS frame: no countdown.
const NO_TIMER = WORD_MASK;
export function runMenuGameMarker(h) {
  h.load(NO_TIMER);
  h.write(h.abs(TIMER), h.ctx.a);
  return h.rts();
}

// One original outer-owner prefix until its actual JSR 9688 at A154. The
// asynchronous main driver keeps that frame through subsequent task rounds.
export function runReferenceGameOwner(h, e, r) {
  return drainNativeSequence(referenceGameOwnerSequence(h, e, r));
}
function* referenceGameOwnerSequence(h, e, r) {
  const { ctx } = h;
  if (
    ctx.programBank !== CODE_BANK ||
    ![GAME_OWNER_ENTRY, GAME_OWNER_RESUME].includes(ctx.pc) ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_owner_entry_required', { pc: ctx.pc });
  const call = (pc, target, long = false) => frontendCallSequence(h, e, r, pc, target, long);
  if (ctx.pc === GAME_OWNER_RESUME) h.load(0);
  h.pha();
  h.load(OPTION_MUSIC | OPTION_MUSIC_RESTORE);
  h.write(h.abs(GAME_OPTIONS), ctx.a);
  h.pla();
  yield* call(0x80a141, 0x80a18c);
  h.dpWrite(0, ctx.a);
  h.load(h.read(SETTINGS_MUSIC));
  h.write(h.abs(GAME_OPTIONS), ctx.a);
  yield* call(0x80a14d, 0x81ef63, true);
  yield* call(0x80a151, 0x80e24e);
  h.a.pushWord(GAME_OWNER_RETURN_WORD);
  ctx.pc = MAIN_START;
  return ctx.pc;
}

export const GAME_OWNER_REFERENCE_ENTRIES = [
  [0x80e24e, runMenuGameMarker],
  [0x80a139, runReferenceGameOwner],
];
NATIVE_CALL_CONTINUATIONS.set(runReferenceGameOwner, {
  run: runReferenceGameOwner,
  create: ({ h, events, routines }) =>
    new NativeCallContinuation(h.a, referenceGameOwnerSequence(h, events, routines)),
});
