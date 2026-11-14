# Saving in the browser

As of 2026-11-09. Code: [save-file.mjs](../src/browser/save-file.mjs),
[game-worker.mjs](../src/browser/game-worker.mjs),
[start.mjs](../src/browser/start.mjs). Tests:
[live-save.test.mjs](../tools/live-save.test.mjs) (native),
[live-game-browser.test.mjs](../tools/live-game-browser.test.mjs) (real Edge).

## Flow

**Options → Save/load game** opens a compact modal overlay. Its German label uses
the corresponding save/load wording. **Four save slots** is also in this overlay;
the setting remains fixed during a running session. Opening pauses gameplay
and audio; Save now closes it before submitting the slot request, while a normal
close restores the prior P pause. The overlay and handbook explain these
separate steps in both languages:

1. Save at a bed or use **Save now** while Jake can move freely. Browser
   storage retains these slots in the current browser profile; clearing site
   data can erase them.
2. **Export** downloads all stored slots together as `Shadowrun.srm`. It
   does not first save the current progress. Save into a slot before exporting
   a backup or moving the game to another browser or computer.
3. **Import** replaces the browser's stored slots with a selected `.srm`.
   A running session ends after confirmation and unsaved progress is lost.
   Afterwards choose **Start game**, then **Start saved game** in the title
   menu and the desired slot. Importing alone does not resume a session.

The export and import controls also reference their own visible help through
`aria-describedby`.

The personal root export `Shadowrun.srm` is ignored by Git and is no longer
tracked as of 2026-11-09. Removing it from version control preserves the local
file; a fresh checkout does not include this personal save. Versioned test
fixtures in `tools/mesen/saves/` remain separate.

- The save game is the cartridge SRAM, 8 KiB per the ROM header
  ([ROM-ANALYSIS.md](ROM-ANALYSIS.md)). The game writes it itself: at a bed
  "Save game", then "Save game 1" or "Save game 2". A slot is 0FFE bytes
  long (slot 1 from 0000, slot 2 from 0FFE); bytes 0/1 and 24C of the slot
  differ when the same state is saved again (checksum and play time).
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

- The Save/load game overlay ("Save now: game 1/2") sends the slot to the
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
- "Save now" offers games 3/4 with the option.
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

User request of 2026-11-05: each "Save now" button carries a dot in its
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
  after the bed's "Save game 4" and "Save now" into slot 3 the dots match the
  slots the title menu then enables.
- Evidence: [save-slots.test.mjs](../tools/save-slots.test.mjs). Port texts
  decode to "Save game 3/4"; without the option the game sees 8 KiB, no port
  bank and only two "Save now" slots; with it the bed's "Save game 4"
  writes the loaded state to 2FFE (only bytes 0/1 and 24C differ, the first
  8 KiB unchanged, no VRAM/CGRAM/OAM access outside blanking), and "Resume
  game 4" in the title restores it; "Save now" reaches slot 3.
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
