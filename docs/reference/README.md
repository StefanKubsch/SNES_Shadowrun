# Routine contract reference

Tables of every proven original routine contract, grouped by subsystem. Each
row names the original behaviour (addresses, modes, branches, edge cases), the
native plan in `proof/` or `src/`, the implementing modules and the evidence
(source reports, listings, probes and tests). Row anchors are the lowercased
former file names, so `slots.md#slotaktion-6a` is the former
`SLOTAKTION-6A.md`.

These files replace about 400 former per-routine contract files
(`RENDER-*`, `RENDER-TASK-*`, `BEWEGUNGS*`, `SLOT*` and the small task system
contracts). The original German wording, including historical test counts and
delivery chronology, stays in git history at commit `20c7b6c9`
(`git show 20c7b6c9:docs/<NAME>.md`).

| File                                               | Content                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [task-opcode-handlers.md](task-opcode-handlers.md) | Interpreter dispatch at `80:F390`, the opcode table and all handler families                                                                        |
| [task-natives.md](task-natives.md)                 | Native58 call chain, larger native graphs, leaf natives and the native render adapter                                                               |
| [task-scripts.md](task-scripts.md)                 | Script52 bridge, script bodies, child yield and the script action families                                                                          |
| [task-system.md](task-system.md)                   | Task heap, frame initialisation, task list, running heap frames, state actions, `$A9` task creation, `$AC/$CF/$63`, `$D9` arithmetic, scratch `$A2` |
| [slots.md](slots.md)                               | Slot table, slot actions, providers and the slot motion body                                                                                        |
| [movement.md](movement.md)                         | Main loop motion helpers, prelude, gates, transitions and post-run                                                                                  |
| [render-routines.md](render-routines.md)           | Render, text, window, input, audio and NMI routines                                                                                                 |

Topic documents outside this folder (VM, scheduler, oracles, PPU, audio,
workflow) are listed in [the docs map](../README.md).

<a id="shared-contract-terms"></a>

## Shared contract terms

These rules were repeated in most former contract files. They apply to every
row unless the row states otherwise.

**Source contracts**

- The source is the unchanged European ROM with SHA-256
  `91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
  Exact original windows, the ROM hash and the Native58/opcode table anchors
  (pointer, argument and return metadata) are pinned independently.
- Analysis never executes machine code. Source edges include both outcomes of
  conditional branches; they are not feasible value paths or executed
  instructions. All local edges and required mode and return conditions stay
  concrete in the report. No external callee returns or initialised data are
  assumed.
- Local stack proofs are call-free typed RTS/RTL proofs under the named
  number of protected outer return bytes; they give no global stack minimum,
  stack capacity, parity, ID, target or initialisation guard. A local RTS or
  prefix end proves no dynamic task, scene, device or frame integration.
- Entry conditions are explicit: usually E0/M0/X0/D0 with full indices, the
  real DBR, bank 00 direct page and bank 00 stack. D0 is an explicit Native58
  entry condition; ADC/SBC require binary arithmetic (decimal flag 0);
  multiplication needs decimal flag 0 for its BYTE ADC while division keeps the
  decimal flag. The original handler keeps its own carry and decimal premises;
  no new arithmetic assumption is added. Payload D is separate from the status
  decimal flag.
- Address arithmetic: direct page and stack wrap at 16 bits in bank 00;
  indirect and absolute data use the real DBR with 24-bit addresses
  (WORD low/high). Stores may physically alias scratch, pointer, frame,
  header, operand or opcode bytes, so earlier data is never silently reused:
  every pointer, opcode and table byte is fetched freshly, including the
  ignored opcode high byte and the full Y.
- Processor semantics follow the
  [WDC W65C816S datasheet, 2024-03-13](https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf)
  (stack relative 3.5.23, native stack, XBA/SEP/REP, instruction flag tables):
  pure CPU address and flag semantics, no SNES device or timing observation.
  SNES hardware facts come from the local Nintendo manuals as described in
  AGENTS.md.

**Native plans**

- Native plans run fixed JavaScript equations, never decoded ROM
  instructions; there is no opcode interpreter, CPU emulation, device values
  or automatic frame binding.
- `prepare…` functions need a frozen explicit entry, real physical byte
  providers, protected outer stack owners, explicit write windows and
  cumulative work and output budgets (`maxWork`, `maxOutputBytes`, and a
  positive `maxHandlers` for opcode sequences). They share one provider
  overlay and change no live bytes.
- `commitTaskPlan` (or `data.commit(plan)`) accepts only its own fresh
  original plans and writes once, outside. Foreign, changed, forged, reused or
  stale plans are rejected without partial effect. Any missing late read,
  write window, context, stack protection or budget gives no committable plan
  and discards all earlier effects.
- Fresh reads keep aliases: later admitted handlers see their own earlier
  writes and fresh pointer, opcode and table bytes. After all real stores F389
  reads the DP00 pointer and the full next opcode WORD freshly from the same
  overlay view; the resulting A/X = opcode low, Y+1 and N0/Z are immutable plan
  metadata, and C, V, I and the decimal flag stay unless a row names a change
  (for example a CMP carry). The plan stops before the dynamic indexed
  `JMP 80:F390`; no following target is read or executed. Opcode JMP creates
  no return frame of its own.
- Manual roots read the real RTS return WORD freshly, report the target and
  S+2, and never execute it; only a separately proven bounded Native58
  composition may continue. A request for more handlers than the proven prefix
  rejects the whole plan before the outer commit.
- Device access: at unmapped MMIO reads `ioMode: 'record-requests'` and a
  frozen ordered `ioObservations` list of frozen `{pc, address, width, value}`
  records are mandatory over the whole sequence. Each real MMIO read consumes
  exactly the next record; missing, wrong, extra or invalid observations hold
  back all effects. MMIO stores are immutable requests in the plan, not device
  execution, and no products, quotients, timing or completion values are
  invented. In ordinary WRAM and ROM banks absolute reads and stores stay
  normal fresh provider accesses. Wait loops use
  `waitMode: 'record-observations'` in the same way.
- Normalised host arithmetic and array operands do not supply the original
  physical stack, scratch or register observations, carries, fresh aliases or
  a full machine return.

**Evidence and limits**

- All fixtures and probes are synthetic unless a row names an original run;
  they are host and source tests, not hardware traces. Source mutation tests
  check all window bytes, modes and control edges.
- Original initialisation, the full task, C1CA, 9178 and BF3B composition,
  devices, scenes and frames stay open unless a row states otherwise; dynamic
  callees, follow-up dispatch and return targets stay separate limits.
- Current progress and the next step are only in
  [PROJECT-STATUS.json](../PROJECT-STATUS.json) (`npm run status:next`);
  historical continuation state is in `PORTIERUNGSSTAND.json`.
