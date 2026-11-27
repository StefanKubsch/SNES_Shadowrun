# Readable, system-agnostic game

User decisions of 2026-11-27. This plan follows the state model rebuild
([STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md)) and the removal of the register-level
code ([REGISTER-COMPAT-BOUNDARY.md](REGISTER-COMPAT-BOUNDARY.md)).

## Goal

The product code (`src/`) knows nothing about the SNES: no WRAM or ROM addresses, no
banks, direct page words or data bank, no hardware registers and no SNES concepts such
as DMA, HDMA channels, OBJSEL or VRAM word addresses. All game data and content are
readable records, tables and arrays, addressed by name or index. The code is plain game
logic that a person can follow and that ports to simpler systems (for example Amiga or
C).

Knowledge of the original layout stays in `tools/` only: the extractors that turn the
ROM into assets, and the projection that maps the game state back to the original
layout for the golden traces.

## Starting point (measured 2026-11-27)

- 453 modules, 55,220 lines in `src/`.
- 1,253 ROM address literals in code (comments excluded) in 127 files; the largest are
  the lookup tables, the native target tables (146 entries each), line of sight and the
  game NMI.
- 158 files import the 707 WRAM address constants of `src/data/wram.mjs`; 389
  direct page constants (`DP_…`).
- 27 files use hardware registers.
- The content is decoded in `assets/` (60 files: rooms, objects, kinds, texts,
  palettes, pictures, portraits, sound, …), but `src/data/cartridge.mjs` writes it back
  into a ROM address image, and the code reads it through addresses.
- The 937 scripts run as bytecode on an interpreter; natives are found by their ROM
  entry address.

## Decisions (2026-11-27)

1. **Reference: golden traces only.** The golden traces (tools/golden/) stay binding
   through a projection in `tools/` that maps the new state to the original layout. The
   frozen lift and caller vectors (tools/lift-vectors/) and the register forms that serve
   them are given up; paths the traces do not reach are no longer compared.
2. **Save files stay `.srm`-compatible**, through one serializer between named fields
   and the file's bytes. No other code knows the save format.
3. **The scripts are decompiled now** into readable code; the bytecode interpreter,
   task frames and native tables by address go.
4. **Pilot: the dialog** with portraits and windows, as the pattern for every later
   subsystem.
5. **No references to WRAM, ROM or hardware** in `src/` (user, 2026-11-27).

## Golden traces during the rebuild

- Binding: the picture (rendered pixels), the game state through the projection, and
  the save data.
- The video memory hash becomes diagnostic once the presentation no longer has video
  memory (phase 5); the audio hash stays binding until the audio phase decides its
  replacement (see open decisions).
- Pokes of the test plans (WRAM writes) go through the projection's named fields.
- A deliberate difference is recorded in [BUGFIXES.md](BUGFIXES.md) and the trace is
  recorded again in the same block, with the reason in the commit.

A ratchet test counts the remaining address literals, WRAM constant imports, `DP_`
names and hardware register imports in `src/`; the counts may only fall.

## Phases

0. **Clear the old references.** Delete the frozen vector tests, tools/lift-vectors/,
   the register forms and the harnesses only they use. Add the ratchet test.
1. **Pilot: dialog.** The dialog records, portraits and topics as readable data; the
   dialog state (current record, portraits, windows, topic list) as a state object; the
   portrait window and its opening animation as a neutral presentation element (a
   rectangle that opens and closes) instead of HDMA tables and window registers. The
   module `src/system/native-dialog-portrait.mjs` disappears.
2. **Scripts.** A decompiler in `tools/` turns the 937 scripts into readable code with
   named variables and calls of named game functions; the interpreter, opcodes, task
   frames and native tables go. The scheduler runs the decompiled scripts as
   coroutines.
3. **Game state.** The remaining WRAM state moves into named state modules (objects,
   party and runners, rooms and camera, windows and text, combat, matrix, front end,
   timers and flags). The save serializer maps the saved fields to the `.srm` format.
4. **Data.** The code reads the decoded records directly (rooms, objects, kinds,
   actions, pictures, palettes, texts, tables); the cartridge address image goes.
5. **Presentation.** The frame description uses neutral terms: tile layers, sprites,
   palettes, screen rectangles (windows), fades and colour effects. SNES modes, VRAM
   addresses and register writes go.
6. **Input.** Pad bits become named buttons.
7. **Audio.** See the open decision.

Each phase is split into subsystem blocks with `npm run test:block` and the golden
traces; release and push as in [WORKFLOW.md](WORKFLOW.md).

## Open decisions

- **Audio.** Music and sound effects run today on an emulation of the SNES sound
  processor and its driver (SPC700, DSP). A system-agnostic form means note sequences,
  instruments and samples played by a neutral mixer. Whether the sound must stay
  sample-identical (then the mixer reproduces the DSP's filters, envelopes and echo) or
  only sound the same decides how the golden audio hash is replaced.

## Progress

- 2026-11-27: plan and decisions recorded.
- 2026-11-27, phase 0: the 92 frozen vector tests (14,400 lines) and tools/lift-vectors/
  (1.2 MB) are gone, with 40 register-form modules that only they used; the harness keeps
  the side and outcome helpers. The fast suite has 957 tests, among them the ten golden
  traces. tools/agnostic-counts.mjs measures the remaining references, and
  tools/agnostic-ratchet.test.mjs keeps them from growing: 1,253 ROM address literals,
  158 WRAM layout imports, 27 hardware register imports, 2,416 direct page names and
  2,946 addresses in comments.
