# SNES PAL 1CHIP-01/02 — Audio-Signalweg und S-MIX: Recherche, Ersatzmodell und Codex-Handoff

> **Stand:** 2026-11-08  
> **Zielplattform:** Nintendo Super Nintendo Entertainment System, PAL-Mainboards `SNSP-CPU-1CHIP-01` und `SNSP-CPU-1CHIP-02`  
> **Sprache:** Deutsch; technische Bezeichner, IDs und Konfigurationsschlüssel bevorzugt Englisch  
> **Zweck:** Vollständige Übergabe der bisherigen Rechercheergebnisse an Codex, damit daraus ein nachvollziehbares, wartbares und erweiterbares DSP-/Emulatormodul entwickelt werden kann.  
> **Wichtigste Grenze:** Es liegen **keine eigenen elektrischen Messdaten** des originalen Nintendo S-MIX vor. Weder eine vollständige interne Transistorschaltung noch eine bestätigte quantitative Frequenz-/Phasenkennlinie des originalen PAL-S-MIX wurde identifiziert. Zahlen in ausdrücklich als *Szenario/Hypothese* bezeichneten Modellprofilen sind **keine Nintendo-Originalspezifikationen**.

---

## 0. Kurzfassung für Codex — vor jeder Implementierung lesen

1. Die gesuchte Schaltung ist **PAL** `SNSP-CPU-1CHIP-01/-02`, nicht NTSC `SNS-CPU-1CHIP-01/-02` und nicht SNES Jr. `SNN-CPU-01`. Vergleichsschaltungen nur mit Quellenkennzeichnung übertragen.
2. Der Signalweg ist: `S-APU/S-DSP -> NEC µPD6379A (U6) -> AC-Kopplung C23/C26 -> Nintendo S-MIX (U10) -> R23/R26 (1 kΩ), C13/C12 (10 µF) -> Multi-Out Stereo`. Cartridge- und Expansion-Audio werden **separat analog** am S-MIX zugemischt.
3. Der originale PAL-Schaltplan-Nachbau lässt C23–C28 explizit mit `?` offen. **150 nF** sind bei der *SNES-Jr*-Rekonstruktion für C23–C28 dokumentiert; **100 nF** sind beim S-MIX-kompatiblen DAC-Mod/AMP-NUS-Umfeld dokumentiert. **Kein Originalbeleg** für die PAL-Kondensatoren.
4. Das S-MIX-Pinout und zahlreiche Außenbauteile sind belegt. **S-MIX-Eingangsimpedanzen, individuelle Gains, interne Tiefpasspole, Nichtlinearität und PRESET/MUTE-Dynamik sind unbekannt.**
5. Die 10-kΩ-Widerstände R48/R51 auf der DAC-Seite und die 200-Ω-Widerstände an Cartridge/Expansion sind **Shunts vor den Kondensatoren**, **nicht** die gesuchten S-MIX-Eingangswiderstände.
6. `C22 = 330 pF` gehört zum **RF-Mono-Zweig**, **nicht** zu den normalen L/R-Stereoausgängen. Den Filter nicht als allgemeine SNES-Tiefpasskurve übernehmen.
7. **Empfohlenes neutrales Vergleichsprofil (nicht „Nintendo-exakt“):** C_in=150 nF, hypothetisches R_in=100 kΩ, keine zusätzliche interne LP-Stufe, Ausgang=1 kΩ+10 µF bei expliziter Last. Ein zweites Profil 100 nF/150 kΩ hat fast die gleiche ideale Hochpassgrenzfrequenz. Gains als Platzhalter 1.0, nicht als originale elektrische Verstärkung.
8. Implementierung: jede der drei Quellgruppen (APU, Cartridge, Expansion) pro Kanal separat AC-koppeln; dann mischen; optionales, **ausgeschaltetes** LP-Hypothesenmodul; zuletzt bekannte Stereo-Ausgangskopplung. Sample-rate-korrekt und mit Testvektoren; niemals doppeltes DAC-/Resampler-Filtering.
9. **Keine harten Aussagen** wie „S-MIX ist 2,2×“ oder „S-MIX-Tiefpass bei 12 kHz“: −2,2 beschreibt einen Abschnitt einer *Ersatzschaltung*, 12 kHz ist ein experimentelles Vergleichsmodell aus älteren Schaltungen, nicht gemessen am Original.
10. Vor Repo-Änderungen bestehende Audio-/DSP-Pipeline, Architektur, parallele Arbeit, Tests und Dokumente prüfen. Das Handoff ist **Recherche**, keine Erlaubnis, ungefragt ein fremdes Repository zu verändern.

## 1. Beweiskategorien und Arbeitsgrundsätze

| Kennung | Kategorie | Bedeutung für die Implementierung |
|---|---|---|
| `DATASHEET` | Herstellerunterlage | Stärkste Belegbasis für die aufgeführten DAC-Spezifikationen; Bedingungen beachten |
| `PAL_RECONSTRUCTION` | PAL-KiCad-Rekonstruktion / dokumentierte Außenbeschaltung | Hohe Aussagekraft zu Netzen, Referenzbezeichnern und dokumentierten Werten; keine offizielle Nintendo-Stückliste |
| `OTHER_BOARD_RECONSTRUCTION` | SNES Jr. / N64 | Konkrete Vergleichsdaten, **keine bestätigten PAL-Originalwerte** |
| `REPLACEMENT_DESIGN` | Funktionierender IC-Ersatz / DAC-Mod | Belegt *Funktionalität eines Alternativdesigns*, nicht die interne IC-Struktur |
| `MEASURED_OTHER_HARDWARE` | Veröffentlichte Messung eines anderen Aspekts/Geräts | Gilt für gemessene Bedingungen, z. B. Sample-Clock, nicht automatisch für S-MIX-Filter |
| `DERIVED` | Analytische Berechnung aus R/C | Mathematisch korrekt **unter Modellannahmen**; kein Messwert |
| `HYPOTHESIS` | Unbekannter Wert / gewähltes Testprofil | Muss in Config und Doku explizit markiert und austauschbar sein |
| `UNKNOWN` | Nicht identifiziert | Nicht durch plausibel klingende Festwerte „auffüllen“ |

**Grundsatz:** Frequenzgang einer vollständigen Konsole, Frequenzgang des DAC und Frequenzgang des S-MIX sind **drei verschiedene Messgrößen**. Die S-DSP-Gaußinterpolation und das programmierbare Echo-FIR sind **digital** und dürfen nicht automatisch als analoger S-MIX-Filter behandelt werden.

## 2. Hardwareüberblick und Signalfluss

### 2.1 Relevante ICs und Ein-/Ausgänge

| Bezeichner (PAL) | Baustein/Funktion | Gesichertheit |
|---|---|---|
| `U2` | `S-APU`: SPC700/S-DSP-basierte Sounderzeugung | PAL-Rekonstruktion |
| `U6` | NEC `µPD6379A`: 16-Bit-Stereo-DAC | PAL-Rekonstruktion + Herstellerdatenblatt |
| `U10` | Nintendo `S-MIX`: aktiver L/R-Mischer/Audioausgang | PAL-Rekonstruktion + SNESdev-Pinout |
| `U9` | `7805`: 5-V-Regelung | Boarddokumentation; nicht „Audiofilter“ |
| Cartridge | Zusätzliche analoge L/R-Audioeingänge | S-MIX-Pinout / Cartridge-Doku |
| Expansion | Zusätzliche analoge L/R-Audioeingänge | S-MIX-Pinout / Board-Rekonstruktion |
| Multi-Out | Stereo-L/R-Ausgang; andere Signale sind getrennte Netze | Board-Rekonstruktion |

### 2.2 Text-Netzplan — Kanäle / Stereo

```text
S-APU/S-DSP --serial PCM--> U6 µPD6379A (16 Bit, 5 V)
                                      | R.OUT pin 1                  | L.OUT pin 4
                          R48 10k shunt to GND            R51 10k shunt to GND
                                      |                              |
                                   C23 ?                          C26 ?
                                      |                              |
                               U10 pin 3 (APU_R)           U10 pin 12 (APU_L)

Expansion R --200Ω shunt-- C24 ? ---> U10 pin 4
Expansion L --200Ω shunt-- C27 ? ---> U10 pin 11
Cartridge R --200Ω shunt-- C25 ? ---> U10 pin 5
Cartridge L --200Ω shunt-- C28 ? ---> U10 pin 10

U10: VCC pin 1; PRE_R pin 2 + C16 33µF; GND pin 6+9; MUTE pin 13;
     PRE_L pin 14 + C17 33µF; interne Struktur UNBEKANNT

U10 pin 7 (R_OUT) -- R23 1kΩ -- C13 10µF --> Multi-Out R
U10 pin 8 (L_OUT) -- R26 1kΩ -- C12 10µF --> Multi-Out L

Separat: S-MIX L/R -> R24/R27 je 47kΩ -> RF Mono -> C22 330pF an GND
Separat: S-MIX L/R -> R22/R25 je 10kΩ -> Expansion Mono
```

**Wichtige Zuordnung:** `C23=APU_R`, `C26=APU_L`, `C24=EXP_R`, `C27=EXP_L`, `C25=CART_R`, `C28=CART_L`. Die Werte bei C23–C28 sind auf dem PAL-Rekonstruktionsschaltplan **unbekannt**.

### 2.3 Das vollständige S-MIX-Pinout (SO-14, Draufsicht)

```text
             .------U------.
 VCC       1 |             | 14 PRESET_L
 PRESET_R  2 |             | 13 MUTE
 APU_R     3 |             | 12 APU_L
 EXP_R     4 |             | 11 EXP_L
 CART_R    5 |             | 10 CART_L
 GND       6 |             |  9 GND
 R_OUT     7 |_____________|  8 L_OUT
```

SNESdev-Pinbelegung [S03]. Versorgung des PAL-S-MIX laut Rekonstruktion nominell 12 V. Beim SNN-CPU-01 (SNES Jr.) ist eine 9-V-Schaltung dokumentiert; deshalb keine direkte Übertragung von Verstärkungs-/Clippingverhalten.

### 2.4 µPD6379A-Pinout (nicht mit µPD6379 ohne „A“ verwechseln)

| Pin | Name | Verwendung |
|---:|---|---|
| 1 | R.OUT | DAC rechts, zur R48/C23-Kopplung |
| 2 | REF | Referenzabblockung, C15=47 µF gegen Masse |
| 3 | GND | Masse |
| 4 | L.OUT | DAC links, zur R51/C26-Kopplung |
| 5 | LRCK | L/R-Kennung, beim A-Typ ist HIGH = linker Datenkanal |
| 6 | SI | 16-Bit-Seriendaten, MSB zuerst |
| 7 | CLK | Daten-Bitclock |
| 8 | VDD | typ. 5 V |

Herstellerdatenblatt [S01]; `µPD6379` ohne „A“ hat eine andere Pinanordnung und LRCK-Logik.

## 3. PAL-1CHIP: Bauteilwerte des relevanten Analogpfads

**Status:** Werte/Topologie aus der gemeinschaftlich rekonstruierten `SNSP-CPU-1CHIP.kicad_sch` [S02], mit bekannten Elko-Listen [S04] gegengeprüft. Die Existenz eines Bauteils heißt nicht automatisch, dass seine innere Wirkung im IC bekannt ist.

| Referenz | Nennwert | Funktion / Lage | Beweisstufe |
|---|---|---|---|
| `U6` | µPD6379A | DAC | DATASHEET + PAL_RECONSTRUCTION |
| `U10` | Nintendo S-MIX | Analoge Mischung L/R | PAL_RECONSTRUCTION |
| `R48`, `R51` | je **10 kΩ** | Pull-down/Shunt jeweils **vor** C23/C26 an DAC-Ausgängen | PAL_RECONSTRUCTION |
| `C23`, `C26` | **?** | DAC→S-MIX AC-Kopplung R/L | UNKNOWN für PAL |
| `R49`, `R52` | je **200 Ω** | Shunts einer externen Audioeingangsgruppe vor Kopplung | PAL_RECONSTRUCTION |
| `R50`, `R53` | je **200 Ω** | Shunts der anderen externen Audioeingangsgruppe vor Kopplung | PAL_RECONSTRUCTION |
| `C24`, `C27` | **?** | Expansion-Audio R/L, Serienkopplung | UNKNOWN für PAL |
| `C25`, `C28` | **?** | Cartridge-Audio R/L, Serienkopplung | UNKNOWN für PAL |
| `C16`, `C17` | je **33 µF/25 V** | S-MIX PRESET_R/PRESET_L nach Masse | PAL_RECONSTRUCTION / Recap-Liste |
| `R21` | **470 kΩ** | MUTE-Steuernetz | PAL_RECONSTRUCTION |
| `C21` | **?** | MUTE-Steuernetz | UNKNOWN für PAL |
| `R23`, `R26` | je **1 kΩ** | Serienwiderstand Stereo-Ausgänge R/L | PAL_RECONSTRUCTION |
| `C13`, `C12` | je **10 µF/16 V** | AC-Kopplung S-MIX-Ausgang→Multi-Out R/L | PAL_RECONSTRUCTION / Recap-Liste |
| `R24`, `R27` | je **47 kΩ** | Summierungswiderstände RF-Mono | PAL_RECONSTRUCTION |
| `C22` | **330 pF** | Kondensator im **RF-Mono**, **nicht Stereo** | PAL_RECONSTRUCTION |
| `R22`, `R25` | je **10 kΩ** | Summierung für Expansion-Mono | PAL_RECONSTRUCTION |
| `C15` | **47 µF/16 V** | DAC REF-Glättung, **nicht Serien-Audiofilter** | PAL_RECONSTRUCTION / Recap-Liste |
| `C62` | **100 nF** | S-MIX-Versorgungsentkopplung, nicht Nutzsignal-Tiefpass | PAL_RECONSTRUCTION |
| `C58` | **?** | DAC-nahe Entkopplung, kein identifizierter Signalwegfilter | UNKNOWN für PAL |

Anmerkungen: `C14`, `C18/C19`, `C59`, `C71/C72` und weitere Kondensatoren der PAL-Platine sind Teil von Stromversorgung/Video/anderen Zweigen. Nicht unbesehen als Audio-RC-Glieder interpretieren. [S04] führt für beide PAL-1CHIP-Revisionen die großen Elektrolytkondensatoren, aber **nicht** die fehlenden kleineren SMD-Koppelkondensatoren C23–C28.

### 3.1 C22 im RF-Monozweig

Unter idealisierten Annahmen (niederohmige L/R-Quellen, hochohmiger RF-Eingang) ergibt `47 kΩ || 47 kΩ = 23,5 kΩ`, mit `330 pF` theoretisch `f_c ≈ 20,5 kHz`. Die echte RF-Eingangslast kann das ändern. **Nicht** auf Multi-Out L/R anwenden.

### 3.2 Stereo-Ausgangskopplung

Bei approximiert niederohmigem S-MIX-Ausgang, einer 1-kΩ-Serienimpedanz, 10-µF-Serien-C und einer rein ohmschen angeschlossenen Last `R_L` gilt:

`f_c = 1 / [2π (1000 Ω + R_L) * 10 µF]`

| Last `R_L` | Hochpass `f_c` | Linearer Hochfrequenz-Durchlassfaktor `R_L/(1000+R_L)` |
|---:|---:|---:|
| 47 kΩ | ~0,332 Hz | ~0,979 (−0,18 dB) |
| 10 kΩ | ~1,447 Hz | ~0,909 (−0,83 dB) |
| 1 kΩ | ~7,958 Hz | 0,5 (−6,02 dB) |

**Wichtig:** Ein reines HP-Modul mit Hochfrequenzverstärkung = 1 bildet den Pegelverlust des Serienwiderstands nicht ab. Für schaltungstreue Amplituden sowohl HP als auch Spannungsteiler berücksichtigen. Reale S-MIX-Ausgangsimpedanz/Lastabhängigkeit ist weiterhin unbekannt.

## 4. Herstellerdaten des DAC und Digitalanteil

Der NEC `µPD6379A` ist laut Datenblatt [S01] ein zweikanaliger 16-Bit-Wandler mit Widerstandskettenarchitektur, interner Ausgangsstufe und 4× Oversampling. Zweierkomplement, MSB zuerst, rechtsbündiger Datenstrom. Typische DAC-Ausgangsspannungen bei 5 V: `0 -> ~2 V`, `+32767 -> ~3 V`, `−32768 -> ~1 V` (ca. 2 Vpp). Ein DC-Offset am DAC-Ausgang ist normal; die danach liegenden Serienkondensatoren entfernen ihn.

Im NEC-Datenblatt genannte **typische** Werte (Hersteller-Testbedingungen, u. a. 25 °C, 5 V, DAC-Wandlungsfrequenz 176,4 kHz — **keine PAL-SNES-Gesamtmessung**): 16 Bit, THD ~0,04 % bei 1 kHz/0 dB, SNR ~100 dB A-bewertet, Dynamik ~96 dB, Übersprechen ~96 dB, 2 Vpp Vollausgang; empfohlene DAC-Last mindestens 5 kΩ. Vierfaches Oversampling beweist **keine** bestimmte analoge Tiefpassgrenzfrequenz auf der Konsole.

**Vor dem DAC**: Die 8-Stimmen-Verarbeitung, BRR-Dekodierung, Gaußinterpolation, Hüllkurven, Stimmenmischung sowie Echo/FIR liegen im **S-DSP**. Ein Echo-FIR ist spielabhängig und kein festes S-MIX-Analogfilter. Der DAC-Bitstream kann bereits aus der existierenden Emulatorpipeline stammen; in dem Fall keine zweite DSP-Echofilterung hinzufügen.

**Audio-Clock:** Nominal ca. 32 kHz; reale Geräte können abweichen und thermisch driften. Veröffentlicht für ein PAL-1CHIP-Gerät [S09]: etwa `32.083 Hz` kalt, `32.091 Hz` nach 25 Min.; längere Messserie `32.086,88 ... 32.095,38 Hz`. `32.090 Hz` ist nur ein Beispiel für eine reale Sample-Clock, **keine universelle PAL-Konstante**. Timing nicht mit PAL-Bildtakt gleichsetzen.

**Identifizierbarkeitsgrenze:** Ohne separaten DAC-Ausgangs- und S-MIX-Eingangs-Mitschnitt lassen sich aus einer vollständigen Konsole die DAC- und S-MIX-Filteranteile nicht eindeutig isolieren. Digitale Ausgabe des DSP und Cartridge-Audio können unterschiedliche Quelltaktraten/Bandbreiten haben.

## 5. Quervergleiche für die bislang unbekannten Kondensatoren

### 5.1 SNES Jr. `SNN-CPU-01` [S05]

Die aus `AV.kicad_sch` direkt ausgewertete Rekonstruktion von qwertymodo führt **C23,C24,C25,C26,C27,C28 = jeweils 150 nF**. Außerdem `C21 = 150 nF` und MUTE-Widerstand `R2 = 470 kΩ` (Jr-Design). Für eine einfache R-C-Zeitkonstante wäre `470 kΩ * 150 nF = 70,5 ms`; die **tatsächliche MUTE-Zeit** hängt auch vom IC und der Schaltungstopologie ab. Die Jr-Rekonstruktion zeigt eine andere analoge Versorgung (9 V) als die PAL-Rekonstruktion (nominell 12 V).

**Achtung:** Jr ist eine andere Region/Boardgeneration. Weder die komplette Bestückung noch Verstärkungs-, Clipping- oder Versorgungseffekte dürfen ohne weitere Nachweise auf `SNSP-CPU-1CHIP-01/02` übertragen werden. 150 nF ist eine **plausible Vergleichshypothese**, kein bestätigter PAL-Wert.

### 5.2 Nintendo 64, AMP-NUS [S06]

Dokumentierte AMP-NUS-Vergleichsschaltungen zeigen u. a. **100-nF**-Eingangskopplung, 10-kΩ-DAC-Last, 200-Ω-Lasten an Zusatz-Audio, 33-µF-PRESET-Kondensatoren und 10-µF-/1-kΩ-Ausgangsnetzwerke. ManCloud berichtet, er habe S-MIX und AMP-NUS zwischen Konsolen getauscht und funktionsfähig betrieben [S07]. Das ist **starke Evidenz für funktionale Kompatibilität**, aber **kein Beweis identischen Siliziums, identischer interner Pole oder der PAL-Bestückung**.

### 5.3 Super Wave Blaster / S-MIX-Konfiguration [S08]

Das RetroLoom-DAC-Umbauprojekt dokumentiert für den Betrieb mit vorhandenem S-MIX `0,1 µF (100 nF)` an den eigenen Eingangskopplungskondensatoren sowie `470 pF` an **Bauteilen dieses DAC-Umbauprojekts**. Zusätzlich ein Spannungsteiler zum Vermeiden von Übersteuerung: Der S-MIX hat laut Projekt ein eigenes Gain-Netzwerk. **Keine der dortigen Kondensatorreferenzen ist automatisch mit PAL `C15/C16` identisch.** README-/CAD-Varianten weichen teilweise bei Bestückungsdetails voneinander ab; beim Nachbau konkrete Variante prüfen. Ein DAC-Umbau kann Pegelverhältnisse verändern und beweist keine Original-Hardware-Grenzfrequenz.

### 5.4 S-MIX-Replacement (ManCloud/borti4938) [S07]

Funktionsersatz mit `LM358D`, vier `BC846`-Transistoren, R1/R2=33 kΩ, R3–R8=10 kΩ, R9/R10=1 kΩ, R11/R12=22 kΩ, R13/R14=1,8 kΩ, R15/R16=1 kΩ, C1=10 µF. Die 10-kΩ-Eingangswiderstände mit 22-kΩ-Feedback erlauben im **idealen Abschnitt der invertierenden Ersatz-Summierstufe** rechnerisch eine Verstärkung `−2,2` pro einzelner AC-Quelle relativ zum Referenzpunkt. **Nicht** als Nintendo-Original-S-MIX-Gain übernehmen; die restliche Ersatzschaltung/Belastung verändert den Endpegel zusätzlich. Die erfolgreiche Funktion des Nachbaus beweist nicht dessen Frequenzganggleichheit oder das Transistorlayout des Nintendo-Siliziums.

### 5.5 Ältere SNES-LM324-Stufe

Bei älteren Boards sind 1-µF-Eingangskoppelkondensatoren sowie externe analoge Filterstufen dokumentiert. In Community-Simulationen wird teils eine Größenordnung `~12 kHz` für eine **ältere diskrete Filterstufe** diskutiert. **Weder 1 µF noch 12 kHz als festen PAL-1CHIP-S-MIX-Originalwert behaupten.** 12 kHz nur als *experimentelles* Tiefpassvergleichsprofil anbieten.

### 5.6 Vergleichsfazit

| Bauteil-/Modellaspekt | PAL-Original 1CHIP | Alternative Belege | Behandlung |
|---|---|---|---|
| C23–C28 | **unbekannt** | Jr 150 nF; S-MIX-Mod/N64 100 nF; ältere SNES 1 µF | 150 nF Default-Hypothese, 100 nF und 1 µF Szenarien |
| C21 MUTE | **unbekannt** | Jr 150 nF | 150 nF nur Vergleichs-/Transientenversuch |
| Eingangsimpedanz S-MIX | **unbekannt** | Kein Original-Datenblatt | `Rin` pro Quelle frei, z. B. 47/100/150 kΩ als Szenarien |
| Verstärkung APu/Cart/Exp | **unbekannt** | Ersatzschaltung −2,2 eines Teilnetzwerks | Parametrisierbare Gains; 1.0 nur *normierter* Platzhalter |
| Interner LPF | **unbekannt** | Filter in älteren *anderen* Boards | Standard **aus**; optional 12-kHz-Testprofil klar markiert |
| PRESET/MUTE Dynamik | **unbekannt** | 33 µF bzw. MUTE-extern | zunächst dokumentieren/vereinfachen; kein erfundener Originalverlauf |

## 6. Ersatzschaltung: mathematische Modelle

### 6.1 Idealer Kopplungshochpass mit Quellimpedanz

Ein Thevenin-Quellmodell mit `R_S` in Reihe, Koppelkondensator `C` in Reihe und Eingangswiderstand `R_L` nach Masse liefert:

\[
H_{HP}(s) = \frac{R_L}{R_S+R_L} \cdot \frac{s\tau}{1+s\tau},\qquad \tau=(R_S+R_L)C,\qquad f_c=\frac{1}{2\pi\tau}.
\]

Der Durchlasspegel ist `R_L/(R_S+R_L)`. **Wenn die Quellspannung vor einem zusätzlichen Shunt gemessen wird**, muss dieser Shunt im Thevenin-Modell berücksichtigt werden. DAC-R48/R51=10 kΩ liegt **vor** C23/C26; bei niederohmigem DAC-Ausgang ist die vereinfachte Quellimpedanz näherungsweise `R_DAC || 10 kΩ`, **nicht `R_S = 10 kΩ` in Serie**. Für externe Quellen gilt Entsprechendes mit 200-Ω-Shunts. Es ist also nicht zulässig, nur `R=10 kΩ` bzw. `200 Ω` und `C` als Kopplungs-Hochpass anzunehmen.

Falls die Eingangsimpedanz komplex/frequenzabhängig ist, gilt der einfache Ein-Pol-Ansatz nur näherungsweise. Impedanz, Gain und Kopplung können sich wechselseitig beeinflussen.

### 6.2 Plausible Szenarien (nur berechnet)

| C | angenommene `R_in` (Quellimpedanz≈0) | f_c | H(20 Hz) relativ zum Hochfrequenzdurchlass |
|---:|---:|---:|---:|
| 150 nF | 47 kΩ | ~22,58 Hz | ~−3,58 dB |
| 150 nF | 100 kΩ | ~10,61 Hz | ~−1,08 dB |
| 150 nF | 150 kΩ | ~7,07 Hz | ~−0,51 dB |
| 100 nF | 100 kΩ | ~15,92 Hz | ~−2,13 dB |
| 100 nF | 150 kΩ | ~10,61 Hz | ~−1,08 dB |
| 1 µF | 10 kΩ | ~15,92 Hz | ~−2,13 dB |

Ein einzelner Hochpass kann **nur das Produkt `R*C`** identifizieren, nicht R und C eindeutig. Die Hypothese „für weniger als ~1 dB bei 20 Hz wären bei C=150 nF ca. ≥104 kΩ nötig“ ist eine mathematische Bedingung **falls** geringer Bassverlust angenommen wird, **kein empirischer Beweis** für einen hochohmigen S-MIX.

### 6.3 S-MIX als parametrische lineare Mischmatrix

Für `x = [APU_L, APU_R, CART_L, CART_R, EXP_L, EXP_R]^T`:

\[
\begin{bmatrix} y_L \\ y_R \end{bmatrix} = \mathbf H_{\mathrm{SMIX}}(s)\, \begin{bmatrix}x_{AL}\\x_{AR}\\x_{CL}\\x_{CR}\\x_{EL}\\x_{ER}\end{bmatrix}
\]

Erste Vereinfachung (ohne belegtes Übersprechen): je L/R drei hochpassgefilterte Eingänge, additive Gains `g_apu`, `g_cart`, `g_exp`, optionaler interner LTI-Filter `H_int(s)` (**Default ausgeschaltet**), anschließend Stereo-Ausgangskopplung. Keine tatsächlichen Gains bekannt; `1.0` bedeutet nur softwareseitige Normierung.

Nichtlineare Ergänzungen (Clipping, DC-Bias, Versorgungsabhängigkeit, MUTE-Transients, Rauschen) sind erst bei besseren Quellen sinnvoll; keine Scheingenauigkeit.

### 6.4 Ausgang bei definierter Last

Beim näherungsweise ideal niederohmigen S-MIX-Ausgang:

\[
H_{out}(s)=\frac{R_{load}}{R_{series}+R_{load}}\cdot
\frac{s(R_{series}+R_{load})C_{out}}{1+s(R_{series}+R_{load})C_{out}}.
\]

Für `Rseries=1 kΩ`, `Cout=10 µF`, `Rload=10 kΩ`: `f_c≈1,447 Hz` und Passbandfaktor `10/11 = 0,90909`; bei 47 kΩ `f_c≈0,332 Hz`, Faktor `47/48 = 0,97917`. Last **explizit** als Parameter führen. Bei hochimpedanter Last erzeugt dieser Ausgangskondensator keinen wesentlichen hörbaren Bassabfall.

### 6.5 Digitaler 1-Pol-Hochpass per bilinearer Transformation (prewarped)

Für digitales Ziel-`f_c`, PCM-Rate `f_s` und `0 < f_c < f_s/2`:

```text
K  = tan(pi * fc / fs)
b0 = 1 / (1 + K)
b1 = -b0
a1 = (K - 1) / (K + 1)

// Direct Form I (a0 = 1):
y[n] = gain * (b0*x[n] + b1*x[n-1] - a1*y_unscaled[n-1])
```

**Implementierungshinweis:** Für `gain != 1` den HP normiert filtern und den Gain **danach** auf das Ergebnis anwenden. In der obigen Pseudogleichung ist `y_unscaled` der Zustand des normierten Filters, nicht der bereits skalierten Ausgabe. Einfacher: `state_out = b0*x + b1*x_prev - a1*state_out_prev; out = passband_gain * state_out`.

Bilineare Transformation mit Prewarping erhält den gewünschten digitalen −3-dB-Punkt. Die früher als erste Näherung erwähnte Rückwärts-Euler-Formel `alpha=RC/(RC+T)` ist zwar ein stabiler RC-Diskretisierungsansatz, liefert **nicht dieselben Koeffizienten** und ist nahe Nyquist insbesondere für einen 12-kHz-LP bei etwa 32 kHz DSP-Rate ungeeignet, wenn eine präzise Grenzfrequenz gefordert wird.

Analog für einen 1-Pol-LP: `K=tan(pi*fc/fs)`, `b0=b1=K/(1+K)`, `a1=(K-1)/(K+1)`, `y[n]=b0*x[n]+b1*x[n-1]-a1*y[n-1]`. **LPF ausschließlich im experimentellen Profil**, keinesfalls als bewiesene S-MIX-Stufe.

#### Berechnete Filterkoeffizienten (quellseitiger HP mit 150 nF / 100 kΩ)

`fc = 10.61032954 Hz`, normiert auf Hochfrequenz-Gain 1; Direct-Form-Konvention `a0=1`, `y[n] = b0*x[n]+b1*x[n-1]-a1*y[n-1]`.

| f_s [Hz] | b0 | b1 | a1 |
|---:|---:|---:|---:|
| 32.090 | +0.998962332 | −0.998962332 | −0.997924665 |
| 44.100 | +0.999244713 | −0.999244713 | −0.998489426 |
| 48.000 | +0.999306037 | −0.999306037 | −0.998612075 |

Zum Vergleich: Ausgangs-HP bei 10 µF, 1 kΩ Serienwiderstand und 10-kΩ-Last (`fc≈1.446863 Hz`), **normierte** HP-Koeffizienten ohne den zusätzlichen Durchlassfaktor `10/11`:

| f_s [Hz] | b0 | b1 | a1 |
|---:|---:|---:|---:|
| 32.090 | +0.999858373 | −0.999858373 | −0.999716746 |
| 44.100 | +0.999896939 | −0.999896939 | −0.999793878 |
| 48.000 | +0.999905312 | −0.999905312 | −0.999810624 |

**Achtung:** Frequenzwerte hier werden in deutscher Notation geschrieben (`32.090` = zweiunddreißigtausendneunzig Hertz, **nicht** `32.09 Hz`). Programmgesteuert `32090` als Integer übergeben. Profil C_in=100 nF/R_in=150 kΩ hat denselben `R*C=0,015 s` und daher **dieselben idealisierten Filterkoeffizienten**; das sagt nichts über ihre identische Interaktion mit realen Quellen aus.

### 6.6 Resampling/DAC-Trennung

- Die Audioquelle stammt aus dem S-DSP mit real geräteabhängig ~32 kHz. Resampler müssen die korrekte zeitliche Sampleposition berücksichtigen; 32090 Hz ist ein Beispielwert.
- Externes Cartridge-Audio kann eine andere analoge Bandbreite und effektive digitale Quellrate haben. **Nicht** durch den SNES-DSP-Resampler zwangsbeschneiden.
- Für eine rein bandbegrenzte Audio-Pipeline genügt qualitativ gutes Resampling und externe RC-Simulation; die **echte DAC-Rekonstruktion** ist damit aber *nicht* automatisch nachgebildet.
- Wenn die DAC-Rekonstruktion separat modelliert wird, digitale Resampler-Filter und DAC-Rekonstruktionsfilter **nicht blind seriell doppelt** anwenden.
- Optionale nichtlineare Erweiterungen/Audio-Experimente besser bei internen >=96 kHz, spätestens vor dem 44,1-/48-kHz-Endausgang korrekt bandbegrenzen.

## 7. Codex-taugliches Modell- und Konfigurationsdesign

### 7.1 Konfigurationsschema (Beispiel, Hypothesen explizit)

```json
{
  "model_version": 1,
  "board": "SNSP-CPU-1CHIP",
  "revision": "01-or-02-not-individually-confirmed",
  "evidence_level": "hypothetical_proxy",
  "profile_id": "pal_1chip_reference_150n_100k",
  "sample_rate_hz": 32090,
  "input": {
    "apu": { "cap_f": 1.5e-7, "source_ohms": 0.0, "smix_input_ohms": 100000.0, "gain": 1.0 },
    "cart": { "cap_f": 1.5e-7, "source_ohms": 0.0, "smix_input_ohms": 100000.0, "gain": 1.0 },
    "expansion": { "cap_f": 1.5e-7, "source_ohms": 0.0, "smix_input_ohms": 100000.0, "gain": 1.0 }
  },
  "internal_smix": {
    "filter_model": "none_unverified",
    "gain_normalization": 1.0,
    "crosstalk": 0.0,
    "nonlinearity_model": "disabled_unverified"
  },
  "output": {
    "series_ohms": 1000.0,
    "coupling_cap_f": 1.0e-5,
    "load_ohms": 10000.0,
    "include_passband_attenuation": true
  },
  "mute": { "mode": "software_gate_not_hardware_verified", "enabled": false },
  "confidence_note": "150nF from SNN-CPU-01, 100k assumed; original PAL values and internal S-MIX transfer unverified"
}
```

`source_ohms=0` ist ein vereinfachter Quellansatz für die AC-Kopplung **nach** den physikalischen Shunts; spätere echte DAC-/Cart-Quellimpedanzen können eingesetzt werden. Exakte Amplituden in Volt erfordern darüber hinaus eine Kalibrierung des DAC-Pegels und des S-MIX-Gains. `gain=1.0` darf **nicht** als gemessener originaler Spannungsverstärkungsfaktor interpretiert werden.

### 7.2 Explizite Vergleichsprofile

| Profil-ID | C_in | angen. R_in | Zusatz-LP | Zweck |
|---|---:|---:|---|---|
| `pal_1chip_reference_150n_100k` | 150 nF | 100 kΩ | aus | neutrale, quellennahe Vergleichsbasis |
| `pal_1chip_150n_47k` | 150 nF | 47 kΩ | aus | prüft stärkere Bassabsenkung |
| `pal_1chip_100n_150k` | 100 nF | 150 kΩ | aus | alternative Hardwaredeutung mit gleichem `R*C` |
| `pal_1chip_100n_100k` | 100 nF | 100 kΩ | aus | alternative stärkere Bassabsenkung |
| `pal_1chip_legacy_1u` | 1 µF | variabel, z. B. 10 kΩ | aus | ältere-Schaltungs-Kontrollvariante |
| `pal_1chip_optional_lp12k` | 150 nF | 100 kΩ | 12 kHz 1 Pol | **rein hypothetischer** HF-Vergleich, nicht Original |

Empfehlung: Für normale Programme nur erstes Profil als „default proxy“ verwenden; Alternativen nur in einem dedizierten Experimentier-/Diagnosebereich. **Keinen Parameter `is_accurate_original=true` setzen**.

### 7.3 Minimaler Processing-Plan

```text
Inputs: apuL/R, cartL/R, expL/R; shared internal output sample rate
  apuL/R     -> separate HP(C_apu, R_apu)
  cartL/R    -> separate HP(C_cart, R_cart)
  expL/R     -> separate HP(C_exp, R_exp)
  each channel: mix = gain_apu*apu_hp + gain_cart*cart_hp + gain_exp*exp_hp
  optionally:  smix_lp(mix)         // OFF by default, purely experimental
  optionally:  smix_nonlinear(mix)  // OFF by default, no parameters measured
  output:     hp(C_out=10µF, R_series=1kΩ, R_load=user-selected)
              * passband_gain(R_load/(1k+R_load))
  apply explicit software mute policy, not portrayed as original MUTE envelope
  output stereo float; clipping/normalization only by declared engine policy
```

Eigene Filterzustände pro Eingang und Stereo-Kanal. Neu initialisieren bei Profil- oder Sample-Rate-Wechsel bzw. nach Bedarf konsistent interpolieren, um künstliche Klicks zu vermeiden. In Echtzeit **keine** dynamischen Allokationen in Sample-/Audio-Callback. Interne Gain-Ziele und eventuell −1-Pol-Inversion für Ersatzschaltungen nicht mit unbekannter originaler Polarität verwechseln.

### 7.4 Unbedingte Tests für Codex

1. **DC:** konstanter Eingang fällt im HP gegen 0; kein nichtendlicher Zustand.
2. **HP-Eckpunkt:** bei `f_c` ~−3,0103 dB relativ zum Durchlass (ausreichende FFT-/Phasenpräzision).
3. **Durchlasspegel:** Ausgang 10-kΩ-Last bei f≫f_c = `10/11` statt 1.0.
4. **Bassszenarien:** `150 nF/100k` und `100 nF/150k` liefern im idealen Modell numerisch gleiche H(f), obwohl elektrische Realisierungen anders sein können.
5. **Stereo-Isolation:** L-Einspeisung darf bei `crosstalk=0` keine R-Ausgabe erzeugen.
6. **Quellen-Isolation:** APU, Cart, Expansion werden getrennt und additiv verarbeitet; keine pauschale DSP-Abtastratenbegrenzung externer Quellen.
7. **RF-Abgrenzung:** C22=330 pF darf keinen Stereo-Ausgangspol erzeugen.
8. **Sample-Rate:** f_c bleibt bei 32090, 44100, 48000, 96000 Hz nahezu gleich (bilineares Prewarping).
9. **Grenzwerte:** invalides `R,C,fs` abweisen; LP-Cutoff muss kleiner als Nyquist sein.
10. **Rückwärtskompatibilität:** wenn Filter deaktiviert, bestehende Referenzausgabe/Audioengine unverändert; kein impliziter Pegelsprung beim Laden anderer Profile.
11. **Metadaten:** Quellen und Konfidenz jeder Defaultannahme aus Profil rekonstruierbar, Unterschiede 01/02 nicht vortäuschen.
12. **Keine Fake-Messdaten:** FFT-Fits an synthetischen Testvektoren nicht als Nintendo-Hardwareergebnis deklarieren.

## 8. Was wir über den S-MIX nicht wissen — Forschungsgrenze

| Fehlender Parameter | Warum relevant | Folge ohne Hardwaremessung |
|---|---|---|
| Original-PAL `C23..C28` | Basskopplung / äußere Netzwerke | nur Varianten, kein exakter PAL-Wert |
| S-MIX `Z_in(s)` je Eingang | Pole, Pegel, Quelleffekt | RC-HP ist Näherung |
| `H_smix(s)` komplex | analoges Filtering, Phase, L/R-Vergleich | kein vollständiger Originalfrequenzgang |
| Original-Gains für APU/Cart/Expansion | korrekte relativen Pegel | Gains als freie Parameter |
| Interne Schaltung / Rückkopplung | Transistor-/Opamp-Struktur | nicht rekonstruierbar aus funktionierendem Ersatz allein |
| S-MIX-Ausgangsimpedanz / Last | Multi-Out-Pegel | vereinfachte ideale Spannungsquelle |
| PRESET-Pins 2/14, C16/C17 | Bias/Einschwingverhalten | keine behauptete komplexe Transientenphysik |
| MUTE + C21 | Fade/Knackser/Schaltverhalten | nur explizite Software-Gate-Option |
| THD, Clipping, Rauschen, Versorgungseinfluss | feine Charakteristik | nicht als scheinexakte Werte einsetzen |
| Revisionsunterschiede 01 vs 02 | mögliche Bestückungs-/IC-Unterschiede | gemeinsames parametrisches Board-Familienmodell |

**Identifizierbarkeit:** Ein Multi-Out-Track enthält im Allgemeinen das *Produkt bzw. die gekoppelte Wirkung* aus S-DSP, DAC, Koppelkondensatoren, S-MIX, Ausgangsnetzwerk, Last und Aufnahmekette. Selbst bei perfekter Digitalreferenz kann eine alleinige Endausgangskurve die internen Übertragungen ohne Zusatzannahmen nicht eindeutig zerlegen. Public-Recordings können **End-to-End-Plausibilität**, nicht eindeutig den S-MIX-internen Aufbau nachweisen.

**Grenze der Recherche, Stand 2026-11-08:** Keine verifizierte vollständige Original-S-MIX-Dieanalyse, kein Originaldatenblatt mit Verstärkung/Frequenzgang, keine isolierte PAL-1CHIP-Pin-zu-Pin-Originalmessung in den überprüften Quellen. Nicht als „existiert grundsätzlich nicht“ behaupten.

## 9. Referenzdateien aus der bisherigen Arbeit

Die folgenden Dateien wurden **separat** für das Forschungsprojekt erstellt. Falls sie neben diesem Dokument vorliegen, sind sie Hilfsmittel, keine zusätzlichen Nintendo-Primärquellen:

- `smix_model.py`, `profiles.json`, `test_model.py`, `RECHERCHE.md`: parametrisches Proxy-Modell, berechnete Frequenzgänge und Tests; keine Hardwaremessungen.
- `analyze_smix.py`, `MESSPROTOKOLL.md`, `hardware_parameters.json`: Auswertung synchroner Messdaten und detailliertes Protokoll; das enthaltene Demonstrationsbeispiel ist **synthetisch**.
- `smix_evidence_and_hypotheses.json`, `smix_input_highpass_scenarios.csv`: maschinenlesbare Schaltungsbelege/vergleichende Rechnung.

Diese Dateien können Codex als **Ausgangspunkt** dienen, sollten aber anhand der hier beschriebenen Qualitätskriterien geprüft werden. Insbesondere `profiles.json` nutzt im alten Prototyp einen 47-kΩ-Ausgangslastwert, während das JSON oben 10 kΩ exemplarisch nutzt: **keine widersprüchlichen Lastannahmen stillschweigend mischen**.

## 10. Quellen und überprüfbare Links

Alle URLs dienen der Nachprüfung im Codex-Arbeitslauf. Ältere Wiki-/Moddingangaben und Rekonstruktionen sind **keine offiziellen Nintendo-Datenblätter**.

| ID | Ressource | Primärer Nutzen | Gewichtung |
|---|---|---|---|
| [S01] | [NEC µPD6379/6379A/6379L/6379AL Datenblatt](https://datasheet.octopart.com/UPD6379-NEC-datasheet-180910103.pdf), alternativ [HTML/Transkript](https://dtsheet.com/doc/510645/nec-upd6379algr) | DAC-Pinout, Datentiming, DC-Pegel, 4× Oversampling, Messbedingungen | hoch, Hersteller |
| [S02] | [stonedDiscord/nonSNES PAL-1CHIP KiCad](https://github.com/stonedDiscord/nonSNES/tree/main/SNSP-CPU-1CHIP), [Schaltplandatei](https://github.com/stonedDiscord/nonSNES/blob/main/SNSP-CPU-1CHIP/SNSP-CPU-1CHIP.kicad_sch) | PAL-Netztopologie und Bauteilreferenzen, unbekannte Cs als `?` | hoch für rekonstruierte externe Schaltung |
| [S03] | [SNESdev S-MIX Pinout](https://snes.nesdev.org/wiki/S-MIX_Pinout) | 14-Pin-Zuordnung und externe Mischerschaltung | hoch für Topologie |
| [S04] | [PAL 1CHIP Kondensatorliste](https://conventionalmemory.io/recap/snes/), alternativ [Altomare-Kondensatorlisten](https://github.com/Altomare/snes-capacitors) | Elko-Werte, Boardvarianten | hoch als sekundäre Bestückungsliste |
| [S05] | [qwertymodo/kicad-snn-cpu-01](https://github.com/qwertymodo/kicad-snn-cpu-01), Datei `AV.kicad_sch` | SNES-Jr-C23..C28 = 150 nF; C21 = 150 nF; andere Versorgung | sehr guter Vergleich, **andere Boardfamilie** |
| [S06] | [Nintendo 64 Audio Output Repair](https://retrotechwiki.com/Nintendo_64_Audio_Output_Repair) | AMP-NUS-Außenbeschaltung | sekundärer Vergleich, nicht PAL |
| [S07] | [ManCloud S-MIX-replacement](https://github.com/ManCloud/S-MIX-replacement), `S-Mix-Replacement.kicad_sch` | LM358D/BC846-Funktionsersatz, AMP-NUS-Swapbericht | Funktions-Evidenz, **kein** Original-IC-Schaltplan |
| [S08] | [RetroLoom Super Wave Blaster](https://github.com/RetroLoom/Super-Wave-Blaster) | 100-nF-Eingangskopplung und Pegelteiler für S-MIX-kompatiblen Mod | alternative Designauslegung, nicht Originalwert |
| [S09] | [S-SMP clock speed measurements](https://undisbeliever.net/blog/20250313-smpspeed.html) | gemessener Audio-Clock-Drift, PAL-Beispielwerte | reale veröffentlichte Messung |
| [S10] | [SNESdev Cartridge connector](https://snes.nesdev.org/wiki/Cartridge_connector) | Cartridge Audio links Pin 31, rechts Pin 62 | Pinout |
| [S11] | [RetroLoom Super ReMix](https://github.com/RetroLoom/Super-ReMix) | alternatives S-MIX-Ersatzdesign, unabhängig vom Originalchip | Vergleichsarchitektur |
| [S12] | [MDFourier](https://junkerhq.net/MDFourier/) | Vergleich ganzer Konsolenaufnahmen, potenzieller Validierungsansatz | keine isolierte Chipmessung |

### Quellenkritische Stolperstellen

- Nicht die **identischen Buchstaben/Referenznummern** über mehrere Boarddesigns hinweg gleichsetzen: z. B. `C15` des PAL-DAC ist **nicht** `C15` einer DAC-Umbauplatine.
- Ein funktionierender AMP-NUS↔S-MIX-Swap ist kein Beweis identischer Siliziumrevision.
- `1CHIP-01` ohne `SNSP` kann NTSC meinen. Für PAL stets vollständige Boardbezeichnung notieren.
- Der mehrpolige Tiefpass alter LM324-SNES-Boards ist nicht automatisch im S-MIX repliziert.
- Generierte Grafiken/Transferkurven aus den älteren Modellpaketen sind **synthetisch**; niemals als tatsächliche Original-Hardwareaufnahmen deklarieren.

## 11. Konkreter Codex-Arbeitsauftrag (zur direkten Weitergabe)

> **Aufgabe:** Implementiere auf Basis dieses Dokuments ein quellenbasiertes, parametrisches SNES-PAL-1CHIP-Audio-Postprocessing-Modul. Zunächst Repository, bestehende S-DSP-/DAC-/Resampler-Implementierung, Architektur, Tests und vorhandene Dokumentation einlesen. Keine bestehenden Arbeitspakete unkoordiniert überschreiben. Die analoge Eingangsankopplung pro Quelle/Kanal, eine konfigurierbare Mischmatrix und die bekannte Ausgangsankopplung implementieren. Den optionalen hypothetischen S-MIX-LPF als deaktivierte Experimentfunktion vorsehen, **nicht als Originalfilter aktivieren**. Einheitentests zu DC, Eckfrequenz, Passband-Gain, Stereo-Isolation, Sample-Rate-Verhalten und Profilwechsel schreiben. Dokumentation mit jeder Quelle/Annahme und ihren Unsicherheiten pflegen. Original-PAL-`C23..C28`, S-MIX-Gains, innere Filterpole und Original-MUTE-Dynamik **nicht erfinden**. API/Konfigurationen an die vorhandene Engine anpassen; keine unbestätigten Hardware-Fakten hart codieren.

### Sinnvolle nächste Recherche ohne Nutzerhardware

1. Offizielle oder hochwertige **Original-Bestückungsfotos/Board-Scans** von `SNSP-CPU-1CHIP-01/-02` identifizieren und C23–C28 räumlich mit Platinenlayout abgleichen. Ohne Markierung und LCR-Messung nicht aus der bloßen Baugröße auf 100/150 nF schließen.
2. Ältere, andere Board-Rekonstruktionen und **Schaltungstopologien** vergleichen (vor allem Netzimpedanz, nicht nur Bauteilnummern); unabhängige Evidenz für `Z_in` und Gain des S-MIX suchen.
3. Vorhandene Originalhardware-Aufnahmen mit bekannter Revision und digitaler Referenz recherchieren, zur **Gesamtkette** vergleichen; intern nicht eindeutig identifizierbare Parameter weiterhin als solche belassen.
4. Falls eine glaubwürdige Original-Frequenzgangmessung eines S-MIX-Pin-zu-Pin-Pfads auftaucht, Quellenbedingungen erfassen und `H_smix` durch komplexen Fit bestimmen (Amplitude **und** Phase, Last, Eingangspegel, Versorgung).

---

**Status dieser Übergabe:** Vollständige technische Zusammenfassung aus der vorliegenden Unterhaltung und den geprüften öffentlichen Schaltplänen/Datenblättern. **Kein Reverse Engineering mit Zugriff auf einen originalen physischen S-MIX, keine bestätigten neuen Originalmesswerte.**
