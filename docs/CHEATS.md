# Cheats

**Options → Cheats** opens a modal in the fullscreen frame, with the same
shared component and stylesheet as the handbook, Audio, Graphics, Controls
and the other settings categories. Cards use two columns
where space permits; the frame fits the content instead of filling the screen.
It follows the English/German
language choice. Opening it pauses the game and audio, clears held inputs
and isolates keyboard, mouse and gamepad input. Closing it restores focus to
Options and preserves an existing P pause.

All four switches start off on page load. They may change before starting or
during play. Changes apply at the next pad read after returning to the game.
Turning a switch off stops enforcement; it does not restore previous values.
Saving retains granted money, attributes and spells through the original save
format. Cheat switches themselves are not saved in SRAM or local storage.

| Switch                        | Effect                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unlimited health for Jake     | Refill his Stamina to his current maximum and replace lethal damage results before the original death decision. Includes Jake in the Matrix; never protects another runner. Does not resurrect an already dead character. |
| Unlimited money               | Refill both nuyen words to `FFFFFFFF`, 4,294,967,295 nuyen, at every pad read. Purchases still follow their original conditions.                                                                                          |
| Maximum attributes and skills | Body/Magic 20, Strength/Charisma 6, Firearms 16, the other five skills 6; derived Stamina capacity 200. Does not unlock spells.                                                                                           |
| All spells at maximum         | All six spell-level bytes 6, Magic 20. Increasing Magic or a spell level also refills Jake's spell points to 200. Casting still spends spell points. Does not alter other attributes or skills.                           |

## Source boundary

This is an explicit optional departure from the European original. No
hardware behavior changes, so no new SNES manual interpretation is needed.

- Jake's actor number `08B2` is row zero of `80:9700`
  ([runners.mjs](../src/data/runners.mjs)). Its actor record pointer at
  `8D:B01F + 08B2 + 1` is `33DC`; count byte `7E:33DE` is his Stamina.
  Actor metadata: [vm-actors.json](../assets/vm-actors.json).
- The mutable character record begins at `7E:3BFB`. Its named offsets are
  `RECORD_ATTRIBUTE`, `RECORD_SKILL` and `RECORD_SPELL` in runners.mjs.
  Byte 3 has no established reader and stays untouched.
- The attribute limits `20,20,6,6` are the words at `80:EFC2`; the
  upgradeable skill limits `16,6,6,6` are at `80:EFDA`. Unarmed and Armed
  combat are absent from that upgrade list: setting both to 6 is the cheat's
  explicit policy, consistent with the handbook's ordinary skill range,
  rather than a claim that the original offers those upgrades.
- All six spell limits are 6 (`80:EFFA`). The member spell menu `80:E693`
  reads these six level bytes directly; the separate `SPELL_LIST` belongs
  to the learning dialog and is not rewritten. Tables:
  [vm-tables.json](../assets/vm-tables.json).
- `80:F0F3` increases Stamina capacity by ten per Body;
  `80:CF2E`/`D079` use ten times Magic as spell-point capacity. Cheat
  activation fills spell points only when increasing those values, rather
  than creating an additional infinite spell-point cheat.
- `80:8691` subtracts damage from an object's count byte before deciding
  whether to wake its task with the death event. The optional health result
  replacement runs before this store and zero test, with an exact Jake
  record match. Hit effects and stun remain original.
  Script setters `80:CAE0` and decrements `80:9DC8` apply the same exact
  record guard, including the decrement's depleted/not-depleted result.
- Matrix damage `81:B1B5` uses a separate WORD at `1754`; `1D93` names the
  decker's record. Protection checks that it is Jake. Pad-read refills of
  Matrix scratch fields additionally require callback `81:BEC3` at
  `006E..0070`, since this WRAM overlaps other scenes' upload queues.
- Nuyen is unsigned, two words at `7E:3C0D/3C0F`. `80:CCDB` saturates its
  overflow, and `80:FDCF` formats powers from a billion downwards, supporting
  the full unsigned 32-bit amount.

## Recording and verification

The shared input buffer has a separate cheat mask word. This lets a running
worker observe changes at pad reads even while its synchronous execution
cannot process messages. The fallback uses a worker command. The raw input
recording layout stays unchanged. Each effective switch is a `cheats-N`
event, including an initially enabled mask and turning all switches off.
Replay applies the same mask and refills after page events and before input.
Recordings without these events keep their original behavior.

[cheats.test.mjs](../tools/cheats.test.mjs) checks source constants, cold/off
isolation, all switch combinations, original damage/death behavior, Matrix
ownership, resource spending and deterministic replay across on/off changes.
[cheats-browser.test.mjs](../tools/cheats-browser.test.mjs) checks the real
menu, dialog, language, keyboard focus, narrow/fullscreen layout, pause and
shared-worker recording integration.

The user's German status-menu regression is covered separately by
[status-menu-language.test.mjs](../tools/status-menu-language.test.mjs).
German main-menu, inventory, skill and spell labels require wider windows;
the existing English dimensions could lose entries and let glyph uploads
overwrite scene graphics. Details: [LANGUAGES.md](LANGUAGES.md).

## Resolved gunfight report (2026-11-08)

The user initially reported losing Stamina and dying with all four cheats
enabled. The supplied recording, `Shadowrun-recording-2026-11-08T22-18-27-430Z.json`,
replays to NMI 5512 with all six WRAM checks equal and no input-path difference.
Its embedded 16 KiB SRAM matched the local `Shadowrun.srm` when investigated; the user
loaded slot 2. The recording contains no cheat activation events and the
effective cheat mask remains zero. Nine enemy damage stores reduce Jake from
200 to 185 Stamina; the first changes 200 to 198 after NMI 3342 through 8691.

The user confirmed that the cheats were active when saving in an earlier
session and were not enabled again after reloading the page. This explains
the observation: granted money, attributes and spells remain in the saved
state, but the four switches restart off on each page load. Unlimited health
must be enabled again through **Options > Cheats**. Loading a slot does not
restore a cheat switch. No health implementation change is needed for this
report.

The existing enabled-cheat checks remain valid:
[cheats-live-combat.test.mjs](../tools/cheats-live-combat.test.mjs) enables all
four cheats during play and checks each actual enemy damage store at full
Stamina. The exact lethal-hit regression also covers mask 15, health alone
and other-runner isolation. This is not a claim about every later combat
route.

Replay logs: `.cache/logs/user-cheat-recording-replay-before.log` and
`.cache/logs/user-cheat-recording-damage.log`; the detailed damage trace is
`.cache/logs/user-cheat-recording-damage.json`. The supplied recording is
retained unchanged as user input.
