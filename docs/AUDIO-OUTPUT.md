# PAL 1CHIP analogue audio output

Target: SNSP-CPU-1CHIP-01 and SNSP-CPU-1CHIP-02, stereo at AV Multi Out
pins 11 (left) and 12 (right). Initial research: 2026-11-02;
new research handoff reviewed and profile/source-impedance extension added:
2026-11-08.

The [optional Julian Daniels soundtrack](TRIBUTE-SOUNDTRACK.md) uses a
separate media stream. This filter still applies to the native sound effects;
the tribute recording bypasses the SNES analogue approximation.

## Research result

The digital DSP path includes Gaussian interpolation and the eight-tap echo
FIR. After the user's approval on 2026-11-02, the browser also applies a
separate nominal PAL 1CHIP output model in the AudioWorklet, after the raw PCM
checksum and queue. See [audio-output.mjs](../src/browser/audio-output.mjs),
[audio-worklet.mjs](../src/browser/audio-worklet.mjs) and the implementation
details below. This is a 32 kHz baseband approximation with documented
assumptions; no physical target measurement is claimed.

The extended investigation establishes the complete published stereo path,
including **10 uF output coupling capacitors C12/C13** and **output shunt
capacitors C51/C52 with unknown values**. These parts were omitted from the
initial research description. Missing parameters therefore include C51/C52
as well as C23/C26 and the S-MIX characteristics. An absence from a capacitor
kit, a stripped scan or an abbreviated pinout drawing is not evidence that a
part is absent on an original populated board.

No manufacturer S-MIX data sheet or calibrated frequency/phase measurement
of either target revision was located in the sources examined. The available
replacement circuits and recordings do not establish that response. This is
a limit of this investigation, not a claim that such evidence cannot exist.

## Review of the supplied research, 2026-11-08

The user supplied
[SNES_PAL_1CHIP_Audio_S-MIX_Codex_Handoff.md](../Ressources/SNES_PAL_1CHIP_Audio_S-MIX_Codex_Handoff.md)
for comparison with the current product. It is a research summary; its
embedded implementation proposal is assessed against the actual code and
sources below. The initial review left playback code and nominal parameters
unchanged. The subsequent authorized implementation adds the comparison
profiles, source impedance and headroom analysis described below; it retains
the existing nominal output.

The existing model already implements the APU-to-stereo path described
there, including input DC blocking, configurable normalized S-MIX gain,
an optional continuous one-pole mixer hypothesis (off by default), and
the loaded 1 kohm / 10 uF output network. Its digital DSP, DAC aperture and
analogue networks are separate concepts. The raw PCM hash precedes this
playback processing. No arbitrary 12 kHz original S-MIX filter, replacement
gain of 2.2, noise or clipping curve is active.

### Findings that need qualification

| Topic                | Source comparison and implication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAL stereo shunts    | The supplied summary omits C51/C52 from its main path and model proposal. The complete PAL drawing includes both at AV Multi Out, with unknown values. The nonSNES file still has Git blob `a2ca3ae261cbe8ac365a62782ab54e9fd1bac2c5`, identical to the previously inspected source. Our `outputShuntF: 330e-12` represents these parts as an explicit related-board assumption; it does not use RF mono C22. Omitting them would simplify the model, without new evidence of their physical absence.                                                                                    |
| New 150 nF candidate | [qwertymodo's SNN-CPU-01 AV reconstruction](https://github.com/qwertymodo/kicad-snn-cpu-01/blob/master/AV.kicad_sch), inspected Git blob `3f183728c666b58c9a83ab21ee8ea2d9daf1fcd1`, labels C23-C28 and C21 as 150 nF. This is useful new comparison evidence for a different board. Its C51 is itself labelled `330pF?`. Neither value settles PAL 1CHIP population. The project's README also allows substitutions for unavailable parts; reconstruction labels are not a measured PAL BOM.                                                                                            |
| N64 comparison       | The handoff repeats a 100 nF AMP-NUS comparison. The specific RDC NUS-CPU-03/04 drawing previously checked below labels its input capacitors 120 nF. State the precise drawing and revision instead of treating 100 nF as universal N64 evidence.                                                                                                                                                                                                                                                                                                                                        |
| DAC oversampling     | The NEC feature list says four-times oversampling, but does not establish an internal interpolation filter or four DAC updates per SNES PCM sample. Our local fourth-edition data sheet, PDF/printed page 12, section 4(2), figures 4-3/4-4, explicitly shows simultaneous updates followed by a hold. The linked Octopart scan is the older third edition; it lacks this added section. Neither edition establishes an extra fixed S-MIX low-pass. Keep the current baseband hold model; do not add an inferred four-times digital filter.                                              |
| Numerical filters    | The handoff's prewarped bilinear examples are possible approximations. Our IIR plus FIR design instead corrects bilinear warping against the continuous circuit over the baseband, including an optional mixer pole. Replacing it with a simple prewarped pole would preserve one corner, without establishing a better match across the band. An analogue hypothesis pole above PCM Nyquist is still a valid continuous parameter; it is not a directly specified digital filter cutoff.                                                                                                |
| Audio clock          | [Published PAL 1CHIP measurements](https://undisbeliever.net/blog/20250313-smpspeed.html) support device variation and warm-up drift, including 32083 to 32091 Hz for one console. They do not establish 32090 Hz for both target revisions. `Apu` currently emits 640 sample pairs per 50 Hz frame and playback requests 32000 Hz. A coherent 32090 Hz extension would need a fractional 641.8 pairs per frame on average, matching timer scheduling and playback conversion. Merely changing AudioContext would consume 90 extra pairs per second and alter pitch by about 4.86 cents. |

The original manufacturer's DAC figures specify test conditions. They do
not supply a calibrated PAL full-scale level, an original S-MIX gain,
a usable distortion law, or a noise spectrum. Adding those effects from
single typical THD/SNR figures would invent their character.

### Initial numerical comparison

The existing `PalAudioOutput` API can already express all the following
APU-only scenarios. The table holds the 47 kohm load, 330 pF shunt, DAC
hold and flat normalized S-MIX fixed unless the row says otherwise. These
are continuous-circuit gains before the separate 0.48 presentation gain,
not measurements of a console.

| Scenario                                     | Input corner |     20 Hz |     50 Hz |     1 kHz |    12 kHz |
| -------------------------------------------- | -----------: | --------: | --------: | --------: | --------: |
| Current 100 nF / 100 kohm                    |    15.915 Hz | -2.315 dB | -0.603 dB | -0.198 dB | -2.297 dB |
| Jr candidate 150 nF / 100 kohm               |    10.610 Hz | -1.261 dB | -0.375 dB | -0.198 dB | -2.297 dB |
| Alternative 100 nF / 150 kohm                |    10.610 Hz | -1.261 dB | -0.375 dB | -0.198 dB | -2.297 dB |
| Jr candidate, stereo shunt omitted           |    10.610 Hz | -1.261 dB | -0.374 dB | -0.197 dB | -2.294 dB |
| Jr candidate, receiving load 10 kohm         |    10.610 Hz | -1.928 dB | -1.023 dB | -0.843 dB | -2.942 dB |
| Jr candidate, hypothetical 12 kHz mixer pole |    10.610 Hz | -1.261 dB | -0.375 dB | -0.228 dB | -5.307 dB |

A new synthetic eight-second stereo impulse probe compared the actual
implementation against independent complex input/output impedances at
5 Hz, the input corner, 20/50 Hz and 1/8/12/15/15.5 kHz. For these six
profiles, sampled magnitude errors through 15 kHz stayed below 0.014 dB
and relative phase errors below 0.16 degrees after removing the common
32-sample delay. The two equal-RC candidates produced identical impulse
arrays, including their filter state evolution. All samples were finite;
the unexcited right channel remained zero. These results validate equations
and code at the sampled points; they do not identify the real S-MIX.

The initial comparison exposed a headroom problem. Its eight-second impulse
absolute sum was 2.05634; for 150 nF / 100 kohm it was 2.07769, giving a
full-scale convolution bound of about 0.99729 after presentation gain.
That leaves less margin than the current profile. The 12 kHz hypothesis
gave 2.44578, whose bound exceeds unity at gain 0.48. This does not prove
that game music clips, but the previous nominal headroom guarantee did not
carry over. The implementation below now evaluates each profile and reduces
its fixed presentation gain where necessary.

Probe and results: `.cache/audio-research/new-handoff-audit.mjs`,
`.cache/logs/audio-new-handoff-audit.json` and
`.cache/logs/audio-new-handoff-audit.log`. The probe also reproduced the PAL
schematic's Git blob and checked the actual unknown component labels.
The unmodified product's earlier passing tests remained the regression
record for that editorial review. The subsequent implementation has its
own expanded verification, described below and recorded in HANDOFF.md.

### Design implications

The implemented profile set keeps the nominal approximation distinct from
the 150 nF candidate and experimental low-pass variants. Each parameter has
units, source identity and an evidence category. Headroom is evaluated for
every named or custom profile. A capacitance change alone cannot select the
more faithful profile while the original input impedance remains unknown.

The nominal input still assumes zero DAC source impedance. The extended
linear input stage now expresses a Thevenin source with a separate resistance:
`H(s) = Rin*s*C / (1 + (Rs + Rin)*s*C)`. Both its corner and its passband
divider must change together. DAC-side 10 kohm shunts are not series `Rs`;
with a nonideal DAC, first derive the loaded Thevenin voltage and resistance.
Actual DAC impedance remains source-required. Likewise a finite S-MIX
output impedance would require the mono branches and their stereo coupling
to be solved together, rather than just adding resistance to the AV branch.

Shadowrun currently supplies only native APU audio. The optional tribute
recording is a separate presentation stream, not cartridge audio. Separate
cartridge/expansion coupling and mixing would be necessary for an actual
external analogue source, but adding silent inputs cannot improve this
game's present output. Such sources must join after the native DAC stage;
they must not inherit its hold response or its 16 kHz source bandwidth.

The present 32 kHz model covers the native PCM baseband. A higher-rate
DAC reconstruction could also represent spectral images and the receiving
chain's rejection of them, which this model omits. It would need explicit
source/output rates, time alignment, reconstruction and anti-alias filters;
it would not reveal the unknown original amplifier bandwidth. Browser
resampling is currently external and not calibrated as an analogue board
or a particular television. Original MUTE/PRESET transients, distortion,
noise and revision differences still need suitable published evidence.

The current work order belongs only in [PROJECT-STATUS.json](PROJECT-STATUS.json).

## Source evidence

The target boards have a different audio circuit from the early SNES boards
with a discrete LM324 filter. Their nominal path is S-APU U2, NEC
uPD6379A U6, input coupling capacitors C23/C26, S-MIX U10, output
resistors R23/R26, output coupling capacitors C13/C12 and the AV connector
with C52/C51 to ground. The source is arzi84's reverse-engineered schematic,
revision 0.5, dated 2019-08-25, one A1 sheet, explicitly labelled with both
target revisions. It is community hardware research, not a Nintendo service
schematic.

- [Author's publication](https://videogameperfection.com/forums/topic/schematic-for-1chip-pal-snes/).
  The author explicitly says that some pinouts and component values are missing.
- [Original download](https://drive.google.com/file/d/1fDNpfyJ-E82QWd-eq_aRCuPxjVkuFo0R/view)
  and [public mirror](https://www.mikrocontroller.net/attachment/602902/PAL-snes-1chip-schematic.pdf).
- Local copy: [SNES-PAL-1CHIP-Schematic.pdf](../Ressources/SNES-PAL-1CHIP-Schematic.pdf),
  PDF page 1, audio circuit around U6/U10 and P4, sheet columns 8-10.
  Follow the wires up to P4: the area around U10 alone does not show the
  complete stereo output circuit.
  SHA-256: `013a0dfdcf0608faf119163bb4db1c97036cecd3118901e1a3b87e8fc2650e8a`.

The DAC evidence is NEC's manufacturer data sheet S11588EJ4V0DS00,
fourth edition, November 1999:

- [Published scan](https://igspgm.com/repairs/nec%20upd6379.pdf).
- Local copy: [NEC-UPD6379-Datasheet.pdf](../Ressources/NEC-UPD6379-Datasheet.pdf).
  SHA-256: `5c7cda76c2de991a9ae6836e3a9014a2989e7ac70255e248da9559d1ed1c0ff4`.
- PDF/printed page 1: resistor-string DAC, internal output operational
  amplifier; the stated ability to accept four-times oversampled input does
  not establish an internal four-times interpolation filter.
- Pages 2-3: block diagram and uPD6379A pin assignments; right output 1,
  reference 2, ground 3, left output 4.
- Page 6: 16-bit output; full-scale voltage, distortion and channel separation
  are characteristics with stated test conditions, not transfer functions.
- Page 10: signed input words map to analogue voltages around a DC bias.
- Page 12, section 4(2), figures 4-3/4-4: both outputs update together 3.5
  bit clocks after the end of right-channel data and hold between updates.
  This supports a zero-order hold model. It does not specify the complete
  output amplifier frequency response.

Nintendo's [Book I](../Ressources/book1_text.pdf) establishes the hardware
boundaries independently of the board-specific schematic:

- Chapter 22, figure 2-22-1, PDF page 99, printed 2-22-2: sound DSP, D/A
  converter, filter amplifier and output amplifier are separate blocks.
  This overview predates the target 1CHIP circuit and gives no S-MIX values.
- Sound chapter 1.5, figure 3-1-3, PDF page 156, printed 3-1-4: the digital
  echo filter is within the DSP, before its digital output.
- Sound chapter 7.2.2.11, PDF page 177, printed 3-7-10: C0-C7 form the
  eight-tap echo FIR. This is not evidence for an analogue output low-pass.

Shadowrun's native driver and digital DSP are documented separately in
[SOUND-DRIVER.md](SOUND-DRIVER.md). ROM behaviour cannot establish analogue
component values. A match with Mesen's internal DSP state ends at digital PCM.

## What the target schematic establishes

| Part          | Connection or value                                         | Consequence                                                                                   |
| ------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| U6            | NEC uPD6379A                                                | Simultaneous stereo DAC output; no left/right swap                                            |
| C15           | 47 uF at DAC reference                                      | Reference supply smoothing, not a series audio high-pass                                      |
| C23, C26      | Series DAC-to-S-MIX coupling, values marked `?`             | AC coupling is present; its corner frequency is unresolved                                    |
| R48, R51      | 10 kohm DAC output pull-downs                               | These are before the coupling capacitors; they do not establish S-MIX input impedance         |
| U10           | S-MIX, no internal schematic                                | Gain, input resistance, bandwidth and nonlinear behaviour are unresolved                      |
| C16, C17      | 33 uF from S-MIX preset pins to ground                      | Not series output coupling capacitors                                                         |
| R23, R26      | 1 kohm in series with AV stereo outputs                     | Level depends on the connected line input impedance                                           |
| C13, C12      | 10 uF, 16 V, in series after R23/R26                        | Right/left output DC blocking; a further load-dependent high-pass                             |
| C52, C51      | From right/left AV pins to ground, values marked `?`        | With source resistance and the connected cable, an output low-pass whose corner is unresolved |
| R24, R27, C22 | 47 kohm from each channel to RF mono node, 330 pF to ground | The capacitor is on the RF summing node, not across each stereo output                        |
| R22, R25      | 10 kohm from each channel to expansion mono node            | An expansion-output summing network, not two stereo low-pass filters                          |

Do not reuse the early-board 22 kohm/1 nF/1.8 nF filter values, put the RF
mono capacitor across stereo, treat the input pull-downs as series resistors,
or infer coupling corners from the reference/preset capacitors.

The channel connections in that drawing are:

| Channel | DAC output              | Input coupling | S-MIX input/output | Output branch | AV pin / shunt  |
| ------- | ----------------------- | -------------- | ------------------ | ------------- | --------------- |
| Left    | U6 pin 4, R51 pull-down | C26            | U10 pin 12 / pin 8 | R26, then C12 | P4 pin 11 / C51 |
| Right   | U6 pin 1, R48 pull-down | C23            | U10 pin 3 / pin 7  | R23, then C13 | P4 pin 12 / C52 |

The RF and expansion mono branches leave the S-MIX outputs before the stereo
output coupling capacitors. C22 must not be substituted for C51/C52.

## Additional research and its limits

[ManCloud's S-MIX replacement](https://github.com/ManCloud/S-MIX-replacement)
documents successful interchange of S-MIX and N64 AMP-NUS. Its open replacement
uses an LM358, 10 kohm input resistors and 22 kohm feedback. That is a
replacement design, not a measurement of original S-MIX internals or proof
of its frequency response.

The inspected replacement schematic is pinned to
[commit b3b1b3a7](https://github.com/ManCloud/S-MIX-replacement/tree/b3b1b3a7baac4eca1b1cada6cfdc22a01531cb1d),
file `S-Mix-Replacement.sch`, Git blob
`e1822ba6db955e07db96e50de680214b56486af7`.
Its resistor ratio suggests an ideal inverting mixer gain magnitude of 2.2;
that calculation describes the replacement only. Its BOM does not supply
an original S-MIX reconstruction-filter specification.
In [issue 1](https://github.com/ManCloud/S-MIX-replacement/issues/1),
the author reports another builder's working board with some buzzing. This
supports functional repair evidence, not a precision analogue comparison.

[McRetro's PAL 1CHIP repair](https://mcretro.net/s-mix-on-the-snes-snsp-cpu-1chip-01-snsp-cpu-1chip-02/)
identifies the DAC and demonstrates an S-MIX bypass on a damaged board.
The author explicitly does not establish electrical equivalence or long-term
loading safety. Audible output after a bypass does not prove a flat S-MIX.

[RetroLoom's DAC replacement](https://github.com/RetroLoom/Super-Wave-Blaster)
specifies 100 nF input coupling for its S-MIX configuration. This is another
modified circuit, not a measured stock value for C23/C26 on the target boards.

These sources help identify assumptions and exclude wrong topologies. They
do not close the missing stock capacitor values and S-MIX response. Both
requested revisions share the published schematic; it provides no separate
measured audio responses for them.

### Newer PAL recreation and board scans

[stonedDiscord/nonSNES](https://github.com/stonedDiscord/nonSNES)
contains a PAL 1CHIP KiCad project and ArcadeTV board scans. The
[README at the inspected commit](https://github.com/stonedDiscord/nonSNES/blob/cf2e70b35b141b551b1683b0fac1c4b29f9ed0d6/README.md)
credits arzi84 for the schematic and ArcadeTV for stripped scans. Consequently,
agreement with the 2019 drawing does not constitute an independent measurement.

- Inspected file:
  [SNSP-CPU-1CHIP.kicad_sch](https://github.com/stonedDiscord/nonSNES/blob/cf2e70b35b141b551b1683b0fac1c4b29f9ed0d6/SNSP-CPU-1CHIP/SNSP-CPU-1CHIP.kicad_sch).
  Git blob: `a2ca3ae261cbe8ac365a62782ab54e9fd1bac2c5`;
  downloaded UTF-8 file SHA-256:
  `2728ba37c83283717f5c81334de333fb07baa0ddfcae6d46c062c3fa8efc8bef`.
- Its actual component properties still give `?` for C23, C26, C51 and C52;
  U10 remains an S-MIX symbol without an internal circuit.
  C12/C13 are labelled 10 uF, 16 V.
- The photo directory includes stripped PAL -01 and -02 scans. The inspected
  `SNES_SNSP-1CHIP-02_PAL_UPPER_WITH_PARTS_PCB_SCAN_ATV.tif` shows S-MIX A,
  uPD6379A and retained electrolytics. Parts were removed to expose traces;
  it cannot establish factory non-population of the missing small passives.
- [Issue 2](https://github.com/stonedDiscord/nonSNES/issues/2) and
  [issue 3](https://github.com/stonedDiscord/nonSNES/issues/3) discuss the
  reconstruction work but provide no missing audio values or measurements.

[SNESdev's S-MIX pinout](https://snes.nesdev.org/wiki/S-MIX_Pinout)
also cites arzi84. Its abbreviated ASCII circuit omits C12/C13 and C51/C52.
Use the full source sheet when following the path to the AV connector.

### Related-board capacitor evidence

These observations are useful candidates for subsequent verification. None
is a direct stock measurement of SNSP-CPU-1CHIP-01/-02.

| Source                                                                                                                                                                            | What is actually documented                                                                                                                                                | Limit for this target                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [RDC's original N64 publication](https://acidmods.com/forum/index.php?topic=42639.0) and [current schematic PDF](https://www.acidmods.com/RDC/NINTENDO/N64/N64_NUS_CPU_03_04.pdf) | NUS-CPU-03/04, drawing dated 2-7-2013 with revision 10-17-2020: AMP-NUS input C31/C32 are labelled **120 nF**; output C25/C26 are 10 uF; output shunts C23/C122 are 330 pF | Different console, DAC and board. Do not silently substitute the 100 nF labels seen in older copies or summaries, or turn its values into PAL SNES measurements |
| [arzi84's earlier PAL SNES schematic](https://www.mikrocontroller.net/attachment/602939/PAL-SNES_Schematic.pdf)                                                                   | Revision 0.8, 2017-11-04, SNSP-CPU-01/-02 from 1992: AV audio shunts C51/C52 labelled 330 pF                                                                               | Those are the early multi-chip PAL boards, despite their similar names and reused designators                                                                   |
| [Areku's LM358 repair question](https://electronics.stackexchange.com/questions/527928/using-an-lm358-as-line-level-buffer)                                                       | SNSM-CPU-1CHIP-03; discussion describes an 88 nF DC-blocking capacitor and a failed replacement buffer bias arrangement                                                    | Brazilian -03, with no stated measurement method or PAL designator mapping; neither an original S-MIX response nor proof of a stock nominal value               |
| [Gaoga's RGB-01 modification](https://gaoga.sakura.ne.jp/CGC/SFC/RGB01_R01/RGB01_R01.php)                                                                                         | Replaces input capacitors with 1 uF and mentions removed 0.1 uF Mylar parts                                                                                                | Different SNS-CPU-RGB-01 board, already modified; the 1 uF values are replacements, not factory PAL 1CHIP values                                                |
| [RetroLoom's replacement](https://github.com/RetroLoom/Super-Wave-Blaster)                                                                                                        | Its S-MIX configuration uses 100 nF coupling, voltage-divider resistors and its own low-pass parts                                                                         | Replacement PCM5102A path; its component reference numbers do not refer to the original motherboard                                                             |

The N64 PDF was inspected visually because it is a raster drawing. Its
SHA-256 is `5c2486062cd51def528334a3ad2a6dc01d561c3d0aa891587642ced489b6b6c7`.
The earlier PAL schematic SHA-256 is
`744dd93c8365fe576fc9a428e7939c919f5579d0add9f4304fd2e0c2fb7067fc`.
They are comparison sources, not additional target schematics.

The combined evidence makes a coupling capacitance around 0.1 uF and an AV
shunt around 330 pF reasonable hypotheses to test. It does not establish their
nominal values, tolerance, dielectric or revision identity for the target.

### Audio comparisons checked

- [Karbuncle and Kevtris, AtariAge, 2018-03-01](https://forums.atariage.com/topic/242970-fpga-based-videogame-system/page/353/#findComment-3974964):
  spectrum comparisons concern **MSU-1 cartridge audio**, including a Junior
  and Super Nt. The cartridge signal bypasses the console's native DAC and
  APU input coupling. Those images cannot identify the full native PCM-to-AV
  response of either PAL target. Music spectra also are not calibrated
  frequency/phase transfer measurements.
- RetroLoom's repository contains MDFourier comparisons and a WAV labelled
  GPM02. These are comparisons of a different board and replacement audio
  path; no PAL 1CHIP reference recording was identified there.
- [MDFourier's author documentation](https://junkerhq.net/MDFourier/)
  describes controlled tone generation and comparative recordings. The
  examined downloads page supplies reference archives for Mega Drive and
  PC Engine, and lists the SNES generator separately as release pending.
  It supplies no identified PAL -01/-02 stock recording on that page.
- [TmEE's LTspice discussion](https://forums.nesdev.org/viewtopic.php?t=24985)
  gives about 12 kHz for a discrete LM324 circuit. Although the thread title
  mentions 1CHIP, that calculation discusses the older filter and mixer;
  it is not an S-MIX measurement. The indexed discussion was readable;
  direct retrieval returned HTTP 403.

No recordings were captured from physical hardware during this investigation.

### Available measurement software, checked beyond the landing page

The release-pending label on MDFourier's landing page does not mean no SNES
measurement software exists. The current public repositories contain:

- [Native SNES B3 profile](https://github.com/ArtemioUrbina/MDFourier/blob/50fd5c2a050885bd2a78dfaf974d261fe29979a8/profiles/mdfblocksSNES.mfn),
  Git blob `ae41a8d4dfe9758e0cf7f913045dfa139061743f`: separate PAL/NTSC
  modes, synchronization/silence blocks, 120 SPC700 tone blocks and a mono
  balance reference. This is an analysis description, not a hardware capture.
- [SNES B3 plus MSU-1 profile](https://github.com/ArtemioUrbina/MDFourier/blob/50fd5c2a050885bd2a78dfaf974d261fe29979a8/profiles/mdfblocksSNES-MSU1.mfn),
  Git blob `1fff4af7553b22bc13eb505c4855c239062fa6b4`: native and cartridge
  sections are explicitly separate. Use the native section for the full
  DSP-to-AV path, rather than treating MSU-1 as an equivalent source.
- [240p Test Suite SNES generator source](https://github.com/ArtemioUrbina/240pTestSuite/blob/8af9e81a3e3bb329afadde48a2efc36f0579f3cf/240psuite/SNES/240pSuite/tests.c#L1231):
  `ExecuteMDFourier`, `ExecutePulseTrain` and `PlayScale`. The inspected code
  sends eight sample classes through fifteen settings each, separated by
  silence and synchronization. Its samples still pass through the console's
  digital audio path; their names are not a substitute for actual DSP PCM.

No generator was built or run here. Match the precise generator binary and
profile version before using recordings; repository availability does not
validate a particular pair. Retain both hashes with the capture.

The authors have also documented measurement pitfalls:

- [Artemio Urbina, 2020-01-11](https://www.patreon.com/aurbina/posts/thank-you-kindly-33044979)
  discusses an SDK-related stereo-imbalance investigation and clock variation.
  This is historical development evidence, not a claim that those problems
  remain in a current release.
- [MDFourier note 04](https://junkerhq.net/MDFourier/notes/MDF-Note04-AnalogueSystems.pdf),
  2020-02-29, PDF page 3, explains time alignment and pitch differences and
  mentions the SNES work. Correct clock differences before attributing a
  spectral mismatch to an analogue filter.
- [MiSTer SNES issue 212](https://github.com/MiSTer-devel/SNES_MiSTer/issues/212)
  documents incorrect synchronization tones in an FPGA implementation and a
  subsequent reported fix. Its attached output is an implementation bug
  example, not an identified stock PAL reference. This is another reason to
  verify the exact digital reference before fitting an analogue model.

The additional S-MIX replacement installation described by
[Ivan Caregnato, 2022-05-02](https://console-tribe.com/articoli/hardware-test/sostituire-s-mix-aka-super-nintendo-1chip-che-non-riproduce-alcun-suono-237775/)
provides independent functional-repair evidence for ManCloud's board, but no
calibrated response comparison with the removed chip. The archived
ASSEMblerGames discussion linked by McRetro could not be retrieved; its
unread contents are not treated as verified evidence here.

## What can be calculated without inventing component values

The following are circuit deductions with explicit idealizations, not measured
target responses. They explain why a generic SNES low-pass is insufficient.

For an ideal held DAC output at nominal `Fs = 32000 Hz`, the normalized
zero-order-hold magnitude is `abs(sin(pi*f/Fs)/(pi*f/Fs))`. This alone gives
about -0.91 dB at 8 kHz, -2.11 dB at 12 kHz and -3.92 dB at 16 kHz.
The NEC hold timing supports this idealization; amplifier settling and the
remaining analogue network still need separate evidence. The hold also
creates spectral images above the audio band. A sample-rate conversion
filter does not by itself prove this physical DAC response.

For input coupling, assuming a resistive S-MIX input and negligible DAC
source resistance, `fc = 1/(2*pi*Rin*Cin)`. If `Cin` were 100 nF, a 10 kohm
input would give 159 Hz, whereas a 100 kohm input would give 15.9 Hz. Both
are conditional examples. R48/R51 cannot choose between them because those
pull-downs are on the other side of the capacitors.

The output network can be expressed, assuming an ideal S-MIX voltage source,
as `Hout(s) = Zload / (Rseries + 1/(s*Cout) + Zload)`, where
`Zload = 1/(1/Rload + s*(Cshunt + Ccable))`, `Rseries = 1000 ohm` and
`Cout = 10 uF`. A real source adds its output impedance to this expression.
The receiving equipment and cable must be specified for a reproducible model.

For example, with a purely resistive 10 kohm load and negligible shunt/cable
capacitance, the known output branch has a high-pass corner of about 1.45 Hz
and a passband gain of 10/11. If the unknown shunt were 330 pF, its isolated
low-pass corner with an ideal source, 1 kohm series resistance, negligible
cable capacitance and an effectively infinite load would be about 482 kHz.
That would not explain a strong 8-12 kHz roll-off. A value of 10 nF in the
same hypothetical network would instead give 15.9 kHz. Neither value is
selected as the target's stock value here.

## Evidence needed for a faithful model

The user clarified on 2026-11-02 that no SNES or measurement equipment is
available. Physical measurements by the user or in this workspace are
therefore not a prerequisite for further work. The measurement routes below
describe what suitable published third-party evidence would need to contain;
they are not tasks assigned to the user. No hardware purchase is required.

There are two valid routes; a complete internal S-MIX schematic is not a
prerequisite for a model fitted to calibrated end-to-end measurements.

1. **Component route:** establish C23/C26 and C51/C52 on each labelled stock
   PAL revision, with the measurement method and uncertainty recorded.
   Establish S-MIX gain, input/output impedance, frequency/phase response and
   the effect of C16/C17. Measure DAC settling or bound its omission.
2. **Measurement route:** record known digital DSP output and the matching
   stock AV output, with identified board/chip revision, supply, cable,
   receiving impedance and calibrated capture response. Measure channels
   separately with several levels, tones/sweeps and silence. Preserve the
   unnormalized level relationship, sample-clock alignment and phase. Use
   separate recordings to validate any fitted response and nonlinear terms.

A cartridge/MSU-1 sweep can help isolate the downstream mixer/output path,
but cannot replace the native-DAC measurement. A capture comparison must
include the DSP's existing digital filtering exactly once. Do not infer the
analogue transfer by dividing unrelated game-music spectra, or adopt an
emulator's user-selectable resampler as hardware evidence.

Matching the published topology supports a shared initial model structure
for -01/-02. A claim that their responses are identical requires revision-
identified measurements; it does not follow from one combined drawing.

## Practical route without physical measurements

The achievable result is a documented nominal model, with a clear boundary
between circuit evidence and chosen assumptions. Software checks can prove
that its implementation follows the chosen equations; they cannot establish
that those assumptions match an unmeasured original S-MIX.

The recommended first scope is the documented DAC hold and the known output
coupling/resistance, with an explicit receiving load. Keep the unresolved
input network, S-MIX response and AV shunt capacitances as separate parameters.
An ideal linear S-MIX is a possible approximation; its flat response must not
be presented as a hardware finding. Similarly, selecting a line-input load
defines the listening setup rather than a component inside the SNES.

Candidate 100 nF input coupling and 330 pF AV shunts can be evaluated as
related-board assumptions, but those capacitances alone do not determine the
sound. In particular, an input corner still needs the unknown S-MIX input
impedance. Do not silently assign the replacement's 10 kohm input resistance
to the original: with 100 nF it would introduce a 159 Hz corner, a substantial
bass change. Compare parameter sensitivity before selecting a nominal preset.

Do not introduce an arbitrary 8-12 kHz low-pass, hiss, hum, saturation or
channel imbalance as an assumed PAL 1CHIP characteristic. Keep the proven
digital filtering unchanged. The final description should identify the
result as a PAL 1CHIP approximation, and leave room for later published data
without requiring users to perform measurements themselves.

## Supplied capacitor list and video-modification claims

The user supplied the following capacitor list on 2026-11-02. Its values agree
with the corresponding labelled parts in the target schematic. This is a list
of electrolytics, not a complete list of the board's capacitors.

| Part          | Capacitance | Voltage |
| ------------- | ----------- | ------- |
| C9            | 2.2 uF      | 50 V    |
| C12, C13      | 10 uF       | 16 V    |
| C14, C16, C17 | 33 uF       | 25 V    |
| C15           | 47 uF       | 16 V    |
| C18, C19      | 220 uF      | 6.3 V   |
| C59           | 10 uF       | 25 V    |
| C71           | 10 uF       | 50 V    |
| C72           | 2200 uF     | 25 V    |

C23/C26 are absent from this list. That does not establish their value, type,
or whether a particular board has them populated. A pasted follow-up claimed
they were empty video-supply pads fitted with 4.7 uF/100 nF for the ghosting
fix. Do not use that claim as audio evidence: it contradicts the topology of
the target-board schematic, where they couple the two DAC outputs to S-MIX.
The linked capacitor-kit listing is not a component-level circuit analysis.

[Borti's original RGB-bypass instructions](https://github.com/borti4938/SNES_RGB_Bypass#ghosting)
identify **C11**, with a 220 nF replacement in those instructions, as the
ghosting modification. A video-supply or ghosting modification is separate
from the stock stereo audio output circuit. Neither the 4.7 uF nor the
100 nF claim in the pasted text establishes the stock C23/C26 values.

## Implementation boundary

Keep the original sample assets, native sound driver, DSP state and its
32 kHz PCM output unchanged. An output-circuit model belongs only in the
playback path, after raw PCM checksums and before the audio destination.
Preserve stereo and continuous filter state across message/render blocks.
Queue starvation is a transition to zero input, so a physical model's tail
must continue rather than freeze; a new game starts with fresh state.

An exact target-board transfer function remains source-required until the
missing response is established by component evidence or calibrated
measurement. On 2026-11-02 the user accepted the proposed nominal model,
explicit parameters and sensitivity comparison without physical measurements.
That approval permits the following implementation assumptions; it does not
turn them into findings about the original board.

## Implemented nominal model

The same nominal profile serves both PAL target revisions. Their separately
measured differences remain unknown. Values live in `PAL_1CHIP_AUDIO` in
[audio-profiles.mjs](../src/browser/audio-profiles.mjs), re-exported by
[audio-output.mjs](../src/browser/audio-output.mjs) for existing callers.

| Parameter                     | Default                                   | Evidence or model choice                                                                    |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Source PCM rate               | 32000 Hz                                  | Existing native DSP rate; no driver or DSP timing change                                    |
| DAC aperture                  | `sin(pi*f/Fs)/(pi*f/Fs)`                  | Ideal baseband magnitude of the NEC-supported hold                                          |
| C23/C26                       | 100 nF each                               | Related-board/replacement assumption                                                        |
| S-MIX input resistance        | 100 kohm                                  | Explicit model choice; not R48/R51 or a measured S-MIX value                                |
| Loaded DAC source resistance  | 0 ohm                                     | Explicit ideal-source choice; configurable Thevenin resistance after the physical DAC shunt |
| S-MIX gain and bandwidth      | Linear gain 1, no additional low-pass     | Normalized approximation; original gain, phase, impedance and bandwidth remain unknown      |
| S-MIX output source impedance | Ideal zero                                | Model choice; mono branches draw current but cannot change the ideal stereo source voltages |
| R23/R26                       | 1 kohm each                               | Target schematic                                                                            |
| C12/C13                       | 10 uF each                                | Target schematic and supplied list                                                          |
| C51/C52                       | 330 pF each                               | Related-board assumption, distinct from RF mono C22                                         |
| Receiving load                | 47 kohm per channel, no cable capacitance | Explicit listening setup choice; not a resistor inside the SNES                             |

The chosen input network has a 15.9 Hz corner. Assigning the replacement's
10 kohm input instead would move it to 159 Hz and remove much more bass.
100 kohm selects the milder of those two candidate effects; this is a
practical choice under uncertainty, not evidence that the original uses it.
The known output network with the chosen load has a slow corner near
0.332 Hz. Its assumed 330 pF shunt has only a small effect in the baseband.

### Named comparison profiles and source impedance

`AUDIO_PROFILES` and `getAudioProfile(id)` expose five immutable definitions.
Each contains complete `parameters`, per-parameter `evidence` with units,
category, source and qualification, plus shared unresolved hardware questions.
The default is `pal_1chip_nominal_100n_100k`; the additional profiles are
comparisons and hypotheses rather than alternative claims of measured PAL
accuracy. All use the same explicit 47 kohm receiving load and 330 pF stereo
shunt assumption, so those choices do not silently change during comparison.

| Profile ID                      | Input coupling / resistance | Additional mixer pole                            |
| ------------------------------- | --------------------------- | ------------------------------------------------ |
| `pal_1chip_nominal_100n_100k`   | 100 nF / 100 kohm           | Off                                              |
| `pal_1chip_reference_150n_100k` | 150 nF / 100 kohm           | Off                                              |
| `pal_1chip_150n_47k`            | 150 nF / 47 kohm            | Off                                              |
| `pal_1chip_100n_150k`           | 100 nF / 150 kohm           | Off                                              |
| `pal_1chip_optional_lp12k`      | 150 nF / 100 kohm           | Unverified continuous one-pole 12 kHz hypothesis |

Both `PalAudioOutput` and `AudioPlaybackOutput` accept a profile ID where
they previously accepted custom parameters. The custom object API remains
available. `PalAudioOutput.definition` identifies a named profile; for custom
overrides it is `null`, rather than implying that the user-supplied values
inherit the original definition's evidence. `profile` always contains the
complete validated numeric/boolean parameters.

`inputSourceResistanceOhm` defaults to zero and must be finite and
nonnegative. With input coupling present, it changes the input pole to
`1 / ((Rs + Rin) * C)` and the passband divider to `Rin / (Rs + Rin)`.
The current normalized PCM represents the source's open-circuit Thevenin
voltage after the physical shunt. If a finite DAC resistance before R48/R51
is known later, both that voltage and `Rs = Rdac || Rshunt` must be derived
first. Setting `Rs` to the shunt's 10 kohm value would describe the wrong
network. The original DAC impedance remains unmeasured here.

For example, a custom hypothesis can use the Jr candidate with a chosen
10 kohm loaded source resistance:

```js
const definition = getAudioProfile('pal_1chip_reference_150n_100k');
const output = new AudioPlaybackOutput({
  profile: { ...definition.parameters, inputSourceResistanceOhm: 10000 },
});
```

With an ideal source the 150 nF / 100 kohm and 100 nF / 150 kohm candidates
remain identical. With a finite source they differ in passband divider and
corner, as their impedances are different despite the original equal RC
products. `inputCapacitanceF: null` omits the entire input stage, including
the new divider, for isolated circuit checks.

The AudioWorklet accepts an optional initial `processorOptions.audioProfile`
ID or custom parameter object and reports the applied named ID (or `custom`)
and `presentationGain` with its existing counters. **Options → Audio** exposes
the five profiles with bilingual listening descriptions and explicit labels
for comparisons and experiments. The nominal profile remains the default.
The selected ID is stored as `shadowrun.audio.profile.1`; unknown stored IDs
fall back to the nominal profile. The same overlay contains the analog filter
switch, Original/Tribute soundtrack choice and Tribute volume slider.

An `audio-profile` control message changes the output circuit without restarting
the game or clearing either PCM queue. Unknown message IDs are ignored.
`AudioPlaybackOutput.setProfile(id)` validates and constructs the new circuit
before changing state. The previous circuit, bypass delay and filter mix remain
available during a 64-sample (2 ms) crossfade between both circuits' outputs
and their fixed presentation gains. Multiple choices before playback resumes
replace the pending circuit while retaining the last audible circuit. Selecting
the current ID leaves its state intact. The new circuit starts with fresh state;
this transition is a listening convenience, not a hardware switching model.
PCM hashing, source rate and DSP scheduling are unchanged.

### Parameter sensitivity

The table uses the continuous circuit equations above, before presentation
headroom. Each row changes only the named parameter. Entries are gain in dB
relative to the normalized digital input; they are calculated examples,
not measurements of consoles.

| Scenario                                     |   20 Hz |   50 Hz |  1 kHz |  8 kHz | 12 kHz | 15 kHz |
| -------------------------------------------- | ------: | ------: | -----: | -----: | -----: | -----: |
| Selected nominal profile                     |  -2.315 |  -0.603 | -0.198 | -1.096 | -2.297 | -3.591 |
| Input resistance 10 kohm                     | -18.268 | -10.649 | -0.306 | -1.098 | -2.298 | -3.591 |
| Input resistance 1 Mohm                      |  -0.212 |  -0.188 | -0.197 | -1.096 | -2.297 | -3.591 |
| Input coupling 120 nF                        |  -1.767 |  -0.479 | -0.198 | -1.096 | -2.297 | -3.591 |
| AV shunt 10 nF                               |  -2.323 |  -0.611 | -0.223 | -2.044 | -4.189 | -6.267 |
| Receiving load 10 kohm                       |  -2.981 |  -1.251 | -0.843 | -1.741 | -2.942 | -4.235 |
| Assumed first-order S-MIX low-pass at 16 kHz |  -2.315 |  -0.603 | -0.215 | -2.066 | -4.235 | -6.330 |

Input resistance dominates the uncertain bass response. Neither 100/120 nF
coupling alone nor the two known 10 uF capacitors establish it. Shunt and
S-MIX bandwidth assumptions can affect the upper band independently of the
DAC aperture. The default therefore does not invent an additional S-MIX
low-pass. S-MIX gain is an independent linear multiplier in the model.

### Numerical realization and playback

The slow input/output high-pass poles retain infinite decay in two stereo
IIR states, using the bilinear substitution `s = 2*Fs*(1-z^-1)/(1+z^-1)`.
The output poles are factored from the complete series/shunt/load impedance
expression; the shunt is not approximated as a second independent RC with
the wrong resistance. The small root is evaluated without subtracting
nearly equal numbers.

A 65-tap FIR models the DAC aperture, fast output pole and optional assumed
S-MIX low-pass, and corrects the slow IIRs' frequency warping. Its coefficients
come from midpoint inverse-DTFT quadrature over 1024 bins, a generalized
Blackman window with alpha 0.08 and DC normalization. The window comparison
kept the 32-sample delay and reduced the tested alternatives' upper-band
error; `.cache/logs/audio-kernel-resolution.json` retains that investigation.
Construction allocates once; circuit render-block processing
uses fixed histories and makes no allocations. The scalar stereo response
introduces no channel crossfeed or imbalance.

The FIR has a 32-sample reference delay (1 ms). It represents the hold's
magnitude; the physical half-sample aperture delay is absorbed into that
constant processing delay. Absolute board timing, including the serial DAC
latency, is not reconstructed. Browser/device resampling remains external.
The [Web Audio specification](https://www.w3.org/TR/webaudio/) defines the
AudioContext rate and processor arrays; processing remains at the requested
32 kHz so raw sample counts and pitch do not change.

This implementation approximates **the PCM baseband below 16 kHz**. It does
not generate the physical DAC's spectral images above that band, switching
glitches, amplifier noise, distortion, supply ripple or reference/preset
startup transients. A higher-rate physical-waveform model would be a separate
extension. The finite FIR has increasing error very close to Nyquist;
neither arbitrary parameter values nor every frequency have a global bound.
The underlying distinction between a continuous DAC hold and discrete
playback is explained by [Neil Robertson](https://www.dsprelated.com/showarticle/1627.php).

`AUDIO_HEADROOM = 0.48` remains the maximum software presentation gain
(about -6.38 dB), applied after the circuit model. `AudioPlaybackOutput`
now chooses a fixed `presentationGain` for its actual profile:
`min(0.48, 0.99 / max(1, circuit.headroom.bound))`. The nominal profile still
uses exactly 0.48. A stronger-response profile can receive a smaller gain;
the value is the same for filtered and bypass playback, preventing a level
jump when toggling the filter. It does not vary with music, compress peaks,
clip or saturate the circuit, or represent a measured S-MIX gain.

At construction, `circuit.headroom` records a 4096-sample impulse prefix's
absolute sum, a bound on the entire remaining tail, and their combined bound.
This analysis uses separate scalar state and a fixed FIR history; neither
live stereo channel is advanced. Processing callbacks do not run the analysis
or allocate its state. For normalized input with absolute value at most one,
the impulse absolute sum bounds every output sample by convolution.

For the two high-pass stages after the finite impulse, let `u0` and `v0`
be their last outputs, `a1/a2` the feedback coefficients and `b2` the second
stage's feedforward coefficient. Future input is zero. For `k >= 1`:

```text
F = b2 * (a1 - 1) * u0
D = F / (a2 - a1)
v[k] = (v0 + D) * a2^k - D * a1^k
```

The sum of the two absolute geometric tails bounds the remaining second-stage
impulse. A separate convolution bound,
`abs(v0)*abs(a2)/(1-abs(a2)) + abs(F)/((1-abs(a1))*(1-abs(a2)))`,
also covers equal poles. Taking the smaller finite bound avoids cancellation
problems in the residue expression near coincident poles. With the input
stage omitted, `u0` is zero and only the output-stage decay remains. The FIR
tail bound includes its stored impulse samples as well as the future IIR
tail, weighted by absolute kernel coefficients. It never assumes that a
slow pole has finished decaying after the finite prefix.

The combined bound includes a relative and absolute `1e-9` numerical allowance.
This is a Float64 linear-filter analysis with practical rounding margin, not
formal interval arithmetic or an arbitrary-parameter frequency-error proof.
Profiles whose pole rounds to unity or whose coefficients/bound are non-finite
are rejected before playback. The 0.99 output target leaves room for Float32
playback rounding. State below `1e-24` is cleared to prevent denormal tails.

The implemented profiles give the following bounds and fixed gains. These
are software results, including the analytic tail and rounding allowance,
not hardware gain measurements:

| Profile ID                      | Impulse absolute-sum bound | Presentation gain |
| ------------------------------- | -------------------------: | ----------------: |
| `pal_1chip_nominal_100n_100k`   |                   2.057898 |          0.480000 |
| `pal_1chip_reference_150n_100k` |                   2.080029 |          0.475955 |
| `pal_1chip_150n_47k`            |                   2.041060 |          0.480000 |
| `pal_1chip_100n_150k`           |                   2.080029 |          0.475955 |
| `pal_1chip_optional_lp12k`      |                   2.457643 |          0.402825 |

Full values are retained in `.cache/logs/audio-profiles-headroom.json`.
The pre/post default circuit and playback hashes match exactly, including
the existing on/off crossfade, in `.cache/logs/audio-profile-before.json`
and `.cache/logs/audio-profile-after.json`.
For isolated component checks, `inputCapacitanceF: null` explicitly omits
the input stage. A zero series capacitance is rejected rather than silently
treated as a physical bypass. `mixerLowPassHz: 0` selects the stated flat
mixer approximation.

The **Audio** overlay has an **Analog audio filter: on/off** button, default on.
Its choice is stored as `shadowrun.audio.analog.1`; only `off` disables the
default. The initial choice is passed in the worklet's processor options;
changes use a separate `analog-filter` control message, never a PCM block.
The menu heading, navigation label and burger button label are **Options**.
Like Cheats, Audio is a native modal inside the fullscreen frame. Opening it
clears game input, pauses frame consumption and suspends audio. Closing it
restores the prior P-pause state and returns focus to the burger button.
The profile selector stays available with the filter off; profile presentation
gain still applies to bypass, including the experimental profile's lower gain.
Tribute recordings bypass this circuit; original music and game effects use it.

Bypass retains the same 32-sample reference delay and profile presentation gain,
so it compares filtering without a level or time jump. `AudioPlaybackOutput`
continues the circuit state in either setting and blends between delayed
raw and filtered output over 64 samples (2 ms). Two reusable scratch buffers
and a fixed bypass delay avoid render-block allocations at a stable quantum
size. Turning the filter off bypasses its audible shaping; it does not reduce
the already small processing cost. The worklet reports the applied setting
alongside the unchanged native queue counters for browser verification.

Queue underflow supplies zeros to the still-running circuit. Refill preserves
its state; a newly started game constructs a fresh worklet and state. Raw
sample hashing in `start.mjs`, the driver, DSP and sample assets remain
unchanged. `SampleQueue.push` now ignores zero-length PCM blocks: real startup
contains frames without DSP output. Previously such a chunk produced an
undefined sample and one phantom played pair; the resulting NaN permanently
contaminated the new IIR state. Ignoring empty chunks fixes that startup
silence without dropping any actual sample. Bypass selects the dry value
directly at zero mix, rather than multiplying a potentially invalid wet
value by zero.

Breaks in the queued signal are declicked (2026-11-13, user report of clicks
with the original soundtrack, for example from the intro to the start menu): an
underflow while playing, the restart after the prebuffer and dropped pairs each
leave the output at its last value and carry the step as an offset that decays
with a time constant of about 4 ms, instead of a hard step that was heard as a
click. After an underflow while playing the prebuffer doubles, from 40 ms up to
80 ms, so a worker that falls behind during a scene change has more lead; the
original and SFX queues stay aligned because both see the same blocks. The
worklet reports the underflows and the current prebuffer; the page shows them as
`data-audio-underruns` and `data-audio-prebuffer` on the canvas next to the
played, silent and dropped counts. The declick is presentation only: the raw
sample hashes are taken before the queue. Contract tests that check exact queue
values construct it with `declick: false`;
[tools/sample-queue-declick.test.mjs](../tools/sample-queue-declick.test.mjs)
checks the glides, the prebuffer growth and an unchanged unbroken stream.

### Verification scope

[audio-output.test.mjs](../tools/audio-output.test.mjs) uses complex impedances
as an independent continuous-circuit oracle. It compares impulse transforms
with all named profiles, additional source-impedance and circuit cases at
selected frequencies from 5 Hz to 15 kHz, checks
magnitude and relative phase, known capacitor discharge, stereo isolation,
render-block boundaries, starvation/refill, fresh state, input preservation
and presentation headroom. Source-impedance checks independently verify both
the loaded divider and the change in corner. Equal-RC profiles match with
an ideal source and separate under finite source loading. The headroom cases
include slow, equal, nearly equal and negative IIR feedback poles, zero mixer
gain, fresh state and adversarial full-scale inputs. These checks establish
agreement with the chosen equations, not with unavailable real hardware.

[audio-profiles.test.mjs](../tools/audio-profiles.test.mjs) checks immutable
profile data, complete per-parameter evidence/units, hypothesis boundaries,
retention of the nominal default and rejection of unknown profile IDs.

[audio-output-browser.test.mjs](../tools/audio-output-browser.test.mjs)
loads the actual worklet in Edge's OfflineAudioContext and checks both output
channels, default-on filtering, initial bypass, the starvation tail and initial
experimental profile selection with its lower fixed gain in both settings. A real
page test checks Options labels, default state, persistence across reload,
initial disabled playback and a live control message acknowledged by the
worklet. Unit checks cover the aligned bypass, ramp and retained circuit
state, atomic rejection of invalid profile IDs and profile crossfades in both
filtered and bypass output. The offline worklet also checks profile control
messages and rejection of an invalid ID. [settings-browser.test.mjs](../tools/settings-browser.test.mjs)
checks both modal settings overlays, bilingual labels, keyboard selection,
storage and fallback, fullscreen/narrow layout, live worklet acknowledgement,
input isolation and retained P pause. The existing live browser test continues to check the unchanged raw
PCM count/hash from the real worker.
Regression cases include empty PCM blocks before/after queued samples and
around refill, both in the queue/circuit unit check and the real worklet.
A live diagnostic reproduced non-finite output before the correction. After
it, the same real startup passed its empty block and produced nonzero finite
output at the analysed browser channels (NMI 537, native peak 14576).
The before/after observations are retained in
`.cache/logs/audio-live-diagnose-before-fix.json` and
`.cache/logs/audio-live-diagnose.json`; these are browser observations, not
physical SNES measurements.

### Why switching can sound subtle in Shadowrun

After the user reported little audible difference on headphones, a native
cold-start probe compared five seconds beginning one second after the first
nonzero PCM block. The source was the existing ROM-derived asset package and
native DSP, with no sample edits. The two stereo paths were time-aligned at
the 32-sample reference delay; their identical presentation gain cancels in
the comparison.

In this particular startup excerpt, about 99.67% of the analysed dry signal's
energy was below 1 kHz: 28.04% in 50-100 Hz and 71.44% in 100-1000 Hz.
Only about 0.00024% was above 4 kHz. These are estimates from summed stereo
2048-point Hann-windowed FFT blocks, not a statement about every track or
effect. The nominal filter changed the excerpt's RMS level by about
**-0.256 dB**. The largest treble differences therefore act on very little
energy in this excerpt, making a subtle perceived difference plausible.
Phase differences also contribute to a waveform subtraction and must not be
mistaken for the same amount of audible attenuation.

The result is in `.cache/logs/audio-game-comparison.json`. It assesses the
effect of the chosen nominal model on this game's PCM; it neither calibrates
headphones nor verifies the real PAL circuit. The model is not adjusted to
exaggerate a difference in this recording. The final incremental release
passed 43/43 tests with no skips; its log is
`.cache/logs/release-pal-audio-options-final.log`.

The local numerical probe of the nominal profile found errors below 0.003 dB
and 0.04 degrees at its sampled points through 15 kHz, after removing the
constant reference delay. At 15.5 kHz those errors were about 0.021 dB and
0.42 degrees. These are sampled numerical results, not interval bounds.
The sensitivity/probe data are in `.cache/audio-output-response.json`.
A historical Node benchmark before the profile/headroom extension, including bypass history
and presentation gain, measured about 4.9 ms initial construction and
0.011 ms median / 0.016 ms p99 for a warmed 128-pair stereo block, against its
4 ms playback budget. That host-only probe is in
`.cache/logs/audio-output-benchmark.json`; it is not a browser-wide CPU bound.
