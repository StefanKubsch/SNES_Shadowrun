// Power-on reset 00:E382 as a hardware service (docs/BOOT-SERVICE-COMPOSITION.md).
// The register-level reset with its CPU entry checks, the software reset 80:9E3D and
// their exchange of emulation mode, widths, direct page and stack remain in
// proof/replay/main-reset.mjs for recorded comparisons.
import {
  INIDISP,
  OBJSEL,
  BGMODE,
  BG34NBA,
  BG1HOFS,
  VMAINC,
  M7SEL,
  M7A,
  M7B,
  M7C,
  M7D,
  M7X,
  M7Y,
  CGADD,
  W12SEL,
  CGSWSEL,
  CGADSUB,
  COLDATA,
  SETINI,
  APUIO0,
  APUIO1,
  APUIO2,
  APUIO3,
  NMITIMEN,
  WRIO,
  MDMAEN,
  HDMAEN,
  MEMSEL,
} from '../constants/hardware-registers.mjs';

import {
  INIDISP_FORCED_BLANK,
  COLDATA_RED,
  COLDATA_GREEN,
  COLDATA_BLUE,
} from '../constants/ppu.mjs';

import { CODE_BANK } from '../constants/memory-map.mjs';

// Register resets 80:E3FA and 81:EE4F: all WRIO outputs high, COLDATA 0 on all three
// components, colour math prevented everywhere (CGWSEL bits 4-5 = 3,
// proof/video/ppu-frame.mjs) and FastROM.
export const WRIO_ALL_HIGH = 0xff,
  CGSWSEL_MATH_PREVENTED = 0x30,
  MEMSEL_FAST_ROM = 1;

// The power-on stack top. The original's PEA-like push of 8080 and its two PLB leave
// both data bank bytes in the free stack bytes below it; the game state keeps them.
const POWER_ON_STACK = 0x01ff;

// Sites are the original store instructions. Power-on runs the reset in bank 00, so
// the device model sees their 16-bit offsets, as for the register-level reset.
const STOP_SITES = [
    [NMITIMEN, 0xe383],
    [HDMAEN, 0xe386],
    [MDMAEN, 0xe389],
    [APUIO0, 0xe38c],
    [APUIO1, 0xe38f],
    [APUIO2, 0xe392],
    [APUIO3, 0xe395],
  ],
  INIDISP_SITE = 0xe39a,
  OBJECT_SITE = 0xe3a7,
  VRAM_PORT_SITE = 0xe3aa,
  BG_MODE_SITE = 0xe3b2,
  SCROLL_LOW_SITE = 0xe3b5,
  SCROLL_HIGH_SITE = 0xe3b8,
  // Mode 7 matrix: A and D = 1.0 (high byte 1), B, C, X and Y = 0.
  MODE7_WRITES = [
    [M7SEL, 0, 0xe3be],
    [CGADD, 0, 0xe3c1],
    [M7A, 0, 0xe3c6],
    [M7A, 1, 0xe3c9],
    [M7B, 0, 0xe3cc],
    [M7B, 0, 0xe3cf],
    [M7C, 0, 0xe3d2],
    [M7C, 0, 0xe3d5],
    [M7D, 0, 0xe3d8],
    [M7D, 1, 0xe3db],
    [M7X, 0, 0xe3de],
    [M7X, 0, 0xe3e1],
    [M7Y, 0, 0xe3e4],
    [M7Y, 0, 0xe3e7],
    [SETINI, 0, 0xe3ea],
  ],
  WINDOW_SITE = 0xe3ef,
  CPU_PORT_SITE = 0xe3f2,
  FINAL_WRITES = [
    [WRIO, WRIO_ALL_HIGH, 0xe3fa],
    [COLDATA, COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE, 0xe3ff],
    [CGSWSEL, CGSWSEL_MATH_PREVENTED, 0xe404],
  ],
  // The 16-bit store of A = 1 also clears the register after MEMSEL.
  MEMSEL_SITE = 0xe414;

// The reset's hardware writes in their original order, through the hardware port
// (src/system/hardware-port.mjs), and its two stack bytes in memory. It takes and
// leaves no CPU context; the startup 80:A133 follows directly.
export function resetHardware(port, mem) {
  const write = (register, value, site, width = 1) => port.write(register, value, width, site);
  for (const [register, site] of STOP_SITES) write(register, 0, site);
  write(INIDISP, INIDISP_FORCED_BLANK, INIDISP_SITE);
  mem.write8(POWER_ON_STACK - 1, CODE_BANK);
  mem.write8(POWER_ON_STACK, CODE_BANK);
  // OBJSEL, OAMADDL/H and VMAINC, VMADDL/H, from the highest register down.
  for (let x = 2; x >= 0; x--) {
    write(OBJSEL + x, 0, OBJECT_SITE);
    write(VMAINC + x, 0, VRAM_PORT_SITE);
  }
  // BGMODE to BG34NBA, and both writes of the scroll registers BG1HOFS to BG4VOFS.
  for (let x = BG34NBA - BGMODE; x >= 0; x--) {
    write(BGMODE + x, 0, BG_MODE_SITE);
    write(BG1HOFS + x, 0, SCROLL_LOW_SITE);
    write(BG1HOFS + x, 0, SCROLL_HIGH_SITE);
  }
  for (const [register, value, site] of MODE7_WRITES) write(register, value, site);
  // W12SEL to CGADSUB, and NMITIMEN to the same offset ($4200-$420E).
  for (let x = CGADSUB - W12SEL; x >= 0; x--) {
    write(W12SEL + x, 0, WINDOW_SITE);
    write(NMITIMEN + x, 0, CPU_PORT_SITE);
  }
  for (const [register, value, site] of FINAL_WRITES) write(register, value, site);
  write(MEMSEL, MEMSEL_FAST_ROM, MEMSEL_SITE, 2);
}
