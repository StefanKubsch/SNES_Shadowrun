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
   Several src modules still import proof/caller modules; that is part of step 5.
4. Decouple the product tools and tests that reach proof only for data or helpers:
   the golden scenarios (through tools/mesen-f390-oracle.mjs and proof/vm/main-loop.mjs),
   rom-map, extract-tables, extract-texts-de, the editing audits (through
   proof/system/native-unpack.mjs) and the shared test harnesses.
5. Delete the register modules, src/system/register-compat.mjs, the recorded branches
   in live modules and the register path of src/video/video-port.mjs.
