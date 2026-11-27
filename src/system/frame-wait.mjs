import { readStateByte } from '../state/objects.mjs';
// The frame waits (lifted from 81:EEBB and 81:B0A1; register-level versions in
// proof/system/main-scene-wait.mjs and proof/system/native-frame-wait.mjs). 81:EEBB: with
// the NMI enabled in the NMITIMEN shadow, wait until the NMI has changed the frame
// counter byte 7E:1C76; otherwise poll HVBJOY until the vertical blank ends. 81:B0A1
// waits for a change of the counter word.
//
// The NMI comes from the lag-free frame model (src/vm/frame-events.mjs), which
// delivers it only at a blocking loop branch of the original. The normal game
// dispatches frame jobs directly with the branch condition and carry as values.
// Recorded comparisons retain the original interrupt context: branch 81:EED1,
// an equal byte compare, and the handler's push/restore before returning here.
import { lagFree } from '../vm/frame-events.mjs';
import { registerCompat } from './register-compat.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from './native-wait-continuation.mjs';
import { NMITIMEN_SHADOW, RANDOM_STATE } from '../data/wram.mjs';
import { HVBJOY, HVBJOY_VBLANK, NMITIMEN_NMI_ENABLE } from '../constants/hardware-registers.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
import { waitStatus } from './wait-status.mjs';

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
// loop: frame jobs, or audio time at a sound wait with the NMI disabled. Normal
// live execution does not change the caller's CPU context. The compatibility
// path below restores its temporary interrupt context. A frame pauses the call.
export function* nmiAtBranch(h, events, branch, status) {
  const frames = lagFree(events);
  if (frames && events.frameJobs) {
    const nmis = frames.nmis;
    yield () => {
      if (frames.textWait?.(h, events, status, branch)) return;
      const samples = frames.audioSamples;
      if (!frames.nmiAt(status, branch)) {
        if (frames.audioSamples !== samples) h.a.resetAccessBudget?.(h.a.entry);
        return;
      }
      h.a.resetAccessBudget?.(h.a.entry);
      frames.enterNmi();
      try {
        events.frameJobs(h.a, status & FLAG_CARRY ? 1 : 0);
      } finally {
        frames.leaveNmi();
      }
    };
    if (frames.nmis !== nmis) yield { continuation: new FramePause() };
    return;
  }
  const nmis = lagFree(events)?.nmis;
  yield* registerCompat('interruptAtBranch')(h, events, branch, status);
  if (lagFree(events)?.nmis !== nmis) yield { continuation: new FramePause() };
}

// A sequence (yield* waitForFrame(...)) for a native call continuation. h is the
// accessor of the running scene, events its frame events, port its hardware port.
export function* waitForFrame(h, events, port) {
  const { wram } = h.a.mem;
  if (!(readStateByte(wram, NMITIMEN_SHADOW) & NMITIMEN_NMI_ENABLE)) {
    while (port.read(HVBJOY, 1, VBLANK_SITE) & HVBJOY_VBLANK);
    return;
  }
  const counter = readStateByte(wram, RANDOM_STATE);
  while (readStateByte(wram, RANDOM_STATE) === counter)
    yield* nmiAtBranch(h, events, WAIT_BRANCH, waitStatus(h, events, FLAG_NEGATIVE, WAIT_FLAGS));
}

// The word wait (81:B0A1), a sequence like waitForFrame: wait until the NMI has
// changed the frame counter word 7E:1C76, whatever the NMITIMEN shadow says. The NMI
// arrives at the branch with the compare equal in 16-bit mode. Lifted callers read no
// registers (user decision 2026-11-17); the register form with the counter in A is in
// tools/register-forms/input-routines.mjs.
export function* waitForCounterWord(h, events) {
  const { wram } = h.a.mem,
    counter = () =>
      readStateByte(wram, RANDOM_STATE) | (readStateByte(wram, RANDOM_STATE + 1) << BYTE_BITS);
  let start;
  yield () => {
    start = counter();
  };
  while (counter() === start)
    yield* nmiAtBranch(
      h,
      events,
      COUNTER_BRANCH,
      waitStatus(h, events, FLAG_NEGATIVE | FLAG_MEMORY_8BIT, COUNTER_FLAGS),
    );
}
