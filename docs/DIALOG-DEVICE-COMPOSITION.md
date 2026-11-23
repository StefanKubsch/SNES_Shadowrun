# Dialog device composition

This phase 4 block composes object tile restoration and dialog device waits
directly after [PORTRAIT-COMPOSITION.md](PORTRAIT-COMPOSITION.md). It changes
control flow, preserving the established object, animation, upload and input
equations. No hardware interpretation or frozen proof code changes.

## Object tiles

[object-tiles.mjs](../src/game/object-tiles.mjs) traverses the draw list in
the original reverse order. Each object queues its current picture again,
or steps a pending picture change until the animation accepts it. A pending
change increments the job count and composes `waitForCounterWord` directly;
there is no nested JSL frame, return PC or temporary program bank.

The upload-list-full and final job-list waits retain their original branch
conditions. They reload the job count on every poll. Upload indices, job
counts and tile pointers keep word wrapping, including the original case
where adding a picture's jobs carries past FFFF and bypasses the full-list
comparison. Two source/bank/address records per tile are still queued.

## Dialog callers

[dialog-talk.mjs](../src/game/dialog-talk.mjs) composes all sixty-one greeting
counter waits directly. Closing composes the portrait close, OBJSEL reset,
object tile restoration and final counter wait without CPU call frames.
The two font DMA setups retain their writes and order, followed by pad
refresh and sprite rebuilding. The optional outer native RTS remains an
adapter; menu selection and topic task append retain separate compatibility
boundaries. Instruction-level portrait unpack recordings retain their adapter.

## Verification

[dialog-device-flow.test.mjs](../tools/dialog-device-flow.test.mjs) checks
tile reload and complete dialog close at every single-step boundary, with
CPU call/return helpers made unusable. It covers zero budgets, empty tile
sets, ordinary and full uploads, index/job wrapping, a picture change blocked
on free slots, repeated completion and failure/replay rejection at all three
wait branches. Two actual talk-prefix cases compose both portraits, opening
and the full greeting, or fail at its first wait, before menu entry.

Existing dialog and status callers retain complete state, input, portrait,
tile, font and device-write comparisons against the independent former
orchestration. All five golden traces remain unchanged. Serviced fixture
uploads establish caller ordering, not new hardware timing evidence.
