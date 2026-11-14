import { BYTE_MASK, BYTE_BITS, WORD_MASK, LONG_MASK } from '../../src/constants/bits.mjs';
import { BANK_WITHOUT_IO } from '../../src/constants/memory-map.mjs';
import {
  APUIO0,
  RDNMI,
  MPYL,
  MPYH,
  RDVRAML,
  RDVRAMH,
} from '../../src/constants/hardware-registers.mjs';
import { INIDISP_FORCED_BLANK } from '../../src/constants/ppu.mjs';
import { WRAM, TEXT_MASK_BUFFER } from '../../src/task/wram.mjs';
// Cold native execution with original *input* observations, through two
// explicitly observed first-room frame boundaries. No CPU decoder or image
// seed. This bounded replay does not provide a PAL clock. After the complete
// replay, live() continues the same owner with lag-free frames and a live pad
// (src/vm/frame-events.mjs); those frames are not compared with the original.
import { VmMemory, VmFault, WRAM_SIZE, SRAM_SIZE } from '../../src/vm/memory.mjs';
import { ScriptInterpreter } from '../../src/vm/interpreter.mjs';
import { NativeCalls } from '../../src/vm/native-call.mjs';
import { ObservedDevices } from '../vm/observed-devices.mjs';
import {
  MainLoopDriver,
  STOP_MAIN_WAIT,
  STOP_MAIN_OWNER_RETURN,
} from '../../src/vm/main-driver.mjs';
import { STOP_RETURNED, STOP_BUDGET, STOP_NATIVE_WAIT } from '../../src/vm/scheduler.mjs';
import { nativeOpcodeTargets } from '../../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../../src/task/native-targets.mjs';
import { MAIN_STARTUP_ROUTINES as STARTUP_ROUTINES } from '../../src/task/main-startup.mjs';
import { withFrontendReference } from '../frontend-reference/frontend.mjs';

// Recorded chronologies hold every instruction of the title (prologue fill, polls in
// bank 81): they replay with the register-level title (proof/frontend-reference).
const MAIN_STARTUP_ROUTINES = withFrontendReference(STARTUP_ROUTINES);
import { PpuBus, PpuState, PpuBoundary } from '../../src/video/ppu-state.mjs';
import { renderMode1Frame } from '../../src/video/ppu-frame.mjs';
import { hdmaRows } from '../../src/video/hdma.mjs';
import {
  LagFreeFrames,
  LiveDevices,
  nmitimenAfterWrite,
  isApuPort,
  NMI_MARK_PC,
} from '../../src/vm/frame-events.mjs';
import { Apu } from '../../src/apu/apu.mjs';

// Transcript encoding: a 24-bit PC and one NMI marker bit.
const INTERRUPT_NMI_MARKER = 0x1000000;
const INTERRUPT_CODE_LIMIT = 0x2000000;
const MAX_REPLAY_POLL_COUNT = 20000000;
// Fixed boundaries and control values admitted by the supplied room recordings.
const OBSERVED_VBLANK_FIRST_LINE = 225;
const OBSERVED_FRAME_LAST_LINE = 311;
const OBSERVED_FRAME_CONTROLS = [1, 3];
const PRODUCT_READ_END = MPYH + 1;
const TEXT_MASK_READBACK_BYTES = 16;
const TEXT_MASK_READBACK_ADDRESS = WRAM + TEXT_MASK_BUFFER;

const need = (ok, reason) => {
  if (!ok) throw new VmFault(reason);
};
function memoryRuns(runs, size) {
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const [count, value] of runs) {
    need(
      Number.isSafeInteger(count) &&
        count > 0 &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= BYTE_MASK &&
        at + count <= size,
      'room_initial_memory_required',
    );
    bytes.fill(value, at, at + count);
    at += count;
  }
  need(at === size, 'room_initial_memory_required');
  return bytes;
}
export function roomInterrupts(rows) {
  const out = [],
    cache = new Map();
  const append = (code) => {
    need(
      Number.isInteger(code) && code >= 0 && code < INTERRUPT_CODE_LIMIT,
      'room_interrupt_record_required',
    );
    if (!cache.has(code))
      cache.set(
        code,
        Object.freeze({ pc: code & LONG_MASK, nmi: !!(code & INTERRUPT_NMI_MARKER) }),
      );
    out.push(cache.get(code));
  };
  for (let n = 0; n < rows.length; n++) {
    const code = rows[n];
    if (code >= 0) append(code);
    else {
      const count = -code,
        pc = rows[++n],
        next = rows[++n];
      need(
        Number.isSafeInteger(count) &&
          count > 0 &&
          count <= MAX_REPLAY_POLL_COUNT &&
          ((pc === 0x81eecd && next === 0x81eed1) || (pc === 0x81b0a5 && next === 0x81b0a9)),
        'room_poll_record_required',
      );
      for (let j = 0; j < count; j++) {
        append(pc);
        append(next);
      }
    }
  }
  return Object.freeze(out);
}
class RoomDevices extends ObservedDevices {
  constructor(rows) {
    super(rows);
    this.cachedIndex = -1;
  }
  peek(target) {
    const row = this.sets[this.index];
    if (!row || row.target !== target) return null;
    if (this.cachedIndex !== this.index) {
      const io = [];
      for (const [pc, address, width, value, count] of row.reads) {
        need(
          [pc, address, value].every(Number.isInteger) &&
            [1, 2].includes(width) &&
            Number.isSafeInteger(count) &&
            count > 0,
          'room_read_record_required',
        );
        const o = Object.freeze({ pc, address, width, value });
        for (let n = 0; n < count; n++) io.push(o);
      }
      this.cached = Object.freeze({
        target,
        io: Object.freeze(io),
        wait: Object.freeze([]),
        input: Object.freeze([]),
        interrupts: roomInterrupts(row.instructions),
        interruptRoutines: MAIN_STARTUP_ROUTINES,
        startupInterrupts: true,
        dmaTransfers: Object.freeze(
          row.dmaTransfers.map((o) => Object.freeze({ ...o, bytes: Object.freeze(o.bytes) })),
        ),
      });
      this.cachedIndex = this.index;
    }
    return this.cached;
  }
  take(target) {
    const set = super.take(target);
    if (set) {
      this.current = set;
      this.reverseIndex = 0;
    }
    return set;
  }
  // NMITIMEN is tracked from the original writes of the replay itself. The
  // native audio unit receives the original port writes (shadow, see live()).
  write(pc, address, value, width) {
    this.nmitimen = nmitimenAfterWrite(this.nmitimen, address, value, width);
    if (isApuPort(address)) this.apu.cpuWrite((address & WORD_MASK) - APUIO0, value, width);
    this.bus.write(pc, address, value, width);
  }
}
export class ObservedRoom {
  constructor(rom, bundle, { onFrame = null } = {}) {
    need(
      bundle?.schema === 1 &&
        bundle.checkpoint === 0x8096c3 &&
        Number.isSafeInteger(bundle.rounds) &&
        bundle.rounds > 0,
      'room_observations_required',
    );
    need(
      Array.isArray(bundle.frames) &&
        bundle.frames.length === 2 &&
        bundle.frames.every(
          (f, n) =>
            Number.isSafeInteger(f.writes) &&
            f.writes > 0 &&
            Number.isSafeInteger(f.frame) &&
            f.scanline === OBSERVED_VBLANK_FIRST_LINE &&
            f.controls === OBSERVED_FRAME_CONTROLS[n] &&
            (!n ||
              (f.writes > bundle.frames[n - 1].writes && f.frame > bundle.frames[n - 1].frame)),
        ),
      'room_frame_observation_required',
    );
    let nextWrite = 0;
    for (const w of bundle.windows) {
      need(
        [w.start, w.count, w.frame, w.first, w.last].every(Number.isSafeInteger) &&
          w.start === nextWrite &&
          w.count > 0 &&
          w.frame >= 0 &&
          w.first >= 0 &&
          w.last >= w.first &&
          w.last <= OBSERVED_FRAME_LAST_LINE &&
          [0, 1].includes(w.blank),
        'ppu_original_write_window_required',
      );
      nextWrite += w.count;
    }
    this.bundle = bundle;
    this.onFrame = onFrame;
    this.frameIndex = 0;
    this.frames = [];
    this.windowIndex = 0;
    this.memory = new VmMemory(
      rom,
      memoryRuns(bundle.initial.wram, WRAM_SIZE),
      memoryRuns(bundle.initial.sram, SRAM_SIZE),
    );
    this.vm = new ScriptInterpreter(this.memory);
    this.vm.setContext(bundle.initial.context);
    this.vm.pc = bundle.initial.context.pc;
    this.vm.e = bundle.initial.context.e;
    const devices = (this.devices = new RoomDevices(bundle.sets));
    // The native audio unit runs alongside the replay: the CPU's port writes and
    // one frame of audio time per NMI. Port reads of the replay stay observations.
    this.apu = devices.apu = new Apu();
    this.vm.natives = new NativeCalls(this.vm, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
      devices,
    });
    this.bus = new PpuBus(this.memory, new PpuState(), {
      beforePpuWrite: (index, port) => {
        this.captureFrames(index);
        let window = bundle.windows[this.windowIndex];
        if (window && index === window.start + window.count)
          window = bundle.windows[++this.windowIndex];
        if (
          !window ||
          index < window.start ||
          index >= window.start + window.count ||
          window.first < 0 ||
          window.last > OBSERVED_FRAME_LAST_LINE ||
          window.last < window.first
        )
          throw new PpuBoundary('ppu_original_write_window_required', { index });
        const ppu = this.bus.ppu;
        if (
          ppu.registerKnown[0] &&
          Number(!!(ppu.registers[0] & INIDISP_FORCED_BLANK)) !== window.blank
        )
          throw new PpuBoundary('ppu_original_blank_state_required', { index });
        ppu.observedVblank = window.first >= OBSERVED_VBLANK_FIRST_LINE;
        // Frames selected for output must have no register/memory mutations
        // during their visible lines. Even harmless-looking writes are a
        // separate raster contract. Line zero is outside the 224 BG lines.
        if (
          !window.blank &&
          window.first > 0 &&
          window.first < OBSERVED_VBLANK_FIRST_LINE &&
          bundle.frames.some((f) => f.frame === window.frame)
        )
          throw new PpuBoundary('ppu_room_raster_source_required', { index, port });
      },
      reverseDma: (bytes) => {
        const o = devices.current?.dmaTransfers[devices.reverseIndex++];
        if (!o || o.bytes.some((value, n) => value !== bytes[n]))
          throw new PpuBoundary('ppu_original_readback_mismatch');
      },
    });
    devices.bus = this.bus;
    const a = this.vm.natives.accessor,
      read = a.absoluteRead;
    a.absoluteRead = (offset, width, pc) => {
      // Every replayed NMI executes C118 (a WRAM read when DBR is $7E/$7F).
      if (offset === RDNMI && pc === NMI_MARK_PC && !this.liveFrames) this.apu.frame();
      const value = read(offset, width, pc);
      // Live reads were answered by the PPU itself (LiveDevices).
      if (this.liveFrames || a.ctx.bank & BANK_WITHOUT_IO) return value;
      if (offset >= MPYL && offset <= MPYH) {
        const product = Array.from(
          { length: width },
          (_, n) => this.bus.ppu.readProduct(offset + n) << (BYTE_BITS * n),
        ).reduce((x, y) => x | y, 0);
        need(
          offset + width <= PRODUCT_READ_END && value === product,
          'room_multiplier_read_mismatch',
        );
      }
      if (offset === RDVRAML || offset === RDVRAMH) {
        need(width === 1 && pc === 0x81aa8e, 'room_vram_read_source_required');
        need(value === this.bus.ppu.readVram(offset), 'room_vram_read_mismatch');
      }
      return value;
    };
    this.driver = new MainLoopDriver(this.vm, {
      devices,
      routines: MAIN_STARTUP_ROUTINES,
      startRoutines: MAIN_STARTUP_ROUTINES,
      frontendRoutines: MAIN_STARTUP_ROUTINES,
      startupRoutines: MAIN_STARTUP_ROUTINES,
      resetProgramBank: bundle.initial.context.programBank,
    });
  }
  captureFrames(writes) {
    while (this.frameIndex < this.bundle.frames.length) {
      const mark = this.bundle.frames[this.frameIndex];
      need(mark.writes >= writes, 'room_frame_boundary_missed');
      if (mark.writes !== writes) return;
      const pixels = renderMode1Frame(this.bus.ppu, { objects: true }),
        frame = { ...mark, pixels };
      this.frames.push(frame);
      this.frameIndex++;
      this.onFrame?.(frame, this.bus.ppu);
    }
  }
  step({ mainBudget = Infinity, opcodeBudget = Infinity } = {}) {
    need(this.driver.roundsCompleted < this.bundle.rounds, 'room_replay_complete');
    const active = this.driver.pending || this.driver.mainPending;
    const stop = active
      ? this.driver.resume(opcodeBudget, { mainBudget })
      : this.driver.run(opcodeBudget, { mainBudget });
    need(
      [STOP_RETURNED, STOP_BUDGET, STOP_MAIN_WAIT, STOP_NATIVE_WAIT].includes(stop),
      'room_round_return_required',
    );
    this.captureFrames(this.bus.ppuWrites);
    return this.frames.length;
  }
  // Hand the same owner, memory and PPU to lag-free frames. A frame is the PPU
  // state at NMI entry, with the H-DMA rows from the enabled channels and their
  // tables at that moment. PPU writes and H-DMA changes outside an NMI since the
  // previous frame have no known scanline and mark that frame's raster as unknown.
  live({ pad, onFrame = null, counter } = {}) {
    need(
      this.driver.roundsCompleted === this.bundle.rounds &&
        this.devices.index === this.bundle.sets.length &&
        !this.liveFrames,
      'room_replay_incomplete',
    );
    need(this.devices.nmitimen !== undefined, 'room_nmitimen_required');
    let rasterWrites = 0;
    const frames = new LagFreeFrames({
      nmitimen: this.devices.nmitimen,
      pad,
      apu: this.apu,
      onNmi: (nmi) => {
        onFrame?.(
          {
            nmi,
            rasterWrites,
            pixels: renderMode1Frame(this.bus.ppu, { objects: true, rows: hdmaRows(this.bus) }),
          },
          this.bus.ppu,
        );
        rasterWrites = 0;
      },
    });
    const devices = new LiveDevices(frames, MAIN_STARTUP_ROUTINES, {
      bus: this.bus,
      apu: this.apu,
      ...(counter ? { counter } : {}),
    });
    this.vm.natives.devices = devices;
    this.vm.natives.accessor.devices = devices;
    this.driver.devices = devices;
    this.bus.beforePpuWrite = this.bus.beforeHdmaWrite = () => {
      if (!frames.inNmi) rasterWrites++;
    };
    // Channel 5 VRAM->WRAM (A9E1): the PPU supplies the bytes, the DMA writes them.
    this.bus.reverseDma = (bytes) => {
      for (let n = 0; n < TEXT_MASK_READBACK_BYTES; n++)
        this.memory.write8(TEXT_MASK_READBACK_ADDRESS + n, bytes[n]);
    };
    this.liveFrames = frames;
    return frames;
  }
  stepLive({ mainBudget = Infinity, opcodeBudget = Infinity } = {}) {
    need(this.liveFrames, 'room_live_required');
    const active = this.driver.pending || this.driver.mainPending;
    const stop = active
      ? this.driver.resume(opcodeBudget, { mainBudget })
      : this.driver.run(opcodeBudget, { mainBudget });
    // Game Over: the main loop's RTS returns to A157; the next step continues the menu owner.
    need(
      [
        STOP_RETURNED,
        STOP_BUDGET,
        STOP_MAIN_WAIT,
        STOP_NATIVE_WAIT,
        STOP_MAIN_OWNER_RETURN,
      ].includes(stop),
      'room_round_return_required',
    );
    return this.liveFrames.nmis;
  }
  finish() {
    while (this.driver.roundsCompleted < this.bundle.rounds) this.step();
    need(
      this.devices.index === this.bundle.sets.length &&
        this.frameIndex === this.bundle.frames.length,
      'room_observation_unused',
    );
    const last = this.bundle.windows.at(-1);
    need(last && this.bus.ppuWrites === last.start + last.count, 'room_write_window_unused');
    return this;
  }
}
