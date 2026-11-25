// The SNES picture back end of LiveGame (docs/FRAME-DESCRIPTION.md, step 8): the PPU
// register model (ppu-state.mjs, ppu-frame.mjs, hdma.mjs) as the device bus, for the
// register-level comparisons. Live play draws through the register-free picture back
// end (src/video/picture-video.mjs); src/ imports none of this. A caller passes
// `video: SNES_VIDEO` to LiveGame.
//
// Without a frame position, every PPU write outside the NMI with the display on counts
// as a raster write (position unknown). In the cold start these are only registers
// (brightness, layers, scroll, colour math), never VRAM, CGRAM or OAM; their data may
// only be written in VBlank (CGRAM also in HBlank) or forced blank (Book I PDF 116 OAM
// 2104, PDF 121 VRAM 2118/2119, PDF 125 CGRAM 2122). The game's dataOutsideBlank counts
// such data accesses (the tests require zero).
import { PpuBus, PpuState } from './ppu-state.mjs';
import { renderMode1Frame } from './ppu-frame.mjs';
import { hdmaRows } from './hdma.mjs';
import { CGDATA, OAMDATA, VMDATAH, VMDATAL } from '../../src/constants/hardware-registers.mjs';
import { INIDISP_FORCED_BLANK } from '../../src/constants/ppu.mjs';

// WRAM target of the channel 5 VRAM read (81:A9E1).
const TEXT_MASK_BUFFER = 0x7e2ae0;

export const SNES_VIDEO = Object.freeze({
  // The device bus over the game's memory.
  bus: (memory) => new PpuBus(memory, new PpuState()),
  // The video memories (vram, cgram, oam) of LiveGame's screen.
  screen: (bus) => bus.ppu,
  // The picture at NMI entry, or null before the first write to 2100.
  render: (bus) =>
    bus.ppu.registerKnown[0]
      ? renderMode1Frame(bus.ppu, { objects: true, rows: hdmaRows(bus) })
      : null,
  // Counts raster writes (game.rasterWrites, reset per frame by LiveGame) and data
  // writes outside blank (game.dataOutsideBlank), and lets the text read-back's
  // channel 5 write WRAM.
  watch(game, frames) {
    const { bus } = game,
      outsideBlank = () =>
        !frames.inNmi && !(bus.ppu.registerKnown[0] && bus.ppu.registers[0] & INIDISP_FORCED_BLANK);
    game.rasterWrites = 0;
    game.dataOutsideBlank = 0;
    bus.beforePpuWrite = (index, port) => {
      bus.ppu.observedVblank = true;
      if (!outsideBlank()) return;
      game.rasterWrites++;
      if (port === OAMDATA || port === VMDATAL || port === VMDATAH || port === CGDATA)
        game.dataOutsideBlank++;
    };
    bus.beforeHdmaWrite = () => {
      if (outsideBlank()) game.rasterWrites++;
    };
    bus.reverseDma = (bytes) => {
      for (let n = 0; n < bytes.length; n++) game.memory.write8(TEXT_MASK_BUFFER + n, bytes[n]);
    };
  },
});
