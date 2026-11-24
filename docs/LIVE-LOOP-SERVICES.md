# Live loop services

With frame jobs, the live GameLoop (src/script/game-loop.mjs) passes one frozen
game-service object, `{ a }`, to every phase it composes: startup, the game
owner with its title cycle, the game start and the main loop's end-of-frame and
update phases. No phase receives the dialog register helpers or reads or writes
the CPU context. Scheduler rounds and head visits already use named services
(docs/SCHEDULER-SERVICE-COMPOSITION.md).

The game start (src/game/game-start.mjs) ends at 80:96AB without a PC in live
play. Recorded callers without frame jobs still receive that end as their PC,
which the frozen register-level main start and game-screen comparisons check.
Injected recorded loops without frame jobs keep the dialog access with its
compatibility context.

The live accessor carries no CPU workspace either. After the reset service, live
play reads the data bank 80 as a value (`a.dataBank`, through `dataBankOf` in
src/system/data-bank.mjs), as waiting native services already do; object creation
during room entry was the last live reader of the context's data bank. Only
injected recorded loops without frame jobs receive `STARTUP_CONTEXT`. The
power-on context the constructor writes remains the seed for recorded callers
that run the register-level reset on this accessor.

Contract (tools/live-loop-services.test.mjs): a live game runs from power-on
through the boot screens, title and start menu into a new game and its main loop
up to NMI 4200, at budgets one and seven. Every access to the services beyond
`h.a` fails, and every register of the accessor's CPU context fails on any read
or write from construction on. All five golden traces passed with the same
poisoned context during the block's development.

Recorded comparisons, the numeric scheduler entry API and register-level native
accessors keep their compatibility contexts.
