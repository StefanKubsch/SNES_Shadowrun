// Synthetic test observations for the reached main intervals and native
// contracts. Retries use private memory; the running main owner is untouched.
import assert from 'node:assert/strict';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { nativeBridge, NativeCalls } from '../src/vm/native-call.mjs';
import { ScriptInterpreter } from '../src/vm/interpreter.mjs';
import { MainLoopDriver } from '../src/vm/main-driver.mjs';
import { TaskScheduler, STOP_BUDGET, STOP_NATIVE, STOP_RETURNED } from '../src/vm/scheduler.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { BOOT_NATIVE_CONTRACTS } from './main-boot-native-contracts.mjs';
import { MAIN_STARTUP_ROUTINES } from '../src/task/main-startup.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';
import { isIoAddress, isArithmeticRegister } from '../src/vm/devices.mjs';
import { observationSet, ObservedDevices } from '../proof/vm/observed-devices.mjs';

const freeze = (rows) => Object.freeze(rows.map((o) => Object.freeze({ ...o })));
// A mask read is an explicit synthetic device reply at the reached DMA, never
// a write to the running owner's WRAM or an inferred PPU result.
function appendMaskTransfer(dmaTransfers, error, vmadd) {
  assert.equal(error.observationIndex, dmaTransfers.length);
  assert.ok(Number.isInteger(vmadd));
  dmaTransfers.push(
    Object.freeze({
      pc: 0x81aa93,
      address: error.address,
      width: 1,
      value: 0x20,
      dmap: 0x81,
      bbad: 0x39,
      a1b: 0x7e,
      a1t: 0x2ae0,
      das: 16,
      vmain: 0x80,
      vmadd,
      bytes: Object.freeze(Array(16).fill(0)),
    }),
  );
}
// No device time or counter writes: record explicit synthetic replies only at
// actual port reads. The arithmetic model already present in VmMemory is kept.
// Device reads pass busRead: the original's absolute reads (at the data bank) and
// the lifted code's hardware port (bank 0, src/system/hardware-port.mjs).
function capturePorts(a, io, pad = 0, menuPads = [], counterPattern = []) {
  const read = a.busRead;
  let menuIndex = 0,
    counterIndex = 0;
  a.busRead = (address, width, pc, anyBank) => {
    const offset = address & 65535;
    if (!isIoAddress(address)) return read(address, width, pc, anyBank);
    let value;
    if (isArithmeticRegister(address, false)) value = read(address, width, pc, anyBank);
    else {
      assert.ok(
        [0x2134, 0x213a, 0x4210, 0x4212, 0x4218, 0x2137, 0x213c, 0x213d, 0x2140].includes(offset),
        'boot port ' + offset.toString(16),
      );
      value =
        offset === 0x2134
          ? 192
          : offset === 0x4210
            ? 0x80
            : offset === 0x4218
              ? pad
              : offset === 0x2140
                ? a.mem.read8(0x1ce4)
                : 0;
      // Explicit cyclic synthetic BYTE samples at C560's horizontal read.
      // This is fixture input, without any elapsed-time or beam model.
      if (pc === 0x80c572 && counterPattern.length)
        value = counterPattern[counterIndex++ % counterPattern.length];
      if (offset === 0x4218 && menuPads.length) {
        // Read the actual interrupted PC and long caller from the NMI's saved
        // hardware frame. Only A6E9's B0A1 menu poll advances this input list;
        // window/text NMIs keep the explicitly supplied base pad.
        const savedS = a.mem.read16(0x1c7a),
          interruptedPc = a.mem.read16((savedS + 2) & 65535),
          caller = a.mem.read16((savedS + 5) & 65535),
          bank = a.mem.read8((savedS + 7) & 65535);
        if (interruptedPc === 0xb0a5 && caller === 0xa6ec && bank === 0x80) {
          assert.ok(menuIndex < menuPads.length, 'menu input samples exhausted');
          value = menuPads[menuIndex++];
        }
      }
    }
    io.push({ pc, address, width, value });
    return value;
  };
  return () => assert.equal(menuIndex, menuPads.length, 'unused menu input samples');
}
export function constructBootInterval(current, appendWait, { pad = 0, menuPads = [] } = {}) {
  assert.ok(Number.isInteger(pad) && pad >= 0 && pad <= 65535);
  assert.ok(
    Array.isArray(menuPads) &&
      menuPads.every((value) => Number.isInteger(value) && value >= 0 && value <= 65535),
  );
  const interrupts = [],
    dmaTransfers = [];
  for (let attempt = 0; attempt < 1200; attempt++) {
    const mem = new DialogTestMemory(current.mem.wram.slice(), current.mem.sram.slice(), rom),
      vm = new ScriptInterpreter(mem);
    vm.setContext(current.vm.context());
    vm.pc = current.vm.pc;
    vm.e = current.vm.e;
    const devices = new ObservedDevices([
      observationSet(0x8096c3, {
        interrupts,
        interruptRoutines: MAIN_STARTUP_ROUTINES,
        dmaTransfers,
      }),
    ]);
    vm.natives = new NativeCalls(vm, {
      devices,
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
    });
    const driver = new MainLoopDriver(vm),
      a = driver.accessor,
      io = [];
    driver.ownsGame = current.driver.ownsGame;
    driver.ownerReturnS = current.driver.ownerReturnS;
    const finishPads = capturePorts(a, io, pad, menuPads);
    let vmadd;
    const write = a.absoluteWrite;
    a.absoluteWrite = (offset, value, width, pc) => {
      if (offset === 0x2116) vmadd = value;
      return write(offset, value, width, pc);
    };
    try {
      // A real scene initialization can leave the task cursor negative. Its
      // first C1E3 then returns without fetching an opcode; that is a complete
      // original round, just like the first round after boot.
      const outcome = driver.run(0);
      assert.ok([STOP_BUDGET, STOP_RETURNED].includes(outcome));
      finishPads();
      return observationSet(0x8096c3, {
        io: io.filter((o) => !isArithmeticRegister(o.address, false)),
        interrupts,
        interruptRoutines: MAIN_STARTUP_ROUTINES,
        dmaTransfers,
      });
    } catch (error) {
      if (error.reason === 'main_loop_boundary:wait_interrupt_observation_required') {
        assert.equal(error.details.observationIndex, interrupts.length);
        appendWait(interrupts, error.details.pc, { mem, a });
      } else if (error.reason === 'main_loop_boundary:text_dma_observation_required')
        appendMaskTransfer(dmaTransfers, error.details, vmadd);
      else throw error;
    }
  }
  assert.fail('main interval observation construction bound exceeded');
}
export function constructBootNative(
  stopped,
  appendWait,
  { pad = 0, menuPads = [], nestedInputs = [], counterPattern = [] } = {},
) {
  assert.ok(Number.isInteger(pad) && pad >= 0 && pad <= 65535);
  assert.ok(
    Array.isArray(menuPads) &&
      menuPads.every((value) => Number.isInteger(value) && value >= 0 && value <= 65535),
  );
  assert.ok(
    Array.isArray(counterPattern) &&
      counterPattern.every((value) => Number.isInteger(value) && value >= 0 && value <= 255),
  );
  const interrupts = [],
    dmaTransfers = [];
  for (let attempt = 0; attempt < 1200; attempt++) {
    const mem = new DialogTestMemory(stopped.mem.wram.slice(), stopped.mem.sram.slice(), rom),
      vm = new ScriptInterpreter(mem);
    vm.setContext(stopped.vm.context());
    vm.pc = stopped.vm.pc;
    vm.e = stopped.vm.e;
    vm.natives = new NativeCalls(vm, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
      devices: new ObservedDevices([]),
    });
    const nestedSets = [],
      nestedTargets = [],
      rounds = [];
    let nestedInputIndex = 0;
    const target = nativeBridge(vm),
      contract = BOOT_NATIVE_CONTRACTS.get(target);
    assert.ok(contract);
    const a = new TaskAccessor(vm);
    a.load();
    a.ctx.pc = target & 65535;
    a.devices = { write() {} };
    const io = [];
    let vmadd;
    const write = a.absoluteWrite,
      finishPads = capturePorts(a, io, pad, menuPads, counterPattern);
    a.absoluteWrite = (offset, value, width, pc) => {
      if (offset === 0x2116) vmadd = value;
      return write(offset, value, width, pc);
    };
    const events = {
      interrupts: freeze(interrupts),
      interruptIndex: 0,
      interruptRoutines: MAIN_STARTUP_ROUTINES,
      dmaTransfers: Object.freeze([...dmaTransfers]),
      dmaIndex: 0,
    };
    try {
      const options = {
        interruptEvents: events,
        round: (entry) => {
          assert.equal(entry, 0x80c1ca);
          a.store();
          // The real nested scheduler owns E547 and the original main/native
          // frames. Each reached special takes a separate observation set.
          const scheduler = new TaskScheduler(vm),
            sets = [];
          let outcome = scheduler.call(entry & 65535);
          for (let calls = 0; outcome !== STOP_RETURNED; calls++) {
            assert.ok(calls < 48, 'nested native construction bound exceeded');
            assert.equal(outcome, STOP_NATIVE);
            const target = 0x800000 | mem.read16(0x82d7b8 + vm.x);
            assert.ok(BOOT_NATIVE_CONTRACTS.has(target));
            const supplied = nestedInputs[nestedInputIndex],
              input = supplied?.target === target ? (nestedInputIndex++, supplied) : {};
            const child = constructBootNative({ mem, vm }, appendWait, input);
            vm.natives.devices.sets.push(child.set, ...child.nestedSets);
            nestedSets.push(child.set, ...child.nestedSets);
            nestedTargets.push(target, ...child.nestedTargets);
            sets.push(child.referenceSet);
            outcome = scheduler.resume();
          }
          rounds.push(Object.freeze({ entry, sets: Object.freeze(sets) }));
          a.load();
          return {};
        },
      };
      const result = contract.run(a, options);
      assert.equal(result.returnTarget, 0x80f509);
      finishInterruptObservations(events);
      finishPads();
      assert.equal(nestedInputIndex, nestedInputs.length);
      const channels = { interrupts, interruptRoutines: MAIN_STARTUP_ROUTINES, dmaTransfers };
      return {
        set: observationSet(target, {
          ...channels,
          io: io.filter((o) => !isArithmeticRegister(o.address, false)),
        }),
        referenceSet: Object.freeze({
          ...observationSet(target, { ...channels, io }),
          rounds: Object.freeze(rounds),
        }),
        nestedSets,
        nestedTargets,
        result,
        resultWord: mem.read16(0),
      };
    } catch (error) {
      if (error.reason === 'wait_interrupt_observation_required') {
        assert.equal(error.observationIndex, interrupts.length);
        appendWait(interrupts, error.pc, { mem, a });
      } else if (error.reason === 'text_dma_observation_required') {
        appendMaskTransfer(dmaTransfers, error, vmadd);
      } else throw error;
    }
  }
  assert.fail('boot native observation construction bound exceeded');
}
