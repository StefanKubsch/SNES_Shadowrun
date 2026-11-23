# Portrait composition

Phase 4 of [STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md) composes the
portrait subsystem without internal CPU call frames. The existing packed
streams, row shifts, palette and HDMA fields, hardware writes and lag-free
frame model retain their contracts.

## Direct graph

- `uploadFirstPortrait` and `uploadSecondPortrait` compose
  `transferPortraitTiles` directly. The six DMA channel setup writes precede
  the request word. The transfer polls until that word becomes negative;
  an already negative destination performs no wait. Palette, HDMA and OAM
  updates remain ordered around the transfer as before.
- `openPortraitWindow` and `closePortraitWindow` compose the counter wait
  directly for all eleven edge steps. They preserve the caller's CPU
  context and stack across every budget pause.
- `memberPortrait` composes unpacking, row separation, both tile transfers
  and its eleven colour-window steps directly. The second channel still
  increments the NMI job count with word wrapping.
- `talk` uses the direct unpacker for both portraits. Instruction-level
  startup recordings alone retain the unpack call frame and their installed
  recorded routine. Other dialog waits and object tile reload are separate
  callers with their existing contracts.

`uploadPortraitTiles` remains the outer RTS adapter used by existing
register-level callers and frozen reference modules. It delegates the work
to `transferPortraitTiles` and consumes only the supplied caller frame.
The retained `unpackPortrait` entry likewise serves recorded comparisons.
No frozen proof module or golden trace is extended or rewritten.

## Verification

[portrait-flow.test.mjs](../tools/portrait-flow.test.mjs) checks all six
direct operations at every single-step boundary. CPU call/return helpers
fail if accessed; the actual caller stack and full register context remain
unchanged. Cases cover zero budgets, repeated completion, multi-poll DMA
completion, job-count wrap, failure propagation and rejection of failed
replay, already negative destinations and one pause per actual frame.

The existing portrait, member and dialog caller comparisons retain their
full game-state, tile, palette, window, input and hardware-write checks
against the independent former callers. All five golden traces remain
binding for the shared game paths. These tests add no new hardware timing
assumption or coverage of unrecorded story routes.
