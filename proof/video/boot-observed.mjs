import { BYTE_MASK, BYTE_BITS, BANK_SIZE } from '../../src/constants/bits.mjs';
import { BANK_WITHOUT_IO } from '../../src/constants/memory-map.mjs';
import { INIDISP, NMITIMEN } from '../../src/constants/hardware-registers.mjs';
import { VmMemory, VmFault, WRAM_SIZE, SRAM_SIZE } from '../../src/vm/memory.mjs';
import { ScriptInterpreter } from '../../src/vm/interpreter.mjs';
import { TaskAccessor } from '../../src/vm/task-accessor.mjs';
import { runMainReset } from '../../src/task/main-reset.mjs';
import {
  runMainStartup,
  MAIN_STARTUP_ROUTINES as STARTUP_ROUTINES,
} from '../../src/task/main-startup.mjs';
import { withFrontendReference } from '../frontend-reference/frontend.mjs';

// Recorded chronologies hold every instruction of the title (prologue fill, polls in
// bank 81): they replay with the register-level title (proof/frontend-reference).
const MAIN_STARTUP_ROUTINES = withFrontendReference(STARTUP_ROUTINES);
import { finishInterruptObservations } from '../../src/task/main-wait-interrupt.mjs';
import { PpuBus } from '../../src/video/ppu-state.mjs';

// Replay read windows retain the exact original transcript filtering ranges.
const PPU_READ_WINDOW_FIRST = INIDISP;
const PPU_READ_WINDOW_LAST = 0x21ff;
const CPU_READ_WINDOW_FIRST = NMITIMEN;
const CPU_READ_WINDOW_LAST = 0x43ff;
const READ_RUN_REPEAT_COUNT = 3;

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
      'boot_initial_memory_required',
    );
    bytes.fill(value, at, at + count);
    at += count;
  }
  need(at === size, 'boot_initial_memory_required');
  return bytes;
}
function interruptsFrom(bundle) {
  need(
    Number.isSafeInteger(bundle.instructionSteps) && bundle.instructionSteps > 0,
    'boot_instruction_count_required',
  );
  const records = new Array(bundle.instructionSteps),
    cache = new Map();
  let at = 0,
    pending = null,
    nmis = 0;
  const instruction = (pc) => {
    const nmi = pending !== null;
    if (nmi) need(pc === pending, 'boot_nmi_position_required');
    need(at < records.length, 'boot_instruction_count_required');
    const key = pc * 2 + Number(nmi);
    if (!cache.has(key)) cache.set(key, Object.freeze({ pc, nmi }));
    records[at++] = cache.get(key);
    pending = null;
  };
  for (const row of bundle.chronology) {
    if (row[0] === 'H') {
      need(pending === null, 'boot_nested_nmi_required');
      pending = row[1];
      nmis++;
    } else if (row[0] === 'T') instruction(row[1]);
    else if (row[0] === 'L') {
      need(Number.isSafeInteger(row[1]) && row[1] > 0, 'boot_poll_count_required');
      for (let n = 0; n < row[1]; n++) {
        instruction(0x81eecd);
        instruction(0x81eed1);
      }
    } else throw new VmFault('boot_instruction_record_required');
  }
  need(
    pending === null && at === records.length && nmis === bundle.nmis,
    'boot_instruction_count_required',
  );
  return Object.freeze(records);
}

// The first visible logo uses the native reset/startup equations and original
// *input* observations. No CPU decoding, PPU image import or later RAM seed.
// The bundle contains cold initial CPU/RAM, device-read runs and PC/NMI events.
export function runObservedLogo(rom, bundle) {
  need(bundle?.schema === 1 && bundle.checkpoint === 0x81eef1, 'boot_logo_observation_required');
  const mem = new VmMemory(
    rom,
    memoryRuns(bundle.initial.wram, WRAM_SIZE),
    memoryRuns(bundle.initial.sram, SRAM_SIZE),
  );
  const vm = new ScriptInterpreter(mem);
  vm.setContext(bundle.initial.context);
  vm.pc = bundle.initial.context.pc;
  const a = new TaskAccessor(vm);
  a.load();
  Object.assign(a.ctx, bundle.initial.context);
  const bus = new PpuBus(mem);
  a.devices = bus;
  const absoluteRead = a.absoluteRead;
  let run = 0,
    used = 0,
    readBytes = 0;
  a.absoluteRead = (offset, width, pc) => {
    if (
      a.ctx.bank & BANK_WITHOUT_IO ||
      !(
        (offset >= PPU_READ_WINDOW_FIRST && offset <= PPU_READ_WINDOW_LAST) ||
        (offset >= CPU_READ_WINDOW_FIRST && offset <= CPU_READ_WINDOW_LAST)
      )
    )
      return absoluteRead(offset, width, pc);
    let value = 0;
    for (let byte = 0; byte < width; byte++) {
      const row = bundle.reads[run];
      need(
        row && row[0] === a.ctx.bank * BANK_SIZE + offset + byte && row[1] === pc,
        'boot_device_read_required',
      );
      value |= row[2] << (BYTE_BITS * byte);
      readBytes++;
      if (++used === row[READ_RUN_REPEAT_COUNT]) {
        used = 0;
        run++;
      }
    }
    return value;
  };
  const routines = new Map(MAIN_STARTUP_ROUTINES),
    checkpoint = Symbol('logo entry'),
    events = {
      startupInterrupts: true,
      interrupts: interruptsFrom(bundle),
      interruptIndex: 0,
      interruptRoutines: routines,
      calls: [],
    };
  routines.set(0x81eef1, () => {
    throw checkpoint;
  });
  a.resetAccessBudget(0x00e382);
  runMainReset(a);
  a.resetAccessBudget(0x80a133);
  let complete = false;
  try {
    runMainStartup(a, events, routines);
  } catch (error) {
    if (error !== checkpoint) throw error;
    complete = true;
  }
  need(
    complete && a.ctx.programBank * BANK_SIZE + a.ctx.pc === bundle.checkpoint,
    'boot_logo_checkpoint_required',
  );
  finishInterruptObservations(events);
  need(run === bundle.reads.length && used === 0, 'boot_device_read_unused');
  bus.ppu.requireComplete();
  return {
    memory: mem,
    context: { ...a.ctx },
    ppu: bus.ppu,
    readBytes,
    dmaBytes: bus.dmaBytes,
    nmis: bundle.nmis,
  };
}
