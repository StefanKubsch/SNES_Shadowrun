# Initial analysis: European Shadowrun ROM

File examined: `Shadowrun (E).smc`, 2026-10-03.

This document records the initial analysis. The subsequent decoder,
extracted asset package and first executable script component are described
in [SCRIPT-LANGUAGE.md](SCRIPT-LANGUAGE.md). Script calls and wait checks added
afterward are described in [SCHEDULER.md](SCHEDULER.md). Implementation and
test coverage statements below refer to that early stage, including its
recorded follow-up work; they do not describe the current project status.

## Identity and format

| Field              | Value derived from the local file                                  |
| ------------------ | ------------------------------------------------------------------ |
| Size               | 1,048,576 bytes / 1 MiB / 8 Mbit                                   |
| SHA-256            | `91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690` |
| Copier header      | None                                                               |
| Internal title     | `SHADOWRUN`                                                        |
| Header file offset | `$007FC0`                                                          |
| Mapping            | `$30`: FastROM / LoROM                                             |
| Cartridge type     | `$02`: ROM, RAM, battery according to the header                   |
| SRAM               | 8 KiB according to the header                                      |
| Target region      | `$02`: Europe / PAL according to the header                        |
| Revision           | `$00`                                                              |
| Checksum           | Stored and calculated: `$2F63`                                     |
| Complement         | `$D09C`; XOR with the checksum gives `$FFFF`                       |

The header and checksum confirm this file's internal consistency. They do
not replace comparison with an independent cartridge dump. Tool addresses
and identity checks refer to this exact file.

The LoROM file offset for ROM windows is
`(bank & $7F) * $8000 + (address & $7FFF)`.
RAM and hardware addresses are excluded before conversion.
Generated addresses mostly use bank mirrors `$80–$9F`.

## Startup and interrupts

- Reset vector: `$00:E382`, file offset `$006382`.
- Native NMI vector: `$00:C112`, file offset `$004112`.
- Other valid vector fields point to `$00:F2B3`, which contains `RTI`.

The reset code disables interrupt sources and DMA, writes zero to APU ports
`$2140–$2143` and sets forced blank through `$2100`.
`CLC; XCE` switches the CPU from emulation mode to native mode.
This is an operating mode of the original CPU, not planned browser emulation.

`PEA $8080; PLB; PLB` sets the data bank to `$80`. Hardware initialization
follows, with `REP #$30` for a 16-bit accumulator and index registers,
Direct Page `$0000` and stack pointer `$013F`. A 16-bit write to `$420D`
enables FastROM. `JML $80:A133` transfers control to the program entry.
It first calls `$80:A15C`, which in turn calls `$81:E7BC`.

The NMI entry begins with `REP #$30`. It saves the accumulator at
`$7E:1C78` and the previous stack pointer at `$7E:1C7A`, switches to stack
`$1CBB`, saves further registers and increments `$1C76`.
The call to `$80:C14F` leads to `JML [$006E]`: the actual NMI workflow
therefore depends on a RAM pointer and remained open in this initial analysis.

## Event scripts: European tables located

The public US randomizer reference provided a search hint. European offsets
were derived independently from accesses in the local ROM. The US addresses
do not match here; script names and IDs must also be checked before reuse.

| Table                        | File offset | CPU address | Evidence in the local code                        |
| ---------------------------- | ----------- | ----------- | ------------------------------------------------- |
| Script banks                 | `$015B28`   | `$82:DB28`  | `LDA $82DB28,X` at `$80:C2C8`                     |
| Script pointers, 16 bits     | `$015ED1`   | `$82:DED1`  | `TXA; ASL; TAX; LDA $82DED1,X` at `$80:C2D8`      |
| Script return sizes, bytes   | `$016623`   | `$82:E623`  | Access at `$80:F4A9`                              |
| Script argument sizes, bytes | `$0169CC`   | `$82:E9CC`  | Accesses at `$80:C2CE` and `$80:F469`             |
| Native function pointers     | `$0157B8`   | `$82:D7B8`  | Access at `$80:F500`                              |
| Native return sizes, bytes   | `$015970`   | `$82:D970`  | Access at `$80:F51D`                              |
| Native argument sizes, words | `$015A4C`   | `$82:DA4C`  | Access at `$80:F4D6`, followed by a word-pop loop |

Table spacing gives 937 script entries and 220 native function entries.
All pointers refer to valid ROM addresses; targets within each group are
distinct in this file. These counts come from adjacent tables, not from an
already reconstructed script loader with an independently proved maximum ID.

During script allocation, the code reads two header bytes at the start of
the script and adds `$17`. Their association with scratch space and maximum
stack size initially came from the US reference. The European code confirms
their contribution to the allocation size, but not every detail of their
meaning. The exact script length cannot be derived from this header.
The subsequent [task heap analysis](reference/task-system.md#taskallokation) models the size
calculation exactly: two 8-bit ADCs, preserved Carry when adding `$17` and
byte overflows. At that stage, the heap was implemented separately but was
not yet connected to running script frames or their original slot management.
The [separate frame initialization](reference/task-system.md#frameinitialisierung) subsequently
used the heap for the proved data writes and allocation of free task slots.

The native dispatch routine at `$80:F52F` is `JMP ($00A2)`.
Function arguments are first copied from the script stack to Direct Page
words. A return word is pushed back onto the script stack afterward when
required. Reconstructing the 220 functions themselves remained open at
the time of this analysis.

## First directly proved script operations

Dispatch at `$80:F389` reads the next byte from `($00),Y`, increments Y,
masks to eight bits and jumps to the handler through `JMP ($F2B4,X)`.
Opcode values index this table as byte offsets, not entry numbers.

| Opcode | Handler    | Observed operation                                      |
| ------ | ---------- | ------------------------------------------------------- |
| `$00`  | `$80:F398` | Read the following byte, mask to 8 bits, push as a word |
| `$14`  | `$80:F3B1` | Read and push the following little-endian word          |
| `$BC`  | `$80:F8BB` | Discard one word                                        |
| `$C0`  | `$80:F393` | Push word `$0000`                                       |

These four operations are implemented as separate JavaScript operations in
`proof/script/stack-primitives.mjs`. The initial version still lacked calls,
returns, local variables, branches, timing and native game actions. The
recorded follow-up work implemented the first five areas partly or fully
for a bounded call chain; the linked analyses describe their limits.
Missing opcodes remained errors.

## Limits and verification

The 65816 disassembler knows all 256 opcodes and tracks explicitly supplied
E/M/X flags, as well as `REP`, `SEP` and resolvable `XCE`.
It stops at calls, unknown status restoration, returns and unconditional
jumps. Conditional branches are recorded as references; only the fallthrough
path is listed. This produces neither a complete control-flow graph nor a
reliable separation of all code and data regions.

The NMI and script routine excerpts use documented entry assumptions
E=0/M=0/X=0. Only the reset and its direct transition have an initial mode
fully derived from reset behavior.

The eleven tests at that time checked bank mapping and invalid addresses,
immediate lengths, mode changes, termination boundaries, relative branches
and PC wrapping, plus the ROM checksum, reset transition, script tables and
the four stack operations. ROM signatures anchor the analysis to the
examined file; they do not establish a comparison of complete game flows.

## References

- [WDC W65C816S datasheet, opcode matrix and CPU flags](https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf)
- [PVSnesLib: SNES ROM header](https://github.com/alekmaul/pvsneslib/wiki/SNES-ROM-Header)
- [Osteoclave: Shadowrun randomizer, US ROM](https://github.com/Osteoclave/shadowrun-randomizer)

The former local randomizer snapshot and its README were removed from
`references/` on 2026-11-02 because no game code, generator or test used them.
They remain recoverable from Git history. The snapshot was a research
reference only, was not executed and was never part of the browser runtime.
Historical snapshot SHA-256:
`8cb0a8c147c04191ffcfaec2583ddfeb6b85a797cb64a707f22b3534c428e6ff`.
It was retrieved from the main branch on 2026-10-03; the version recorded
in the code was `2025-06-10`.
