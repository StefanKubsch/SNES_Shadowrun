# Game script language: first decoder and native JavaScript runtime

State 2026-10-03; exactly the ROM with SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`.
Translated from the former German `SKRIPTSPRACHE.md` (original wording at git
commit 20c7b6c9).

This document describes the historical decoder and host runtime state. The
newer physical original body/stack/return contracts are in
[task-scripts.md](reference/task-scripts.md#script-bodies); their current scope
and next block only in the project status. The historical opcode and execution
counts below are no counters of that newer binding.

## Achieved

- 98 even opcode positions `$00–$C2` examined in the dispatch.
- 69 valid opcode formats with handler addresses and operand widths proven.
- 29 entries lead directly or via a JMP to the original fault handler.
- All 937 scripts give a statically decodable control flow graph.
- 930 reached bytecode areas are gap-free and are rebuilt byte-exactly from
  opcodes/operands without stored raw bytes.
- Seven scripts have eight unreachable areas in total; their bytes stay as
  undecoded areas and are not part of the round-trip check.
- 34 operations run on their own in JavaScript.
- `$52` runs other scripts in a cooperative call chain; `$58` passes arguments
  to an explicitly halted game action interface.
- The European wait function `$9F` is implemented for non-zero masks.
- Mask-zero registrations remove the current frame; no own native continuation
  or root result is invented.
- Original script `$04B` runs to its sound call `$4C` after five readiness
  checks.
- An outer scheduler manages several independent call chains, backward
  traversal order and the kept cursor ([SCHEDULER.md](SCHEDULER.md)).
- Five native state actions run through a host adapter: `$060` writes its
  proven data and stops at `$B9`; `$10A/$10B` also run native `$56`, wait once
  and end regularly after the check ([state actions](reference/task-system.md#zustandsaktionen)).
- With a slot state `$B9` is implemented for proven data and even offsets;
  `$060` ends on explicitly synthetic slot data ([slot state](reference/slots.md#slotzustand)).
- `$A9` creates slots from extracted definition data when its fifth argument
  is negative; the path without a free slot returns the original first
  argument; a lifecycle with original `$060` runs in a synthetic control shell
  without proven slot test data; task creation was still missing then
  ([slot creation](reference/slots.md#sloterzeugung)).
- The complete original script `$197` was checked for all 65,536 inputs.
- Original heap and frame initialisation including allocation of the 48
  original task slots are implemented; the optional
  [running heap binding](reference/task-system.md#laufender-heap) uses original
  heap bytes and task slot offsets including release and known old local bytes
  ([frame initialisation](reference/task-system.md#frameinitialisierung)).
- A browser asset package holds 937 scripts with 86,193 bytecode bytes in total
  and the argument/return profiles of the 220 native game actions.

This was the structure of the event language and a first behaviour proof; most
scripts still needed unimplemented game actions; no playable browser game
existed at the time.

## Source evidence and coordinates

The handler listings in `analysis/opcode-handlers.asm.txt` come from the local
machine code; entry assumption E=0, M=0, X=0 (single handlers switch M
temporarily). The dispatch reads a byte from `($00),Y`, increments Y and jumps
via `JMP ($F2B4,X)`. The script allocator stores the original script address
plus two as bytecode pointer at `$80:C320–C324`, so jump targets are absolute
16-bit offsets from the bytecode start **after** the two-byte header — neither
CPU addresses nor relative distances.

| Operations          | Evidence / observed behaviour                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `$00`, `$0A`, `$14` | Read byte/word; `$0A` extends a byte with bit 7 set by `$FF00`                                        |
| `$02`, `$0C`, `$16` | Read a byte offset and load byte/signed byte/word from direct page `$13`                              |
| `$2C`, `$34`        | Read a byte offset, pop a word and store its byte/word from `$13`                                     |
| `$C2`               | Load a fixed byte from `$13` and zero-extend                                                          |
| `$44`, `$46`        | Pop a word, test zero/non-zero; load the target word into Y or skip two operand bytes                 |
| `$48`               | Load the target word into Y                                                                           |
| `$4C`               | Save the continuation Y in a separate return area; load the target into Y                             |
| `$50`               | Restore the saved continuation Y                                                                      |
| `$52`               | Read a 16-bit script ID; load the argument byte count via `$82:E9CC`; enter the script loader         |
| `$56`               | End the whole script call, regardless of local subroutines                                            |
| `$58`               | Read an 8-bit function ID; pop argument words per `$82:DA4C`; select the native target via `$82:D7B8` |
| `$5C`, `$5E`        | Word addition/subtraction; the right operand is the top stack value; 16-bit overflow kept             |
| `$7A`, `$7C`        | Pop the shift count and shift the value below logically that often                                    |
| `$AA`, `$B0`        | Identical equality handler; result `$FFFF` or `$0000`                                                 |
| `$B2`, `$B8`        | Identical inequality handler; result `$FFFF` or `$0000`                                               |
| `$BA`, `$BC`, `$BE` | Duplicate/drop a word; normalise non-zero to `$FFFF`                                                  |

Some complex compare handlers are no ordinary JavaScript comparisons: the
machine routines contain special cases and partly unexpected branches, so the
decoder names them by opcode and their execution stayed locked at the time.
Hardware division and the multiplication/remainder variants also had to be
fully derived before assigning standard maths (later done, see
[task-opcode-handlers.md](reference/task-opcode-handlers.md)).

## Decoder and round-trip check

`src/script/codec.mjs` follows both ways of conditional jumps; for local
subroutines target and continuation (without claiming a continuation is reached
at runtime). Native calls and calls of other scripts are decoded structurally
with a static continuation and referenced in the report. The next script
address or bank end only bounds the examined range; the extracted length is the
end of the highest reached instruction (bytes after it are not automatically
part of the script; this becomes a full length determination only after all
dynamic entry points are checked). The decoder rejects unknown/fault opcodes,
cut operands, targets outside the range and overlapping instructions. Seven
scripts keep gaps between reached instructions:

| Script | Offset range, end exclusive  | Original bytes   |
| ------ | ---------------------------- | ---------------- |
| `$000` | `$0168–$016B`                | `48 6E 01`       |
| `$0DD` | `$006D–$006E`                | `50`             |
| `$23D` | `$0118–$0119`                | `50`             |
| `$279` | `$0172–$0175`; `$01CD–$01CE` | `48 CD 01`; `56` |
| `$2AA` | `$0278–$0279`                | `50`             |
| `$31B` | `$01AD–$01AE`                | `50`             |
| `$337` | `$002B–$002E`                | `48 7E 00`       |

The byte sequences look like extra jumps/returns, but the static entry does
not reach them, so they are not classified as proven executable code.

## First executable original routine: `$197`

ROM `$0DEE22`, CPU `$9B:EE22`, header `02 04`, one word argument and one word
return; 160 bytecode bytes. It stores the argument in a local word and compares
it in turn with `08B2 1458 089D 15D2 079A 0A4F 0D2E 1B6D 0B52 0BA6 078C 0B3D
098B`; a hit returns `$FFFF`, else `$0000` (meaning of the values as game
objects, events or other open). The JavaScript runtime matches an
independently transcribed set for all word values (a semantic proof from the
code, no hardware trace).

```powershell
npm run decode:scripts
node tools/run-script.mjs 197 08B2
node tools/run-script.mjs 197 0000
```

The commands read only `assets/scripts.json`, no ROM file.

## Runtime limits

The JavaScript runtime uses a word stack, byte-wise locals and a separate stack
for local subroutine continuations; it runs no 65816 instructions. The
synchronous runner aborts at game actions; the task runner supports nested
scripts and proven wait checks and halts at other native actions with arguments
and a continuation. The proven state adapter can complete five basic actions
and, with a supplied slot state, `$B9` and the proven `$A9` paths with real
effects; missing data or other functions stay halted, and the outer scheduler
stops too so later tasks assume no unproven effects. Unimplemented bytecode
operations stay faults; no automatic success values for missing actions.
Locals start marked uninitialised and an unproven read aborts instead of
assuming zero; implemented word arithmetic reduces overflows to 16 bit; a step
budget bounds loops; meaning and enforcement of the stack size header stay open
and are not reported as checked capacity; return profiles support zero or one
word. Script calls and a bounded wait check are implemented ([SCHEDULER.md](SCHEDULER.md));
the outer task order and an NMI sync point are proven, full browser timing was
missing; `$9F` is the wait function; `$4C` leads into audio output and `$04B`
halts there until a real implementation.
