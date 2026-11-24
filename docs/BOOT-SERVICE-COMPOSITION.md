# Boot service composition

The live game starts with two ordinary services. The power-on reset 00:E382
(`resetHardware` in src/system/main-reset.mjs) sends its hardware writes in the
original order through the hardware port, with the original store sites, and
writes the two data bank bytes its push and pulls leave below the power-on
stack (WRAM 01FE-01FF). The startup 80:A133 (src/system/main-startup.mjs) then
runs the boot screens. Neither service takes, checks or changes a CPU context;
the live startup receives game services only (`{ a }`).

The register-level reset with its entry checks and the software reset 80:9E3D
remain in proof/replay/main-reset.mjs, unchanged. The boot screens keep their
original status changes and PLP restoration only for recorded callers without
frame jobs; the frozen RTL form in proof/frontend-caller/boot-screens.mjs uses
that path.

The register state the reset leaves at 80:A133 is `STARTUP_CONTEXT` in
src/script/game-loop.mjs. It is the compatibility workspace of register-level
owners and natives that still borrow the outer accessor; removing it belongs to
the later outer GameLoop accessor block. tools/startup-entry-adapter.mjs restores
the original PHP/PLP, data bank 80 and owner entry A139 for comparisons with
frozen register-level callers.

Contracts (tools/boot-service-flow.test.mjs): the reset service's device writes
match the frozen register-level reset by register, value, width and site; WRAM,
PPU registers and write counts match; the frozen reset leaves exactly
`STARTUP_CONTEXT`; the CPU context is frozen while the service runs. The live
startup runs both boot screens at budgets one and seven with any access to the
caller beyond its game services rejected and the CPU context frozen. The direct
startup comparison (tools/main-startup-lift.test.mjs), owner and transition
caller comparisons and the five golden traces remain binding.

Title, intro and start menu frames, the game owner and the outer GameLoop
accessor still use the compatibility context; phase 4 remains unfinished.
