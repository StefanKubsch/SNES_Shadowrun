# PAL 1CHIP RGB output

Target: **SNSP-CPU-1CHIP-01 and SNSP-CPU-1CHIP-02 with C11 replaced by
470 nF**, through a PAL RGB cable into the Sony PVM-20M2E. Research and
implementation: 2026-11-02.
This is the video counterpart to [AUDIO-OUTPUT.md](AUDIO-OUTPUT.md).
The monitor, beam, screen and geometry contract remains
[CRT-FILTER.md](CRT-FILTER.md).

## Result and scope

The source profile names both boards, records the C11 modification and supplies
a separate output network before the monitor electronics. It retains the stock S-RGB path,
not a THS7374 bypass, an R3 level correction, a SNES Jr. or an early
three-chip board. The published circuit establishes the connections and
resistor values. Absolute DAC swing and S-RGB gain remain nominal family
assumptions; they are not manufacturer specifications of either target.
No physical console or measurement equipment is required for this project.

## C11 modification premise

User decision, 2026-11-02, after the first RGB delivery: assume the console
already has the ghosting-fix capacitor installed. We select **470 nF** from
the replacement values in the supplied
[Retro Console Mods article](https://retromods.game.blog/snes-sfc/snes-1-chip-ghosting-fix/).
That article prefers 470 nF for ghosting suppression and describes 220 nF as
a compromise with brightness-transition artifacts. Its detailed installation
example is a SNES Jr., not a calibrated measurement of either PAL board.
The board-specific
[PAL 1CHIP installation guide](https://www.retroupgrades.co.uk/guides/snes-pal-1chip-aio-guide/),
section 2.2, also identifies replacing C11 as an optional ghosting modification.
The other modifications in that guide are not implied by this decision.

For this project, residual horizontal ghosting after the 470 nF modification
is assumed negligible. This explains omitting a ghost-image kernel; it is
not a measured guarantee of zero ghosting. The capacitance is recorded as
`videoModifications.c11CapacitanceF` in the source profile. This field is
hardware metadata, not a simulated C11 circuit or a new filter coefficient.

C11 modification and brightness settling must remain distinct from the
external RGB output RC below. The supplied
[ConsoleMods overview](https://consolemods.org/wiki/SNES:Games_with_Issues_on_1CHIP_Consoles)
connects larger C11 values with slower brightness transitions. The original
[SD2SNES release notes](https://sd2snes.de/blog/archives/980) and
[implementation](https://github.com/mrehkopf/sd2snes/commit/a8cd32af3d360b1c91ea1222321734fbe240f573)
independently confirm a brightness-register transient and a mitigation by
patching register writes. They do not establish a 470 nF PAL impulse response.
Brightness-DAC settling and associated blanking transients remain omitted.
The native PPU brightness calculation is unchanged; no cartridge patch is
introduced. The selected hardware premise does not establish that Shadowrun
exhibits or avoids these transients.

The existing RGB voltage, gain, 39 ohm outputs and 47 pF AV shunts are retained.
C11 is not C44/C45/C47, and replacing it does not select an RGB bypass,
an R3 brightness correction, a different monitor bandwidth or a new gamma.
The metadata update therefore does not change rendered pixels or GPU work.

## Sources and circuit

The local [target schematic](../Ressources/SNES-PAL-1CHIP-Schematic.pdf),
arzi84 revision 0.5, 2019-08-25, PDF page 1, is explicitly labelled with
both board revisions. This is the author's reverse engineering, with some
values marked unknown, rather than a Nintendo service schematic.
[Publication](https://videogameperfection.com/forums/topic/schematic-for-1chip-pal-snes/),
[public PDF](https://www.mikrocontroller.net/attachment/602902/PAL-snes-1chip-schematic.pdf).
Its SHA-256 is
`013a0dfdcf0608faf119163bb4db1c97036cecd3118901e1a3b87e8fc2650e8a`.
The relevant areas are U1 at columns 3-4, U7 at columns 6-7, the transistor
stages at column 7 and P4 at columns 9-10.

| Channel | S-CPUN U1 | Input coupling | S-RGB U7 input / output | Buffer | Series resistor | AV P4 / shunt |
| ------- | --------- | -------------- | ----------------------- | ------ | --------------- | ------------- |
| Red     | 156       | C6             | 5 / 20                  | Q1     | R17, 39 ohms    | 1 / C44       |
| Green   | 157       | C7             | 3 / 22                  | Q2     | R16, 39 ohms    | 2 / C45       |
| Blue    | 158       | C8             | 1 / 24                  | Q3     | R15, 39 ohms    | 4 / C47       |

Q1-Q3 are C2412 emitter followers. R9-R11 are 100 ohm emitter pull-downs;
they are not series video resistors. C6-C8 and C44/C45/C47 are marked `?`.
R3 is 1.6 kohm; changing it to 1.74 kohm is a modification. The C11 ghosting
fix annotation does not establish the stock capacitance or response. The
470 nF replacement is now our explicit hardware premise above.
P4 pin 3 is +12 V on these PAL boards, not NTSC composite sync. Sync may
come from luma or composite video; neither is mixed into the RGB channels.

[Borti4938's board research](https://github.com/borti4938/SNES_RGB_Bypass/blob/master/README.md),
sections Decoupling caps at the MultiAV and Brightness and Ghosting Issues,
identifies 47 pF for C44-C47 on 1CHIP-01/02. It reports excess RGB amplitude
and a possible small, several-pixel output swing, but does not supply a
target-board impulse response. Its THS7374 bandwidth is a property of the
replacement, not the stock S-RGB. We use the 47 pF shunts without borrowing
that replacement's low-pass or treating a repair as original hardware.

[Voultar's own measurements](https://assemblergames-archive.com/archive/index.php/thread-45689-19.html),
2017-08-28, report 1CHIP ASIC swings ranging from 0.67 to 0.88 Vpp and
an S-RGB example around 6.5 dB rather than 6 dB. That publication does not
identify either PAL revision as a calibrated specimen; its old scope images
are unavailable in the stripped archive. We choose 0.8 Vpp and 6.5 dB as
a nominal family example, not an average, tolerance or exact PAL measurement.

The cable manufacturer's
[PAL SNES Cable Setup](https://www.retroupgrades.co.uk/guides/n64rgb-v3-flex-mod-kit-installation-guide/)
table specifies a **75 ohm resistor to ground on each RGB line**. This table
describes the cable; the guide's N64 amplifier is not part of our console.
The PVM has another 75 ohm termination. Its
[Sony manual](../Ressources/SONY-PVM-20M2U-20M4U-Operation-Maintenance-Manual.pdf),
Specifications, PDF/printed page 3, gives RGB input 0.7 Vpp and automatic
75 ohm termination. Assume no downstream loop-through device. A cable's
75 ohm characteristic impedance is not an additional series resistor.

No source gives the cable's length or construction. The model assumes
**2 m of 75 ohm coax with solid polyethylene** (relative permittivity 2.25).
For a coaxial line, `C' = sqrt(er) / (c * Z0) = 66.7 pF/m`, so the cable adds
133.4 pF. In that dielectric 10 MHz has a wavelength of about 20 m; a 2 m
line is electrically short, and its capacitance is lumped onto the shunt
node with the AV capacitor. This lumped capacitance ignores the line
inductance and therefore errs towards slightly more softening. Conductor and
dielectric loss over 2 m stay below about 0.1 dB at 10 MHz and are omitted.
Thin multicore cables without coax can have more capacitance per metre; the
profile fields `cableLengthM` and `cableFPerM` hold the assumption.

Nintendo [Book I](../Ressources/book1_text.pdf), chapter 27, PPU Registers,
PDF page 125, printed 2-27-11, describes the 15-bit CG-RAM format; PDF 133,
printed 2-27-18, describes 224/239 lines and interlace selection. These
establish digital format and raster mode, not analogue voltage, bandwidth,
DAC linearity or the later 1CHIP circuit. The native PPU already applies
2100 brightness and expands each resulting 5-bit code as `v<<3|v>>2`.
The filter recovers that code; it does not apply brightness twice.

## Selected model

| Parameter                                | Value                         | Basis                                                |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Pixel clock                              | 21.28137 MHz / 4              | Existing timing model, retained                      |
| DAC levels                               | code / 31, held for one pixel | Linear DAC approximation after native PPU brightness |
| DAC full-scale swing                     | 0.8 Vpp                       | Explicit family assumption                           |
| S-RGB voltage gain                       | 10^(6.5/20)                   | Family measurement transferred as an assumption      |
| Emitter-follower gain / source impedance | 1 / 0 ohms                    | Ideal small-signal buffer approximation              |
| Series resistor                          | 39 ohms per channel           | Target schematic                                     |
| AV shunt                                 | 47 pF per channel             | Borti's board research                               |
| PAL cable shunt                          | 75 ohms per channel           | Cable setup table                                    |
| Cable length / capacitance               | 2 m / 66.7 pF/m               | Assumed solid-PE 75 ohm coax                         |
| PVM termination / reference white        | 75 ohms / 0.7 Vpp             | Sony specification                                   |

With `Rs = 39`, `RL = 75 || 75 = 37.5` and `C = 47 pF + 2 * 66.7 pF =
180.4 pF`, the selected small-signal circuit has

```
G = 0.8 * 10^(6.5/20) * RL / (Rs + RL) / 0.7 = 1.18402747
tau = (Rs || RL) * C = 3.448824 ns
Hsource(f) = G / (1 + j * 2*pi*f*tau)
```

Reference-white code 31 therefore delivers about **0.829 Vpp** in this
model. Before optical spreading and grille transmission, its gun light is
`G^2.25 = 1.4624` times the former ideal source. This is a gain about black,
not a raised black level. Over-range light survives float targets; final
display encoding clips as before. Monitor controls act after the source
network. A contrast value near `1/G^2.25 = 0.684` compensates the nominal
level for comparison; that is not a calibrated Sony knob position.

The source RC corner is about 46 MHz (the AV shunt alone would give about
177 MHz). It barely changes the 10 MHz monitor response; it does not justify
adding visible softness or calling the stock console's bandwidth 46 MHz.
Unknown ASIC/encoder/buffer response, input coupling values, clamp dynamics,
cable inductance, loss and reflections, the real cable construction and DAC
nonlinearity remain outside this model. No additional source low-pass,
ringing, noise or brightness-transition glitch is introduced. Residual C11
ghosting is assumed negligible after the selected 470 nF modification.
The ideal clamp removes DC offsets; the unknown coupling capacitors are not
assigned an invented high-pass corner.

As a sensitivity example, changing only DAC swing to the published family's
0.67 or 0.88 V yields normalized gain about 0.992 or 1.302. This is not a
PAL tolerance range. No evidence here supports separate picture defaults for
01 and 02. X1 in the schematic is 17.734476 MHz, not the pixel clock; the
existing pixel clock and 52 microsecond / 288-line reference geometry remain
explicit assumptions until their internal timing relationship is established.

## Realization and verification

[sourceResponse](../src/crt/signal.mjs) derives gain and RC time in source
pixels once during renderer setup, before GPU allocation. Missing
`source.rgbOutput` retains a normalized ideal source. Electrical fields
must be finite and positive, with zero allowed only for the shunt capacitor,
cable length and cable capacitance per metre.
The Sony profile provides the receiving load and white reference separately.

The held source rectangles pass through the causal RC and then the existing
Gaussian monitor model. Their analytic step response is the convolution of
an exponential with a normal CDF. A scaled complementary error function
avoids overflow at the very short stock time constant. It uses the existing
erf polynomial below argument 2 and 12 terms of the continued fraction in
[NIST DLMF 7.9.1](https://dlmf.nist.gov/7.9#E1) above it, reduced to six
terms at argument 4 and above. Outside minus eight Gaussian sigmas and
plus eight sigmas plus 24 RC time constants, the step returns zero or one;
the omitted mathematical mass there is below 3.8e-11. This avoids expensive
evaluations far from pixel edges. This is a numerical
approximation, with sampled checks rather than a global floating-point bound.

Reference and LIGHT shader use the same cumulative response for adjacent
held intervals and the brightness window. Support covers six Gaussian
sigmas plus 20 RC time constants; omitted mathematical tail mass is below
about 4.1e-9, separately from numerical error. Derived margins include that
support, and unsupported reaches still fail explicitly. The stock profile
retains seven held intervals and existing target dimensions. The monitor's
10 MHz bandwidth and inferred physical beam spot are not recalibrated to
cancel the source response. No frame history, pass, texture or frame delay
is added; raw pixels and CRT-off output remain unchanged.

[crt-video-output.test.mjs](../tools/crt-video-output.test.mjs) checks circuit
loading, invalid fields, source/monitor separation and stable edge/tail
behaviour against independent Gaussian integration of an RC pulse.
[crt-shaders.test.mjs](../tools/crt-shaders.test.mjs) checks the real LIGHT
shader against that independent integral for the stock circuit and a wider
synthetic RC with controls. The existing browser test checks the actual
profile through the complete renderer/reference path and plain bypass.
These establish implementation agreement with the chosen model, not a
measured match to either physical PAL revision.

The isolated Edge/ANGLE D3D11 benchmark on an RTX 4070 used eight warmup
frames and 40 timed frames per case. Both runs reported hardware rendering,
valid GPU timers and no disjoint queries:

| Output      | Ideal source GPU median / p95 (ms) | Stock nominal source GPU median / p95 (ms) |
| ----------- | ---------------------------------- | ------------------------------------------ |
| 1440 x 1080 | 0.801 / 1.067                      | 1.016 / 1.068                              |
| 2880 x 2160 | 2.122 / 3.392                      | 2.675 / 5.226                              |

The comparison uses the current renderer with `rgbOutput: null` versus the
nominal network; it is not a historical whole-renderer benchmark. Host/GPU
conditions can affect sequential timings. Both allocate the same six
textures, 9,771,520 bytes. Logs are
`.cache/logs/crt-pal-video-ideal-benchmark.log` and
`.cache/logs/crt-pal-video-stock-benchmark.log`.
The earlier slower probe remains in `crt-pal-video-benchmark.log`.
No browser-wide FPS or input-latency bound is inferred from these GPU times.
