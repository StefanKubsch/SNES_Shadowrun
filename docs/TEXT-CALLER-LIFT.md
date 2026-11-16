# Text caller composition

The text producers keep their established decoding, arithmetic, bank and return
contracts. This work separates the text-buffer renderer from register routine
tables. It introduces no hardware effects or timing assumptions. Hardware and
glyph composition remain covered by the existing register-level, dialog, menu
and script-native comparisons described in [WINDOW-CALLER-LIFT.md](WINDOW-CALLER-LIFT.md).

## Delivery phases

1. Text printing: receive a renderer sequence directly, default to live drawing,
   and retain the former dispatched text caller independently in proof.
2. Number printing: use the same explicit renderer interface, retaining its
   former caller and the original decimal arithmetic comparisons.
3. Menu lists: pass the renderer explicitly through drawing and marking;
   resolve legacy tables at the menu entry boundary.
4. Dialog texts: pass the renderer explicitly through dialog and script text
   composition; resolve legacy tables at the register entry boundary.

Phases 1 to 3 each had a release check, handoff, commit and push. After phase 3,
the user changed the cadence: five blocks, each checked and committed, then one
shared release check and push. Phase 4 starts that batch. Register/NMI
interfaces, saves, frame policy, shape editing and S-MIX remain outside this work.

## Phase 1: text printing (2026-11-16)

[text-print.mjs](../src/game/text-print.mjs) receives a renderer sequence rather
than a dispatch table. Without an injected renderer it composes
[text-draw.mjs](../src/game/text-draw.mjs) directly. The original call frame and
bank restoration remain around the renderer, including cooperative pauses.
[text-renderer.mjs](../src/game/text-renderer.mjs) adapts callers that still
supply tables, preserving function-identity continuation lookup and the missing
helper frontier. Table lookup happens when the renderer is reached.

The former caller remains in [proof/caller/text-print.mjs](../proof/caller/text-print.mjs).
[text-caller.test.mjs](../tools/text-caller.test.mjs) compares both compositions
with a renderer that pauses across several segments, at budgets one and seven.
Cases include both source banks, terminal texts and language replacements;
zero budget has no effects. Renderer inputs, buffer bytes, final memory,
registers, bank restoration and actual return are compared. Existing random
decoder, menu and dialog comparisons continue through the compatibility adapter.

## Phase 2: number printing (2026-11-16)

[window-text.mjs](../src/game/window-text.mjs) now gives number printing the
same renderer sequence interface, defaulting to live text-buffer drawing.
Decimal conversion, divider traffic, digit relocation and the bank/return
contract are unchanged. The former caller and cursor remain in
[proof/caller/window-text.mjs](../proof/caller/window-text.mjs).

The cooperative comparisons add zero, digit-count boundaries and the maximum
unsigned word, at both budgets. They assert the actual decimal buffer as well
as matching device traffic, renderer arguments, final memory and returns. The
existing 600 random number comparisons against the register-level original
remain. At this phase, menu lists and register entries adapted their tables at
the producer boundary, before the menu migration below.

## Phase 3: menu lists (2026-11-16)

[menu-list.mjs](../src/game/menu-list.mjs) passes a renderer sequence through
row text, optional numbers, selection marks and page indicators. It no longer
reads or adapts a routine table. Menus and dialog menus receive the same
sequence, and main-upkeep supplies the live renderer directly; the former
one-entry menu text table is removed.

The former [menu list](../proof/caller/menu-list.mjs) imports the retained text
and number producers. The retained menu choice imports this list, so recorded
comparisons cannot silently adopt the new list or producers. The existing 24
menu caller comparisons now supply a sequence on the direct side and a table
on the retained side. They keep navigation, repeat, paging, confirmation,
cancellation and hotkey coverage at both budgets. The random list/mark tests
against the register-level original retain their renderer stand-in via the
explicit compatibility adapter.

## Phase 4 / batch block 1: dialog texts (2026-11-16)

[dialog-text.mjs](../src/game/dialog-text.mjs) passes an explicit renderer through
matching and fallback dialog texts and the two script text natives. Main-upkeep
supplies live drawing directly. Custom dialog service objects and topic actions
retain their existing interface; this block does not change task scheduling.
The former [dialog text caller](../proof/caller/dialog-text.mjs) imports the
retained text and cursor producers.

[dialog-text-caller.test.mjs](../tools/dialog-text-caller.test.mjs) compares
matching greeting/talk, sorted topic insertion with duplicates, restored action
position, fallback and missing text, plus clearing and non-clearing script text.
Both budgets retain zero-budget stability and cooperative renderer pauses.
The shared [fixture](../tools/text-window-caller-harness.mjs) supplies deterministic
arithmetic and services upload branches; real NMI/device coverage remains in
the existing integrations. Eighteen new comparisons passed; the combined focused
text/menu/dialog suite passed 80 tests.

## Five-block batch after the cadence change

1. Dialog and script text renderer interfaces (phase 4 above).
2. Separate live glyph drawing and upload waits from recorded rendering.
3. Compose notice window opening and text directly.
4. Compose the Cortex bomb timer's notice, cursor, number and text directly.
5. Use live menu composition for standard dialog menus, retaining the former
   caller and recorded replacements independently.

Each block gets focused checks and a commit. The shared release follows block
five; its result and the count since the preceding release belong in HANDOFF.md.

## Batch block 2: live glyph drawing (2026-11-16)

[text-draw.mjs](../src/game/text-draw.mjs) always uses live upload waits and no
longer selects startup observations or dispatches recorded polling routines.
The independent [former renderer](../proof/caller/text-draw.mjs) retains both
recorded modes. The existing random glyph, list and menu comparisons now use
that former renderer explicitly for recorded polls; real live integrations
continue through the product renderer.

[text-draw-caller.test.mjs](../tools/text-draw-caller.test.mjs) compares both
renderers on live requests, with empty/plain/wrapping texts, eight styles,
budgets one and seven, and request counters zero, FFFE and FFFF. Each serviced
request payload, arithmetic device write and final game state is compared.
A read-back request wrapping from FFFF to zero does not wait; later requests
still wait normally. Glyph equations, hardware contracts and frame policy are
unchanged. The fixture services uploads rather than emulating NMI hardware.

## Batch block 3: notice composition (2026-11-16)

[notice-show.mjs](../src/game/notice-show.mjs) opens its window and prints its
text directly, passing a renderer sequence. The native entry and script notice
no longer supply an opening/text routine table. Slot allocation, equal-time
replacement order, effect duration, minimum tracking and release are unchanged.
The [former notice caller](../proof/caller/notice-show.mjs) retains dispatch and
imports the retained release. Existing random stand-in comparisons use it.

[notice-caller.test.mjs](../tools/notice-caller.test.mjs) compares the direct
notice against the former caller with retained opening and text producers.
Free, mixed and full slots cover ties and replacement of the last notice,
with and without the effect, at budgets one and seven. Actual window uploads,
renderer input, effect duration, selected slot and final game state must match.

The shared fixture writes tables through WRAM bank 7E and asserts initialized
field contents. During block 3 this corrected an initially incorrect low-bank
fixture write; all 82 affected notice/glyph/dialog comparisons were rerun and
passed. The product arithmetic and window code did not require a correction.

## Batch block 4: Cortex bomb timer composition (2026-11-16)

[time-limit.mjs](../src/game/time-limit.mjs) composes its notice, cursor, number
and suffix directly with the same renderer sequence. The main-loop entry no
longer forwards an upkeep table to the timer. Warning sounds, countdown,
hour reload and script timer APIs are unchanged. The [former timer caller](../proof/caller/time-limit.mjs)
retains dispatch for the independent original/random comparisons.

The notice caller suite adds disabled and expired timers, ordinary countdown,
hour changes and both warning intervals, at both budgets. The former side uses
retained notice, opening, cursor and text/number producers; expected hour and
frame counts, decimal payload and number of rendered texts are also asserted.

## Batch block 5: live dialog menus (2026-11-16)

[dialog-menus.mjs](../src/game/dialog-menus.mjs) always composes live menus for
standard dialog services. Its default renderer is live glyph drawing; it no
longer selects register-level menu composition when no renderer was passed.
Custom service objects keep their existing interface. The [former caller](../proof/caller/dialog-menus.mjs)
retains the previous table interface and recorded register-level path, importing
independent retained menus, opening and release. Existing recorded random
comparisons import it explicitly.

[dialog-menu-caller.test.mjs](../tools/dialog-menu-caller.test.mjs) compares main
and topic choices, confirmation/cancellation and empty/all-flagged topic lists,
including consumed input, window uploads, end marker and result. Four additional
cases omit the renderer on the live side and compare real glyph composition
against the former renderer. Both budgets include zero-budget stability.

The first five-block batch passed its shared release and was pushed.
Actual verification results are recorded in HANDOFF.md. Shared register/NMI interfaces
and other caller tables remain; no save or frame policy changed.

## Modal menus and portraits: action menu (2026-11-16)

The next five blocks cover action menus, Yes/No questions, confirming input,
portrait windows and portrait uploads. They simplify established caller
composition without changing the original arithmetic, hardware setup or frame
policy. The remaining dialog orchestration and other caller tables stay separate.

[action-menu.mjs](../src/game/action-menu.mjs) opens its window and runs the
hotkey menu directly, passing a renderer sequence. Both the glove entry and
the script native use this composition; main-upkeep no longer forwards a
helper table. The [former caller](../proof/caller/action-menu.mjs) retains
independent window release and the injected opening/menu interface. Existing
600 random original comparisons explicitly use that retained caller.

[modal-menu-caller.test.mjs](../tools/modal-menu-caller.test.mjs) compares both
compositions with real window opening, list decoding, input, sound and release.
It covers no actions, Exit, hotkeys, override, cancellation, combined cast flags,
separate open/close flags and the script override reset at budgets one and seven.
The test checks selected flags, script result, uploads, consumed input and final
game state, with zero-budget stability. Drawing and NMI upload service are
stand-ins; existing script-native integrations retain actual devices and NMIs.

## Modal menus and portraits: Yes/No question (2026-11-16)

[yes-no-question.mjs](../src/game/yes-no-question.mjs) composes window opening,
plain menu selection and release directly with the renderer sequence. The
[former question](../proof/caller/yes-no-question.mjs) retains dispatch; the
comparison binds independently retained opening, menu and release callees.
The modal caller suite adds Yes, No, cancellation and navigation back to Yes,
using both budgets and comparing the answer, uploads, input and game state.
The stack-held answer across release and language-dependent window sizing
remain unchanged. Main-upkeep supplies no helper table to this native.

## Modal menus and portraits: confirming input (2026-11-16)

[confirm-key.mjs](../src/game/confirm-key.mjs) calls the live word wait and
pad reader directly. Main-upkeep no longer allocates a two-entry helper table
for each confirming wait. The [former loop](../proof/caller/confirm-key.mjs)
retains the injected callees and its existing source-contract test.

[confirm-key-caller.test.mjs](../tools/confirm-key-caller.test.mjs) compares
the actual live wait and pad reader through both callers, at both budgets,
for each accepted button and their combined mask. Held buttons must first be
released; Start, directions, shoulder buttons and invalid controller words
do not confirm. After an invalid word the fixture releases the pad before
pressing again, preserving the existing previous-held bookkeeping. It compares
each wait, final pressed mask, input count, result and game state.

## Modal menus and portraits: portrait window (2026-11-16)

[portrait-window.mjs](../src/game/portrait-window.mjs) opens and closes with
the live frame wait directly. Its HDMA setup, edge arithmetic and eleven-frame
sequences are unchanged. The [former window](../proof/caller/portrait-window.mjs)
keeps the recorded/injected wait interface; the existing random comparisons
against the original import it explicitly. Main-upkeep supplies no table to
the live window entry points or their continuation factories.

[portrait-caller.test.mjs](../tools/portrait-caller.test.mjs) compares opening
and closing at both budgets with four initial channel masks and three counter
values, including counter wrap. Every frame captures the edge step, full HDMA
table, channel mask and layer mask, followed by an explicit final snapshot.
These snapshots also protect the HDMA bytes inside the fixture's excluded CPU
stack range. The actual game state and device writes are compared as before.
No new hardware interpretation is introduced; the existing portrait contracts
and real dialog integrations retain hardware coverage.

## Modal menus and portraits: portrait uploads (2026-11-16)

[portrait-upload.mjs](../src/game/portrait-upload.mjs) composes first and
second portrait DMA jobs directly, with live completion waits. Main-upkeep
no longer forwards a dialog helper table. The [former upload](../proof/caller/portrait-upload.mjs)
retains recorded polling and injected DMA callees; the random original
comparisons bind this implementation independently. The shared NMI channel
setup remains unchanged. The unpacker's separate startup-interrupt fallback
is outside this upload composition change and remains in the product.

[portrait-upload-caller.test.mjs](../tools/portrait-upload-caller.test.mjs)
compares first/second uploads with both mirror states and job counts zero,
7FFF and FFFF, at both budgets. Completion can span three waits. Standalone
DMA cases cover zero, 0800, 7FFF and already-negative destinations; a negative
request skips the wait after channel setup as before. Each serviced request,
palette index, full tile payload, device write and final game state is compared.
The request and palette are captured explicitly before the fixture excludes
CPU stack bytes, since both fields share that address range. The existing
NMI comparisons retain palette-cycle channel restoration coverage.

All five modal menu and portrait blocks have focused checks and individual
commits. Their shared release result and delivery state are recorded in
HANDOFF.md. Dialog orchestration, member portrait caller tables and the
remaining register/service boundaries are subsequent work.

## Dialog orchestration batch: close (2026-11-16)

[dialog-talk.mjs](../src/game/dialog-talk.mjs) closes the portrait window, waits
for a live frame and reads the pad directly. Object tile reload and sprite
composition retain their existing service table. The independent [former caller](../proof/caller/dialog-talk.mjs)
retains the previous talk and close sequences, including injected callees.
The original random dialog comparison now explicitly exercises that reference.

[dialog-orchestration-caller.test.mjs](../tools/dialog-orchestration-caller.test.mjs)
compares close at budgets one and seven, channel masks with either enable bit,
counter wrap, and idle, confirming and invalid pad words. It checks all twelve
frames, the font DMA writes, game state and return, with zero-budget stability.
Tile reload and sprite rebuilding are recording stand-ins; their real integration
comparisons remain in the existing dialog suites. No hardware contract changes.

## Dialog orchestration batch: windows (2026-11-16)

Talk composes colour clearing, glove and notice release, window opening,
text-width setup and both final releases directly. The established call frames,
arguments, music preservation and allocation order remain unchanged.
The orchestration suite adds complete Exit, cancellation, Talk and topic routes
at both budgets, with real text, menus, portrait unpacking/uploads and window
composition. A synthetic bounded dialog record supplies texts while retaining a
real portrait source. Tile reload, sprites and music are recorded services.
The fixture services each upload and blocking frame; it is not a hardware NMI
comparison. It relocates its CPU stack away from the HDMA fields and captures
those fields explicitly. Former injected call coverage remains independent.

## Dialog orchestration batch: portraits (2026-11-16)

Talk unpacks, separates rows, uploads both portraits and opens their colour
window directly. Original arguments and cooperative call/return ownership stay
intact. The orchestration suite adds both Jake portraits, two music selections
and disabled music, and either partner mirror flag at both budgets. It checks
both complete tile payloads and destinations, the mirror word, frame snapshots,
restored music calls and final state against the former caller. These serviced
NMI fixtures complement the existing real integration comparisons.

## Dialog orchestration batch: text and menus (2026-11-16)

Talk passes its renderer sequence directly to greeting, Talk and topic texts and
both dialog menus, and uses the live greeting frame wait. Custom dialog text
services retain their established interface, including topic actions. The
main-upkeep dialog table now contains only tile reload, sprite rebuilding,
music and the tile reload's shared frame wait. The register entries remain
available for other established callers.

The orchestration suite adds empty topic lists, topic cancellation and actions
that end the dialog after Talk or a topic. Both budgets compare restored action
position, end state, frames, texts, input and cleanup against the independently
retained former caller. Eight new boundary comparisons bring the suite to 88.
No save, task scheduling or lag-free frame policy changes.

## Dialog orchestration batch: member portrait (2026-11-16)

[member-portrait.mjs](../src/game/member-portrait.mjs) composes unpacking, row
separation, the first upload, the second DMA job and eleven live colour-window
frames directly. Main-upkeep no longer constructs a portrait helper table.
The [former member caller](../proof/caller/member-portrait.mjs) retains all
injected callees, and the existing random original comparisons bind it explicitly.

[member-portrait-caller.test.mjs](../tools/member-portrait-caller.test.mjs) adds
48 comparisons across four real portrait records, job-count zero, 7FFF and FFFF,
either initial channel state and budgets one and seven. They check both upload
payloads, palettes and destinations, all edge/frame snapshots, channel state,
job-count wrap, complete device writes, game state and actual return.
The NMI fixture services requests; existing integrations retain actual NMI and
hardware comparisons. Shared scene/service tables and the unpacker's separate
startup fallback remain outside this batch.

## Status menus batch: spell choice (2026-11-16)

[spell-choice.mjs](../src/game/spell-choice.mjs) composes live window opening,
plain menu selection and release directly with an explicit renderer. Main-upkeep
no longer constructs its helper table. The [former caller](../proof/caller/spell-choice.mjs)
retains injection, and the existing 400 random original comparisons use it.
[menu-status-caller.test.mjs](../tools/menu-status-caller.test.mjs) adds twelve
comparisons at budgets one and seven: empty list, Exit, first/last spell,
cancellation and a paged choice. Actual menu input, uploads, text payloads,
result and final state match independently retained window/menu/text callees.
Zero budget leaves memory unchanged. Uploads are serviced by the established
fixture; existing integrations retain actual NMI/device coverage.

The five blocks in this batch are spell choice, equipment rows, skills, notes
and party status. Each retains independent original and caller comparisons.

## Status menus batch: equipment rows (2026-11-16)

[equipment-window.mjs](../src/game/equipment-window.mjs) composes cursor,
text and number printing directly with the renderer sequence. Main-upkeep
removes its equipment table. The [former caller](../proof/caller/equipment-window.mjs)
retains injected callees for original random comparisons. The caller suite adds
twelve cases across leader and other members, absent/present items, dermal
armour and byte-rating wrap, with both budgets. It compares full text payloads,
number digits, writes, game state and return, including zero-budget stability.
Original item lookup, stack-held equipment and bonus arithmetic stay unchanged.

## Status menus batch: skills (2026-11-16)

The skills sequence in [status-submenus.mjs](../src/game/status-submenus.mjs)
composes opening, cursor, text, number, confirming input and release directly.
Its renderer is passed through text and numbers. The [former submenus](../proof/caller/status-submenus.mjs)
retain both routines independently for the existing random original comparisons.
Sixteen new caller comparisons cover no, one, sparse and all skills, including
byte value 255, confirmation and Select ending the status screen, at both
budgets. Text payloads, number digits, serviced uploads, consumed input and
final state/return are compared. The zero-budget check remains. Notes still
uses its table until its separate complete block.

## Status menus batch: notes (2026-11-16)

The notes sequence in [status-submenus.mjs](../src/game/status-submenus.mjs)
now composes opening, cursor, text, confirmation and release directly too.
Main-upkeep removes the submenu table, including its shared enrichment entry.
The independent former notes implementation already retained in the preceding
block supplies the reference. Twenty new comparisons cover a runner with and
without a datajack and all eight combinations of Jake's cyberware flags, at
both budgets. They compare each text, upload, input, return and game state,
and assert the number of visible entries. Window sizing and row ordering
remain as before; the existing original comparisons remain independent.

## Status menus batch: party status (2026-11-16)

[party-status.mjs](../src/game/party-status.mjs) composes glove and notice
release, window opening, cursor/text/numbers, confirming input and final
release directly with the renderer sequence. Main-upkeep removes the party
status table. The [former caller](../proof/caller/party-status.mjs) retains
injection for the original random comparisons. Twelve new caller cases cover
one, two and four members, leader-only display, an odd last index and pending
glove/notice cleanup, at both budgets. Byte maxima and real runner records
exercise the count and magic columns. Text and number payloads, uploads,
input, return and final state must match.

Ten further comparisons omit the renderer on the product side for all five
new compositions, and use the independently retained real glyph renderer on
the former side. They require actual glyph upload requests. All 82 caller
comparisons and the affected original, production and inventory checks passed.
The fixture services uploads; existing real NMI integrations remain. No
hardware, save or frame-policy contract changes. These five blocks have their
own focused-check commits; shared release results belong in HANDOFF.md.

## Member and scene batch: decimal numbers (2026-11-16)

The decimal formatter composes its renderer directly, preserving the original
call frame and data bank save/restore. The independent former formatter keeps
the injected renderer for the existing original random comparisons. The new
member caller suite compares zero, digit and comma boundaries, billions and
the maximum unsigned word pair at budgets one and seven, with both captured
text and actual glyph uploads. Uploads are serviced by the fixture; established
NMI integrations retain the hardware coverage.

## Member and scene batch: spell menu windows (2026-11-16)

The member spell menu composes opening, plain selection and release directly,
passing its renderer. Script execution and scene services retain their table.
The former caller remains independent for original random comparisons. New
caller cases cover empty and full spell lists, Exit, leader selection, cancel
and the status entry for another runner, at both budgets and with real glyphs.

## Member and scene batch: spell cleanup (2026-11-16)

The member spell caller composes confirming input, notice release and status
equipment rows directly. Its reduced service table retains script append,
nested visit, window-list reset and portrait display. Caller cases independently
record those scene services and cover script end, redraw, notices and their
combinations. Both budgets compare consumed input, payloads, uploads and state.
The fixture's notice points at its open window; scene allocation is not inferred.

## Member and scene batch: spell native entry (2026-11-16)

The spell native composes its member menu directly and forwards the renderer
through the original JSR frame. The injected menu override lives only in the
former caller. New entry comparisons use Jake's actual runner record and cover
empty spells, Exit, selection and cancellation with both budgets and renderers;
member index and menu-mark cleanup are asserted. Original override comparisons
remain unchanged on the independently retained caller.

## Member and scene batch: item use cleanup (2026-11-16)

Item use composes confirming input, notice release and equipment rows directly,
passing the renderer through. Object creation, the nested script visit and
portrait/list services keep their interface. The former caller retains all
injected calls for the original random tests. Caller comparisons cover three
actor records, coordinate word maxima and end/redraw/notice combinations at
both budgets. Two further cases require actual default glyph uploads.
The controlled creation/visit services record arguments and return normally;
the existing route comparison retains real object and scheduler integration.

## Member and scene batch: item menus (2026-11-16)

All three item classes compose opening, numbered selection, item use, tile
clearing and release directly with the renderer. Main-upkeep reduces their
services to object creation, nested visit, list reset and portrait display.
Caller tests use real actor/kind records for each class, covering empty lists,
Exit, cancel, use ending the screen and removal followed by list rebuilding.
Both budgets compare uploads, text/count payloads and final state; two default
renderer cases include real glyph uploads. The former item caller and its
original random comparisons remain independent.

## Member and scene batch: status windows (2026-11-16)

The status screen composes glove and notice cleanup, both window openings and
all window releases directly. Sound, colour setup, display and submenu services
retain their existing calls. The former complete status caller remains the
reference for original random tests. New caller cases cover native, Start and
immediate-item entries for Jake and another runner, leader fallback, cancel
and a submenu, comparing input, uploads, game state and sound restoration.
Budgets one and seven retain the zero-budget stability check.

## Member and scene batch: status text and numbers (2026-11-16)

Status attribute labels, cursor positions, numbers and decimal money now
compose directly with the explicit renderer. The record-pointer chronology,
skipped byte, byte maxima, magic scaling and bank restoration remain unchanged.
The independent caller suite adds default live glyph comparisons for Jake and
another runner at both budgets. Existing status fixtures use maximum karma
and money, capture every text payload and compare full game state and uploads.

## Member and scene batch: status equipment and portraits (2026-11-16)

The status caller composes equipment rows and member portraits directly.
Caller comparisons now use the independently retained real portrait caller,
including real unpacking, both uploads and eleven colour-window frames. The
fixture relocates the CPU stack, captures full portrait payloads, palettes,
HDMA bytes and final edges explicitly, and excludes only that relocated stack
from game-state snapshots. Jake's alternate portrait adds two boundary cases.
The fixture services NMI requests; existing real integrations retain device
and NMI coverage. Sound, colour setup and scene cleanup remain services.

## Member and scene batch: status menu orchestration (2026-11-16)

The status caller composes plain selection and all six submenus directly with
the renderer: three item classes, member spells, skills and notes. It still
reads the original submenu jump table and rejects unknown targets before
constructing their frame. Main-upkeep retains only script/scene and sound
services for this path. The former status caller dispatches independently
to retained real submenus. New comparisons visit all six rows, including
confirming waits and return to the outer menu, with both budgets and real
glyphs. Immediate-item entry now also runs its actual numbered menu.

All ten complete phases have individual focused checks and commits. Shared
release and delivery results belong in HANDOFF.md. Object creation, nested
script visits, window-list reset, portrait redraw services, sound commands,
colour setup and scene cleanup retain their established interfaces. Hardware,
save and lag-free frame policy are unchanged.

The final orchestration checks also confirm Select ending the screen from
skills, while Select only confirms notes and returns to the outer menu. An
unknown submenu target reports the same frontier as the former caller before
constructing its frame. Both budgets are covered.

## Main, save and karma composition batch (2026-11-16)

The ten phases cover main menu windows and selection, the blocked-save notice,
save-slot selection, direct main/submenu orchestration, karma balance rendering,
purchase notices, list rendering, list purchase orchestration, karma windows
and category/list orchestration. Each phase keeps independent former callers
and original comparisons. SRAM layout, sound commands, hardware and lag-free
frame policy retain their established contracts.

### Block 1: main menu windows

[main-menu.mjs](../src/game/main-menu.mjs) composes opening, plain menu selection
and release directly, forwarding a renderer sequence. The choice remains on its
original frame across release. Save and karma remain services until block 4.
The [former caller](../proof/caller/main-menu.mjs) retains dispatch for the
original random comparisons. [Caller comparisons](../tools/main-karma-caller.test.mjs)
cover Exit, cancellation, both submenu choices and real default glyphs with
budgets one and seven. Uploads are serviced; existing real NMI integrations
retain hardware coverage. Every case retains zero-budget stability.

### Block 2: blocked-save notice

The save caller directly opens the blocked-save notice, prints its text, waits
for confirmation and releases the window. Countdown zero, one and the largest
positive word retain the blocked branch; captured text and real glyph cases
compare independently at both budgets. Save eligibility and SRAM are unchanged.

### Block 3: save-slot selection

The allowed-save branch opens and selects directly with the same renderer,
then releases its window. Caller cases cover both slot counts, every slot, Exit
and cancellation at both budgets. They compare the entire SRAM and assert the
selected slot checksum and unchanged SRAM on Exit/cancel. Slot four also uses
real glyphs. The existing save implementation and sound service are unchanged.

### Block 4: main submenu orchestration

The main menu calls its save and karma sequences directly through the original
frames. The caller comparisons now enter the actual save/karma menus, return
and exit the main menu; the former side binds independent retained submenus.
Karma balance drawing is real; resource refill remains a recorded service here.

### Block 5: karma balance

Karma balance directly composes tile clearing, cursor placement, text and number
printing. The displayed value remains the original karma word divided by eight.
Cases at the division and decimal boundaries, zero and the maximum word compare
captured payloads and actual default glyphs at both budgets. The original random
karma comparisons now explicitly use the independent former caller.

### Block 6: purchase notice

Step purchase directly composes the insufficient-karma window, text, confirming
input and release. Both WRAM banks, zero cost, byte wrap and exact/insufficient
cost boundaries compare memory, payment and pointer clearing at both budgets.
Default glyph cases cover the notice. The cost remains eight times the byte;
the successful purchase path and its arithmetic retain their existing contract.

### Block 7: karma list rendering

All three lists directly print their header, clear their list tiles and select
from the numbered rows with an explicit renderer. Empty lists, values at their
limits, sparse and full lists compare against independent retained lists at
both budgets; the terminator and input count are asserted. All three also run
with default glyphs. Purchase, balance refresh and Body refill remain services.

### Block 8: karma list purchases

Lists call purchase and balance refresh directly through their original frames.
Paid, insufficient and limit-reaching upgrades cover each list, cursor rebuilding,
failed-pointer clearing and Body's count refill. The Body case starts at count
250 and checks its byte wrap to four. Both budgets and real glyphs compare
against the retained purchase/line composition; resource refill stays a service.

### Block 9: karma windows and cleanup

Karma directly releases notices and the glove, opens all four windows, clears
category tiles and releases its detail/category/balance windows. Exit and cancel
cover no pending windows, notice, glove and both; all category detail windows
open and close at both budgets. Default glyph cases include pending cleanup.
Category selection, balance and lists retain services until the final phase.

### Block 10: karma orchestration and live entry

Karma directly composes balance, category selection and all three upgrade lists,
forwarding the renderer through main and save callers. The main-upkeep table
now holds only sound, state-count refill and magic refill. Direct comparison
callers receive only those surviving services, preventing hidden fallback to
menu tables. Full routes buy or reject a step in each category, return to the
category menu and exit, checking cost, value, refill calls and consumed input.
All categories and both main submenus also compare real default glyphs with
the independently retained former composition at both budgets.

All ten phases have focused-check commits. Shared release and delivery state
belong in HANDOFF.md. Hardware, SRAM format, sound and frame policy are unchanged.
The remaining scene services are separate work; shape editing and S-MIX stay
deferred.

The actual main-upkeep entry comparisons also use real runner refills, checking
health and magic restoration. Importing the scene graph installs an observed
wait factory for the same address as the fixture's live wait. The menu fixture
now binds its live wait by its own function identity, so retained caller tests
keep their explicit live-wait contract regardless of those scene imports.
Unexpected upload waits report their original address for diagnosis.

## Remaining menu services batch (2026-11-16)

The ten phases compose spell portraits, item portraits, spell list redraw,
item list redraw, status colour setup, status sound, runner resource redraw,
karma magic refill, karma state-count refill and save sound. Each phase
keeps independent former callers and existing original comparisons. Nested
script visits and object creation remain explicit services.

### Block 1: spell portrait redraw

The member spell caller directly composes the member portrait after a script
requests redraw. Its original frame and redraw/end ordering are unchanged.
The caller fixture now uses the independently retained real portrait on the
former side, comparing both tile payloads, palettes, eleven frame snapshots,
HDMA fields, writes and final state. Ended scripts skip redraw. The CPU stack
is relocated and excluded explicitly; portrait fields remain captured.
Uploads are serviced; existing integrations retain real NMI coverage.

### Block 2: item portrait redraw

Item use now composes member portraits directly after the nested visit requests
redraw. Ended visits still return before any redraw or notice processing. The
item caller suite uses the same retained real portrait comparison at both
budgets, for three actor records and end/redraw/notice combinations. It asserts
two uploads and eleven frames only when the portrait is requested and reached.
Object creation, visit and list reset remain services at this phase.

### Block 3: spell window-list redraw

Spell cleanup directly composes the existing window-list reset sequence through
its original JSL frame. The sequence is now exported for composition; the
register adapter uses the same body. The comparison binds the independent
former reset and its drawing/upload chain, so redraw requests compare actual
window map uploads before the real portrait. End/notice ordering and nested
script services are unchanged.

### Block 4: item window-list redraw

Item cleanup also composes window-list reset directly. All three actor cases
compare the actual former redraw and portrait chain, including combinations
with notices and early end. The direct member/item scene tables now contain
only script append, object creation and nested visits. Redraw allocation,
map reconstruction and upload waits keep their established contracts.

### Block 5: status colour setup

The status screen composes its established fixed-colour reset directly through
the original JSL frame. The retained caller still receives that same reset as
an independently dispatched callee. Existing full status routes compare the
actual COLDATA and CGADSUB writes alongside window, text and portrait output;
all native, Start and immediate-item entries retain their source ordering.
No hardware interpretation or colour equations change.

### Block 6: status sound commands

Status entry and close directly send their volume target commands through the
original long frames. The retained side binds the register-level command sender,
including its echo handshake, rather than a recording stand-in. Full routes
compare the actual dim/restore parameter writes and command tokens. Additional
cases cover token wrap at FE and FF with both budgets. Sound driver, hardware
handshake and volume parameters are unchanged; scene closing remains a service.

### Block 7: runner resource redraw

State-count raising and full runner restoration now directly compose window-list
drawing through their original JSL sites. This shared dependency is completed
before the karma refill callers. The independent former resource caller retains
its table and the retained window list. The existing injected original-frame
comparison explicitly exercises that former caller. New caller comparisons
exercise both actual drawing chains at both budgets, with zero/max amounts,
missing object records, two members and upload counter wrap. The resource
arithmetic and original random body comparisons remain unchanged.

### Block 8: karma magic refill

Karma exit directly composes the established magic-point native through its
original frame. Former callers bind the register-level magic refill, and all
karma/main fixtures now initialize a valid real leader record. Additional
cases cover zero Magic, the byte maximum, ten-times scaling beyond a byte,
and initial points zero, 250 and 255 at both budgets. Final byte truncation
remains the original behaviour. Health refill remains a service in this phase.

### Block 9: karma state-count refill

Body purchases and karma exit directly compose state-count raising, including
the shared window-list redraw completed in block 7. Karma menus and lists now
receive only their renderer, with no service table. Former comparisons use
the retained resource caller and retained window list. Purchase cases assert
the actual count refill after the maximum wraps from 250 to four; full routes
assert health and payment together. Additional cases cover zero/max health,
counts below and above the limit and absent object records at both budgets.

### Block 10: save sound and final menu entry

Save directly composes its established sound-effect routine through the original
JSR frame. Main/save/karma entry points now receive only their renderer; main-upkeep
no longer allocates a menu service table. The retained callers keep dispatch and
real sound callees, with the existing register-level audio comparisons unchanged.
All save slots assert the actual save-sound parameter only after a successful
save; Exit/cancel preserve SRAM and omit that sound. Voice-mask reuse and command
token wrap compare at both budgets. SRAM format, sound values and frame policy
are unchanged. The final caller checks supply only surviving script/scene
services to member and status callers, preventing hidden menu-table fallback.

All ten phases have focused-check commits. Shared release and delivery results
belong in HANDOFF.md. Member script append, object creation, nested visits and
status scene closing remain explicit services. Shape editing and S-MIX remain
deferred.

## Scene service composition batch (2026-11-16)

### Block 1: member script append

The spell menu composes task append directly through its original JSR frame.
The former caller retains dispatch and now binds the actual task append in
caller comparisons. Script cleanup combinations compare real task frames and
WRAM at budgets one and seven; nested visits remain controlled services.

### Block 2: item object creation

Item use composes object creation directly through its original frame. The
former caller binds the independent register-level creator, using actual kinds,
actor scripts, task tables and one free object slot. Item classes, cleanup
combinations and coordinate word maxima compare at both budgets.
The nested visit reads task state, so its comparison omits the creator's
unused leftover Y register. Object and task writes remain fully compared.

### Block 3: member nested visits

Member spells compose the scheduler's nested visit directly through the original
JSR frame, preferring a resumable child and retaining the synchronous round hook.
Missing round hooks retain the established frontier. Spell entry points no longer
receive a service table. Existing cleanup combinations exercise both hook paths
and compare independent former callers; scheduler integrations remain unchanged.
