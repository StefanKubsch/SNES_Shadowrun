// The frame waits (lifted from 81:EEBB and 81:B0A1; register-level versions in
// src/task/main-scene-wait.mjs and src/task/native-frame-wait.mjs). 81:EEBB: with
// the NMI enabled in the NMITIMEN shadow, wait until the NMI has changed the frame
// counter byte 7E:1C76; otherwise poll HVBJOY until the vertical blank ends. 81:B0A1
// waits for a change of the counter word.
//
// The NMI comes from the lag-free frame model (src/vm/frame-events.mjs), which
// delivers it only at a blocking loop branch of the original. For the delivery
// the wait presents the state the original has there: the branch 81:EED1 back to
// the counter compare, with the accumulator in 8-bit mode and the compare equal.
// The NMI handler pushes and restores that state; afterwards the caller's
// context is put back. Only the interrupt delivery sees this state.
import { InterruptStepContinuation, lagFree } from '../task/main-wait-interrupt.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../task/native-wait-continuation.mjs';
import { NMITIMEN_SHADOW, RANDOM_STATE } from '../task/wram.mjs';
import { HVBJOY, HVBJOY_VBLANK, NMITIMEN_NMI_ENABLE } from '../constants/hardware-registers.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

// Original instructions: the vertical blank poll (a site of the device model) and
// the branch where the NMI arrives.
const VBLANK_SITE = 0x81eec2,
  WAIT_BRANCH = 0x81eed1,
  // After CMP equal in 8-bit mode: Z and C set, N clear.
  WAIT_FLAGS = FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_CARRY;
// 81:B0A1 compares the whole counter word in 16-bit mode; its branch back to the
// compare.
const COUNTER_BRANCH = 0x81b0a9,
  COUNTER_FLAGS = FLAG_ZERO | FLAG_CARRY;

// A pause of the running native call after a frame: the live step that ran the
// frame ends there, as it ends within the polling loop of the original wait (whose
// instructions use up the step budget). Without it one step would run hundreds of
// lifted frames. The next step goes on after the pause.
class FramePause {
  work = 0;
  result = undefined;
  paused = false;
  get done() {
    return this.paused;
  }
  run() {
    if (this.paused) return WAIT_RETURNED;
    this.paused = true;
    return WAIT_PAUSED;
  }
}

// One pass of the lag-free frame model at the blocking branch of an original wait
// loop, with the status the original has there: an NMI, or with the NMI disabled at a
// wait for the sound driver, audio time (src/vm/frame-events.mjs). The caller's
// context is put back after it; after an NMI the native call pauses.
export function* nmiAtBranch(h, events, branch, status) {
  const { ctx } = h,
    saved = { programBank: ctx.programBank, pc: ctx.pc, status: ctx.status },
    nmis = lagFree(events)?.nmis;
  ctx.status = status;
  yield { continuation: new InterruptStepContinuation(h, events, branch) };
  yield () => Object.assign(ctx, saved);
  if (lagFree(events)?.nmis !== nmis) yield { continuation: new FramePause() };
}

// A sequence (yield* waitForFrame(...)) for a native call continuation. h is the
// accessor of the running scene, events its frame events, port its hardware port.
export function* waitForFrame(h, events, port) {
  const { ctx } = h,
    { wram } = h.a.mem;
  if (!(wram[NMITIMEN_SHADOW] & NMITIMEN_NMI_ENABLE)) {
    while (port.read(HVBJOY, 1, VBLANK_SITE) & HVBJOY_VBLANK);
    return;
  }
  const counter = wram[RANDOM_STATE];
  while (wram[RANDOM_STATE] === counter)
    yield* nmiAtBranch(h, events, WAIT_BRANCH, (ctx.status | WAIT_FLAGS) & ~FLAG_NEGATIVE);
}

// The word wait (81:B0A1), a sequence like waitForFrame: wait until the NMI has
// changed the frame counter word 7E:1C76, whatever the NMITIMEN shadow says. The
// accumulator holds the counter, as the original's LDA leaves it; the NMI arrives at
// the branch with the compare equal in 16-bit mode.
export function* waitForCounterWord(h, events) {
  const { ctx } = h,
    { wram } = h.a.mem,
    counter = () => wram[RANDOM_STATE] | (wram[RANDOM_STATE + 1] << BYTE_BITS);
  let start;
  yield () => {
    start = counter();
    ctx.a = start;
  };
  while (counter() === start)
    yield* nmiAtBranch(
      h,
      events,
      COUNTER_BRANCH,
      (ctx.status | COUNTER_FLAGS) & ~(FLAG_NEGATIVE | FLAG_MEMORY_8BIT),
    );
}
