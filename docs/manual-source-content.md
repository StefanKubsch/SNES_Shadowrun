# Remaining handbook content: checked source notes

Source: [Shadowrun.pdf](../Ressources/Shadowrun.pdf), SHA-256
`d4944fc6b84e1de7306161a781ff43b43db355fa1d319803afcd9239371b4924`.
Read visually on 2026-11-08 from the PDF's embedded page JPEGs. The unchanged
source PDF is authoritative; the extracted inspection images remain local
under `.cache/manual/`. No OCR text or screenshot is shipped.

These are page-by-page extraction notes, kept apart from the bilingual
editorial [content](../src/browser/manual-content.mjs). They are not a full
verbatim transcription. The earlier five-page
[pilot transcription](manual-source-pilot.md) remains unchanged. Numbers and
button labels below were read from the original, rather than inferred from
the previous chat proposal. PDF page numbers are one-based; printed page
numbers are two lower throughout the numbered booklet.

## Beginning and exploration

| PDF / printed | Checked content                                                                                                                                                                                                                                                         | Editorial entries                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 3 / 1         | Seattle in 2050; megacorps, shadowrunners, technology and magic; Jake Armitage has amnesia and must uncover his past.                                                                                                                                                   | seattle-2050                                                                               |
| 4 / 2         | Contents lists the gameplay topics through the Matrix on printed page 36.                                                                                                                                                                                               | Represented by chapter navigation, not copied as a second contents page.                   |
| 5 / 3         | Physical cartridge setup and controller drawing. At the title, waiting shows the background story; Start opens the main game menu.                                                                                                                                      | title-story; physical console installation is replaced by the existing browser start flow. |
| 7 / 5         | Start New Game with Start; Start Saved Game leads to slot selection, confirmed with B. Two original slots; empty ones dim, occupied ones highlighted. Control Type A maps straight pad input to diagonal screen motion; Type B uses diagonal input for diagonal motion. | new-and-saved-game, original-options                                                       |
| 8 / 6         | Stereo/Mono; background music Full, Event and Off. Event limits music to important events or certain people; Exit returns to the title.                                                                                                                                 | game-sound-options                                                                         |
| 9 / 7         | Jake wakes in the morgue; movement through streets, doors and stairs; target tag at the lower right identifies the object/person under a pointer and is needed for an action/spell.                                                                                     | starting-jake, movement-and-tags                                                           |
| 10 / 8        | Yellow action glove B; gray spell glove X and another X to cast. No Spell Selected is dismissed with X. Crosshair A.                                                                                                                                                    | three-pointers                                                                             |
| 11 / 9        | Door: select with B, choose Open; a locked door needs the correct inventory key. Items: Examine/Pick Up through the action list. Nuyen can be left by enemies and must be picked up.                                                                                    | doors-and-keys, items-and-nuyen                                                            |
| 12 / 10       | Examine before buying; Ask About keywords elicit offers; Yes accepts. Give an inventory item to a potential buyer to obtain a fixed offer. People give clues. Life meter depends on Body; Stamina zero means death. Start/Select give exact reserves.                   | buying-and-selling, life-meter                                                             |

Browser-specific sentences about four slots, mouse actions, soundtrack choice
and file export/import are drawn from the existing product, not the US manual.
The standalone browser-save-options entry is marked `browser: true`. Existing
browser controls retain that same marker.

## Status and inventories

| PDF / printed | Checked content                                                                                                                                                                                                                     | Editorial entries                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 13 / 11       | Start opens status; categories selected with pad and Start; an empty submenu returns to Exit; Select can leave status. Body 0–20, starts 3; example Body 7 permits 70 Stamina.                                                      | status-screen, body-and-stamina                                                                           |
| 14 / 12       | Stamina damage varies. Magic 0–20, starts 0; example Magic 8 permits 80 spell points. Strength controls equipment use and has range 0–6. Charisma 0–6, starts 3; at 6 permits three runners. Karma improves levels; nuyen is money. | magic-attribute, strength-and-charisma; resource distinction also summarized in karma-money-and-equipment |
| 15 / 13       | Spell, Weapon and Armor lines show selected gear; armor must be worn/used, not merely carried.                                                                                                                                      | karma-money-and-equipment                                                                                 |
| 16 / 14       | Items permits Examine, Give or Use depending on item. Magic lists learned spells, levels and bracketed costs, and chooses the X spell.                                                                                              | items-inventory, magic-inventory                                                                          |
| 17 / 15       | Weapon/Armor list carried equipment. Skills are always active after learning and are improved through sleep-menu Karma. Firearms and Computer start at 1. Cyber equipment is always operational after fitting.                      | equipment-inventories, skills-and-cyber-inventory; magic cost changes summarized in magic-inventory       |

Source cautions: the Strength paragraph says it begins at 0, while the status
illustration on printed page 11 shows a different Strength value. The guide
explains its equipment role and maximum without claiming a starting Strength.
The status illustration also contains Intelligence, but these pages provide
no explanation or range for it; no extra rule is invented. The Skills section
on printed page 15 contains a parenthetical explanation of spell upgrades;
that information belongs to the magic inventory in the editorial guide.

## Combat and companions

| PDF / printed | Checked content                                                                                                                                                                                                                      | Editorial entries                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 20 / 18       | Further attacks on innocents after the spirit guide's warning deduct one Karma if any is held. Mercenaries are armed/armored; deckers specialize in Matrix work; magic users default to Powerorbs and offer spell inventory/points.  | innocent-people, runner-types                             |
| 21 / 19       | Keywords are used for hiring. Runners follow most places, may guard outside some areas, and return to their hire location when the contract ends. Autonomous combat positioning/targeting; Examine exposes status, Skills and Cyber. | hiring-runners, runner-examine-and-talk                   |
| 22 / 20       | Talk through action menu. Target is combat-only, assigns a selected enemy confirmed with B. Move To repositions a runner and may alter their target or exposure.                                                                     | runner-orders; Talk summarized in runner-examine-and-talk |
| 23 / 21       | Give spare gear only to runners strong enough to use it. Inspect Stamina after fights. Heal through magic, hired magic users or purchased Slap Patches; spell points can be restored, patches cannot.                                | runner-equipment-and-healing                              |
| 24 / 22       | Select opens party status, including Jake; Stamina/spell points, following order, removal of defeated runners; useful even without hired help.                                                                                       | party-status                                              |

Printed page 20's Move To sentence ends with `and press the . . .` and does
not identify the confirmation button. The guide says to select the new
position without filling in that missing button from a guess. The magic-user
paragraph on printed page 18 has an unclear pronoun about whose knowledge or
spell points are available; the guide retains only the clear inventory and
spell-point access, without inventing an extra casting rule.

## Skills, recovery, dialogue and Vidphone

| PDF / printed | Checked content                                                                                                                                                                                                                | Editorial entries                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 27 / 25       | Skills start at 1; overview says up to 6. Jake begins with Firearms and Computer. Leadership keeps runners through more adversaries; Negotiation automatically discounts most purchases and hiring, without a separate haggle. | learning-skills, leadership, negotiation |
| 28 / 26       | Computer reduces Matrix damage and improves IC combat chances; starts 1. Firearms improves accuracy; starts 1 and specifically reaches 16.                                                                                     | computer, firearms                       |
| 29 / 27       | Use a bed with the glove/B and Use. Sleep menu saves, spends Karma, or exits with Stamina/spell points replenished for Jake and hired runners. Save Game chooses Game 1/2 and confirms with B; beep indicates completion.      | beds-and-rest, save-at-bed               |
| 30 / 28       | Karma follows enemy defeats, with faster rewards for harder enemies. Use Karma at a bed; choose Attribute/Skills/Magic, then an entry, and Start increases one level. Example: Firearms 10 to 11 costs 10 Karma.               | earning-karma, spending-karma            |
| 31 / 29       | Initiate Talk through the glove/action menu; top contains the other person's portrait/dialogue, bottom Jake and options.                                                                                                       | talking-to-people                        |
| 32 / 30       | Keywords learned in dialogue; Talk after greeting; Ask About opens alphabetically sorted vocabulary, B confirms, L/R page backward/forward.                                                                                    | keywords                                 |
| 33 / 31       | Credstick used on Vidphone; Use opens known-number directory, up/down selects and B dials; an answer opens normal dialogue.                                                                                                    | vidphone                                 |

The general skill cap of 6 conflicts with the **specific Firearms cap of 16**
on the next page. The guide keeps the ordinary progression and the specific
Firearms exception distinct. It does not silently cap Firearms at 6.
Printed page 28 calls Firearms an item under Attributes in its cost example;
the guide keeps the example but gives category-neutral selection instructions.
The example is not generalized into a universal upgrade-cost equation.

## Matrix

| PDF / printed | Checked content                                                                                                                                                                                                                                                                                                                                             | Editorial entries                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 34 / 32       | Global grid, deckers, electronic locks, information and money. Requires fitted datajack and cyberdeck; persona and protection/interface role.                                                                                                                                                                                                               | matrix-equipment                                                      |
| 35 / 33       | Cyberdeck programs and downloaded-data storage. Enter from a connected terminal; persona starts by it. Datalines join tiled areas. Bars at the bottom left: upper bar Stamina, lower storage. Storage full blocks downloads but permits IC/CPU attacks; Stamina zero is fatal. Nodes may need passwords, kept as inventory items and automatically applied. | matrix-layout, matrix-nodes                                           |
| 36 / 34       | Hidden IC, trace scans eight surrounding tiles and reports count. Face a suspected tile and B attacks; empty tile fails and costs Stamina; successful IC destruction makes the tile safe.                                                                                                                                                                   | matrix-ic                                                             |
| 37 / 35       | Stepping on live IC damages and pushes back. Stronger IC can need more attempts and cause more loss. White-block datastore, face it and A downloads; it becomes transparent. Jack-out messages identify downloads. Passwords, DF-prefixed inventory datafiles and nuyen accounts.                                                                           | matrix-damage, matrix-downloads, matrix-data-types                    |
| 38 / 36       | Trash discarded on jack-out. CPUs control doors/elevators/alarms; some destroy linked IC in the area. Face CPU and B attacks. X jacks out anywhere and returns Jake to the entry terminal.                                                                                                                                                                  | matrix-cpus, matrix-jack-out; trash continuation in matrix-data-types |

The guide distinguishes the Matrix buttons explicitly: **B attacks, A
downloads, X exits**. It gives no invented IC damage formula, password list,
map route, account amounts or storage size.

## Excluded non-gameplay material

The cover/front matter, physical-console connection instructions, product
warranty on PDF page 39 and historical contest advertisement on page 40 are
not browser gameplay instructions. Original full-page images and illustrations
are not redistributed. The numbered contents page is represented by the
guide's own chapter navigation. These exclusions do not omit a gameplay topic.
