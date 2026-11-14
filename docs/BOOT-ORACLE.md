# Boot oracle: original comparison of the boot prelude and task rounds

Tools: [recorder](../tools/mesen/trace-boot-prefix.lua),
[comparison](../tools/mesen-boot-prefix.mjs),
[test](../tools/mesen-boot-prefix.test.mjs). The canonical next step is only
in the [project status](PROJECT-STATUS.json), readable via
`npm run status:next`. This file merges and translates the former German
`BOOT-ORAKEL.md` and `BOOT-TASKRUNDEN.md` (original wording at git commit
20c7b6c9). The first visible room pictures are added by the
[PPU room contract](PPU-ROOM.md); running free control is a separate M5
contract; [NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md) adds finite work
budgets for the main loop owner and its direct counter/input calls.

Common rules: only the original power-on image initialises the native owner;
later CPU, WRAM, SRAM, task or player states from Mesen are expectations only
and are never taken into the VM; no readiness, counter or state injection. The
emulator options for the RAM power-on state are in [mesen.mjs](../tools/mesen.mjs)
and prove nothing about real console power-on values. Recordings carry running
line numbers and a final count (lost, torn or incomplete output fails); raw log
and Lua script stay in the reported temporary directory.

## Checkpoints

| Checkpoint                                    | Scope                                                                                                                                                                                                                                | Equal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before the first wait                         | Cold reset 00:E382 up to before the first wait at 81:EEBB (the native run stops at its missing interrupt observation at the same instruction)                                                                                        | All registers including E, PC and program bank; all 131,072 WRAM and 8,192 SRAM bytes; 822 CPU device bytes from 803 write instructions (address, value, order, original PC); six DMA requests with 86,496 B-bus bytes (65,536, 544, 2,048, 8,160, 2,048, 8,160). No NMI in this section. Counter-probes change a final WRAM byte or remove the first CPU access                                                                                                                                                                      |
| Logo, SPC, hint up to 80:A139                 | Same cold owner after the first wait through logo, SPC transfer and hint to the title menu owner                                                                                                                                     | Registers, WRAM, SRAM; 31,416 CPU device bytes from 8,001 write instructions; 162,784 DMA bytes from ten requests; 397 real NMIs; 6,523,598 instruction observations (EEBB and SPC transfer EF07/F07F/EFA5/EFFA/F001). Uses the strict VmMemory so unbound device accesses show                                                                                                                                                                                                                                                       |
| Title prelude up to the new-game menu 81:E14A | After audio directory F092 and the real abort path of title sequence D694/DDDB; from 80:A139 A is pressed for six frames every 30 frames via Mesen's joypad API (control input; game state is built by original or native equations) | Registers, WRAM/SRAM, 416,475 CPU device bytes from 52,632 write instructions, 316,896 DMA bytes from 52 requests, 436 NMIs, 7,124,147 instruction observations; proves the chosen title abort, not all later title animations                                                                                                                                                                                                                                                                                                        |
| New-game menu up to 81:EF63                   | A/Start run to the real call after the full new-game choice and return from A18C                                                                                                                                                     | Registers including E, all WRAM/SRAM; 530,399 CPU device bytes from 60,435 write instructions, 933,888 DMA bytes from 1,292 requests, 590 NMIs, 10,086,518 instruction observations; closes the new-game menu for this path, not yet the first room                                                                                                                                                                                                                                                                                   |
| First full scene build (M3), 2026-10-19       | Whole owner from 00:E382 via logo/SPC/hint, title abort, new-game menu and game entry to 80:96AB (after 9629, the whole transition A4BF and 8861; before the first main loop pass)                                                   | Registers including E, PC and program bank, all WRAM and SRAM; 11,005,441 instruction observations, 636 NMIs, 1,051,707 CPU device bytes from 161,380 write instructions, 943,460 DMA bytes from 1,369 requests. **M3 is met for this cold new-game route.** The earlier recording to A117 is now also green (591 NMIs, 980,432 CPU device bytes, 936,784 DMA bytes; it was open at mode 08 then). The older recording to 96C0 stays a historical raw data set with other observation windows, not an extra scene or task round proof |

## DMA observation

The recorder separates CPU and DMA accesses by Mesen's real eight `dmaActive`
channel flags (part of the official
[serialize source](https://github.com/SourMesen/Mesen2/blob/master/Core/SNES/SnesDmaController.cpp)).
A CPU exec callback is no DMA end marker: in the observed run the next opcode
callback appears before the pending DMA bus accesses. In a DMA record the PC
field therefore names the earlier observed triggering MDMAEN job, not a CPU
instruction per DMA byte; normal CPU accesses keep their real PC after the
operands. The Lua callbacks change no values. Every observed byte value and
target port is compared against the channel job checked on the CPU side and the
current native WRAM/ROM source. Admitted: the reached modes 00, 01, 08 and 09,
forward direction, fixed or in-bank incrementing source; other modes and DMA
reads stay explicit limits. The concrete Shadowrun jobs come from the EB97/EE22/ED8B/EC16 equations. This CPU contract binds no PPU device; the
[browser picture contract](PPU-BROWSER.md) adds the native PPU output.

A772 uses DMA channel 2 twice with DMAP=08, BBAD=04, A1B=81, A1T=A7FB,
DAS=0220: exactly 544 bytes of the same ROM address to 2104 (bits 0..2 = 000
select one B-bus port, bit 3 = 1 keeps the A-bus address fixed, bit 7 = 0 means
A to B; the source is not incremented). The recorder admits this fully known
mode also on the safe APU poll path; a counter-probe changes one of the 544
output bytes and fails.

## NMI and instruction observations

- NMI occurrences come from Mesen's pushed hardware return frame, never from a
  frame counter or the last opcode. Each NMI carries its position in the full
  device byte stream, checked at the native vector read before the NMI pushes
  its hardware frame, so interrupts and device accesses stay ordered. NMI
  records hold the full interrupted register set, compared with Mesen before
  the native hardware frame. NMIs run via the original vector, handler 00:C112,
  the installed callback (e.g. empty 81:E839 during logo/hint) and real RTI.
- Unchanged CMP/BNE poll pairs are recorded losslessly with repeat count and
  flushed before interrupts, device accesses or other instructions; an
  independently counted total in the Lua callback checks the expansion; JS
  observations share frozen absence objects per PC. Startup sections without
  NMIs in this run would fail at an uncovered continuation PC if one occurred
  (no arbitrary interrupt points are admitted).
- All 0C55 transferred SPC bytes and every reached acknowledgement read come
  from the real run, including three NMIs during the transfer. The original INC
  at 81:EFB8 reads the APU port and writes its incremented low byte (no invented
  ready value; no SPC processor or audio output).
- The hint data stream uses STA ($0E) at 81:ECC7 for two BYTE writes to
  80:210D: FC, then FF. This data command used a plain memory write that the
  test memory swallowed at device addresses; it now uses `absoluteWrite` with
  the original PC (a WRAM target stays allowed). For this two-byte STA Mesen's
  data access PC is ECC9; other reached device instructions are three bytes
  long; pinned in [main-scene-video-source.mjs](../tools/main-scene-video-source.mjs).
  The oracle tool now derives the PC end of device instructions from their ROM
  opcode (four-byte long stores in 9AE6, three-byte absolute accesses, the
  two-byte indirect store ECC7); this decoding exists only in the test tool.
- An NMI hits the MVN at 81:DE28 after 1,452 of 2,047 bytes: A=0252, X=5454,
  Y=5455, S=0133, DBR=7E, P=05; its DD54 callback reads the partly cleared
  title buffer by DMA. `move` allows an explicit observation before each byte;
  DDDB uses it for exactly this MVN and the transfer continues with the real
  registers (an NMI played after the whole transfer does not satisfy the
  contract).
- The recorder captures device accesses in all system banks (DDB1 uses DBR 81;
  a bank 00/80-only recorder would lose its port accesses); the physical bank is
  part of every record.
- The whole boot/menu route exceeds four million accessor accesses; the finite
  host budget now applies per outer source composition (reset, startup A133,
  menu A139, game entry 9688, main interval); `resetAccessBudget` keeps
  registers, memory, device and interrupt cursors. The A path needs 4,
  3,408,284 and 667,716 accesses in the first three compositions.
  MainLoopDriver uses the same limits and passes `startupInterrupts` from the
  observation set; without an interrupt list this mode is a limit before a set
  or waiting owner is consumed.
- Runtime budget: 180 s for the extended headless run (also Mesen's own limit
  and the outer watchdog), 600 s host test budget for longer menu runs; no
  contract about game time or console timing.
- Counter-probes move the device stream index of an NMI, remove a compressed
  poll pair, and check both real indirect PPU writes and the SPC byte count.

### Lossless APU poll recording

The two pinned CMP at 81:F00E and 81:F046 are recognised before execution via
real exec callbacks; their read values are fully counted and compressed as
unchanged runs, avoiding repeated serialisation of the whole emulator state via
[`getState`](https://github.com/SourMesen/Mesen2/blob/master/Core/Debugger/LuaApi.cpp);
an independent IO total checks the expansion. This fast path applies only
outside the NMI, without enabled IRQ/HDMA, and while all observed DMA jobs have
fully known forward modes 00/01/08/09 and sources outside the device range;
unknown jobs, other modes, source overflows, IRQ or HDMA switch it off; an NMI
discards the remembered CPU read site. A direct comparison with the previous
unoptimised recording up to E14A gave identical 733,371 IO bytes, all
instruction/NMI records with all interrupted registers and both full register,
WRAM and SRAM images; runtime 117.1 s before, 63.6 s after (one measurement, no
fixed factor).

### Inner unpacker interruptions in the new-game menu

Enable helper EB7B has observations before all eight original instructions,
especially before the RTL at EB88. Unpacker 9F6D, bit helper 9E65 and the
needed 9F49/9F4D/9E7E/9E9B graph observe every reached instruction; MVN
observes every byte before its transfer with the real remaining count,
original indices and current DBR. The first inner NMI at 80:9FF7 has A=030A,
X=0003, Y=0037, S=012D, DBR=7F, P=34; further interruptions lie at
9E65/9E67/9E7B, 9FA6/9FB7, 9FFD and A001/A002/A00E/A01C. The APU wait sites
E1B6/E1B9/E1BB and E510/E513/E515 also get observations before every reached
instruction (their port values stay the shared original IO stream). The fixed
equations in [native-unpack-body.mjs](../src/task/native-unpack-body.mjs) share
the source body from STA DB to PLA between 9F83 and 9E9B (pinned distance E8;
MVN target 7F or 7E), keeping PHP/PHB, real JSR/JSL frames, PHA/PLA, fresh
scratch/pointer/stack reads and the RTS/RTL epilogues; no original
instructions are decoded in the product. Isolated task plans keep their
contract; the explicit startup mode runs on the shared owner. EC16 passes the
set to its data commands and unpackers; E14A falls into section E1B4 after both
graphics streams without an extra stack frame. Source windows stay pinned in
task-native-unpack-spec.mjs, render-9f6d.json, main-scene-video-source.mjs,
main-scene-graphics-source.mjs and the frontend sources.
[main-unpack-interrupt.test.mjs](../tools/main-unpack-interrupt.test.mjs)
compares all registers, scratch and stack before every reached unpacker
instruction and every MVN byte against the original instructions (the test
evaluator has the explicit option repeatBlockMoves); missing entry
observations stop before the first effect; a counter-probe changes the observed
A at 9FF7. The older instruction counts to A139 and E14A refer to the narrower
recorder windows of that time and are still checked exactly; the independent
total checks all current observations.

### Scene build continuations (M3)

9629 observes every original instruction from 966D to RTS 9687; the real NMI
before TSB at 80:9676 runs via the installed C152 callback. A9B2 and AD92 pass
the shared set into their unpacker calls. In the scene/tile graph the chosen
inner observation points sit right before the original instruction, including
8FCB, 9025/9028/9039, 8E57, 903E, 940A, A1E1, 9AE6, 8954, 840E, A9B2 and
F130/F03A. The two horizontally mirrored graphics stores at 9CFA/9D10 belong
only to the branch without vertical mirroring. In APU poll F049 the
interruption is before BNE and the return keeps the real compare flags. The
recording holds the explicit absence of an NMI for every visit of these sites;
all recorded NMIs must be consumed exactly there; an NMI elsewhere stays a
limit (no automatic interrupt planning, no shift to the helper end).
[main-scene-continuations.test.mjs](../tools/main-scene-continuations.test.mjs)
checks registers, scratch and fresh stack at all 20 chosen scene/graphics sites
against the original instructions (its synthetic start WRAM fixture is only for
this equation test); a counter-probe changes the observed S at the first 8FCB
NMI. SPC processor, audible output and real-time timing stay open; the main loop
and its task rounds are not counted by this CPU comparison ending before 96AB.

## Cold owner, task rounds and native NMI

This contract connects the boot comparison with the product main loop driver,
scheduler, script interpreter and natives.

**Original call boundaries.** The recorder starts at cold reset 00:E382. The
real JSR at 80:96C0 marks the next call; only its following entry 80:C1E3
records **B**: all registers including E, both freshly read stack bytes of the
return word, device byte stream index and original instruction counter; the
JSR bytes 20 E3 C1 and return word 96C2 are checked; internal C1E3 visits do not
count as more rounds. For special natives **G** records the real JMP entry
80:F52F: the recorder checks 6C A2 00, reads the target pointer freshly from DP
A2 and takes the real register set and return frame F508; **V** closes the call
only at F509 with its own popped stack frame (nested foreign return visits with
another S do not close it). Both records have their own device and instruction
positions; all records are numbered independently; the real number of 96C3
returns is recorded.

**Shared native owner.** The [comparison](../tools/mesen-boot-prefix.mjs) in
mode driverRounds uses MainLoopDriver with the same NativeCalls accessor,
memory, TaskScheduler and ScriptInterpreter; all native bindings run through
their real modules (no helper stubs, entered task lists or readiness values).
The first round only sets the cursor to the original list head; the second runs
tasks for the first time (331 script opcodes, 52 native calls); dependent init
rounds continue on this state. The B/G/V boundaries split observations by real
owner: main interval to C1E3 and, if needed, its own set for a special native
inside the round; each set holds only its device, instruction/NMI and DMA
observations; unowned gaps, overlapping or incomplete segments and unconsumed
inputs fail; nested scheduler calls inside a native need extra original
segments and stay an explicitly rejected limit. At every B the tool compares
the live VM register set and the just pushed JSR frame; at G and V also target,
owner, stack, registers and global device position; only the fixed JMP/JSR
target PC follows the pinned source contract (observations replace no VM
registers). The validated driver option resetProgramBank keeps the real cold
reset in bank 00 (default 80); PBR is not guessed from DBR; the pinned reset
equations switch to 80:A133 themselves. Counter pairs EECD/EED1 and B0A5/B0A9
are compressed losslessly (half pairs are flushed before IO, NMI or call
boundaries); the independent original instruction counter must match the fully
expanded sequence; no poll round is guessed from an NMI or frame counter.

**Inner interruption and DMA readback.** The original third main pass contains
an NMI at 80:AC8F: animation post-run AC2F has already executed `LDA [$11],Y`;
`AND #00FF` follows only afterwards; the full accumulator and its flags survive
NMI/RTI. The bound equations separate both operations and, in explicit
startupInterrupts mode, consume the record before AND. The
[differential test](../tools/main-wait-interrupt.test.mjs) independently runs
the whole original AC2F and NMI handler with and without NMI and DBR 00/80/81;
its WORD 800A must also survive completely in the NMI save area 1C78. In the
longer intro a real NMI also interrupts 80:FD21 in the
[pinned FB39 glyph build](../tools/task-native-text-compose-source.mjs): M8/X16,
the first BYTE mask store at 2AE0,Y is done, the following INY not yet; the NMI
sees exactly this partly written glyph buffer. NativeCalls and
withInterruptEvents pass startupInterrupts mode to the same text owner; the
recording holds all 1,720 reached FD21 sites including this one interruption;
registers, memory and DMA sources are checked. The first FEC1 call owns its own
real NMIs during its WORD wait points; the interrupt adapters run the original
NMI callbacks (no wait counters or input words injected into WRAM). Such a
callback reads exactly 16 VRAM mask bytes via 81:AA93: channel 5, DMAP 81, BBAD
39, A1B 7E, A1T 2AE0, DAS 0010, VMAIN 80; kept channel values and VMADD come
from the original chronological CPU write stream and are checked against the
natively created jobs; other readback modes stay locked. The recorder marks the
real STA and takes the result bytes at AA98 before STZ 01FC; only REP at AA96
lies between and all eight DMA active flags must already be false (an exec hook
at AA96 alone is insufficient because Mesen can report it before the pending
transfer). This is the immediate DMA result, not a later checkpoint image; the
16 bytes go in proven target order as hardware observation to the
[NMI DMA contract](../src/task/main-dma-readback.mjs). The earlier CPU dummy
read at 213A stays a separate IO record. The global comparison still checks all
forward DMA bytes against live native ROM/WRAM sources and all CPU device bytes
and their order; the readback result is counted separately (no PPU model, no
visible frame comparison).

**First original control and movement.** The first movement proof ended at the
first 96C3 return after the third really returned E014; the current picture
comparison extends the same recording to the first 96C3 return after both full
room pictures, where E014 returns a fourth time (the end follows original
events, not an entered round count or imported save). Until the first hint the
A/Start input stays; then Start is released while periodic A edges finish the
original confirm waits; only after the first returned E014 is right held. All
changes use Mesen's inputPolled input; the original NMIs take the joypad word
themselves (no input writer at 01CA, no new route probe series). G and V at E014
also record the real player slot from 0CC2, its position and speed from
E28/E80/ED8 and D20/D78/DD0, and 01CA; the comparison reads these fields freshly
from its live VM (nothing is taken over). The first E014 in round 1,584 still
has input 0000; the next sees 0100 and computes the original speed FFFD/0003
itself; between the second and third E014 the real main loop movement graph
moves player slot 42 from (1432, 2004, 256) to (1429, 2007, 256). The turn
direction follows the DEC7 tables and the real cold SRAM; both owners and the
final whole memory and register state agree.

**Totals.** The [cold original test](../tools/mesen-cold-rounds.test.mjs)
checks all registers including E and whole WRAM/SRAM, CPU device bytes, forward
DMA sources and observed readback results. A second native replay of the same
data set starts every round with opcode budget 0 and keeps the real scheduler
frame via resume; it also uses main loop budget 1024, keeps the real B0A1 frame
and must end identically. Counter-probes change caller frames, ownership
boundaries, registers and DMA records and must fail; the
[segment tests](../tools/mesen-boot-observations.test.mjs) check missing,
overlapping and unowned observations and each of the 16 readback places. The
extended cold comparison covers 1,587 rounds, 144,274 script opcodes and 13,554
native calls; 2,273 real NMIs and 19,582,782 instruction observations agree;
equal are 1,136,813 CPU device bytes from 217,676 write instructions and
2,000,880 DMA bytes from 7,177 jobs, including eight 16-byte readbacks. Own
special native owners: eight FEC1, four C46E, two CDA8 and the four E014. Budget
and caller counter-probes use the same original data set without a second init.
Visible room pictures with OBJ and PPU write windows are proven by the
[PPU room contract](PPU-ROOM.md). A dynamic PAL clock, free running control,
audible output and later nested native owners stay separate contracts; no new
native/leaf/body counts; the finished M3/M4 proofs are not counted again.

<a id="nintendo-sources"></a>

## Nintendo sources

Primary source: [Nintendo Development Manual Book I](../Ressources/book1_text.pdf)
and the local [CPU manual scan](../Ressources/SnesDevManualCPU.pdf). PDF pages
count from one; the printed identifier is in parentheses. Hardware effects are
recorded separately from the Shadowrun-specific ROM flow and the observed bytes.

| Subject                        | Chapter and page                                                                                | Finding and limit                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DMA and CPU continuation       | Book I ch. 17, PDF 84 (2-17-1)                                                                  | The CPU halts during DMA and continues after completion; no assumed transfer time                                                                                                                                  |
| Direction and address sequence | Book I ch. 28, PDF 149 (2-28-10)                                                                | Bit 7 sets B to A; mode 1 alternates L/H; bits 3/4 select fixed or increasing A address; bits 0..2 = 000 one B-bus port                                                                                            |
| Transfer length                | Book I ch. 28, PDF 151 (2-28-12)                                                                | DAS counts bytes; 0000 means 65,536; the readback contract takes exactly 16 (no generalised readback)                                                                                                              |
| VRAM read ports                | Book I ch. 27, PDF 135 (2-27-21)                                                                | 2139/213A, address from 2116/2117, earlier dummy read and blank access limit; dynamic PPU write windows stay open                                                                                                  |
| NMI enable and acknowledge     | Book I ch. 28, PDF 140 (2-28-1) and 145 (2-28-6)                                                | Bit 7 of 4200 enables V-blank NMI; reading 4210 acknowledges the NMI flag; occurrences and return frames come separately from Mesen, handler and callback from the pinned ROM                                      |
| APU ports                      | Book I ch. 27, PDF 138 (2-27-24); sound ch. 3, PDF 161 (3-3-2); sound ch. 9.10, PDF 194 (3-9-6) | 2140–2143 have separate BYTE input and output registers (written values are no read acknowledgements); BYTE accesses for APU port writes; the handshake sequence comes from EFA5/EFFA/F001, the answers from Mesen |
| MVN                            | CPU manual ch. 10.24, PDF 51 (3-10-12); ch. 11, PDF 62 (3-11-11)                                | Repeated opcode fetch per byte and PC+3 only after the last byte; X/Y increment, A decrement, target DBR, unchanged status flags                                                                                   |
| Native hardware interrupt      | CPU manual ch. 9.11/9.12, PDF 37 (3-9-3)                                                        | PBR = 00, saved PBR and cleared decimal flag; the concrete interrupted iteration comes from the original Mesen run                                                                                                 |

The Shadowrun-specific sequence STA AA93, REP AA96 and STZ AA98 and the job
registers are pinned in the [A9E1 source proof](../tools/main-game-nmi-source.mjs).
