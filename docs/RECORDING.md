# Session recording

Recording for the user's test run ([STRATEGY.md](STRATEGY.md), point 4): every
browser session can be exported and replayed natively, so a reported fault can
be reproduced and kept as a regression test.

## What is recorded

The live game ([src/video/live-game.mjs](../src/video/live-game.mjs)) is
deterministic for a given start. The recording
([src/browser/recording.mjs](../src/browser/recording.mjs)) therefore holds:

- the seed of the H/V counter substitute (drawn per session in
  [game-worker.mjs](../src/browser/game-worker.mjs)),
- the start SRAM (the save game the page passed in, or none),
- the versioned gameplay settings (`gameplay`: `version`, `bugfixes`,
  `preventExploits`, `fourSaveSlots`, `instantText` and `fluidControls`; [BUGFIXES.md](BUGFIXES.md),
  [SAVING.md](SAVING.md), [INSTANT-TEXT.md](INSTANT-TEXT.md) and [CONTROLS.md](CONTROLS.md)), fixed at session start,
- the raw input of every pad read as a change list `[read, nmi, word, keys,
mouse, buttons, wheel]`, packed like the worker's shared memory. The mouse
  control ([mouse-control.mjs](../src/browser/mouse-control.mjs)) derives its
  WRAM writes (glove position 01D0 to 01D6, offsets 01E0/01E2) from these
  inputs and the game state, so they need no own record,
- page events that write the WRAM themselves as `[read, name]`, applied just
  before that pad read: `debug-room-warp` (the menu entry "Debug room",
  [debug-room.mjs](../src/browser/debug-room.mjs)), `save-slot-N`
  ([SAVING.md](SAVING.md)), `credits`, `language-en`/`language-de` and
  `cheats-N` ([CHEATS.md](CHEATS.md), the four-switch mask, including off).
  Older `debug-room` events unlock the matchbox only. Recordings without
  the field stay valid; cheats remain off without a cheat event,
- an FNV-1a hash of the WRAM every 1000 NMIs, so a replay finds the first
  point where it differs.

The worker feeds every pad read through the recorder before the mouse control.
On the page, **Options → Recording** opens a compact modal overlay.
**Export recording (.json)** asks the worker for the recording and downloads it.
The worker can answer while the overlay pauses gameplay and audio. Closing
restores the previous P pause. The recording format and replay are unchanged.
After a fault (for example `rom_byte_absent` with its address) the session
stops, the worker's game stops with it, and the page asks for the export
before a new start; the stopped worker still answers the request with the
recording up to the fault (tools/gameplay-options-browser.test.mjs).

## Replay

`node tools/replay-recording.mjs <file.json> [--until n]` replays from the
reset on the data package and reports the NMIs reached, the first WRAM check
that differs, the first pad read off the recorded path and a fault of the
native run with its NMI. `replayRecording` in recording.mjs does the same for
tests (option `stop` ends at the first difference).

Replay uses the recorded gameplay settings, independently of browser
preferences. Older recordings without `gameplay` keep the original behaviour
with both corrections and exploit prevention disabled. Unsupported gameplay
versions and non-boolean settings are rejected.

Test: [tools/recording.test.mjs](../tools/recording.test.mjs)
records a session as the worker does (title, new game, a pseudo-random run of
pad words, mouse moves and buttons up to NMI 6200), replays the JSON text to the
same WRAM at every check and at the end, and finds the difference when the
inputs after NMI 5200 are replaced. A debug room warp at the first free pad
read from NMI 5600 is replayed; without it the replay differs at the check at
NMI 6000.
It also replays a cold new game with fixes enabled to the same WRAM and
detects the difference if the original settings are substituted.

## Limits

- A recording starts at the session start; a long session grows by one entry
  per input change (a few bytes each) and one check per 20 s.
- The recording is kept only while the page runs; it is not stored in the
  browser.
- Replaying in Mesen needs the same inputs per frame; the original takes lag
  frames the lag-free live game does not, so a Mesen replay must follow the
  closed live plan rules (tools/live-plan-driver.mjs), not the raw frame list.
