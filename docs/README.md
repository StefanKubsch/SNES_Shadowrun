# Documentation map

Where to find what. Start with HANDOFF.md and
`npm run status:next` (reads [PROJECT-STATUS.json](PROJECT-STATUS.json)).

## Project direction and process

| File                                                   | Content                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| [STRATEGY.md](STRATEGY.md)                             | Direction, priorities and decisions                                  |
| [WORKFLOW.md](WORKFLOW.md)                             | Work and testing process, release check                              |
| [GENERATOR-DEPENDENCIES.md](GENERATOR-DEPENDENCIES.md) | Generator dependency inventory used by the incremental release check |
| [PORTING-PLAN.md](PORTING-PLAN.md)                     | Historical goal and step plan                                        |
| [WINDOWS-INFRASTRUCTURE.md](WINDOWS-INFRASTRUCTURE.md) | Windows sandbox and artefact open errors (2026-10-09)                |

## Understanding the code

| File                                             | Content                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [VM-ARCHITECTURE.md](VM-ARCHITECTURE.md)         | Overview of the VM layers                                                                                                                        |
| [VM-INTERPRETER.md](VM-INTERPRETER.md)           | Event interpreter, scheduler, natives, main loop, NMI and boot owner (`src/vm/`, `src/task/`)                                                    |
| [NATIVE-MODULES.md](NATIVE-MODULES.md)           | Native task modules                                                                                                                              |
| [NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md) | Resumable wait and input points, live game start                                                                                                 |
| [SCHEDULER.md](SCHEDULER.md)                     | Proof-era script runner: calls, waits, mask zero, time source                                                                                    |
| [SCRIPT-LANGUAGE.md](SCRIPT-LANGUAGE.md)         | Script bytecode decoder and first runtime                                                                                                        |
| [reference/](reference/README.md)                | Tables of every proven routine contract (opcodes, natives, scripts, task system, slots, movement, render routines) and the shared contract terms |
| [ROM-ANALYSIS.md](ROM-ANALYSIS.md)               | Initial ROM analysis                                                                                                                             |
| [ROM-FREE.md](ROM-FREE.md)                       | How the game runs without loading a ROM                                                                                                          |

## Original comparisons and hardware

| File                                           | Content                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [MESEN-ORACLE.md](MESEN-ORACLE.md)             | Mesen2 oracle (M2): recorder, comparison, routes and results |
| [BOOT-ORACLE.md](BOOT-ORACLE.md)               | Cold boot comparison, task rounds and native NMI (M3)        |
| [PPU-BROWSER.md](PPU-BROWSER.md)               | First native browser picture (logo)                          |
| [PPU-ROOM.md](PPU-ROOM.md)                     | First room, OBJ, windows, HDMA, brightness, colour math      |
| [MANUAL-SPOT-CHECKS.md](MANUAL-SPOT-CHECKS.md) | Spot checks against the Nintendo manual                      |
| [SOUND-DRIVER.md](SOUND-DRIVER.md)             | Sound driver and sound chip                                  |
| [AUDIO-OUTPUT.md](AUDIO-OUTPUT.md)             | PAL 1CHIP analogue audio output                              |
| [VIDEO-OUTPUT.md](VIDEO-OUTPUT.md)             | PAL 1CHIP RGB output                                         |

## Player-facing features

| File                                                                                             | Content                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [CONTROLS.md](CONTROLS.md)                                                                       | Controls in the browser                    |
| [SAVING.md](SAVING.md)                                                                           | Saving in the browser                      |
| [RECORDING.md](RECORDING.md)                                                                     | Session recording                          |
| [START-SCREEN.md](START-SCREEN.md)                                                               | Monitor startup screen                     |
| [OBJECT-MARKERS.md](OBJECT-MARKERS.md)                                                           | Marking usable objects                     |
| [BUGFIXES.md](BUGFIXES.md)                                                                       | Optional corrections to original game bugs |
| [CRT-FILTER.md](CRT-FILTER.md), [CRT-RESEARCH.md](CRT-RESEARCH.md), [CRT-BEZEL.md](CRT-BEZEL.md) | CRT filter, its sources and the bezel      |
| [TCRF-NOTES.md](TCRF-NOTES.md)                                                                   | Hidden and unused content                  |

## Status files

| File                                                         | Content                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [PROJECT-STATUS.json](PROJECT-STATUS.json)                   | Current work (`npm run status:next`)                                                                  |
| `PORTIERUNGSSTAND.json`                                      | Historical proof groups (about 1 MB; use `node tools/status-next.mjs <group-id>`, never load in full) |
| `PORTIERUNGSSTAND.md`                                        | Generated German view of the historical status (`npm run docs:progress`)                              |
| [GENERATOR-INPUT-SOURCES.json](GENERATOR-INPUT-SOURCES.json) | Recorded generator inputs                                                                             |
