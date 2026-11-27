# Register compatibility boundary

Phase 4 of the state model rebuild ([STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md))
removes CPU registers, stack frames and interrupt records from live control flow.
Live play already passes game services only and never touches the accessor's CPU
context ([LIVE-LOOP-SERVICES.md](LIVE-LOOP-SERVICES.md)). This step also removes the
register-level modules from the live import graph.

## Audit of the remaining src register adapters (2026-11-24)

| Module                                  | Register content                                              | Live use before this step                                                                  |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| src/system/nmi-call.mjs                 | observed native NMI with its hardware frame and RTI           | none; loaded through main-wait-interrupt                                                   |
| src/system/main-wait-interrupt.mjs      | interrupt records, RTI checks, the recorded frame-wait branch | only `lagFree`, a frame-model query                                                        |
| src/system/native-call-continuation.mjs | register snapshot guard, JSR/JSL frames (`dialogCallBody`)    | only the neutral helpers `segmentSequence`, `drainNativeSequence` and the continuation map |
| src/system/native-dialog-support.mjs    | register helpers `dialogAccess`                               | none; reached only on recorded branches                                                    |

All four are imported by frozen proof modules (5 to 98 proof importers each), so
they keep their paths: moving them would edit frozen proof code.

## Boundary

- The neutral helpers moved to src/system/sequence-runner.mjs and `lagFree` to
  src/vm/frame-events.mjs. The old modules re-export them for frozen callers.
- Live modules reach the remaining register entries only on their recorded branches,
  through src/system/register-compat.mjs: `dialogAccess`, `dialogCallBody` (as
  `recordedCallBody`), `observedContinuation` and `interruptAtBranch`, the recorded
  pass of a frame wait at its blocking branch.
- Each register module installs its entries when it loads. Every recorded accessor
  comes from `dialogAccess`, and native-dialog-support.mjs loads main-wait-interrupt,
  nmi-call and native-call-continuation with it. A recorded branch without an
  installed entry stops with `register_compat_required`.
- The unused src copy of the JSR-entered window release
  (`releaseWindowJsrSequence`) was removed; recorded callers keep the retained
  sequence in proof/caller/window-release.mjs.

## Contract

tools/register-compat-boundary.test.mjs follows the static imports of the browser
entries (src/browser/game-worker.mjs and start.mjs): none of the four modules, and
nothing in proof/ or tools/, is reached. The live-loop contract
(tools/live-loop-services.test.mjs) has the same clean graph, so its run from
power-on through title, menu and new game to NMI 4200 proves at run time that live
play installs and needs no compatibility entry. The golden traces load proof modules
and therefore run with the entries installed; they prove unchanged behaviour.

User decision 2026-11-24: tools/production-boundary.test.mjs, which otherwise
requires every src module to be loaded by the game (decision of 2026-11-01), lists
these four modules as the only permitted exception and also requires that the game
does not load them.

## Remaining limits

- The register modules stay in src/ as long as frozen proof modules import them.
  They can be deleted only together with those proof modules, once golden traces
  cover their paths.
- Recorded branches inside live modules (data bank and status setup for injected
  renderers, the recorded intro ending, attract and script visit frames) remain as
  compatibility code; they no longer pull register modules into the live graph.

## Removal plan (user decisions 2026-11-25)

The user chose to remove the register compatibility code with the proof references
that still call it, and to keep the coverage of paths the golden traces do not reach
by freezing the references' outcomes as test vectors.

Measurement before the plan (`npm run golden:coverage -- --json`): 185 proof modules
and 169 tests import the four register modules, directly or transitively. About half of
the 89 lift-function and caller tests check src functions that no golden trace reaches,
mostly script natives (src/script 56 %).

1. Frozen vectors for the lift-function tests (done): `registerCases` in
   tools/lift-function-harness.mjs keeps, per case and sample, a hash of the
   reference's outcome (stop, or result, WRAM, SRAM and device writes) in
   tools/lift-vectors/<test>.json.gz and compares the lifted side with it.
   `LIFT_VECTORS=record` runs the references and writes the vectors. The samples come
   from their seeds, so a changed sample function needs new vectors, which only the
   reference can record: change samples before step 2 or not at all.
2. Strip the references from those tests and delete the proof modules nobody imports
   any more (done: the 54 tests run no reference; `matchesFrozen` freezes the one
   hand-written comparison of game-nmi; 34 proof modules went). Their remaining proof
   imports are scaffolding of the lifted side: caller adapters (proof/caller), callee
   stand-ins and routine tables (proof/replay, proof/system) and data tables. A
   helper's reference parameter was removed only together with the matching argument
   of every call (checked per call), so no reference runs in place of lifted code.
3. The same for the caller tests (done 2026-11-26): `assertFrozenRun` in
   tools/lift-function-harness.mjs keeps a hash of the former caller's result (a
   canonical text, equal exactly when `assert.deepEqual` holds) per test name and
   comparison site, in the same vector files. 119 sites in 34 tests (8,334 frozen
   results) no longer run a former proof/caller module; `LIFT_VECTORS=record` keeps the
   vectors of retired sites. The `direct` flags and former branches of the run helpers
   went, the real-glyph runs use the lifted text renderer (src/game/text-draw.mjs), and
   three proof modules nobody imports any more were deleted. Remaining proof imports of
   these tests are scaffolding of the lifted side: RTS/RTL forms (jsr-forms), callee
   stand-ins (window, menu, input, portrait routines) and the portrait upload callee.
   src imports no proof module; its comments that name proof paths go with step 5.
4. Decouple the product tools and tests that reach proof only for data or helpers
   (done 2026-11-26):
   - Golden scenarios: the input plans and saved games moved from
     tools/mesen-f390-oracle.mjs to tools/mesen-plans.mjs (25 tests and tools import
     them there); the WRAM projection moved from proof/state/to-wram.mjs to
     tools/to-wram.mjs. The golden chain now reaches proof only through the register
     picture path of tools/golden/trace.mjs (proof/video/ppu-frame.mjs, hdma.mjs), which
     goes with step 5.
   - rom-map and extract-tables take the jump table targets from src
     (`STATUS_SUBMENUS`, `SCENE_LIST_COMMAND_TARGETS`, `KARMA_LISTS`) and the eight depth
     compare targets from tools/depth-compare-targets.mjs; analysis/vm-rom-map.json and
     assets/vm-tables.json are unchanged. extract-texts-de lost an unused import.
   - The editing audits (character, map, room tile, packed asset and packed text) use
     the lifted unpacker src/system/unpack.mjs; `unpackWithState` now also reports the
     bits read, so the audits keep their bit and token counts.
   - The shared harnesses (task-native-dialog, text-window-caller, lift-function) reach
     no proof module; member-menu-caller-harness keeps its callee scaffolding (step 5).
   - tools/scene-shape-audit.mjs observes the lifted scene load through the optional
     `observeSceneLoad` observer of src/game/scene-load.mjs (shape cell writes, tile
     stack interning, the ascending reset and phase ends). Every audit observation is
     unchanged; the WRAM checksums differ only in the former caller stack bytes
     7E:1EDC-1EF0 (docs/SCENE-SHAPE-EDITING.md).
5. Delete the register modules, src/system/register-compat.mjs, the recorded branches
   in live modules and the register path of src/video/video-port.mjs.
   User decisions 2026-11-26: proof/ goes as a whole (it is too densely linked to free
   modules test by test). The Mesen oracle family (tools/mesen-f390-oracle.mjs, its
   test, mesen-coverage, rom-code-coverage) is deleted without replacement, and so is
   analysis/rom-code-observed.json; the audits that read it (rom-map, rom-code-audit,
   rom-unread-audit, text-reference-inventory, vm-cartridge.test) are reworked without
   Mesen execution data. Tests and tools that only test or run proof code go with
   proof/; proof/crt (no register content) moves to tools/crt.
   - 5a (done): 40 proof-only tests, the run-*.mjs runners, fixture and analysis tools
     only they used, the oracle family with analysis/mesen-coverage.json, and the 21
     proof modules only they imported. tools/retire-doc-links.mjs turns Markdown links
     to removed files into plain text marked "(removed)".
   - 5b (done): analysis/rom-code-observed.json is gone. tools/rom-map.mjs traces code
     from proven entries only and reaches the same 51,325 code bytes (traced code is
     class code, code_static is empty); the package is byte-identical (216 raw bytes).
     rom-code-audit now explains the 121 retained code bytes as 40 product reads and 81
     data margins; rom-unread-audit and text-reference-inventory decode the traced
     starts only (docs/ROM-CODE-AUDIT.md).
   - proof/crt moved to tools/crt (done).
   - Mixed tests moved off proof (done): scene-stream-audit and scene-edits on the lifted
     scene load and collision grid, text-edits on the lifted text print and width, codec
     on the product interpreter; the WRAM/JS task conversion moved to
     tools/task-layout.mjs. script-interpreter and script-scheduler compare the product
     interpreter and scheduler with frozen hashes of the register-level runs
     (`frozenData` keeps the scheduler start states); LIFT_VECTORS=record still runs the
     reference.
   - cheats and gameplay-bugfixes run on product code (lifted hit 80:8691, product
     interpreter with the lifted natives, setUpNewGameState, loadSavedGame,
     preparePushkinTopics); scene-command-composition is frozen; the proof-level main
     loop tests (main-loop-motion, main-motion-helpers, confirm-key-lift,
     replay-boundary, scene-observed-calls), the 8E36 fixture chain and 30 proof modules
     only they used are gone.
   - Video tests moved off proof/video (done): ppu-state, ppu-large-bg,
     ppu-window-hdma, room-observed, sprite-state and the native side of the OBJ time
     over check run on the register interface of PictureVideo with renderFrame
     (tools/picture-fixture.mjs). Assertions about state only the SNES back end kept
     (known-memory flags, the observed write window, raster write hooks) are gone with
     it. picture-video compares with frozen hashes of the SNES back end results; the
     PPU multiplier case of frame-events uses PictureVideo.readProduct.
   - The golden traces hash only the picture back end, and the VRAM probe
     (tools/rom-vram-hook.mjs, rom-vram.mjs, rom-unpack-loader.mjs) is gone; it patched
     the register PPU model, so analysis/rom-vram.json is a retained input (done).
   - The frozen lift and caller tests compare the picture state (user decision
     2026-11-26): createSide (tools/lift-function-harness.mjs) gives each side a
     PictureVideo as its device bus, started with the DMA channel set-up of live play
     and reading open bus as 0 for unmapped DMA sources. Register-level code reaches it
     through its PPU and DMA register writes, lifted code calls it directly; only the
     other device writes stay in the write list, and the outcome hashes video memory,
     palette, OAM and settings. Tests that counted PPU writes check the picture instead
     (font upload, portrait channel set-up, fixed colour and colour math resets, the
     portrait channel restore of handleGameNmi). The vectors were re-keyed with
     LIFT_VECTORS=rekey: per sample, the lifted outcome with listed register writes is
     first checked against the old vector, and only a confirmed sample gets the new
     key (a caller vector after a passing run with the old vectors; a stop that appears
     or disappears fails). Cross-check: with the lifted code calling the picture
     directly instead of through VideoPort's register writes, the whole fast suite
     passes against the re-keyed vectors unchanged.
   - No test reaches VideoPort any more (measured over the whole fast suite on
     2026-11-27): the scene load writes its data-bank-7E palette channel bytes to WRAM
     itself (resetScenePalettes without video), loadSceneSequence no longer builds a
     scene runtime, and the remaining fixtures (text caller, native services, front-end
     text edits, camera and text state, scene command composition) give their
     accessors a picture bus or compare a PictureVideo.
   - VideoPort (src/video/video-port.mjs) and the register fallback of sceneRuntime
     and videoOf are deleted (2026-11-27); PictureVideo is the only video interface.
   - Next: move the scaffolding of the frozen tests to tools/; then delete the rest of
     proof/ and the register modules.
