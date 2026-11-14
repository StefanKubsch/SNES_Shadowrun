// The start of the sound driver (lifted from 81:EF07 with the driver load 81:F07F and
// the IPL transfer 81:EFA5, 81:EFFA and 81:F001; register-level version in
// src/task/main-startup.mjs). The IPL protocol is in Book I appendix D (PDF 237/238)
// and docs/SOUND-DRIVER.md: the IPL reports AA/BB on ports 0/1; CC on port 0 starts a
// block at the ARAM address on ports 2/3 (port 1 not zero: data follows); each byte
// goes on port 1 with its counter on port 0, which the IPL echoes. Port 1 zero with a
// new counter ends the transfer and starts the program at the port 2/3 address. The
// driver reports CA on port 1 when it is ready.
import { APU_COMMAND_TOKEN, AUDIO_BLOCK_LIST_POINTER, MUSIC } from '../task/wram.mjs';
import { APU_COMMAND_SONG_LEVEL, APU_COMMAND_VOLUME } from '../constants/sound-commands.mjs';
import { APUIO0, APUIO1, APUIO2, APUIO3 } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS } from '../constants/bits.mjs';

const IPL_READY_PORT0 = 0xaa,
  IPL_READY_PORT1 = 0xbb,
  IPL_START = 0xcc,
  DRIVER_READY = 0xca;
// The driver: 0C55 bytes from 97:8000 to ARAM 0200, where it starts.
const SOUND_DRIVER = 0x978000,
  SOUND_DRIVER_BYTES = 0xc55,
  SOUND_DRIVER_ARAM = 0x0200;
// 81:EF07: no music, main volume 0, song level 20/20.
const NO_MUSIC = 0xffff,
  START_VOLUME = 0,
  START_SONG_LEVEL = 0x2020;
// Original instructions, the sites of the device model.
const SITES = {
  ready0: 0x81efaa,
  ready1: 0x81efb1,
  increment: 0x81efb8,
  address2: 0x81efbd,
  address3: 0x81efc2,
  start: 0x81efc7,
  echo: 0x81f001,
  data: 0x81effa,
  counter: 0x81effe,
  end1: 0x81efd9,
  end2: 0x81efde,
  end3: 0x81efe3,
  end0: 0x81efe8,
  driverReady: 0x81efed,
  clear0: 0x81eff2,
};

// Write a byte to an APU port and wait until the IPL echoes value on port 0 (81:F001).
function writeAndWaitEcho(port, register, value, site, echo) {
  port.write(register, value & BYTE_MASK, 1, site);
  while (port.read(APUIO0, 1, SITES.echo) !== (echo & BYTE_MASK));
}

// Transfer bytes from the long address source to ARAM address aram through the IPL and
// start the program there (81:EFA5). The original keeps the source pointer in direct
// page 89-8B (direct page 0) and clears the command token afterwards.
export function uploadToApu(mem, port, source, bytes, aram) {
  const { wram } = mem;
  wram[AUDIO_BLOCK_LIST_POINTER] = source & BYTE_MASK;
  wram[AUDIO_BLOCK_LIST_POINTER + 1] = (source >>> BYTE_BITS) & BYTE_MASK;
  wram[AUDIO_BLOCK_LIST_POINTER + 2] = source >>> WORD_BITS;
  while (
    port.read(APUIO0, 1, SITES.ready0) !== IPL_READY_PORT0 ||
    port.read(APUIO1, 1, SITES.ready1) !== IPL_READY_PORT1
  );
  // INC 2141: port 1 not zero, a data block follows.
  const flag = (port.read(APUIO1, 1, SITES.increment) + 1) & BYTE_MASK;
  port.write(APUIO1, flag, 1, SITES.increment);
  port.write(APUIO2, aram & BYTE_MASK, 1, SITES.address2);
  port.write(APUIO3, aram >>> BYTE_BITS, 1, SITES.address3);
  writeAndWaitEcho(port, APUIO0, IPL_START, SITES.start, IPL_START);
  for (let n = 0; n < bytes; n++) {
    port.write(APUIO1, mem.read8(source + n), 1, SITES.data);
    writeAndWaitEcho(port, APUIO0, n, SITES.counter, n);
  }
  // Port 1 zero and the next counter start the program at the ARAM address.
  port.write(APUIO1, 0, 1, SITES.end1);
  port.write(APUIO2, aram & BYTE_MASK, 1, SITES.end2);
  port.write(APUIO3, aram >>> BYTE_BITS, 1, SITES.end3);
  port.write(APUIO0, (bytes + 1) & BYTE_MASK, 1, SITES.end0);
  while (port.read(APUIO1, 1, SITES.driverReady) !== DRIVER_READY);
  port.write(APUIO0, 0, 1, SITES.clear0);
  wram[APU_COMMAND_TOKEN] = 0;
}

// Start the sound driver (81:EF07): no music, the driver loaded and started (81:F07F),
// main volume 0 and the song level 20/20. m is the scene runtime
// (src/system/scene-runtime.mjs).
export function startSoundDriver(m) {
  m.wram[MUSIC] = NO_MUSIC & BYTE_MASK;
  m.wram[MUSIC + 1] = NO_MUSIC >>> BYTE_BITS;
  uploadToApu(m.mem, m.port, SOUND_DRIVER, SOUND_DRIVER_BYTES, SOUND_DRIVER_ARAM);
  m.sound(APU_COMMAND_VOLUME, START_VOLUME);
  m.sound(APU_COMMAND_SONG_LEVEL, START_SONG_LEVEL);
}
