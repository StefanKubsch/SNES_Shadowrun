# Boot screens lift

After the reset, the start-up 80:A133 calls 80:A15C, which calls the boot screens
81:E7BC. They are lifted in
[src/frontend/boot-screens.mjs](../src/frontend/boot-screens.mjs)
(`bootScreensSequence`). The register-level version stays in
[src/task/main-startup.mjs](../src/task/main-startup.mjs) (`showBootScreens`) as the
reference, and recorded runs keep using it. The routine table entry
`runBootScreensLifted` (MAIN_STARTUP_ROUTINES) runs the lifted screens with lag-free
frames. Method: [MATRIX-LIFT.md](MATRIX-LIFT.md).

## Course

1. Clear the direct page word 10 (no reader is known).
2. The first screen from the scene list 8A:8000: the scene screen start 81:EB97
   (`startSceneScreen`), the list 81:EC16 (`runSceneList`), the screen registers 81:EBE9
   (`setSceneScreen`), the NMI and joypad 81:EB7B, and the fade in 81:EEDD (`fadeIn`).
3. The sound driver start 81:EF07 (`startSoundDriver` in
   [src/apu/sound-driver-start.mjs](../src/apu/sound-driver-start.mjs)): no music, the
   driver 97:8000 (0C55 bytes) through the IPL to ARAM 0200 (81:F07F, 81:EFA5), main
   volume 0 and song level 20/20. The port accesses keep their original sites. A
   planted song level 2021 differs in the sound RAM at NMI 16.
4. Hold the screen for 150 frames (81:EEBB, `waitForFrame`), fade it out (81:EEF1,
   `fadeOut`) and disable the NMI (81:EB89).
5. The settings word 70:1FFC keeps its output mode and control type bits. When the
   checksum compare 81:D5EC (`settingsValid` in
   [src/frontend/settings.mjs](../src/frontend/settings.mjs), with the checksum 81:D5D0)
   fails, the defaults 81:D5F4 (`restoreDefaultSettings`) are restored. A keeps the
   control type in its high byte and the checksum in its low byte, X the end of the
   checksum loop (FFFF), as the original leaves them.
6. The second screen from the scene list 89:EC26, shown the same way for 180 frames
   (81:EED5), then faded out with the NMI disabled.
7. Send the output mode 81:EF36 (`sendOutputMode`: X the settings word, A the command
   with its token), restore the entry status and return with RTL.

## Boundaries

- The JSL frames of the lifted callees and the status byte of the original PHP are not
  pushed. They lie below the caller's frame on the stack.
- 81:EB97 sets the interrupt disable flag, and the lifted screens set it too. The PLP at
  the end restores the entry status.
- With recorded interrupt observations the register-level screens run, with their
  callees through their frames.

## Tests

[tools/boot-screens-lift.test.mjs](../tools/boot-screens-lift.test.mjs) runs the first
2989 frames from the reset into the title, for the apartment save and for a copy with
mono output and an invalid settings checksum (the defaults restore stereo), each twice:
once with the lifted screens and once with the register-level ones. It compares WRAM
(outside the scratch and stacks of `CUTSCENE_IGNORED_WRAM`), VRAM, CGRAM, OAM, PPU
registers, scroll, PPU write count and sound RAM at every NMI. Each run takes about 17
seconds. A first screen held for 149 frames fails it. The cleared direct page word 10
lies in the ignored scratch, so this test cannot see it, nor SRAM itself; a boot that
skips the defaults differs in the sound RAM at NMI 394. The settings functions 81:D5EC,
81:D5F4 and 81:EF36 have random state tests in
[tools/start-menu-lift-functions.test.mjs](../tools/start-menu-lift-functions.test.mjs).
