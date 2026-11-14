# TCRF notes: hidden and unused content

Source: The Cutting Room Floor, "Shadowrun (SNES)",
<https://tcrf.net/Shadowrun_(SNES)>. Initially transcribed on 2026-11-01 from
the user's screenshots. The supplied local main and notes PDFs were also
consulted on 2026-11-09 for the [unidentified-data audit](ROM-UNREAD-AUDIT.md).

Status: **unverified third-party claims**, except for the European source
checks explicitly recorded below. TCRF describes the North
American version, so its ROM offsets may not apply to our European ROM. Before relying on
one, confirm it and record the evidence in the relevant source contract.

## Debug room (matchbox cheat)

- Available in every version except the Japanese one. Based on a hint from
  the developers in Retro Gamer issue 120.
- Stand just north of the flickering streetlight outside the morgue entrance
  (for example, where the "A Busy Man" NPC stops).
- Wait until RAM `7E3BD3` equals `01`. The value is driven by the
  streetlight's flicker animation and keeps changing as the cheat
  progresses. Then open the item menu and examine the matchbox. A telephone
  beep confirms each step. Do this four times in a row, then examine it once
  more inside the morgue lobby, which plays a different beep.
- After that, the matchbox option "Examine L" becomes "Open R", which warps
  to the debug room from anywhere in the game.
- Pro Action Replay shortcut: `7E3BD3FF 7E3BD4FF` switches the matchbox menu
  directly.

Room contents:

- "Dog Food" item on the floor: picking it up shows "INVINCIBILITY CHEAT FOR
  JAKE".
- Six doors warp to game "chapters". The chapters appear to be the periods
  between keyword-list purges. The waitress next to each door gives money and
  karma for that chapter, listed from right to left:

  | Chapter  | Nuyen  | Karma | Warp target              |
  | -------- | ------ | ----- | ------------------------ |
  | 4 hours  | 5,000  | 20    | Jake's apartment         |
  | 8 hours  | 10,000 | 42    | Oldtown street doc       |
  | 16 hours | 19,000 | 70    | Hotel near Daley Station |
  | 22 hours | 26,000 | 100   | Bremerton ship           |
  | 28 hours | 34,000 | 125   | Volcano                  |
  | 32 hours | 60,000 | 145   | Aneki building           |

- An invisible exit at the bottom center ("ADIOS!") returns the player to the
  location they warped in from.
- In the Japanese version the room still exists, but the matchbox sequence
  does not.

### European ROM and native port (checked 2026-11-01)

Static (analysis/event-scripts.txt, assets/vm-rooms.json):

- `7E:3BD3` is script word offset `$18` of the table at `7E:3BBB`, accessed
  through natives `$57` (read) and `$12` (write). Script `$126` (ROM
  `$0E7C82`) is the matchbox handler. It is a step counter, not the
  streetlight's animation itself. When the counter is 1–4 and the player
  examines the matchbox in room 1, the player must stand in the correct
  quadrant around (x `$266`, y `$1D5`) for that step. In room `$1F` (the
  lobby), the fifth step stores `FE` and then increments it to `FFFF`. At
  `FFFF`, the "Open" action saves the current room word `7E:2DE2` to offset
  `$1A` and warps to room entry `$D2`. Value 0 never advances the counter.
  Value 1 must come from elsewhere, which matches the TCRF advice to wait
  for `01`. The writer has not been identified.
- Room entry `$D2` is room 114 (bank 9A, scene 164). It has six door exits,
  to room entries 345, 476, 170, 122, 243 and 461, plus a script box at
  x 356–388, y 396–443 that starts script `$2F9`. Script `$2F9` shows a
  window and warps back to the entry saved in offset `$1A`. This is the
  invisible exit.

Live in the native port (apartment save, counter set to `FFFF` as with the
PAR code; probe in the session scratchpad, not a repository test):

- The item list shows "Exit / Open <R>" for the matchbox. Choosing "Open"
  warps to room entry `$D2`, and the room renders.
- Dog Food: "Pickup" shows "INVINCIBILITY CHEAT FOR JAKE".
- Third waitress: "16 Hours = $19000 , 70 Karma". Karma changes to 70 and
  money from 20 to 19,020.
- The door next to the bed leads to Jake's apartment (room entry `$159`).
- The script box returns to the saved entry `$159` at the original position
  (391, 281).

Browser shortcut: the burger-menu entry "Debug room", directly after Cheats,
stays visible and dimmed when unavailable. Its tooltip explains that a game
must be started and Jake must be able to move freely. The enabled state
follows the displayed frame, with a fresh worker-side check on activation.
The entry
([src/browser/debug-room.mjs](../src/browser/debug-room.mjs)) performs the
writes of "Open" at the worker's next pad read: word `$1A` = 2DE2,
2DE2 = `$D2`, 1CE9 = `7FFF`. It does this only while Jake moves freely:
80:E014 ran in the last picture, no glove choice is open, and no scene change
is pending. Otherwise the page reports a refusal. The session recording
keeps the event. [tools/debug-room.test.mjs](../tools/debug-room.test.mjs)
checks the refusal with the item list open, the warp and the return. A
headless Edge run showed the menu, the early refusal, the warp and the
recorded event. The first version (2026-11-01, commit 46d06582) only
unlocked the matchbox.

A successful shortcut clears the browser status overlay (2026-11-02). The
invisible-exit hint remains in the menu button's tooltip rather than covering
the game after returning. The browser regression checks both the cleared
overlay and exact restoration of the underlying picture.

### Morticians on returning to the morgue (2026-11-02)

The reported reappearance is reproduced after opening the partition door,
waiting until both morticians have fled, using the shortcut and walking back
through the invisible exit. Their saved story records remain byte-identical.
This is the behavior prescribed by the European scripts, not evidence that
the shortcut restored an earlier save:

- Room 3, entry 3, contains actors `07FC` and `07EE` (table offsets at
  `8D:B01F`), kind 3, scripts `279` and `337`. Their records are `7E:2E69`
  and `7E:2E6E`.
- Script `279` (`83:E96E`) sets its initial-story bit through native `33`
  at offset `029D`. On the opening-scene flight path it calls native `B9`
  at `02F2`. Script `337` (`83:EC65`) sets the same bit at `011C` and
  calls `B9` at `01A3`. These calls release the current slot through
  `80:A8F5`; they do not set the permanent removed-object holder through
  native `C5` (`80:9D7A`). Both holder words remain `FFFF`.
- The room initializer `80:A3B6` therefore creates both actors again on
  reentry. Their initial-story bits select later branches of `279` and
  `337`; those branches also read `7E:3C17` and contain subsequent dialog
  paths. Permanently deleting the actors would suppress those paths.
- [debug-room.test.mjs](../tools/debug-room.test.mjs) checks the actual
  flight, absence before the warp, reappearance after returning and unchanged
  persistent records. This is a native live regression backed by the decoded
  European source, not a new Mesen route comparison. No gameplay correction
  or persistent actor removal is applied.

Not checked: the real five-step matchbox sequence at the morgue, the source
of value 1, invincibility in combat, the other waitresses and doors, and a
Mesen comparison of the warp.

Repository state: the room texts already exist in `assets/vm-texts.json`.
The implemented browser shortcut uses the RAM addresses described above.

## Winter CES warp script (unreferenced)

- North American ROM file offset `0E7EE0-0E7F26`, SNES address
  `9CFEE0-9CFF26` (consistent with LoROM mapping).
- Shows "Winter CES'93 Las Vegas - Warp!" and then warps to the debug room.
- No pointer to it is known. It is a candidate for the dead-code and script
  inventories.

## Unused mobile phone item

- It was in the debug room of the North American prototype and was removed
  from the final room.
- PAR: `7E3637B2 7E363808`. TCRF has conflicting reports about whether it
  works in the final build.

## Dark Blade weapons shop: bulletproof vest

- In the North American and European English versions, the Bullet Proof Vest
  (defense 3, 8,000 nuyen) is set to out of stock when a new game starts and
  never becomes available.
- PAR `7E381F00` makes it appear.
- It is available on the first visit in the German, Swedish and Japanese
  versions.
- Fidelity note: a faithful US port must keep it out of stock.

## Unused graphics

- Walking sprites for the yo-yo boy in the car yards. In the game he only
  plays his yo-yo animation.
- One of the four car sprite palettes appears unused.
- Unused characters that can be placed in the game and show their names:
  Gorgax, Heavy Orc, Slick Dude, Wolf.

European asset preservation checked on 2026-11-09: those four names resolve
to kinds 94, 96, 46 and 117, respectively, with complete action lists,
picture records and original tile bytes retained in the product. The
[audit](ROM-UNREAD-AUDIT.md#unused-graphics-are-preserved-content) cites the
local PDFs (main page 4, notes page 6) and provides the exact asset chains.
This establishes preservation, not their global non-use. The boy's walking
frames and the illustrated car palette are not individually identified yet.

## Regional differences (Japanese and European versions only)

- Japan only: a BRK and crash handler ("WELCOME TO BEAM SOFT") with a memory
  viewer. PAR `00C1E700` triggers it. The Japanese ROM is two megabits
  larger.
- Japan: a longer opening text crawl with Japanese subtitles. The intro
  cinematic plays on every new game. In the US version it plays only when the
  player waits at the title screen.
- Japan: a larger title logo, a separate main menu, no control options and
  no L and R shortcuts. The ending adds lines for Jake and a polygon head, and
  the epilogue has no text and different credits.
- Europe: different copyright screens and a Laser Beam logo in place of the
  Data East and Beam Software logos.
