// SNES memory-mapped registers (B-bus PPU/APU ports $2100-$2183, CPU registers
// $4200-$421F, DMA channel registers $4300-$437F), named as in the Nintendo
// Development Manual Book I (Ressources/book1_text.pdf):
// - chapter 27 "PPU Registers", PDF pages 115-139 (printed 2-27-1 to 2-27-25),
// - chapter 28 "CPU Registers", PDF pages 140-152 (printed 2-28-1 to 2-28-13).
// The read ports $2138-$213B share their manual names with the write ports; they
// carry an RD prefix here. The OCR text of the DMA pages (PDF 149-152) only
// partly preserves the register names; the DMA names below follow the
// documented fields (parameters, B-bus address, A1 table address and bank,
// data address/count, indirect bank, A2 table address, line counter).
// Hardware behaviour stays documented in the source contracts that use it.

// PPU and APU ports (chapter 27).
export const INIDISP = 0x2100; // forced blank and brightness
export const OBJSEL = 0x2101; // object size and name base
export const OAMADDL = 0x2102;
export const OAMADDH = 0x2103;
export const OAMDATA = 0x2104;
export const BGMODE = 0x2105;
export const MOSAIC = 0x2106;
export const BG1SC = 0x2107;
export const BG2SC = 0x2108;
export const BG3SC = 0x2109;
export const BG4SC = 0x210a;
export const BG12NBA = 0x210b;
export const BG34NBA = 0x210c;
export const BG1HOFS = 0x210d;
export const BG1VOFS = 0x210e;
export const BG2HOFS = 0x210f;
export const BG2VOFS = 0x2110;
export const BG3HOFS = 0x2111;
export const BG3VOFS = 0x2112;
export const BG4HOFS = 0x2113;
export const BG4VOFS = 0x2114;
export const VMAINC = 0x2115; // VRAM address increment mode
export const VMADDL = 0x2116; // VRAM word address, low byte
export const VMADDH = 0x2117;
export const VMDATAL = 0x2118; // VRAM data write, low byte
export const VMDATAH = 0x2119;
export const M7SEL = 0x211a;
export const M7A = 0x211b; // mode 7 matrix A, also the signed multiplicand
export const M7B = 0x211c; // mode 7 matrix B, also the multiplier
export const M7C = 0x211d;
export const M7D = 0x211e;
export const M7X = 0x211f;
export const M7Y = 0x2120;
export const CGADD = 0x2121; // CGRAM colour index
export const CGDATA = 0x2122; // CGRAM data write, low then high byte
export const W12SEL = 0x2123;
export const W34SEL = 0x2124;
export const WOBJSEL = 0x2125;
export const WH0 = 0x2126;
export const WH1 = 0x2127;
export const WH2 = 0x2128;
export const WH3 = 0x2129;
export const WBGLOG = 0x212a;
export const WOBJLOG = 0x212b;
export const TM = 0x212c; // main screen layers
export const TS = 0x212d; // sub screen layers
export const TMW = 0x212e;
export const TSW = 0x212f;
export const CGSWSEL = 0x2130;
export const CGADSUB = 0x2131;
export const COLDATA = 0x2132; // fixed colour data
export const SETINI = 0x2133;
export const MPYL = 0x2134; // signed multiplication result, low byte
export const MPYM = 0x2135;
export const MPYH = 0x2136;
export const SLHV = 0x2137; // software latch of the H/V counters
export const RDOAM = 0x2138;
export const RDVRAML = 0x2139;
export const RDVRAMH = 0x213a;
export const RDCGRAM = 0x213b;
export const OPHCT = 0x213c; // latched horizontal counter
export const OPVCT = 0x213d; // latched vertical counter
export const STAT77 = 0x213e;
export const STAT78 = 0x213f;
export const APUIO0 = 0x2140; // APU communication port 0
export const APUIO1 = 0x2141;
export const APUIO2 = 0x2142;
export const APUIO3 = 0x2143;
export const WMDATA = 0x2180;
export const WMADDL = 0x2181;
export const WMADDM = 0x2182;
export const WMADDH = 0x2183;

// CPU registers (chapter 28).
export const NMITIMEN = 0x4200; // NMI, timer IRQ and automatic controller read enable
export const WRIO = 0x4201;
export const WRMPYA = 0x4202; // unsigned multiplicand
export const WRMPYB = 0x4203; // unsigned multiplier; writing starts the multiplication
export const WRDIVL = 0x4204; // unsigned dividend, low byte
export const WRDIVH = 0x4205;
export const WRDIVB = 0x4206; // divisor; writing starts the division
export const HTIMEL = 0x4207;
export const HTIMEH = 0x4208;
export const VTIMEL = 0x4209;
export const VTIMEH = 0x420a;
export const MDMAEN = 0x420b; // general purpose DMA channel enable
export const HDMAEN = 0x420c; // HDMA channel enable
export const MEMSEL = 0x420d;
export const RDNMI = 0x4210;
export const TIMEUP = 0x4211;
export const HVBJOY = 0x4212; // VBlank, HBlank and controller busy status
export const RDIO = 0x4213;
export const RDDIVL = 0x4214; // division quotient, low byte
export const RDDIVH = 0x4215;
export const RDMPYL = 0x4216; // multiplication product or division remainder, low byte
export const RDMPYH = 0x4217;
export const STDCNTRL1L = 0x4218; // standard controller I, low byte
export const STDCNTRL1H = 0x4219;
export const STDCNTRL2L = 0x421a;
export const STDCNTRL2H = 0x421b;
export const STDCNTRL3L = 0x421c;
export const STDCNTRL3H = 0x421d;
export const STDCNTRL4L = 0x421e;
export const STDCNTRL4H = 0x421f;

// DMA channel registers $43x0-$43xA (chapter 28, x = channel 0-7).
export const DMA_CHANNEL_STRIDE = 0x10; // register distance between two channels
export const DMAP0 = 0x4300; // transfer mode and direction
export const BBAD0 = 0x4301; // B-bus target port
export const A1T0L = 0x4302; // A-bus address, low byte
export const A1T0H = 0x4303;
export const A1B0 = 0x4304; // A-bus bank
export const DAS0L = 0x4305; // byte count (DMA) or indirect address (HDMA), low byte
export const DAS0H = 0x4306;
export const DASB0 = 0x4307; // indirect HDMA bank
export const A2A0L = 0x4308; // HDMA table address, low byte
export const A2A0H = 0x4309;
export const NTRL0 = 0x430a; // HDMA line counter
export const DMAP1 = 0x4310;
export const BBAD1 = 0x4311;
export const A1T1L = 0x4312;
export const A1T1H = 0x4313;
export const A1B1 = 0x4314;
export const DAS1L = 0x4315;
export const DAS1H = 0x4316;
export const DASB1 = 0x4317;
export const A2A1L = 0x4318;
export const A2A1H = 0x4319;
export const NTRL1 = 0x431a;
export const DMAP2 = 0x4320;
export const BBAD2 = 0x4321;
export const A1T2L = 0x4322;
export const A1T2H = 0x4323;
export const A1B2 = 0x4324;
export const DAS2L = 0x4325;
export const DAS2H = 0x4326;
export const DASB2 = 0x4327;
export const A2A2L = 0x4328;
export const A2A2H = 0x4329;
export const NTRL2 = 0x432a;
export const DMAP3 = 0x4330;
export const BBAD3 = 0x4331;
export const A1T3L = 0x4332;
export const A1T3H = 0x4333;
export const A1B3 = 0x4334;
export const DAS3L = 0x4335;
export const DAS3H = 0x4336;
export const DASB3 = 0x4337;
export const A2A3L = 0x4338;
export const A2A3H = 0x4339;
export const NTRL3 = 0x433a;
export const DMAP4 = 0x4340;
export const BBAD4 = 0x4341;
export const A1T4L = 0x4342;
export const A1T4H = 0x4343;
export const A1B4 = 0x4344;
export const DAS4L = 0x4345;
export const DAS4H = 0x4346;
export const DASB4 = 0x4347;
export const A2A4L = 0x4348;
export const A2A4H = 0x4349;
export const NTRL4 = 0x434a;
export const DMAP5 = 0x4350;
export const BBAD5 = 0x4351;
export const A1T5L = 0x4352;
export const A1T5H = 0x4353;
export const A1B5 = 0x4354;
export const DAS5L = 0x4355;
export const DAS5H = 0x4356;
export const DASB5 = 0x4357;
export const A2A5L = 0x4358;
export const A2A5H = 0x4359;
export const NTRL5 = 0x435a;
export const DMAP6 = 0x4360;
export const BBAD6 = 0x4361;
export const A1T6L = 0x4362;
export const A1T6H = 0x4363;
export const A1B6 = 0x4364;
export const DAS6L = 0x4365;
export const DAS6H = 0x4366;
export const DASB6 = 0x4367;
export const A2A6L = 0x4368;
export const A2A6H = 0x4369;
export const NTRL6 = 0x436a;
export const DMAP7 = 0x4370;
export const BBAD7 = 0x4371;
export const A1T7L = 0x4372;
export const A1T7H = 0x4373;
export const A1B7 = 0x4374;
export const DAS7L = 0x4375;
export const DAS7H = 0x4376;
export const DASB7 = 0x4377;
export const A2A7L = 0x4378;
export const A2A7H = 0x4379;
export const NTRL7 = 0x437a;

// Register fields used across modules (same chapters; NMITIMEN PDF 140,
// HVBJOY PDF 146, STAT78 PDF 137).
/** NMITIMEN bit 7: NMI at the start of VBlank. */
export const NMITIMEN_NMI_ENABLE = 0x80;
/** NMITIMEN bit 0: automatic reading of the standard controllers. */
export const NMITIMEN_AUTO_JOYPAD = 0x01;
/** HVBJOY bit 7: VBlank; bit 6: HBlank; bit 0: controller reading in progress. */
export const HVBJOY_VBLANK = 0x80;
export const HVBJOY_HBLANK = 0x40;
export const HVBJOY_JOYPAD_BUSY = 0x01;
/** STAT78 bit 4: 1 on a PAL console. */
export const STAT78_PAL = 0x10;
