# Goal and verifiable work steps

> Historical plan: the notes below describe earlier project stages, not the
> current delivery status. Start with HANDOFF.md for the latest
> delivery and next step, and [STRATEGY.md](STRATEGY.md) for current priorities
> and decisions. Translated from the former German `PORTIERUNGSPLAN.md`
> (original wording at git commit 20c7b6c9).

A standalone browser runtime reconstructs the European original. It contains
no SNES CPU, PPU or SPC700 emulator and no hidden ROM interpreter. Original
game scripts may be interpreted as game events: their documented game language
is part of the own engine.

Equality means original graphics data, palettes, animations, scenes, dialogs,
values, events, combat and Matrix logic, music and sounds. That is the project
goal. Full or bit-exact equality has not been proven yet; browser audio output
and display must be compared separately. European speed is the reference.

## 1. ROM identity and entry points — finished

Result: checked file identity, header, bank overview, reset code, interrupt
entries and first script tables. Local analysis repeatable, tests present. No
playable browser version in this step.

## 2. Game script language — started

Finished at the time of writing:

- 69 valid opcode formats and 29 fault handler entries determined; all 937
  static script graphs decoded; for 930 scripts the reached bytecode is
  gap-free and re-encodable byte-exactly; seven scripts have unreachable areas;
  34 operations run in JavaScript including locals, jumps and local
  subroutines; script `$197` checked for all 16-bit inputs; an own asset
  package holds the scripts without the full ROM
  ([SCRIPT-LANGUAGE.md](SCRIPT-LANGUAGE.md)).
- Script calls/returns within a cooperative call chain and the European wait
  function `$9F` for non-zero masks; original script `$04B` reaches its proven
  sound call `$4C` after five readiness checks and stops there. The outer task
  order for independent roots and their chains (append at the tail, immediate
  start, backward sweep, kept cursor); two `$04B` instances reach the audio
  limit in the derived order. An NMI counter compare before the repeated main
  loop pass is proven; no universal duration per wait check or finished browser
  timing follows ([SCHEDULER.md](SCHEDULER.md)).
- The synchronous mask-zero wait flow: remove current frames, discard their
  continuation and resume parents by the child profile in the same visit; the
  shared return word zero is proven by the immediately preceding argument write
  (no arbitrary start value, no faked root `END`).
- Native word state actions `$03/$12/$57/$9B` and `$56`, `$B9` with `$80:AA4C`,
  the `$A9` paths, original heap `$C242–C2C7` with header size calculation,
  frame initialisation `$C2F8–C349` with task slot allocation, the running heap
  binding, task creation by `$A9`, the `$AC` data paths, `$CF` and the `$D9`
  arithmetic: see [task-system.md](reference/task-system.md). Original script
  prefix `$060` writes real proven data and stops at `$B9` (it ends on
  explicitly supplied slot test data); `$10A/$10B` write their data, wait once
  and end regularly after one readiness check.
- Slot actions `$02`, `$4F/$50/$51`, `$6A`, `$83`, `$D2`, `$D9`, helper
  `$A985`, the target data provider from an explicit `$9D` and the slot motion
  body: see [slots.md](reference/slots.md). `$105` reaches the child wait in
  `$101` on A9/original data; with explicit field fixtures `$252` reaches its
  real positive A9 and creates `$217`.
- Motion helpers 8133, 8238, 82BC, 81B4, 80B2, C9E0, native `$88`, Gate 8000,
  A4BF, BCB2/BE5B/FA3E with AD92, the prelude writers, DE94 atomically with
  AFC4, AFC4 and AC2F: see [movement.md](reference/movement.md).
- Render routines with source contracts and native atomic plans (A9B2 with
  unpacker, AF1F, AD92 with ACB5/ACAF/ACCF, A9E1, AA9C, AB2C, 8949, 999A, 80C4,
  A919, A958, A98E, 8FBA, 9E0B, C06B, B0D1, C152 with all eleven callees,
  9E1A/F007 with the restart limit (full restart 80:E382 then open), the
  input flow, 8877, 8076, BE6D/BCBE,
  AF04/FADD/FB2A, FA67/ACBD, F963, text helpers, FE69/FB39, FEC1, FAAC,
  FD80, A617/A5DB/A5F9, C416, C46E for all WORD sound values with a non-zero
  channel, F03A, F122/F1E8, F130): see
  [render-routines.md](reference/render-routines.md).

Open at that time: the AC call path, full timing, state accesses, complex
arithmetic, native game actions and the general workspace; the audio call `$4C`
is traced to the APU ports, sound data and an own sequencer/mixer are open.

Acceptance: a bounded original script can be decoded and re-encoded without
loss. Its native JavaScript execution gives, for defined inputs, the state
changes derived from the original code. Unknown opcodes are neither skipped nor
reported as successful. European script IDs get semantic names only after
checking.

## 3. Graphics and first scene

Reconstruct compression routines, asset pointers, tile formats, palettes,
sprite build, animation data, room data and drawing order. Extractors read the
local original file and create browser assets with source addresses and
hashes.

Acceptance: the original title display and then the morgue are drawn
correctly with the proven assets. Room sizes, layers, character positions,
palettes and animations are checked against reference pictures. Unlabelled raw
tile previews do not count as finished graphics extraction.

## 4. Texts and interface

Reconstruct text compression, character set, font, control characters, line
breaks, text windows, cursor, menus and keyword dialogs.

Acceptance: selected original dialogs including formatting can be extracted
losslessly and shown with the original font. All European texts are then
opened up with proven pointer limits.

## 5. First playable section

Implement input, movement, hotspots, inventory, object states, dialogs, room
changes and saving for the morgue and the adjacent start area. The original
scripts drive events through the own game actions.

Acceptance: a fixed route from game start to leaving the start area matches
the original in dialogs, inventory, flags and positions. Only then does this
section count as ported.

## 6. Audio without hardware emulation

Reconstruct the sound driver, music sequences, instrument tables, samples and
effects. Decode sample compression and implement a sequencer/mixer in Web
Audio or an AudioWorklet. Loop points, envelopes, pitches, tempo, echo and
filters need their own evidence.

Acceptance: selected pieces of music and effects run completely at the correct
tempo and match reference recordings and proven sequence events. Audio files
from game recordings alone do not replace an interactive, state-dependent
sound implementation.

## 7. Complete game

Finish room groups one by one; then bring together combat, magic, companions,
traders, Matrix, quests, end sequences and all save states. Reconstruct the
original random number routine and call order so reproducible runs are
comparable.

Acceptance: documented playthrough routes, optional events and edge cases run
with the expected states, displays and audio events. A complete 1:1 port is
finished only after this check.

The original program is the behaviour source. Hardware debugging or reference
recordings can support the analysis later but never become a dependency of the
shipped browser runtime. (At the time of writing no emulator had been
installed or run; Mesen2 later became the test oracle, see
[MESEN-ORACLE.md](MESEN-ORACLE.md).)
