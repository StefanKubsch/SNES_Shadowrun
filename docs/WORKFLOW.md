# Workflow for verified porting work

Current work and the next task are maintained in
[PROJECT-STATUS.json](PROJECT-STATUS.json). Use `npm run status:next` to read
this short summary. Keep this as the single source for the current task;
do not copy a mutable backlog into reports or individual source contracts.

[PORTIERUNGSSTAND.json](PORTIERUNGSSTAND.json) preserves the earlier proof
inventory, its recorded plans and local boundaries. Its readable
[overview](PORTIERUNGSSTAND.md) is generated from that JSON. Edit the JSON
rather than the generated Markdown when a proof record needs updating.
These historical records do not describe the current product backlog.
Reports retain a stable `progress_reference` to this evidence inventory.
Use `node tools/status-next.mjs --history` for a shortened historical view,
or `node tools/status-next.mjs <group-id>` for one proof group.
Never load the entire historical JSON into the model context.

For generator dependencies, shared tool modules and the limits of the
recorded ownership graph, see
[Generator dependency inventory](GENERATOR-DEPENDENCIES.md).

Direction and milestones are documented in [STRATEGY.md](STRATEGY.md).
When delivering porting work, update its source evidence, native binding,
tests and local contract together. The proof inventory checks delivered
entries against ROM identity, actual entry points, stack proofs, native
bindings and existing modules. Manual components alone do not establish an
original scene, callback chronology or automatic frame integration.

[Manual spot checks](MANUAL-SPOT-CHECKS.md) record completed hardware checks,
their source locations and remaining limits. They are historical notes;
targeted use of the manuals is governed by
AGENTS.md.

## Script bodies delivered together

The general interpreter replaced this approach on 2026-10-13
([STRATEGY.md](STRATEGY.md)). Do not create new individual body specs.
This section describes the existing body specs retained as regression tests.

Original script bodies were grouped by their established dependencies.
The target size and delivery group belonged only in the central plan;
a genuinely new dependency determined the scope of the next block.
Each body retained its individual original bytes and behavior tests.
Shared handler and native proofs, including failure checks, were updated
once per behavior rather than repeated for every script.
One source report and a compact native report could cover a whole group.
Targeted tests ran during implementation, followed by one release check
after the group was complete. Each completed group had a joint update of
the central record, local contract and handoff, followed by commit and push.

## Efficient work blocks and test responsibility

Before implementation, define a complete delivery group around shared
dependencies. Finish source evidence, native implementation, individual
body evidence and documentation together. A genuine new source boundary
limits the group; a file boundary alone does not require a release check.

For the existing body-spec workflow, include further individually provable
bodies that share already established dependencies before closing the group.
Helper proofs and handoff substeps are internal steps, not separate triggers
for a release check. A completed group or a specifically documented new
source boundary defines the delivery. The recorded target is a work goal,
not a quota to fill with incomplete proofs.
Progress comes from completed source and native work, not repeated checks
of unchanged results that have already passed.

Before the first test run, determine affected test files from changed
modules, their direct consumers and shared contracts. Run common handler,
provider and progress checks once for the group.
New native or proof-inventory roots require the dialog inventory in the
test selection, including an explicitly empty call list for a root that
makes no calls. Each existing body retains its individual ROM and behavior
checks. New tests need a specific failure case or contract boundary;
parameterize similar cases and reuse shared fixtures.

For substantial delivery groups, a test subagent handles routine checks:
under Codex, use `gpt-6-luna`, `medium`, `fork_turns="none"`; under Claude
Code, use the Agent tool with `model="haiku"` or, when needed, `"sonnet"`.
The choice follows AGENTS.md. Delegation is a workflow
decision, not a correctness guarantee or a quantified credit saving.

The main agent supplies a short task, the exact changed paths, relevant
source contracts, expected boundaries and allowed verification commands.
The test agent also checks that the selection covers direct consumers and
shared contracts. Do not pass the full chat history; reuse the same agent
throughout the group. Run brief individual checks directly when starting
an agent and preparing a handoff would take more effort.

By default, the test agent does not change product files, weaken assertions
or start other agents. Unclear ROM, stack or alias questions, contradictory
expectations and failures without a clear cause return to the main agent
with the smallest counterexample and a log path. The main agent resolves
the source question and remains responsible for approval.
Delegation does not replace source evidence.

Tests and generators run in the terminal; the model selects checks and
evaluates their results. Changing models does not automatically shorten the
test process itself. The main agent does not repeat delegated passing runs.
Keep complete output in temporary logs. Return only the command, exit code,
pass/fail/skip counts, duration, log path and specific findings.
For failures, read only the relevant excerpts. For example:

```powershell
$testLog = Join-Path $env:TEMP ('snes-focused-' + [guid]::NewGuid() + '.log')
node --test --test-reporter=tap tools/render-905e-source.test.mjs tools/render-905e.test.mjs *> $testLog
$testExit = $LASTEXITCODE
Get-Content -LiteralPath $testLog -Tail 12
Write-Output "Exit code: $testExit; Log: $testLog"
# If testExit is nonzero, inspect the relevant failures in the log.
```

After a failure, fix its cause first and verify it with a targeted check.
Run `verify:release` once after the entire delivery group is finished.
The incremental release check replaces the former combined affected suite:
it selects affected test files from their recorded inputs.
After it passes, do not add another `npm test` or repeat passing checks.
Later changes to code, tests, generators or contracts require renewed
affected checks and a release check. Adding the actual result to the handoff
requires only a diff check. A failed release remains incomplete until it
passes after the correction.

Purely editorial documentation or agent-instruction changes that do not
alter code, tests, generators, generated status or source contracts need
diff, link and consistency checks rather than a porting release check.
Their completion does not count as a new passing porting release.

## Verification and delivery

Generated `analysis/` reports are not versioned (user decision
2026-10-31). `npm run rebuild:artifacts` recreates them, and everything in
`assets/`, from the ROM: catalogued producers outside the release graph
first, then the release generators in `package.json` order. `--clean`
deletes the generated files first. Recorded and retained inputs are listed
in [rebuild-artifacts.mjs](../tools/rebuild-artifacts.mjs) and are never
deleted. `verify:release` runs only the release generators, so a fresh
checkout needs the rebuild first. When adding a generator, keep producers
before consumers; `node tools/order-generators.mjs` reports backward
dependencies from the recorded graph and `--write` fixes the order.

The release check starts with `prettier --check src proof` (user decision
2026-11-01); unformatted code stops delivery before any generator runs.
Format every changed file with Prettier right away.

## Agent hooks

Both agents run the same hooks from `tools/hooks/` (user decisions
2026-11-05). Like the agent settings, the hooks and their test
`tools/post-edit-eslint.test.mjs` are local only and not versioned (user,
2026-11-14). Claude Code runs them through `.claude/settings.json`, Codex
through `.codex/hooks.json` (the project must be trusted; approve new or
changed hooks once with `/hooks`). Codex commands assume the session starts
in the repository root.

- `session-start.mjs` adds `git status`,
  the last three commits, HANDOFF.md and `npm run status:next` to the context
  at session start, resume, clear and compaction, and warns when `analysis/`
  is missing.
- `pre-read-guard.mjs` denies whole-file
  reads of `docs/PORTIERUNGSSTAND.json` and of files above 64 KiB in
  `analysis/` and `docs/handoff-archiv/`. Read a line range, or limit a shell
  read with a pipe or a line count.
- `post-edit.mjs` formats each edited file with
  Prettier, then reports findings on lines changed since HEAD (new files
  count fully):
  - Magic numbers in `src/`, `proof/` and `tools/` (tests excluded). Replace
    each with a descriptive `UPPER_SNAKE_CASE` constant; values inside such a
    definition, including tables, and 0, 1, -1 and 2 are allowed. ROM
    program addresses written as six hex digits (banks `$00`–`$1F` and
    `$80`–`$9F`, offsets from `$8000`, for example `0x81d9cd`) count as
    source references to the original code and are not reported; neither is
    the instruction address passed as the last argument of the sound
    processor calls `io.read(address, pc)` and `io.write(address, value, pc)`
    (IPL ROM and sound driver, [src/apu/](../src/apu/)). Mark a
    justified exception with `// magic-number-ok: <reason>`. Shared
    constants live in [src/constants/](../src/constants/) (bits, CPU flags,
    hardware registers, memory map, PPU, CRT); WRAM fields stay in
    [src/task/wram.mjs](../src/task/wram.mjs), scheduler tables in
    [src/vm/layout.mjs](../src/vm/layout.mjs). Name a value only where its
    meaning is established; operands of the 1:1 ported routines without a
    documented meaning stay literal for now.
  - German text in code comments and Markdown prose, outside
    `docs/handoff-archiv/`. Mark a deliberate German quotation with
    `language-ok`.
  - Relative Markdown links whose target does not exist.
  - Current-work texts in `PROJECT-STATUS.json` longer than the status CLI's
    400-character limit. The whole status file is checked whenever it is edited;
    findings identify the field or list entry, actual length and excess.
    Keep longer details in the handoff or the relevant source document.
  - ESLint findings ([eslint.config.mjs](../eslint.config.mjs), the
    recommended rules) in `.mjs` and `.js` files: findings on changed lines,
    and findings the HEAD version does not have, such as an import whose last
    use was removed elsewhere. Older findings on untouched lines stay quiet.
    The local test `tools/post-edit-eslint.test.mjs` covers the comparison
    and both adapters.

  The release check validates the same text limit before formatting, generation
  or tests, so edits made through shell scripts are covered too. The shared
  validator and CLI use one limit in [project-status-text.mjs](../tools/project-status-text.mjs).

  To check whole files by hand, run
  `node tools/hooks/post-edit.mjs --scan <file>...`.

ESLint was installed on 2026-11-06 at the user's request; `npm run lint` checks
the whole repository. It is not part of the release check. The first full
run found 290 older findings in 189 files, mostly unused names; remove them
in files you edit.

`src/` holds exactly the shipped game: every module there is reached by a
static import chain from `src/browser/start.mjs`, `game-worker.mjs` or
`audio-worklet.mjs`. Proof models, specs and observation helpers used only
by tools and tests live in `proof/` with the same subfolders (user decision
2026-11-01). Proof code may import game modules, never the other way round;
[production-boundary.test.mjs](../tools/production-boundary.test.mjs) checks
both directions. The browser server serves only `src/`.

Atomic task plan APIs (`prepareTask*`, `commitTaskPlan` and
`isLatestCommittedTaskPlan`) also live in `proof/task/`, including wrappers
around routines shared with the game. The matching `src/task/` modules keep
the direct execution routines; `src/task/plan.mjs` keeps the shared `taskStop`
boundary. Historical inventory bindings and generated native reports name the
proof module and retain their existing export names and schema. The manual
native catalog resolves plan modules in `proof/task/` without a game-module
fallback. Source contracts may still name `src/` for the shared equations.

All `.mjs` modules are syntax-checked together in one Node process using
`vm.SourceTextModule` and `--experimental-vm-modules`. Each file remains a
separate module; imports are neither resolved nor executed.
Comparison tests against `node --check` cover valid and invalid module
grammar. A full release writes the exact `syntax-files.json` manifest and
the combined `syntax.log` to its temporary log directory.
A syntax, read or manifest error stops delivery. Earlier logs are retained.

The two generator passes remain separate processes in their existing order.
Source checks, artifact hash comparisons, AC-source checks, syntax, selected
tests, diff and LFS checks remain part of the release check.
`summary.json` also records artifact and syntax durations; savings are
measured rather than inferred from the number of scripts.

During implementation, check the changed contract directly, for example:

```powershell
node --test tools/render-905e-source.test.mjs tools/render-905e.test.mjs
```

Small related sources and their native implementation can form one delivery
group. Additional helpers, unknown return modes, stack effects and external
observations must be established first. Larger or unresolved parts remain
separate steps. The [dialog inventory](../analysis/dialog-936c-inventory.json)
lists original calls and stops at unknown mode changes; it does not replace
a source contract.

Before every porting delivery:

```powershell
npm run verify:release
```

The release check is incremental
([release-cache.mjs](../tools/release-cache.mjs)). Each generator and test
process records the repository files it reads, writes, lists or checks for
existence, along with loaded modules, through
[track-inputs.mjs](../tools/track-inputs.mjs).
A generator or test file is skipped when all these inputs and its own
outputs have unchanged SHA-256 hashes. Pass 2 repeats exactly the generators
run in pass 1; artifact comparison still covers every artifact.

At most eight test files run at once (user decision 2026-11-01; Node's
default would use all threads but one), since each may start its own Edge or
Mesen. Set `SNES_TEST_CONCURRENCY` to change this; `npm test` uses eight too.
Test processes keep normal priority.

Test files that import [browser-frame.mjs](../tools/browser-frame.mjs) run
in a second batch after all other tests, at most two at once
(`SNES_BROWSER_CONCURRENCY` overrides it). Among eight parallel files with
the software renderer, pages starved and waits such as the recording export
timed out (2026-11-03). The release check logs the batches as `tests.log`
and `browser-tests.log`; `npm test` ([run-tests.mjs](../tools/run-tests.mjs))
uses the same batches.

Edge uses the GPU by default (user decision 2026-11-03): players see the
hardware path, and the software renderer saturated the CPU. Within a single
task after a colour space tag change, `drawImage` of the WebGL canvas still
used the previous tag on the GPU path; the renderer test therefore waits for
one frame after each switch. `SNES_BROWSER_GPU=0` restores `--disable-gpu`,
for example in a sandbox without GPU access. The release cache tracks the
Edge executable but not the graphics driver; after a driver update, rerun the
browser tests with `npm run verify:release:full` or by hand.

Browser tests keep their page in front: [browser-frame.mjs](../tools/browser-frame.mjs)
closes pages Edge opens during a test (noted in `foreign-pages.txt` in the
browser log folder), because a hidden page receives no animation frames.
The test browser uses `--mute-audio` so its playback cannot overlap with a
user's game on the host speakers. The real audio graph, PCM checks and media
clocks still run; only the host output is muted.
Processes with non-Node child processes and tests that write into the
repository always run. The deterministic external tools Mesen2 and Edge
are exceptions (`EXTERNAL_TOOLS` in `track-inputs.mjs`): their executables
are tracked as external inputs by absolute path, along with Mesen's
`MesenCore.dll` and `settings.json`.

The Node version and cache code form a salt; changing either invalidates the
whole cache. The untracked cache is stored in `.cache/release/`.
`summary.json` lists executed and unchanged generators and test files, plus
entries that cannot be cached.

The incremental release check enables the Mesen recording cache
([mesen.mjs](../tools/mesen.mjs)) with `SNES_MESEN_CACHE=1`.
A recording is stored in `.cache/mesen/`, keyed by the SHA-256 hashes of
`Mesen.exe`, `MesenCore.dll`, `settings.json`, the ROM, final Lua script,
arguments and save file. An identical key reuses the recording instead of
starting Mesen again.
Only a run with exit code 0 and confirmed completion is cached: the line
count must match the final line, with no damaged line.
Each replay still compares the VM against all original lines.
Fresh recordings still start from a cold reset without state import.
This saves Mesen's own recording time; the long browser case spends about
560 of its 640 seconds recording.

`npm run verify:release:full` runs every check, records Mesen runs afresh
(`SNES_MESEN_CACHE=record`) and rebuilds both caches.
It is required at a milestone boundary ([STRATEGY.md](STRATEGY.md)) and
whenever a false cache hit is suspected. Deleting `.cache/` has the same
effect on cached results.

The release command covers the render analysis, extraction and probe tools,
dialog inventory and historical status generation.
Changed generators run twice in sequence; a full release runs all of them.
It compares file sets and SHA-256 hashes of render and planning artifacts,
reproduces both AC-source artifacts unchanged, checks all module syntax,
runs selected tests with no skipped tests, and checks diff and LFS.
A full release runs the entire test suite.
Source, test or comparison failures stop verification with an error.

On Windows only, a generator with an actually logged `UNKNOWN` / `-4094`
open error on `analysis/render-*` or `assets/render-*` is retried at most
twice, after 250 and 1000 ms. Each attempt gets a separate log; a persistent
failure stops verification. Both generator passes and the unchanged
SHA-256 comparison remain required.
The Script52 generators still recompute source and native reports.
They do not rewrite byte-identical final reports, avoiding an unnecessary
truncating write when a Windows reader holds the file open.
File and source errors still propagate. Diagnosis and the reproducible
Windows locking test are documented in
[WINDOWS-INFRASTRUCTURE.md](WINDOWS-INFRASTRUCTURE.md).

When the managed sandbox makes `.git` read-only, delivery verification needs
the already authorized Git write permission: `git lfs status` refreshes the
index after generation. Start the entire release command with that
permission when this restriction is known. Do not run all generators and
tests without it and then repeat them because of the predictable index
failure. An index failure is not a passing release and must not be hidden
by permanently weakening the sandbox.

Individual logs and `summary.json` are stored in a new temporary directory;
the command prints its path. It does not commit or push. At its start it
removes older `snes-release-*` directories beyond the newest 19 and
`snes-browser-frame-*` directories beyond the newest 50. Browser tests
delete their Edge profile after each run and keep only log and downloads;
Mesen scripts and test fixtures live in temporary directories that are
removed after the run ([temp-dir.mjs](../tools/temp-dir.mjs)).

After success, update the handoff, stage only files in the delivery group,
run `git diff --cached --check`, and perform the authorized commit and push.
Then compare HEAD, origin/main and the actual remote main.
Earlier handoff results remain historical evidence.
Current work is maintained only in `PROJECT-STATUS.json`; source and proof
records remain in the historical evidence inventory.

To read current work without release verification:

```powershell
npm run status:next
```

To regenerate the historical proof overview without release verification:

```powershell
npm run plan:dialog
npm run docs:progress
```
