# Alternative soundtrack by Julian Daniels

**Options → Audio** selects Tribute (the default) or Original. An explicit
saved Original choice is retained. The choice
is saved in `shadowrun.soundtrack.1` and applies to a running game. Tribute
volume has its own 0-100% slider, starts at 25%, and is saved separately in
`shadowrun.soundtrack.volume.1`. This lowers the mastered album relative to
the unchanged native SFX and can be adjusted live. Soundtrack choice and volume
share the modal Audio overlay with the analog filter and explained audio profiles.
Changes apply when returning to the game; the overlay suspends playback and
preserves an existing P pause. The user
confirmed on 2026-11-07 that Julian Daniels officially permitted using his
recordings in this game. This records the user's permission statement; the
album is not described as an openly licensed asset.

The twelve OGG files in [assets/tribute/](../assets/tribute/) are byte-identical
copies of the supplied files in `Ressources/Julian Daniels - Shadowrun SNES
Soundtrack (Tribute)/`, with shorter web filenames. No conversion, trimming,
normalization or sample edits are applied. The supplied source OGG files and
cover remain in the source folder and use Git LFS too. Only the web OGG copies
are included by both the local server
and `npm run build:web`. The local server supports audio byte ranges for seeking
and looping. See [STATIC-HOSTING.md](STATIC-HOSTING.md).

Album and artist credit: [Shadowrun SNES Soundtrack (Tribute), Julian Daniels](https://juliandaniels.bandcamp.com/album/shadowrun-snes-soundtrack-tribute).
Original music: Marshall Parker. The second burger-menu entry, **About this
project**, opens a centered English/German overlay crediting Julian Daniels
for arranging, performing and producing the tribute soundtrack and Marshall
Parker for the original soundtrack. Below the credits it links to
[Julian Daniels's website](https://www.juliandaniels.com/). A separate section
below a horizontal divider links to this project's GitHub repository. The shared modal
pauses the game and audio, isolates input and returns focus to the menu
button when closed. The Audio settings retain their soundtrack controls.

## Song identification

The album order is not the game's song order. The European game's base lists
install the song pointer table at ARAM `$D067` for the game and `$7674` for the
title, intro and menu. Both addresses are decoded in `assets/vm-sound.json`.
The driver reads song `$8B` through that table in `$06AC`; CPU routines
`81:F229/F25A` load directory item `$FF - song` before command `$04`.
An address alone is insufficient: song 2 has different music in each directory.

| Directory and song | Original cue                        | Tribute file          |
| ------------------ | ----------------------------------- | --------------------- |
| Title 1            | Seattle 2050                        | 01 Main Theme         |
| Title 2            | Main Theme (menu)                   | 01 Main Theme         |
| Title 3            | Ending / new-game shooting sequence | Original fallback     |
| Game 1             | Tenth Street                        | 03 Tenth Street       |
| Game 2             | Sleazy Bar                          | 08 Sleazy Bar         |
| Game 3             | Ghouls                              | 09 Ghouls             |
| Game 4             | Seems Familiar...                   | 06 Seems Familiar     |
| Game 5             | The Cage                            | 10 The Cage           |
| Game 6             | Gunfight                            | 07 Gunfight           |
| Game 7             | Morgue                              | 02 The Morgue         |
| Game 8             | The Matrix                          | 12 The Matrix         |
| Game 9             | Funky Conversation                  | 05 Funky Conversation |
| Game 10            | Shady Conversation                  | 04 Shady Conversation |
| Game 11            | Dead                                | Original fallback     |
| Game 12            | Uptown                              | 11 Uptown             |

User clarification, 2026-11-07: the tribute's **Main Theme combines Seattle
2050 and the original menu Main Theme into one arrangement**. It serves both
cues and continues across the intro-to-menu transition instead of restarting.
The main theme title printed on the album does not identify only original song 2.

The tagged [SNESmusic SPC set](https://snesmusic.org/v2/profile.php?selected=14829&set=)
independently identifies the original cues. Its mixed regional driver layouts
must be distinguished: the European layout reads song `$8B` and table pointer
`$18`; another layout reads song `$88` and table pointer `$1D`. Read the active
song header and each track's first pattern through these pointers; compare
the first 32 pattern bytes against the European catalogue at the same track
index. Relocated pointers in a complete file and leftover music elsewhere in
SPC RAM are unsuitable identity tests.

[Retained identification evidence](../proof/apu/tribute-song-identification.json)
records the archive and dump SHA-256 hashes, tags, variable and pointer addresses,
and matching active pattern prefixes. The regression test reconstructs the
European ARAM lists and verifies those pointers and prefixes without downloading
the archive. The same evidence includes the supplied OGG hashes and byte counts.

## Audio contract

[soundtrack-apu.mjs](../src/apu/soundtrack-apu.mjs) runs the original native
driver and coupled DSP. The full original PCM, DSP registers, ARAM echo buffer,
music beat replies and voice allocation remain available. Music replacement
does not send different commands to the game or alter sequencer timing.
It observes explicit song starts/stops and repeated starts of the same song.
The original note lists and repeat flags still govern the native driver, but
their natural end does not stop a tribute arrangement of a different length.

The original driver marks song-note voices in `$6E` (`SONG_VOICES`): `$07A0`
sets a started voice's bit and `$0717` clears it for command/sequence effects.
The output-only SFX mixer excludes these song voices at the volume mix. It
reuses the established DSP echo steps, signed volumes, FIR and feedback with
private echo RAM/history so that music echo cannot leak into the SFX output.
Echo-header reset clears that private history. It never supplies values back
to the original DSP, driver or game. Existing hardware equations and their
manual/oracle evidence in [SOUND-DRIVER.md](SOUND-DRIVER.md) are reused.

The start menu also plays pitched musical accents through command `$07`,
outside the song sequencer. Its animation callback `81:E6AE`, call at `E775`,
reads `(volume, sound)` words from `81:E7B4`: `$7700/$6801/$A402/$4A03`.
In title song 2, these sounds 0-3 are classified as part of the replaced
musical bed. A private per-voice mask is set only when such a sound actually
starts and is cleared when the voice is reused. This does not modify the
driver's own `$6E` mask. Menu move/choose sounds 9/8, intro effects and all
gameplay effects remain on the SFX path. This closes the user's 2026-11-07
report of original music still audible behind the tribute in the menu.

Frames carry both PCM streams and the observed song state to the browser. The
AudioWorklet keeps their queues aligned and blends the full mix to the SFX mix
over 20 ms. Selecting a supported tribute cue reserves that SFX-only mix even
while loading or resuming the OGG, so original music cannot briefly reappear
behind it. A real media error or an unsupported cue restores the original mix.
Switching back explicitly restores
the continuously running original at its current position.

A single large block from an original no-NMI music wait is trimmed to the queue's
160 ms presentation limit, just as excess older blocks are dropped. Previously
one oversized block could retain seconds of old scene effects. Both PCM queues
drop the same samples and stay aligned; the native output checksum still covers
all generated samples before presentation drops.

[tribute-player.mjs](../src/browser/tribute-player.mjs) streams only the current
OGG through a media element and a gain node in the same AudioContext. Native
SFX still use the optional PAL analogue filter; the modern recording bypasses
that SNES filter. Tribute volume follows the original DSP master fade,
multiplied by its own volume slider and the existing `AUDIO_HEADROOM` factor
(0.48) as presentation headroom. This is
not an acoustic loudness match between arrangements. The browser resamples
the supplied recording to the AudioContext rate.

[tribute-cache.mjs](../src/browser/tribute-cache.mjs) starts background preloading
when Tribute is selected, including on the startup screen. It downloads the
twelve unmodified OGG recordings (58,152,431 bytes, about 58 MB) with at most
two low-priority requests at once, beginning with the main theme and morgue.
The game remains startable without waiting for them. Completed downloads are
retained as compressed Blob URLs for the open page; playback still creates
only one media element and uses the same gain, looping and position logic.
Returning to a ready recording needs no HTTP request, even with the development
server's `no-store` header. The cache also survives restarting the game within
the same page, while remembered playback positions remain session-local.

An unfinished or failed preload retains ordinary immediate media streaming;
it never waits for a complete background download to start playback. A very
early first use can therefore still load over the network, and can overlap
its background download. Decoder startup, metadata and seek preparation can
still take time. This removes network waits for ready tracks, not every source
of audio latency. No PCM copies of the full album are decoded in advance.
An explicit saved Original choice starts no preloads. Switching to Original
cancels outstanding preload requests and retains completed recordings for a
later switch back. Closing the page releases their URLs; a reload starts a
fresh cache. No persistent storage or service worker is required.

The browser's media `preload="auto"` is only a
[hint](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload).
The explicit cache instead reads each successful response to completion with
[`Response.blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/blob)
and uses releasable
[object URLs](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static).
Fetch priority is also a browser hint, not a guaranteed bandwidth reservation.

A first visit to an arrangement starts at its beginning. Each track's current
position is remembered separately during the session. If a dialog plays a
different arrangement, returning to the street resumes the interrupted track;
the dialog track likewise resumes on its next visit. Retiring a stream pauses
it and stores its position, then frees its media element and nodes. Restoring
a track waits for metadata and seeks before playing, so its beginning is not
briefly heard. A replaced loading request cannot overwrite its saved position
with an unloaded element's zero or revive an old stream.

Switching off and on during the same cue also resumes its OGG position.
Stops and renewed requests for
that same arrangement at menu/dialog cleanup also retain it: the native street
and punk route requests Tenth Street again at revision 12 after revision 8.
It must not reload the OGG or return to original music. A new title intro
starts its combined arrangement afresh. Leaving it for the shooting cue stops
and disconnects the combined recording before the original fallback plays.
Pause (P) pauses both the media
element and the AudioContext; session end disconnects and releases the stream
and clears the remembered positions. Positions are kept in memory, not in
saved games or browser storage, and do not survive a reload or a new session.
Different arrangements have different durations, so switching does not claim
beat or bar synchronization with the original. User instruction, 2026-11-07:
every tribute cue loops the full
unaltered OGG, including its album intro and ending; seamless loop points are
not invented. A natural original note-list end or an OGG end must not restore
original music; only an explicit game music stop/change ends the selected cue.
The combined title intro/menu arrangement shares one position, with the new
title-intro restart described above as an explicit reset.

Soundtrack selection is a presentation setting and does not enter recordings
or saved games. Recordings retain the original game clock and inputs.

## Verification

`tools/tribute-soundtrack.test.mjs` checks all retained identities and OGG
hashes, serving/build boundaries, byte ranges, original audio equivalence,
isolated SFX with echo, real boot/room command handshakes, and controller
switches, pause, failure and cancellation races.
`tools/tribute-soundtrack-browser.test.mjs` checks the actual worklet mix,
playing all twelve preloaded recordings with subsequent OGG requests blocked,
cached position restoration, the actual page's cached main theme and no
preloads for a saved Original choice,
streaming every OGG in Edge, the persistent Audio option, live switching and
pause, the slider's computed visibility, and independently resumed track
positions across different dialog music. Unit tests cover seeking before
playback, superseded metadata callbacks and wrapped loop positions. Queue
tests cover oversized single-block trimming and stereo alignment.
The test browser's host speakers are muted while its real audio graph runs.
`tools/tribute-cache.test.mjs` checks bounded concurrent downloads, shared runs,
ready-file reuse, preload failure and retry, cancellation, stale completions
and URL cleanup.
The milestone release also includes the original audio, boot, browser
and production-boundary regressions. Current results belong in HANDOFF.md.
