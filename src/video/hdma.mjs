import { TRANSFER_UNITS, requireValue } from './ppu-state.mjs';
import { BYTE_BITS, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import {
  INIDISP,
  BG1SC,
  BG4SC,
  BG1HOFS,
  BG4VOFS,
  TM,
  WH0,
  WH1,
  WH2,
  WH3,
  DMA_CHANNEL_STRIDE,
} from '../constants/hardware-registers.mjs';
import {
  DMAP_B_TO_A,
  DMAP_HDMA_INDIRECT,
  DMAP_TRANSFER_MODE_MASK,
  DMA_A_ADDRESS_HIGH,
  DMA_A_ADDRESS_LOW,
  DMA_A_BANK,
  DMA_B_ADDRESS,
  DMA_CHANNELS,
  DMA_PARAMETERS,
  HDMA_LINE_COUNT_MASK,
  HDMA_REPEAT,
  SCREEN_HEIGHT,
} from '../constants/ppu.mjs';
import { BANK_WITHOUT_IO, IO_AREA_END, IO_AREA_START } from '../constants/memory-map.mjs';
// H-DMA per Book I chapter 17.2 (PDF 87), 420C/43x0-43xA (PDF 144, 149-152)
// and appendix B-2 (PDF 220): absolute tables of [C|lines] headers, C=0 one
// data unit for all lines, C=1 one unit per line, header 0 ends the channel.
// Result: the B-bus writes before each of the 224 output rows. Row r is the
// line after the r-th H-blank of the field, the same line the BG renderer
// uses for row r (ppu-frame.mjs). Admitted targets: the window edges, the main
// screen layers TM (212C, PDF 128, 2-27-14), BG map base/size registers
// 2107-210A (PDF 118, 2-27-4), and the BG scroll registers
// 210D-2114 (PDF 119, 2-27-5: written twice, low then high, so a channel
// writes them in mode 2). The credits sequence (81:CDF8) drives TM, BG2HOFS
// and window 1 per line.
const SCROLL_PORTS = Array.from({ length: BG4VOFS - BG1HOFS + 1 }, (_, n) => BG1HOFS + n);
const MAP_PORTS = Array.from({ length: BG4SC - BG1SC + 1 }, (_, n) => BG1SC + n);
const HDMA_TARGETS = new Set([WH0, WH1, WH2, WH3, TM, ...SCROLL_PORTS, ...MAP_PORTS]);
// Registers $43x0-$43x4 that a direct H-DMA channel reads.
const HDMA_CHANNEL_REGISTERS = 5;
export function hdmaRows(bus) {
  const mask = bus.ppu.hdmaEnabled;
  if (!mask) return null;
  const rows = Array.from({ length: SCREEN_HEIGHT }, () => []);
  for (let channel = 0; channel < DMA_CHANNELS; channel++)
    if (mask & (1 << channel)) {
      const at = channel * DMA_CHANNEL_STRIDE;
      for (let n = 0; n < HDMA_CHANNEL_REGISTERS; n++)
        requireValue(bus.dmaKnown[at + n] === 1, 'ppu_hdma_register_required', { channel, n });
      const mode = bus.dma[at + DMA_PARAMETERS],
        target = INIDISP + bus.dma[at + DMA_B_ADDRESS],
        bank = bus.dma[at + DMA_A_BANK];
      requireValue(!(mode & DMAP_B_TO_A), 'ppu_hdma_direction_source_required', { channel });
      requireValue(!(mode & DMAP_HDMA_INDIRECT), 'ppu_hdma_indirect_source_required', {
        channel,
      });
      requireValue(
        (mode & DMAP_TRANSFER_MODE_MASK) < TRANSFER_UNITS.length,
        'ppu_hdma_mode_source_required',
        { channel, mode },
      );
      const unit = TRANSFER_UNITS[mode & DMAP_TRANSFER_MODE_MASK];
      for (const offset of unit)
        requireValue(HDMA_TARGETS.has(target + offset), 'ppu_hdma_target_source_required', {
          channel,
          target: target + offset,
        });
      let address =
          bus.dma[at + DMA_A_ADDRESS_LOW] | (bus.dma[at + DMA_A_ADDRESS_HIGH] << BYTE_BITS),
        row = 0;
      const next = () => {
        requireValue(
          (bank & BANK_WITHOUT_IO) !== 0 || address < IO_AREA_START || address >= IO_AREA_END,
          'ppu_hdma_table_source_required',
          { bank, address },
        );
        const value = bus.memory.read8((bank << WORD_BITS) | address);
        address = (address + 1) & WORD_MASK;
        return value;
      };
      while (row < SCREEN_HEIGHT) {
        const header = next();
        if (!header) break;
        // A repeat header without a line count is not admitted.
        requireValue(header !== HDMA_REPEAT, 'ppu_hdma_line_count_source_required', { channel });
        const lines = header & HDMA_LINE_COUNT_MASK,
          repeat = header & HDMA_REPEAT;
        for (let n = 0; n < lines && row < SCREEN_HEIGHT; n++, row++)
          if (!n || repeat) for (const offset of unit) rows[row].push(target + offset, next());
      }
    }
  return rows;
}
