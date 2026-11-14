# Sound driver and sound chip

User decision of 2026-10-20 ([STRATEGY.md](STRATEGY.md)): the sound driver is
ported natively like the code of the main CPU, without SPC700 interpretation in
the product. The sound chip (DSP) is hardware and is built as a device model.
In the long term, music and samples are also available natively.

## Upload and start

F07F calls EFA5 with Y=8000, A=97 (bank) and X=0C55 (length). EFA5 transfers
the 0C55 bytes from ROM 97:8000 to ARAM $0200 using the IPL protocol (Book I
appendix D, PDF 237/238: AA/BB ready, CC start, target word in port 2/3, byte
counter in port 0) and starts them with the last block at $0200. This transfer
has been checked byte for byte against the original since M3
([BOOT-ORACLE.md](BOOT-ORACLE.md)). The lifted version for the live game is in
[src/apu/sound-driver-start.mjs](../src/apu/sound-driver-start.mjs).

EF07 then sends two F007 commands (08 with 0000, 0D with 2020). F007 waits
until port 0 reports token 1CE4 back, writes the parameter word to port 2/3,
the command to port 1 and the next token to port 0.

## Structure of the driver

[sound-driver-source.mjs](../tools/sound-driver-source.mjs) decodes the driver
recursively with the analysis tool [spc700-decode.mjs](../tools/spc700-decode.mjs)
(instruction set Book I appendix C, PDF 227-236). Result: 1513 reachable
instructions in 3002 code bytes with 104 different opcodes; the only external
target is $FFC0 (IPL ROM).

- $0200: DI, CLRP, stack $01EF, basic DSP setup via $F2/$F3 (6C=FF, 2D=00),
  timer 1 with target $14 ($FB) and control $02 ($F1), ready value CA on
  port 1, wait for port 0 = 0.
- Main loop from $0244 (ported natively, see below): the counter outputs
  $FD/$FE determine how often the sequencer ($0A0D) and the effects ($0C89)
  run; then the command poll.
- Command dispatch $02A7-$02C5: if port 0 differs from the remembered token
  $1C, the driver reads port 0/1 (token, command Y) and port 2/3 (parameters
  to $1E/$1F), acknowledges the token on port 0 and writes the operand of
  `CALL $02C2` from the tables $02C8+Y (low) and $02E2+Y (high). This is
  self-modifying code; the native port represents it as a table.
  26 commands $00-$19:

| Command | Target | Command | Target | Command | Target |
| ------- | ------ | ------- | ------ | ------- | ------ |
| 00      | 0619   | 09      | 0956   | 12      | 09B1   |
| 01      | 0635   | 0A      | 0957   | 13      | 05FE   |
| 02      | 0688   | 0B      | 0958   | 14      | 060D   |
| 03      | 068D   | 0C      | 05A0   | 15      | 0611   |
| 04      | 06A3   | 0D      | 0959   | 16      | 0615   |
| 05      | 070E   | 0E      | 0960   | 17      | 09BA   |
| 06      | 0911   | 0F      | 097B   | 18      | 09E3   |
| 07      | 0916   | 10      | 097F   | 19      | 0A00   |
| 08      | 0692   | 11      | 05D0   |         |        |

The CPU side (C46E with 05/06/0F, F130 data loader, F092 directory) is
documented in [reference/render-routines.md#audio](reference/render-routines.md#audio).

## Commands and data path

In the original run from power-on into the first room (recorded room run),
F007 sends 101 commands; only 01-08, 0D, 0F, 10 and 14 are used, most often
the pair 06/05 (channel, then sound FFxx). In addition there are 40,950 pair
transfers via F03A (81:F050/F054/F058).

Data path of the CPU (read from F092, F130, F03A, F122, F1E8):

- 98:FFFA+X holds 24-bit pointers to two directories (X=0: 9F:FEAC,
  X=3: 99:FFC8).
- F092 transfers the base list of the directory (pointer at +2) with driver
  command 01 (parameter: total length-2).
- F130 searches entries of 4 bytes each from directory+5 (number, 24-bit
  pointer) up to number FF and transfers each section with driver command 10
  (parameter: section length).
- Block list: WORD total length+2, WORD ARAM target, then sections until the
  remaining length is 0: WORD n with a 24-bit source (n raw bytes) or
  WORD 8000|n with a WORD fill value (n words).
- F03A buffers one byte and sends it only together with the second one:
  port 1, port 2, then token+1 to port 0. The target word precedes each
  section; a fill byte completes an odd sequence.

Driver side of command 10 ($097F): $0625 delivers the target address to
$6F/$70, the parameter word becomes the counter $71; for each new token the
driver writes port 1 and port 2 to [$6F]. If no new token arrives, X counts
down (the last received token value serves as the counter start) and the loop
ends. In the lag-free model the CPU sends without pause; this abort is a
contract limit of the native driver.

[sound-catalog.mjs](../tools/sound-catalog.mjs) reads the catalogue of all
sound data from it: directory 0 with a base list of 49,539 bytes to ARAM $0EFE
and 22 entries (songs F3-FE to $D083, sound sets 2F-38 to $B58D/$C058),
directory 3 with a base list of 29,053 bytes and 2 entries. This is also the
inventory for the later replacement of the ROM.

## Verification

The optional [Julian Daniels soundtrack](TRIBUTE-SOUNDTRACK.md) retains this
driver and its full DSP output. It adds an output-only mix of the sound-effect
voices and uses the observed song identity to select an OGG arrangement.

[sound-driver.test.mjs](../tools/sound-driver.test.mjs) pins the F07F
parameters, the dispatch bytes, the 26 targets and the number of reachable
instructions. A Mesen case ([trace-spc-exec.lua](../tools/mesen/trace-spc-exec.lua))
records every executed SPC instruction with its successor for 1500 frames:
opcodes unchanged, every successor is PC+length or the decoded target, the
patched CALL reaches only dispatch targets (over 900 transitions, over 90
opcodes). Another case checks all 81,900 transferred data bytes in the recorded
room run (command 01 for both base lists, command 10 for song F8) against the
catalogue; only the fill bytes are excluded. The text layer of the appendix C
tables is too noisy in the local scan for an automatic comparison; execution in
the original therefore proves the lengths of the opcodes used.

## Native port (delivered 2026-10-20)

User decision of 2026-10-20: the envelope model of the DSP already belongs to
this group, because the driver reads ENVX before every key-on.

| Module                                                                                                     | Content                                                                                                                                                         | Source                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [spc-io.mjs](../src/apu/spc-io.mjs)                                                                        | ports, control register $F1, timers, DSP interface, names of the I/O registers $F1-$FF                                                                          | Book I sound part table 3-3-1 (PDF 160), 3.2 (PDF 161), chapter 4 (PDF 162/163), chapter 5 (PDF 164-166), chapter 6 (PDF 167)                                                                                                                                                                                                      |
| [sound-driver.mjs](../src/apu/sound-driver.mjs)                                                            | start, main loop and the 26 port commands                                                                                                                       | ROM 97:8000, disassembly [sound-driver-source.mjs](../tools/sound-driver-source.mjs)                                                                                                                                                                                                                                               |
| [sound-driver-voices.mjs](../src/apu/sound-driver-voices.mjs)                                              | voice and DSP routines shared by commands and timer handlers: key-on, song header and echo, fade, voice choice, release, reset, start of a sound on a voice     | as above                                                                                                                                                                                                                                                                                                                           |
| [sound-driver-sequencer.mjs](../src/apu/sound-driver-sequencer.mjs)                                        | timer handlers: sequencer ($0A0D), effects ($0C89) with glide and vibrato                                                                                       | as above                                                                                                                                                                                                                                                                                                                           |
| [sound-driver-memory.mjs](../src/apu/sound-driver-memory.mjs)                                              | ARAM and register addressing, names of the driver variables and tables, code and stack guard, DIV YA,X, wait results                                            | as above; DIV: Book I appendix C                                                                                                                                                                                                                                                                                                   |
| [dsp.mjs](../src/apu/dsp.mjs)                                                                              | envelope (ADSR/GAIN, release), KON/KOF, BRR decoding, Gaussian interpolation, noise, PMON, volumes, echo with FIR and echo buffer, ENDX/ENVX/OUTX, sound output | Book I chapter 7: PDF 168 (register map, OUTX before VOL), 169 (VOL, pitch), 170-172 (ADSR/GAIN, tables 3-7-2/3-7-3), 173 (ENVX/OUTX per Ts), 174 (KON/KOF, release 8 ms, PMON, NON), 175 (EON, FLG RES/MUTE/ECEN/NCK, table 3-7-4), 176 (ENDX, MVOL/EVOL, ESA, EDL, EFB, DIR), 177 (FIR C0-C7), 178/179 (directory, block format) |
| [dsp-registers.mjs](../src/apu/dsp-registers.mjs)                                                          | names of the DSP registers, their bit fields (FLG, ADSR/GAIN, EDL, PITCH H), directory and BRR layout                                                           | Book I table 3-7-1 (PDF 168), 7.2.1 (PDF 169-172), 7.2.2.4 (PDF 175), 7.2.2.8 (PDF 176), tables 3-7-5/3-7-6 (PDF 178/179)                                                                                                                                                                                                          |
| [apu.mjs](../src/apu/apu.mjs)                                                                              | ARAM, IPL transfer, clock, CPU interface, coupling, sound output per frame                                                                                      | Book I appendix D (PDF 237-239)                                                                                                                                                                                                                                                                                                    |
| [audio-worklet.mjs](../src/browser/audio-worklet.mjs), [sample-queue.mjs](../src/browser/sample-queue.mjs) | playback in the browser at 32 kHz                                                                                                                               | Web Audio (AudioWorklet)                                                                                                                                                                                                                                                                                                           |

The driver classes form one chain along the call layers: `SoundDriver`
(commands) extends `DriverSequencer` (timer handlers), which extends
`DriverVoices`, which extends `DriverMemory`. Each layer calls only itself and
the layers below it. The method names keep the addresses of the original
routines.

Like the original, the driver keeps its whole state in ARAM, including the
helper bytes of the direct page and the patched CALL operand. Wait points are
continuations: WAIT_PORT at a port poll without a new token, IDLE after a main
loop pass without effect. Addressing as in the original (direct page+X wraps
within page 0, $F0-$FF are registers, X/Y 8 bits; each instruction rereads
pointers and voice bytes). If $043F finds no voice, an old helper byte remains
in $2B; this case is also the same as in the original.

For the envelope the manual gives times, not the counter sequence. Rates,
counter phases, the 32 phases of a Ts, the key-on delay and the acceptance of
KON/KOF every second Ts are the known chip behaviour; they are proven by the
Mesen comparison (below) and against the manual tables: the attack times
AR 0-F and the release of 8 ms result from the model.

### Clock contract (lag-free model)

The time of the unit is the Ts (32 kHz); every fourth Ts the 8 kHz prescaler
clocks the timers. One lag-free frame (50 Hz, one NMI) is 640 Ts. The sound
processor is infinitely fast: after each event (CPU port write, timer pulse,
with a deferred key-on every KON/KOF latch) it runs to the next wait point. A
CPU command takes effect at the next poll; the CPU sees the echo at once.

KON/KOF coupling: the DSP latches both registers only every second Ts. In the
original there were always at least two latches between two writes to the same
register (Mesen, over 2000 pairs), so every value took effect. Without time
between the instructions, for example KOF at $07A0 would be cleared in the same
pass by KOF=0 at $0277. The unit therefore makes a new KON/KOF value wait until
the DSP has latched the previous one. The shared write order of both registers
applies: at the end of a note the sequencer ($07A3) writes one KOF per voice,
followed by KOF=0 ($027A) and KON ($0282). If the KON overtook the waiting KOF,
these would switch the freshly struck voices off again; in live mode voices
were missing because of this (user report, Mesen comparison: voice 2 sounded
continuously in the original, never natively). The DSP itself stays exact.
Remainder of the infinitely fast driver: the driver reads ENVX before the key-on;
if the voice just switched off has not yet faded at that moment, it strikes it
a few Ts later in a separate KON (natively 93 and 04 instead of 97).

Echo coupling: the DSP latches EDL only at echo offset 0, so at the latest
after one old buffer length (up to 2048 Ts). The driver changes the echo at
$0366: FLG=FF (echo writes off), EON=0, EDL=0, clearing the area from page
[header+3], then ESA, EDL and FLG=07 from the song header. In the original the
clearing takes about 2500 Ts, longer than the old buffer; the DSP therefore
never wrote with an outdated length (Mesen: over a million echo writes, none
with a length other than the last one written to EDL). In the room replay the
change also falls into a load without NMI, so without audio time. Without
coupling, the old 8 KB buffer from $E800 would run beyond $FFFF into the direct
page and the driver. Therefore an FLG value that enables echo writes waits until
the DSP has latched the last echo length written; following FLG, ESA and EDL
values wait with it in order. The driver never reads these registers.

### Verification

[sound-apu.test.mjs](../tools/sound-apu.test.mjs):

- Timers, counters and port clearing according to the manual; attack and
  release times.
- Sound output according to the manual formulas: a negative VOL inverts the
  phase, MUTE silences, OUTX lies before VOL, P=0800/1000/2000 gives half,
  single and double original rate, PMON gives P(1+y0) to within 2 %, the noise
  clock of all 32 NCK values matches table 3-7-4, the echo delay is exactly
  EDL·512 Ts (16 ms per step, EDL=0 one Ts) plus seven Ts for tap C0 as in the
  game.
- KON/KOF coupling: several KOF, KOF=0 and KON at one instant are latched in
  write order, KON together with KOF=0.
- Live mode against Mesen (300 live rounds with pad 0, live room oracle with
  `sound`): the same number of key-ons per voice, the same sounding voices at
  the first live NMI, sounding NMIs per voice equal to within 5 %; with the old
  coupling the test fails. Menus: with Select the sound stays the same as in
  the original; Start and Y used to end natively after about 80 frames at the
  PPU limit for OBJ line limits. Since HDMA and OBJ line limits
  ([PPU-ROOM.md](PPU-ROOM.md)) both menus continue together with the sound.
- Echo coupling: change from 8 KB at $8E00 to 4 KB at $E800 in one instant,
  FLG waits until the latch, no write outside the area.
- Native against the original instructions
  ([spc700-reference.mjs](../tools/spc700-reference.mjs), tool only): the whole
  CPU port traffic of the room run from power-on and a fixed sequence
  ([sound-apu-schedule.mjs](../tools/sound-apu-schedule.mjs): all songs,
  sounds, remaining commands with their answers, a synthetic song loaded via
  command 10 for the events without a game data example, command 00 into the
  IPL). Every I/O write, the ports and the ARAM except the stack are the same;
  1511 of 1513 instructions are reached. $04C5/$04C7 (INC $05/BRA in $04AC) are
  unreachable because Y runs there from $8D exactly 94 steps to $EA.
- Mesen ([trace-spc-driver.lua](../tools/mesen/trace-spc-driver.lua),
  [mesen-spc-driver.mjs](../tools/mesen-spc-driver.mjs)), 2400 frames from
  power-on: driver and IPL consume every informative read of the original in
  the same order at the same instruction addresses, all writes to $F0-$FF are
  the same, and so are ARAM and DSP registers at 11 snapshots. Excluded are the
  stack, the RAM under $F0-$FF and the echo buffer ESA..ESA+EDL·2K, which the
  DSP writes itself at FLG bit 5 = 0.
- The same run with the exact DSP at the original clock (Mesen cycle/2, 64
  cycles per Ts, counter from power-on; the tracer stamps every read and every
  write with the cycle, and the model runs up to it before each): every DSP
  read, at the end of each of the 2399 frames the whole internal state from
  `emu.getState()` (per voice envelope, BRR address and offset, the twelve
  decoded values, interpolation position; shared counter, noise, echo history
  and pointer, FIR sums, main and echo output, all intermediate values of the
  phases) and at all 11 snapshots the whole ARAM including the echo buffer and
  all 128 DSP registers including ENVX, OUTX and ENDX. The only timing limit:
  in the upload loop $0663-$0680 the native driver writes the second byte
  already at the port read, the original only at $067A. If the DSP reads
  exactly this byte during that time, only the shared intermediate values BRR
  header, BRR byte and directory entry differ (27 frame ends, each at most 32
  cycles after a read of the loop); every voice stays the same. The Gaussian
  table (512 values) is the one from MesenCore.dll.
- Room replay with the unit running alongside: 2273 frames; every handshake
  read of port 0/1 is the native answer or still the value before it, the last
  read of each handshake is the native answer (101 commands, 40,950 pairs, 3157
  IPL bytes). Live mode: Y opens the item list, command 02 is accepted, each
  frame produces 640 sound pairs with audible room music; the run continues
  without a limit, including the HDMA window.
- Browser ([live-game-browser.test.mjs](../tools/live-game-browser.test.mjs)):
  in real Edge the page receives live at a cold start exactly the sound pairs
  of the native DSP up to the frame shown (count and FNV-1a), the AudioWorklet
  runs and plays them. A Node test checks the raw queue (reserve, order,
  zero input when empty, discarding above the limit). Playback then applies
  the separate [nominal PAL 1CHIP output model](AUDIO-OUTPUT.md), after those
  PCM checksums. Analogue output is not part of the DSP comparison with Mesen.
  Empty PCM blocks from startup frames are ignored by the queue so they
  cannot introduce an undefined sample into the persistent filter state.

### Limits

- `sound_driver_command_unknown` (command ≥ $1A), `sound_driver_code_write`
  (write into code that still runs after the start), `sound_driver_stack_write`/
  `_stack_read` ($01E0-$01EF, lowest SP $E6), `apu_program_unknown` (a program
  other than the 0C55 bytes from 97:8000 at $0200).
- In the intro the CPU waits at 81:E1B4 and 81:E50E for port 2 = 2 or 3 (music
  beat $8D, written at $0256). In the lag-free model this wait would need driver
  time without NMI; in the replay the observations supply it.
- Audio time passes only per lag-free frame (NMI). If the game loads without
  NMI, the unit stands still; in the original the sound continues. In the
  browser this results in silence.
- Playback: the frame clock (display, 50 Hz) and the audio clock (32 kHz) run
  separately. The page requests frames on a schedule (frame n at n·20 ms, up to
  four per request when behind); before, it only held every second frame of a
  60 Hz monitor, ran at 30 frames per second and let the sound break off. The
  queue prefills two frames, supplies zero input when empty and discards the
  oldest blocks above eight frames. The output model continues its decay
  during that zero input; it adds a 1 ms reference delay and presentation
  headroom, with its assumptions and baseband limits documented separately.

## Next steps

Sound output and AudioWorklet are delivered (2026-10-20). Still open are the
CPU waiting for the music beat and an audio time for load phases without NMI.

Data accesses stay encapsulated so that driver, music and samples can later
come from native data without the ROM.
