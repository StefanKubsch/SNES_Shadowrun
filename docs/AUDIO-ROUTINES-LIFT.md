# Audio routines lift

The audio routines of the scene routine table (src/task/main-scene.mjs) now run
as lifted code, after the game start
([GAME-START-LIFT.md](GAME-START-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The lifted sound driver command and music
code already existed in src/apu and was proved there; this step replaces the
remaining register-level table entries. The sound effect 80:C46E with its stereo
levels 80:C416 followed as plain code (src/apu/sound-effect.mjs) for the tables
of the main loop upkeep and the main menu. The register-level versions stay as
reference in
[proof/apu-reference/audio-routines.mjs](../proof/apu-reference/audio-routines.mjs)
(`AUDIO_REFERENCE_ENTRIES`, `withAudioReference`; also part of
`INTRO_SETUP_REFERENCE_ENTRIES`, which the intro, title, start menu and title
cycle references carry, and of `FRONTEND_REFERENCE_ENTRIES` and so of the scene
reference table).

## Modules

| Module                                                                  | Content                                                                                                                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [audio-routines.mjs](../src/apu/audio-routines.mjs)                     | The table entries 81:F007 (`sendApuCommandRoutine`) and 81:EF47 (`setMusicModeRoutine`) on top of the lifted code.                                                    |
| [apu-command.mjs](../src/apu/apu-command.mjs)                           | The sound driver command 81:F007 (unchanged).                                                                                                                         |
| [music-mode.mjs](../src/apu/music-mode.mjs)                             | Music change, song start and sample loader (unchanged).                                                                                                               |
| [sound-effect.mjs](../src/apu/sound-effect.mjs)                         | The sound effect 80:C46E (`playSoundEffect`, entry `playSoundEffectRoutine`) and its stereo levels 80:C416 (`soundLevels`).                                           |
| [audio-routines.mjs](../proof/apu-reference/audio-routines.mjs) (proof) | The register-level entries 81:EF47, 81:F007, 81:F229, 81:F1FA, 81:F130, 81:F100, 81:F122, 81:F03A and 80:C46E; the song start 81:F229 moved here from main-scene.mjs. |

## Boundaries

- The table keeps only 81:F007 and 81:EF47: register-level code still calls them
  through it (the boot's sound driver start, the room transition 80:A580, the
  output mode 81:EF36, the software reset). The song start 81:F229 and the
  sample loader 81:F130 with its helpers 81:F1FA, 81:F100, 81:F122 and 81:F03A
  have no register-level caller left in src, so their entries moved to the
  reference.
- Both entries return with RTL and leave A with the last command in its high
  byte and the new token in its low byte; F007 keeps the status flags (PHP/PLP),
  EF47 leaves X = 7F7F and clears N and Z. Not produced: the stack byte of the
  original PHP, Y after EF47 and the sample loader's direct page state
  (7E:0089-008B, 008F-0099).
- The sound effect reads its arguments from the direct page words 0 (object, a
  negative word for none), 2 (byte offset into 80:C4B3), 4 (level) and 6 (voice
  mask). The entry leaves the data bank at 80, X = the sound word with FF in its
  high byte and A as for F007; Y (the effect offset) is not produced after a
  sample set load, and the status flags are not produced. Voices 0 stays a
  frontier (`task_audio_return_required`): the original returns with the sound
  word still on its stack. No word of the table has bit 15, so in the game the
  effect never loads a sample set.
- The stereo levels use the hardware multiplier through the hardware port as
  the original does (WRMPYA, WRMPYB, RDMPYH at the original sites), the way the
  lifted random numbers read the beam counters; another platform answers the
  port with (level * weight) >> 8.
- The lifted code reads and writes the APU ports at their bank-0 addresses
  (src/system/hardware-port.mjs); the original uses the data bank (80:2140 or
  81:2140). Every bank with a system area reaches the same registers (Book I
  21.2, src/constants/memory-map.mjs), so the task accessor
  (src/vm/task-accessor.mjs) matches a recorded I/O observation of a hardware
  port access (`busRead` with `anyBank`) by its register. Register-level
  absolute reads keep matching the full recorded address, which also attests
  their data bank. Fixtures that synthesize device values or compare each I/O
  byte (tools/main-boot-native-observations.mjs, tools/main-boot-connected.test.mjs,
  tools/mesen-boot-prefix.mjs, tools/sound-apu.test.mjs) hook `busRead` and
  `busWrite`, which both paths pass. Tests that compare exact ROM traces or the
  PHP stack byte still run the reference (tools/main-driver.test.mjs, tools/main-reset.test.mjs and
  tools/main-startup-connected.test.mjs use `withAudioReference` for their
  startup tables).
- The Mesen oracle (tools/mesen-f390-oracle.mjs) no longer compares free stack
  bytes: addresses at or below the stack pointer in the main stack 7E:0100-01C9
  or the NMI stack 7E:1C7C-1CBB, where register-level routines leave their
  pushes and lifted code does not. The live comparisons already ignore the stack
  pages.
- src/task/native-audio-compose.mjs and src/task/native-input-apu.mjs stay in
  src: the register-level task natives (dialog, fight list, menus, object hits,
  object shots, the special native 80:C46E, the stereo song level 80:C461) call
  them directly, and the tables of src/task/main-transition.mjs,
  main-intro-nmi.mjs, native-status-screen.mjs and native-dialog.mjs keep the
  register-level F007 and EF47. Those natives are proved against exact ROM
  traces with their own accessors (proof/task/plan.mjs, which has no memory
  view for lifted code), so their audio follows when they are lifted
  themselves.

## What is compared

[tools/audio-routines-lift-functions.test.mjs](../tools/audio-routines-lift-functions.test.mjs)
runs F007 (both accumulator widths) and EF47 (with the cartridge's sound
directory) against the reference on random states: WRAM outside the scratch,
device writes and A, X, P, S, PC and the program bank must be equal. C46E runs
on objects 0-43 or none, the table's effects and offsets past it (code words,
some with bit 15, to reach the sample load), cached and new voices and objects
placed around the camera (every stereo clamp); A, X, Y (within the table), the
data bank, S and PC must be equal. Planted differences (the token in A, X after
EF47, the stereo bias, the sample set cache, the voice cache) fail it.

[tools/audio-routines-lift.test.mjs](../tools/audio-routines-lift.test.mjs) runs
session 4 of [tools/live-title-cycle-plan.mjs](../tools/live-title-cycle-plan.mjs)
(boot, attract game, new game; five F007, two EF47 and 19 C46E calls through
the entries); every NMI must be equal. A planted difference (another music mode)
fails it.

The existing function tests of src/apu (tools/matrix-lift-functions.test.mjs,
tools/cutscene-lift-functions.test.mjs, tools/intro-lift-functions.test.mjs)
keep proving the lifted music code; the cutscene test and
tools/main-scene-animation.test.mjs take the register-level song start from the
reference.
