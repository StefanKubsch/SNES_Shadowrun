# Saving in the browser

As of 2026-11-09. Code: [save-file.mjs](../src/browser/save-file.mjs),
[game-worker.mjs](../src/browser/game-worker.mjs),
[start.mjs](../src/browser/start.mjs). Tests:
[live-save.test.mjs](../tools/live-save.test.mjs) (native),
[live-game-browser.test.mjs](../tools/live-game-browser.test.mjs) (real Edge).

## Shared serializer (2026-11-28)

[srm.mjs](../src/storage/srm.mjs) owns the saved field layout, slot offsets, slot
checksum, global settings and settings checksum. Saving, title loading and slot
descriptions all use this codec. [saved-game.mjs](../src/state/saved-game.mjs) reads
and restores the scene and combat owners by field name. The serializer covers every
saved byte, including interleaved equipment and odd word positions; it does not need
the original cartridge or an image of work memory. Original 8 KiB saves and the
16 KiB extension remain compatible. Invalid slots and incomplete images are rejected
before mutation. [srm.test.mjs](../tools/srm.test.mjs) checks the Mesen save fixture,
complete layout coverage, both storage modes and isolation of slots and settings.

## Slot descriptions (2026-11-22)

The Save/load game overlay shows a card for each available slot, including
before starting a session. Cards show the saved room and, when known, the
local save date and time. Unknown dates are omitted. Empty slots are labelled explicitly. Stored slots
3/4 remain visible with an explanation when the four-slot option is off;
their save actions are hidden. Loading still uses the game's title menu.

[save-details.mjs](../src/browser/save-details.mjs) validates slots with the
shared serializer's checksum and saved room field. New-game room 3 is the morgue
(`src/game/game-start.mjs`); the recorded apartment fixture
`tools/mesen/saves/apartment.srm` holds room 345. These two entries have
English/German names. Other entries display their decimal room number until
their names are established. This is the saved room entry, not Jake's position.

Browser metadata is separate from SRAM under `shadowrun.save-details.1`.
The stable-SRAM notification covers both bed and browser saves. Changed valid
slots and explicitly completed saves get a new timestamp. Other slots keep their
date. Exact Base64 of the complete saved slot bytes binds each date to its
content. Changes to global SRAM options do not change slot dates. An 8 KiB
session preserves the extra slots and their metadata. Import never creates
a save date: matching metadata can remain, while different content discards
it. Old saves and absent or malformed metadata simply omit the date.
The timestamp is the browser's local clock at the stable-save notification,
not historical information extracted from SRAM. Completed byte-identical saves
also update their date and preview. Normal `.srm` exports contain
only game data; optional dates remain in the browser.

The first step did not include previews or total play time. The previous
description of changed slot byte 024C as play time was unproved; a differing
byte alone does not establish that meaning. A play-time field needs its own
source evidence before display. Previews are described below.

Tests: [save-details.test.mjs](../tools/save-details.test.mjs) covers fixture
room decoding, per-slot dates, changed valid imports, checksum damage,
extra-slot preservation and malformed metadata. The
[import browser test](../tools/save-import-browser.test.mjs) checks actual
cards, omitted imported dates, empty slots and narrow layout.

## Slot previews (2026-11-22)

Each slot card reserves a 4:3 picture area. A stored preview appears there;
older saves, empty slots and unavailable or damaged previews show a localized
placeholder. The accompanying note explains that the picture is the latest
unobstructed room view and that loading resumes at the room entrance.
Previews have localized alternative text and remain inside the responsive cards.

[save-preview.mjs](../src/browser/save-preview.mjs) retains a reusable 128 x 112
RGBA sample of the latest eligible frame, before object markers, CRT effects
and worker frame transfer. Eligibility uses `saveAnywhereReachable`, a closed
glove and a negative `WINDOW_LAST_INDEX`. The negative last index is the empty
window-list result of `src/game/window-release.mjs`. Thus bed and dialog
windows retain the earlier free view rather than replacing it with their menus.
The cache retains only two recent room headers. The actual bed route briefly
visits entry 347 and then restores the saved entry 345; retaining both lets the
return use the earlier matching apartment view. A room without a cached eligible
view has no preview; a different room header's picture is never substituted. The cache
starts empty for each game session. This is a presentation policy, not new SNES behavior.

Room table entries select entrances rather than unique physical rooms.
`previewRoomKeys` uses the original header mapping from `src/data/rooms.mjs`.
The user's reported saved entry 170 and entry 335 share one header; a capture
through either entry is valid for the other's saved room. Distinct headers
remain separate. This alias case is covered against the actual data package.

At the stable SRAM notification, the worker selects a separate thumbnail for
each valid saved slot's room header and transfers it alongside the save. The
page encodes the small copies as PNGs once per notification. Changed valid
slots and explicitly saved slots receive an image tagged with their saved
entry. Missing captures clear the saved slot's earlier image. Other
slots retain their own previews, including slots 3/4 during an 8 KiB session.
Images use the existing metadata record and exact slot-byte identity. Imports
preserve only matching metadata; importing different content cannot display an
old preview. `.srm` exports contain neither PNGs nor other browser metadata.

After writing the checksum, `saveGame` calls the optional `memory.onSaveSlot`
presentation observer. The worker requests a stable SaveWatch notification
and records the completed slot numbers, including when the save bytes are
identical. The notification still waits one unchanged frame. This observer
does not change saved bytes, game state or input recordings. An identical
import is not a completed save and retains existing metadata instead.

PNG data URLs are type/size checked before use. Encoding failure yields the
placeholder without blocking the save. Image decoding failure also falls back
to the placeholder. If browser metadata cannot be stored, the save notification
distinguishes stored game data from unavailable slot details. A failed SRAM
write continues to use the existing save failure message.

Tests: [save-preview.test.mjs](../tools/save-preview.test.mjs) checks sampling,
frame-transfer ownership, menu/glove exclusion and room changes. The actual
[bed save test](../tools/live-save.test.mjs) checks capture during the existing
native route. [save-details.test.mjs](../tools/save-details.test.mjs) covers
image identity, missing captures, imports and rejected URLs; the
[preview browser test](../tools/save-preview-browser.test.mjs) checks real PNG
encoding/decoding, persistence, extra slots, localization and narrow layout.

User layout direction of 2026-11-22: the save overlay must show its controls
without scrolling, and slot numbers belong only in card headings. Cards use
small thumbnails beside their room/date and a plain "Save" button. They form
two columns on wide screens and four compact rows on narrow screens. Repeated
slot lists and date-unknown notices are removed; the save/load, backup and
import instructions are shorter. Import still asks for confirmation and explains
that running progress will be lost. The preview browser test measures all four
cards with save actions shown at 1280 x 720 and 390 x 844, in German, and checks
that the full overlay body fits without vertical or horizontal scrolling,
also at 390 x 720.

## Delivery verification (2026-11-22)

The room/date block passed 20 tests across eleven files. The preview and layout
block passed 524 tests across 42 files, including all five unchanged golden
traces. Focused checks cover actual bed saving, the 170/335 entrance alias,
byte-identical saves, per-slot image ownership and compact browser layout.
The user confirmed that the reported bed preview works after the correction.

The final incremental shared release passed 13,027/13,027 tests across 336
executed files, with 338 unchanged files reused and no failures or skips.
All 772 generators were reused; 3,490 render outputs and one planning output
were verified, and syntax covered 3,189 modules. Format, AC source, diff,
staged diff and LFS checks passed. Test duration was 1,052 seconds; artifact
verification took 15 seconds. Summary: `.cache/release/last-summary.json`.
The first shared run found one outdated handbook-browser expectation for the
shortened empty-save text; its focused check and the final shared run passed
after updating that expectation.

## Flow

**Options → Save/load game** opens a compact modal overlay. Its German label uses
the corresponding save/load wording. **Four save slots** is also in this overlay;
the setting remains fixed during a running session. Opening pauses gameplay
and audio; Save closes it before submitting the slot request, while a normal
close restores the prior P pause. The overlay and handbook explain these
separate steps in both languages:

1. Save at a bed or use **Save** while Jake can move freely. Browser
   storage retains these slots in the current browser profile; clearing site
   data can erase them.
2. **Bundle** downloads `shadowrun-saves.shadowrun`, including all stored slots,
   pictures and dates. **.srm** downloads only the original game data as
   `Shadowrun.srm`. Neither first saves current progress. Save into a slot
   before exporting a backup or moving to another browser or computer.
3. **Import** accepts either `.srm` or `.shadowrun` and replaces the browser's stored slots.
   It always asks first in a yes/no question above the overlay, naming the
   file and, where they apply, the slots 3/4 it removes and the running session
   it ends (unsaved progress is lost). "No" has the initial focus; "No" and
   Escape keep everything. A successful import shows a green, check-marked
   status line naming the file; a refused file shows a red one (user,
   2026-11-20; [save-import-browser.test.mjs](../tools/save-import-browser.test.mjs)).
   Afterwards choose **Start game**, then **Start saved game** in the title
   menu and the desired slot. Importing alone does not resume a session.

The export and import controls also reference their own visible help through
`aria-describedby`.

## Portable save bundles (2026-11-22)

[save-bundle.mjs](../src/browser/save-bundle.mjs) defines a single-file,
versioned UTF-8 JSON backup with extension `.shadowrun`. Format
`shadowrun-save`, version `1`, contains canonical Base64 `sram` (8 or 16 KiB)
and a `slots` array with two or four entries. Each valid slot carries its exact
saved-byte identity, optional ISO save date and optional bounded PNG data URL;
invalid/empty slots are null. Export keeps every SRAM byte and includes only
metadata matching those saved bytes. It does not save current gameplay or
include unrelated browser settings. No archive dependency is needed.

The importer uses the selected filename to distinguish raw `.srm` from
`.shadowrun`, case-insensitively, even when a damaged package happens to have
exactly the size of raw SRAM. Packages are bounded to 512,000 bytes before
reading the file. Invalid UTF-8/JSON, format/version, canonical SRAM encoding,
slot count, slot-byte identity, date or PNG URL reject the entire package
before confirmation, storage changes or ending the running session. PNG
decoding retains the existing placeholder fallback. A future package version
gets a separate localized unsupported-version message.

Confirmation and cancellation work identically for both formats. A confirmed
package supplies authoritative metadata, including missing images/dates; it
does not silently merge local metadata into the package. A plain SRAM import
retains only already-known matching local metadata, as before. Importing 8 KiB
replaces rather than merges the extra slots, with the existing loss warning.
Loading still uses the title menu; the four-slot option keeps its existing
behavior. Storage failures keep the existing game-data/details messages.

The export card offers Bundle and .srm beside each other; the single Import
picker accepts both extensions. This preserves the compact no-scroll layout.
The handbook explains the two choices in both languages.

Tests: [save-bundle.test.mjs](../tools/save-bundle.test.mjs) covers two/four-slot
round trips, byte preservation, stale metadata, raw import and invalid packages.
[save-bundle-browser.test.mjs](../tools/save-bundle-browser.test.mjs) downloads
both actual exports, clears the test profile's save store, restores the package
and verifies images/dates, cancellation, invalid-version rejection and a later
plain SRAM import. Existing preview/settings tests check the compact layout.

Block verification passed 23/23 tests in 117 seconds across fourteen files,
including all five unchanged golden traces, actual package/raw downloads,
restoration, import confirmation, handbook and compact-layout browser checks.
The initial download test was corrected to use two separate user clicks,
because browsers block a second automatic download from one activation.

The package filename follow-up passed 11/11 block tests in 102 seconds.
The shared incremental release, explicitly requested by the user, passed
65/65 tests across 25 executed files, with 651 unchanged files reused and no
failures or skips. All 772 generators were reused; 3,491 outputs were verified
and syntax covered 3,192 modules. Format, AC source, diff/staged diff and LFS
checks passed. Tests took 165 seconds and artifact verification took 18 seconds.
Summary: `.cache/release/last-summary.json`.

The personal root export `Shadowrun.srm` is ignored by Git and is no longer
tracked as of 2026-11-09. Removing it from version control preserves the local
file; a fresh checkout does not include this personal save. Versioned test
fixtures in `tools/mesen/saves/` remain separate.

- The save game is the cartridge SRAM, 8 KiB per the ROM header
  ([ROM-ANALYSIS.md](ROM-ANALYSIS.md)). The game writes it itself: at a bed
  "Save game", then "Save game 1" or "Save game 2". A slot is 0FFE bytes
  long (slot 1 from 0000, slot 2 from 0FFE); bytes 0/1 and 24C of the slot
  differ in the recorded repeated-save case (checksum and an unidentified byte).
- Loading happens in the title menu: "Start saved game", "Resume game 1/2".
  The game reads the SRAM only there; an imported save game therefore ends a
  running game (after a confirmation), and "Start game" begins anew from the
  reset.
- The worker starts `LiveGame` with the stored SRAM and checks it each
  picture (`SaveWatch`). It reports a changed SRAM once it stayed unchanged
  for a whole picture, so that no half-written slot is stored.
- The page keeps it in `localStorage` under `shadowrun.sram.1` (Base64) and
  asks for persistent storage (`navigator.storage.persist`). If writing
  fails, it asks for an export.
- Export and import as `.srm` (the Save/load game overlay): exactly
  8192 raw bytes, as Mesen and other emulators write them for this ROM. Other
  sizes are refused.
- The text language (page menu, [LANGUAGES.md](LANGUAGES.md)) is not part of
  the SRAM: the same save works in English and German.

## Save anywhere

User request of 2026-11-04 (quality of life): save from the page at any time,
into a chosen slot. Code: [save-anywhere.mjs](../src/game/save-anywhere.mjs).

- The Save/load game overlay ("Save: game 1/2") sends the slot to the
  worker. At its next pad read the worker runs the slot save of the bed's
  "Save game 1/2" (81:B17D, lifted as `saveGame` in
  [save-slots.mjs](../src/game/save-slots.mjs)). It copies 7E:2DE0..3D07
  into the slot from table 81:B124 and writes the checksum, so the result is
  an ordinary save: the title menu loads it ("Resume game n") and the .srm
  file stays compatible with the original and emulators.
- The lifted save keeps its checksum sums in locals, so only the SRAM slot
  changes (the original's direct page scratch 0E/11/14/15 is not written).
- Allowed only while Jake moves freely: the player control 80:E014 ran in the
  last picture and no glove choice is open (as for the debug room), no scene
  change is pending (1CE9 = FFFF), and no countdown runs (1D89 negative, the
  bed's own condition; otherwise the bed shows notice 7058). Otherwise the
  page reports a refusal. This excludes menus, dialogues, the matrix and
  sequences.
- As after a bed save, loading enters the room at its entry 7E:2DE2 (the
  entrance used last), not at Jake's exact position; the original keeps no
  position in the slot. Room objects are set up again as on any room entry.
- The request is a recording event (save-slot-1, save-slot-2), so a
  replay repeats the save.
- Evidence: [save-anywhere.test.mjs](../tools/save-anywhere.test.mjs). From
  the Mesen save game partment, after walking: WRAM unchanged, slot 1 and
  the options bytes 1FFC..1FFF unchanged, slot 2 equals the block;
  "Resume game 2" restores the block exactly. A recording with the event
  replays to the same SRAM.
- Limits: a save at an unusual moment (for example in a room whose entrance
  belongs to a scripted sequence) loads like the original would load such a
  slot. This is not compared against Mesen yet.

## Four save slots

User decision of 2026-11-04: four slots in the game, behind the page option
"Four save slots" (off by default; gameplay key `fourSaveSlots`, recordings
without the key keep two slots). Code:
[save-slots.mjs](../src/game/save-slots.mjs),
[port-extension.mjs](../src/data/port-extension.mjs).

- The original slot table 81:B124 lists four offsets (0, 0FFE, 1FFC, 2FFA),
  but only two slots fit into 8 KiB: a slot at 1FFC would overwrite the
  option bytes 70:1FFC..1FFF (stereo, control type, music, checksum 81:D5D0).
  With the option the SRAM has 16 KiB; B11A gives slots 3/4 the offsets 2000
  and 2FFE, slots 1/2 keep the table values. The first 8 KiB remain an
  original .srm; empty slots 3/4 fail their checksum and stay disabled.
- Title menu (E3DA, E1B4): "RESUME GAME 1" to "4" and "EXIT" in five rows
  (0414 to 0614). Rows 3/4 draw the original text "RESUME GAME 1" and
  replace its digit tile with the same formula as D531 (7E:46A8 table, 2400,
  DP18). The disabled-row table 11A4 is cleared by D555 for 32 bytes.
- Bed menu (80:CDD6): window height 7 instead of 5, five rows, and the item
  list in the port bank: Exit, Save game 1, Save game 2 (original texts
  7088, 7411, 7419) and the port texts "Save game 3/4".
- Port bank (user decision 2026-11-04): new content lives in the port's own
  read-only bank A0:8000 (src/vm/memory.mjs), a bank the 1 MiB LoROM does
  not use, built at start from the source module, installed only with the
  option. Its texts are encoded with the original Huffman tree and decoded
  by the unchanged 80:FE69. Original text pointers address only banks 9D/9E,
  so port texts use reserved ids 0100/0101: ids below 057C point into the
  tree at 9D:8000..857B and never start an original text; FE69 redirects
  exactly those ids into the port bank.
- Page storage: the first 8 KiB stay under `shadowrun.sram.1`, slots 3/4
  under `shadowrun.sram.extra.1`. A game without the option reports 8 KiB;
  the page then keeps the stored slots 3/4. Export writes 16 KiB when slots
  3/4 are stored, import accepts 8 or 16 KiB (an 8 KiB import clears 3/4).
- "Save" offers games 3/4 with the option.
- Matching the stored slots against the option (user request 2026-11-05).
  The game always sees exactly the SRAM size of its session: 16 KiB with the
  option (an 8 KiB save is padded with zeros, whose slots 3/4 fail the
  checksum), 8 KiB without it (stored slots 3/4 stay untouched in the page
  and are merged back after each save). The option cannot change during a
  session. Beyond this the page now reports which games are stored, and
  when slots 3/4 hold a game while the option is off, it says that these
  games load only with "Four save slots: on". Importing an 8 KiB file over a
  stored game 3 or 4 asks for confirmation first, because the file has no
  slots 3/4.

## Slot occupancy on the page

User request of 2026-11-05: each "Save" button carries a dot in its
upper right corner, red for a used slot and green for a free one (the
accessible name says "used, will be overwritten" or "free").

- The rule is the title menu's own: 80:E3DA calls 81:B1AB for each slot and
  disables the row when the comparison fails. B1AB compares the word at the
  slot offset with the checksum of 81:B12C: two running 8-bit sums (start 00
  and AD) over the 0F26 bytes behind that word, each with the end-around
  carry of 81:B174 (a carry adds one, FF becomes 00), closed as in B15A..B16E
  and EOR ABA5. The page uses a port of it,
  `occupiedSlots` in [save-slots.mjs](../src/game/save-slots.mjs).
- The dots follow the stored save and update after each save the worker
  reports. Slots 3/4 count only in a 16 KiB image.
- Evidence ([save-slots.test.mjs](../tools/save-slots.test.mjs)): the Mesen
  save `apartment` gives game 1 used and game 2 free, as its title menu
  shows; one changed byte empties the slot; zero-filled slots 3/4 are free;
  after the bed's "Save game 4" and "Save" into slot 3 the dots match the
  slots the title menu then enables.
- Evidence: [save-slots.test.mjs](../tools/save-slots.test.mjs). Port texts
  decode to "Save game 3/4"; without the option the game sees 8 KiB, no port
  bank and only two "Save" slots; with it the bed's "Save game 4"
  writes the loaded state to 2FFE (only bytes 0/1 and 24C differ, the first
  8 KiB unchanged, no VRAM/CGRAM/OAM access outside blanking), and "Resume
  game 4" in the title restores it; "Save" reaches slot 3.
- Limits: the five-row title menu and bed window were checked in rendered
  pictures only, not against an original (there is none). Emulators read
  only the first 8 KiB of a 16 KiB file.

## Evidence

- Native live from the reset (live-save): with the Mesen save game
  `apartment`, "Resume game 1" loads Jake's apartment; at the bed "Save game
  2" writes the loaded state to slot 2 (equal to slot 1 except 0/1/24C),
  slot 1 stays unchanged, `SaveWatch` reports exactly once, and there is no
  VRAM, CGRAM or OAM access outside blanking.
- A new game does not write the SRAM (trial run up to NMI 6000).
- Real browser: the imported file lies unchanged in `localStorage`, the
  export returns the same bytes, the worker starts with the same SRAM
  (FNV-1a), and picture and sound stay equal to the native run with this
  SRAM.

## Limits

- The waits in the bed menu are lag-free and shorter than in the Mesen plan
  `SAVES.apartment`; an original comparison of the saving itself is still
  open (the saving B17D, E41F, A954 and C46E runs as a segment).
- One SRAM (two slots) per browser profile and page; further states only via
  export. With the four-slot option: four slots (section above).
