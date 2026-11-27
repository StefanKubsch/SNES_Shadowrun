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
6. **Platform boundary** (user, 2026-11-27): game logic and data in `src/` are
   agnostic; the platform layer (renderer, audio player, input) implements the drawing,
   sound output and input for its system. The browser renderer keeps reproducing the
   original picture from tiles and palettes, so the golden pictures stay pixel-identical;
   another system (Amiga) would bring its own platform layer. The SNES presentation
   layer lives in `src/platform/`: the game calls it in neutral terms (show these
   portraits, open the portrait window this far), and it turns them into the original's
   video memory, HDMA tables and register writes. tools/agnostic-counts.mjs counts it
   apart and the ratchet does not limit it.
7. **Audio is sample-identical** (user, 2026-11-27): music and effects become note
   sequences, instruments and samples played by a neutral mixer that reproduces the
   original filters, envelopes, pitch interpolation and echo; the golden audio check
   compares the mixed samples.

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

- None.

## Progress

- 2026-11-27: plan and decisions recorded.
- 2026-11-27, phase 0: the 92 frozen vector tests (14,400 lines) and tools/lift-vectors/
  (1.2 MB) are gone, with 40 register-form modules that only they used; the harness keeps
  the side and outcome helpers. The fast suite has 957 tests, among them the ten golden
  traces. tools/agnostic-counts.mjs measures the remaining references, and
  tools/agnostic-ratchet.test.mjs keeps them from growing: 1,253 ROM address literals,
  158 WRAM layout imports, 27 hardware register imports, 2,416 direct page names and
  2,946 addresses in comments.
- 2026-11-27, phase 1 step 1 (dialog flow): the dialog reads its records from a content
  layer (`src/content/dialogs.mjs`, `src/content/texts.mjs`: portrait, music, mirror,
  entries with key, topics, script and text, the menu and topic names) and keeps its
  state in `src/state/dialog.mjs` (end word, record flags, windows, partner, topics).
  `talk` takes the partner and dialog number as arguments; windows, text and menus go
  through named entries (`openWindowAt`, `releaseWindowAt`, `setWindowTextArea`,
  `printTextIn`, `chooseFromList`). The portrait and screen work sits in
  `src/game/dialog-screen.mjs` for the next steps. The scratch mask gained the direct
  page long pointer 41 to 43 (a local of several routines; traces re-recorded with the
  old code first). Ratchet: 1,248 ROM literals, 157 WRAM imports, 2,326 direct page
  names, 2,888 address comments.
- 2026-11-27, phase 1 step 2 (portraits and portrait window): the presentation layer
  `src/platform/` begins with the portrait tiles (unpack, row shift, VRAM uploads, the
  dialog's `showDialogPortraits`), the portrait window (`beginPortraitWindow`,
  `setPortraitWindowOpening`, `endPortraitWindow`) and the dialog's screen effects
  (`clearColourEffect`, `hidePortraits`, `restoreFont`).
  `src/system/native-dialog-portrait.mjs` is gone. The game side keeps only the window's
  opening (2 to 32 in steps of 3, closing from 31) and the order of the dialog's screen
  steps. Ratchet: 1,212 ROM literals, 153 WRAM imports, 26 hardware imports, 2,319 direct
  page names, 2,850 address comments.
- 2026-11-27, member portrait: the status and spell menus' portrait goes through
  `showMemberPortrait` and the member window of the presentation layer.
- 2026-11-27, phase 2 step 1 (scripts decompiled and running):
  `tools/decompile-scripts.mjs` turns the 937 scripts into generator functions in
  `src/scripts/` (32 files of 32 scripts, about 31,000 lines; `index.mjs` by number,
  `natives.mjs` the native calls by name, `runtime.mjs` the word arithmetic and the
  original's comparison quirks). The operand stack becomes expressions, locals become
  variables (seven scripts that read a local at two widths keep a byte array), local
  subroutines nested functions, and jumps structured code along the dominator tree
  (N. Ramsey, "Beyond Relooper"). All scripts have reducible control flow and no stack
  value across a jump. The scheduler runs the generators (`stepTask` in
  `src/script/tasks.mjs`); the bytecode interpreter moved to
  `tools/script-interpreter.mjs` as the reference. `tools/decompile-scripts.test.mjs`
  runs every script 16 times on both, with arguments, native results and first state
  reads steered by the script's own constants, and compares calls, state writes and
  results (about 85 to 90 percent of the bytecode is reached; long AI loops stay partly
  unvisited); it also checks that `src/scripts/` matches the decompiler. All ten golden
  traces and the slow replays pass unchanged. Dropped frontiers: the interpreter's
  endless-loop guard and the operand stack and local call depth checks (no script
  reaches them). Task identity is the script number (`tasks.script`), not the bytecode
  address. Next: names for locals, arguments and state from what the scripts do; script
  calls by name; `src/script/codec.mjs` and the opcode table leave `src/` with the data
  readers that still decode bytecode.
- 2026-11-27, phase 2 step 2 (decompiler output tidied): expressions carry the variables
  they read and the calls the variables they may change, so a pending value becomes a
  temporary only when the next statement or a call before it could change it (`const t =
  local1` and argument copies are gone; a word stored and tested reads back from the
  local, `x = word(x - 1); if (x === 0)`). Jumps that fall through to where they lead go
  (a break at the end of its block, a continue at the end of its loop, a plain return at
  the end of a subroutine), empty branches go and an empty then turns its condition;
  `truth(a) & truth(b)` becomes `a && b` when b has no call. The natives table lists the
  183 natives some script calls, all by name (the factory-made ones from the names in
  `src/script/native-targets.mjs`). Every state access in the scripts has a name: the
  spell effects 1D6F to 1D72, the circling leader flag and nine bytes of Jake's runner
  record joined `src/data/wram.mjs`. `src/scripts/` shrank from 31,700 to 26,400 lines.
  Next: names for the 87 scripts other scripts call and for arguments and locals.
- 2026-11-27, phase 2 step 3 (names in the scripts): 44 of the 87 scripts that other
  scripts start have names (tools/script-names.mjs: leaveBody, waitUntilDefeated,
  walkToWaypoint, goToRoom, giveWeapon, lockedDoor, usePhone and more); scripts start
  them through the generated table `run` in `src/scripts/started.mjs`
  (`yield* run.leaveBody(object)`), the others keep their number (`run.script045`).
  Constant text numbers, topics and object kinds carry their text as a comment
  (`notice(..., 0x9b /* "This door is locked." */, ...)`, `addTopic(7 /* "Cortex Bomb" */)`,
  `createObject(0x78 /* "Jester Spirit" */, ...)`). Locals passed first to a game
  function on objects are named `object` (the one from the first argument), `created`
  (from createObject) or `object2`; counters that count down are `count`. The remaining
  unnamed scripts are mostly fight behaviours with parameters.
