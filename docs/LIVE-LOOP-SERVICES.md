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

Contract (tools/live-loop-services.test.mjs): a live game runs from power-on
through the boot screens, title and start menu into a new game and its main loop
up to NMI 4200, at budgets one and seven. Every access to the services beyond
`h.a` fails, and the CPU context is frozen after the reset service; it still
equals `STARTUP_CONTEXT` at the end. All five golden traces also passed with this
guard in place during the block's development.

The accessor still owns a CPU context object for recorded callers and the
`STARTUP_CONTEXT` workspace; removing those from live play is the outer
accessor step.
