// Cold M3/M5 checkpoints, using actual reset state and original IO.
// The product executes only its existing fixed native JS equations.
import assert from 'node:assert/strict';
import { nativeReturnContext } from './lifted-script-natives.mjs';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { prepareScript, runMesen } from './mesen.mjs';
import { rom } from './task-native-dialog-harness.mjs';
import { decode } from './disassemble.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { ScriptInterpreter } from '../src/vm/interpreter.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { MainLoopDriver, STOP_MAIN_WAIT } from '../src/vm/main-driver.mjs';
import { NativeCalls } from '../src/vm/native-call.mjs';
import { isArithmeticRegister } from '../src/vm/devices.mjs';
import { ObservedDevices } from '../proof/vm/observed-devices.mjs';
import { nativeOpcodeTargets } from '../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../src/task/native-targets.mjs';
import { STOP_RETURNED, STOP_BUDGET } from '../src/vm/scheduler.mjs';
import { SPECIAL_NATIVES } from '../src/vm/special-natives.mjs';
import { runMainReset } from '../src/task/main-reset.mjs';
import { runMainStartup, MAIN_STARTUP_ROUTINES } from '../src/task/main-startup.mjs';
import { withFrontendReference } from '../proof/frontend-reference/frontend.mjs';
import { runMainOwnerStart } from '../src/task/main-frontend.mjs';
import { runMainStart } from '../src/task/main-start.mjs';
import { finishInterruptObservations } from '../src/task/main-wait-interrupt.mjs';

const ROM_PATH = fileURLToPath(new URL('../Shadowrun (E).smc', import.meta.url));
export const BOOT_PPU_OVERRIDES = [
  '--video.videoFilter=None',
  '--video.brightness=0',
  '--video.contrast=0',
  '--video.hue=0',
  '--video.saturation=0',
  '--video.scanlineIntensity=0',
  '--video.screenRotation=None',
  '--snes.forceFixedResolution=false',
  '--snes.highResBlendMode=None',
];
const state = (t) => ({
  a: t[0],
  x: t[1],
  y: t[2],
  s: t[3],
  d: t[4],
  bank: t[5],
  status: t[6],
  programBank: t[7],
  pc: t[8],
  e: t[9],
});
export async function recordBootPrefix(
  exe,
  {
    checkpoint = 0x81eebb,
    menuInput = false,
    menuStart = true,
    capturePpu = false,
    captureRoomFrames = false,
    stopHits = 1,
    captureMainCalls = false,
    captureNativeCalls = false,
    stopAfterNativeNmi = false,
    stopAfterNativeTarget = null,
    stopAfterNativeTargetHits = 1,
    afterNativeTargetInput = null,
    timeoutMs = checkpoint === 0x81eebb ? 60000 : menuInput ? 600000 : 180000,
  } = {},
) {
  assert.ok(
    Number.isSafeInteger(stopHits) && stopHits > 0,
    'positive original checkpoint occurrence',
  );
  assert.ok(!captureNativeCalls || captureMainCalls, 'native recording needs original main owners');
  assert.ok(
    !captureRoomFrames || (capturePpu && captureNativeCalls && stopAfterNativeTarget === 0x80e014),
    'original room frame owners required',
  );
  assert.ok(
    !stopAfterNativeNmi || captureNativeCalls,
    'native NMI checkpoint needs original native owners',
  );
  assert.ok(
    stopAfterNativeTarget === null ||
      (captureNativeCalls && SPECIAL_NATIVES.has(stopAfterNativeTarget)),
    'original native target checkpoint required',
  );
  assert.ok(
    Number.isSafeInteger(stopAfterNativeTargetHits) && stopAfterNativeTargetHits > 0,
    'positive original native return occurrence',
  );
  assert.ok(
    afterNativeTargetInput === null ||
      (stopAfterNativeTarget !== null &&
        captureNativeCalls &&
        menuInput &&
        Array.isArray(afterNativeTargetInput) &&
        afterNativeTargetInput.every((key) =>
          ['a', 'b', 'x', 'y', 'up', 'down', 'left', 'right', 'l', 'r', 'start', 'select'].includes(
            key,
          ),
        )),
    'original post-Native joypad input required',
  );
  const script = prepareScript('trace-boot-prefix.lua', {
      STOP_PC: checkpoint,
      MENU_INPUT: menuInput,
      MENU_START: menuStart,
      CAPTURE_PPU: capturePpu,
      CAPTURE_ROOM_FRAMES: captureRoomFrames,
      STOP_HITS: stopHits,
      CAPTURE_MAIN_CALLS: captureMainCalls,
      STOP_AFTER_NATIVE_NMI: stopAfterNativeNmi,
      STOP_NATIVE_TARGET: stopAfterNativeTarget ?? 0,
      STOP_NATIVE_HITS: stopAfterNativeTargetHits,
      AFTER_NATIVE_TARGET_INPUT:
        afterNativeTargetInput === null
          ? 'nil'
          : '{' + afterNativeTargetInput.map((key) => key + '=true').join(',') + '}',
      NATIVE_TARGETS: captureNativeCalls
        ? '{' + [...SPECIAL_NATIVES.keys()].map((pc) => '[' + pc + ']=true').join(',') + '}'
        : 'nil',
    }),
    snapshots = { I: {}, F: {} },
    io = [],
    chronology = [],
    mainCalls = [],
    nativeCalls = [],
    rawLines = [],
    log = script + '.trace.log',
    video = capturePpu ? {} : null,
    frames = [],
    ppuWindows = [];
  let activeVideo = video;
  const openNatives = [];
  let received = 0,
    announced = null,
    nmis = null,
    nmiRecords = 0,
    instructionSteps = null,
    ioBytes = null,
    checkpointHits = null,
    damage = null;
  const result = await runMesen(
    exe,
    ROM_PATH,
    script,
    (raw) => {
      rawLines.push(raw);
      if (damage || announced !== null) return;
      if (raw.startsWith('N ')) {
        announced = Number(raw.slice(2));
        return;
      }
      if (
        !/^(I|F|IW|FW|IM|FM|r|w|d|v|NMI|T|H|L|STEPS|R|IO|HITS|PPUV|PPUC|PPUO|FRAME|B|G|V|W|J) /.test(
          raw,
        )
      )
        return;
      try {
        const match = / #(\d+)$/.exec(raw);
        assert.ok(match, 'unsequenced boot record');
        assert.equal(Number(match[1]), ++received, 'damaged boot record sequence');
        const [tag, ...tokens] = raw.slice(0, match.index).split(' ');
        if (tag === 'I' || tag === 'F') {
          if (tag === 'F') activeVideo = video;
          const values = tokens.map((t) => parseInt(t, 16));
          assert.equal(values.length, 10);
          assert.ok(values.every(Number.isInteger));
          snapshots[tag].context = state(values);
        } else if (['IW', 'FW', 'IM', 'FM'].includes(tag)) {
          assert.equal(tokens.length, 1);
          assert.match(tokens[0], /^(?:[0-9a-f]{2})+$/);
          snapshots[tag[0]][tag[1] === 'W' ? 'wram' : 'sram'] = Uint8Array.from(
            Buffer.from(tokens[0], 'hex'),
          );
        } else if (['PPUV', 'PPUC', 'PPUO'].includes(tag)) {
          assert.ok(video);
          assert.equal(tokens.length, 1);
          assert.match(tokens[0], /^(?:[0-9a-f]{2})+$/);
          activeVideo[{ PPUV: 'vram', PPUC: 'cgram', PPUO: 'oam' }[tag]] = Uint8Array.from(
            Buffer.from(tokens[0], 'hex'),
          );
        } else if (tag === 'FRAME') {
          assert.ok(video);
          assert.equal(tokens.length, 3);
          activeVideo.width = Number(tokens[0]);
          activeVideo.height = Number(tokens[1]);
          assert.ok(
            Number.isSafeInteger(activeVideo.width) && Number.isSafeInteger(activeVideo.height),
          );
          assert.match(tokens[2], /^(?:[0-9a-f]{6})+$/);
          activeVideo.rgb = Uint8Array.from(Buffer.from(tokens[2], 'hex'));
          assert.equal(activeVideo.rgb.length, activeVideo.width * activeVideo.height * 3);
        } else if (tag === 'J') {
          assert.equal(tokens.length, 5);
          const [frame, ioCursor, writes, controls, scanline] = tokens.map(Number);
          assert.ok([frame, ioCursor, writes, controls, scanline].every(Number.isSafeInteger));
          assert.equal(ioCursor, io.length);
          activeVideo = { frame, ioCursor, writes, controls, scanline };
          frames.push(activeVideo);
        } else if (tag === 'W') {
          assert.equal(tokens.length, 6);
          const [start, count, frame, first, last, blank] = tokens.map(Number);
          assert.ok([start, count, frame, first, last, blank].every(Number.isSafeInteger));
          assert.equal(
            start,
            ppuWindows.reduce((n, w) => n + w.count, 0),
          );
          assert.ok(
            count > 0 && first >= 0 && last >= first && last <= 311 && [0, 1].includes(blank),
          );
          ppuWindows.push({ start, count, frame, first, last, blank });
        } else if (tag === 'G' || tag === 'V') {
          assert.ok([14, 22].includes(tokens.length));
          const target = parseInt(tokens[0], 16),
            ioCursor = Number(tokens[1]),
            steps = Number(tokens[2]);
          const context = state(tokens.slice(3, 13).map((t) => parseInt(t, 16))),
            returnWord = parseInt(tokens[13], 16);
          assert.ok(SPECIAL_NATIVES.has(target), 'original special native target');
          assert.equal(ioCursor, io.length, 'original native IO order');
          assert.ok(
            Number.isSafeInteger(steps) &&
              steps >= 0 &&
              Object.values(context).every(Number.isInteger),
          );
          const point = { target, ioCursor, instructionSteps: steps, context, returnWord };
          if (tokens.length === 22) {
            assert.equal(target, 0x80e014);
            const [slot, x, y, z, vx, vy, vz, input] = tokens.slice(14).map((t) => parseInt(t, 16));
            assert.ok(
              [slot, x, y, z, vx, vy, vz, input].every(
                (v) => Number.isInteger(v) && v >= 0 && v <= 65535,
              ),
            );
            assert.ok(slot < 0xb0 && !(slot & 1));
            point.player = { slot, x, y, z, vx, vy, vz, input };
          }
          if (tag === 'G') {
            assert.equal(context.programBank * 65536 + context.pc, 0x80f52f);
            assert.equal(returnWord, 0xf508);
            const call = {
              start: point,
              round: mainCalls.length - 1,
              depth: openNatives.length,
              nmiStart: nmiRecords,
            };
            nativeCalls.push(call);
            openNatives.push(call);
          } else {
            const call = openNatives.pop();
            assert.ok(call, 'original native return without caller');
            assert.equal(target, call.start.target);
            assert.equal(context.programBank * 65536 + context.pc, 0x80f509);
            assert.equal(context.s, (call.start.context.s + 2) & 65535);
            assert.equal(returnWord, 0xf508);
            call.end = point;
            call.nmis = nmiRecords - call.nmiStart;
          }
        } else if (tag === 'B') {
          assert.equal(tokens.length, 14);
          const pc = parseInt(tokens[0], 16),
            ioCursor = Number(tokens[1]),
            steps = Number(tokens[2]);
          const context = state(tokens.slice(3, 13).map((t) => parseInt(t, 16))),
            returnWord = parseInt(tokens[13], 16);
          assert.equal(pc, 0x80c1e3);
          assert.equal(context.programBank * 65536 + context.pc, pc);
          assert.equal(ioCursor, io.length, 'original main caller IO order');
          assert.ok(
            Number.isSafeInteger(steps) &&
              steps >= 0 &&
              Object.values(context).every(Number.isInteger),
          );
          assert.ok(Number.isInteger(returnWord) && returnWord >= 0 && returnWord <= 65535);
          mainCalls.push({ pc, ioCursor, instructionSteps: steps, context, returnWord });
        } else if (tag === 'NMI') nmis = Number(tokens[0]);
        else if (tag === 'HITS') {
          assert.equal(tokens.length, 1);
          checkpointHits = Number(tokens[0]);
          assert.ok(Number.isSafeInteger(checkpointHits) && checkpointHits >= stopHits);
        } else if (tag === 'STEPS') {
          assert.equal(tokens.length, 1);
          instructionSteps = Number(tokens[0]);
          assert.ok(Number.isSafeInteger(instructionSteps) && instructionSteps >= 0);
        } else if (tag === 'IO') {
          assert.equal(tokens.length, 1);
          ioBytes = Number(tokens[0]);
          assert.ok(Number.isSafeInteger(ioBytes) && ioBytes >= 0);
        } else if (tag === 'R') {
          assert.equal(tokens.length, 4);
          const [address, value, pcAfter] = tokens.slice(0, 3).map((t) => parseInt(t, 16)),
            count = Number(tokens[3]);
          assert.ok(
            [address, value, pcAfter].every(Number.isInteger) &&
              Number.isSafeInteger(count) &&
              count > 0,
          );
          const o = Object.freeze({ kind: 'read', address, value, pcAfter });
          for (let n = 0; n < count; n++) io.push(o);
        } else if (tag === 'T') {
          assert.equal(tokens.length, 1);
          const pc = parseInt(tokens[0], 16);
          assert.ok(Number.isInteger(pc));
          chronology.push({ kind: tag, pc });
        } else if (tag === 'H') {
          assert.equal(tokens.length, 10);
          const pc = parseInt(tokens[0], 16),
            ioCursor = Number(tokens[1]);
          nmiRecords++;
          assert.ok(Number.isInteger(pc) && Number.isSafeInteger(ioCursor) && ioCursor >= 0);
          assert.equal(ioCursor, io.length, 'original NMI/IO recording order');
          const values = tokens.slice(2).map((t) => parseInt(t, 16));
          assert.ok(values.every(Number.isInteger));
          chronology.push({
            kind: tag,
            pc,
            ioCursor,
            context: state([...values.slice(0, 7), pc >>> 16, pc & 65535, values[7]]),
          });
        } else if (tag === 'L') {
          assert.equal(tokens.length, 3);
          const count = Number(tokens[0]),
            pcs = tokens.slice(1).map((t) => parseInt(t, 16));
          assert.ok(Number.isSafeInteger(count) && count > 0);
          assert.ok(
            (pcs[0] === 0x81eecd && pcs[1] === 0x81eed1) ||
              (pcs[0] === 0x81b0a5 && pcs[1] === 0x81b0a9),
            'original counter poll pair',
          );
          chronology.push({ kind: tag, count, pcs });
        } else {
          assert.equal(tokens.length, 3);
          const [address, value, pcAfter] = tokens.map((t) => parseInt(t, 16));
          assert.ok([address, value, pcAfter].every(Number.isInteger));
          io.push({
            kind:
              tag === 'r' ? 'read' : tag === 'd' ? 'dma-write' : tag === 'v' ? 'dma-read' : 'write',
            address,
            value,
            pcAfter,
          });
        }
      } catch (error) {
        damage = error;
      }
    },
    {
      timeoutMs,
      overrides: capturePpu ? BOOT_PPU_OVERRIDES : [],
      keep: () => !damage && announced !== null && announced === received,
    },
  ).finally(() => writeFileSync(log, rawLines.join('\n') + '\n'));
  assert.equal(result.code, 0, 'Mesen boot prefix: ' + result.stderr);
  if (damage) throw damage;
  assert.equal(announced, received, 'incomplete boot recording');
  assert.notEqual(checkpointHits, null, 'missing original checkpoint count');
  if (!stopAfterNativeNmi && stopAfterNativeTarget === null)
    assert.equal(checkpointHits, stopHits, 'original checkpoint occurrence');
  assert.equal(openNatives.length, 0, 'unfinished original native caller');
  if (stopAfterNativeNmi)
    assert.ok(
      nativeCalls.some((o) => o.nmis > 0),
      'original native NMI required',
    );
  if (stopAfterNativeTarget !== null)
    assert.ok(
      nativeCalls.filter((o) => o.start.target === stopAfterNativeTarget).length >=
        stopAfterNativeTargetHits,
      'original native return checkpoint required',
    );
  assert.equal(nmis, chronology.filter((o) => o.kind === 'H').length, 'missing boot NMI');
  for (const s of Object.values(snapshots)) {
    assert.ok(s.context);
    assert.equal(s.wram?.length, 0x20000);
    assert.equal(s.sram?.length, 0x2000);
  }
  assert.equal(snapshots.I.context.pc, 0xe382);
  assert.equal(snapshots.I.context.e, 1);
  assert.equal(snapshots.F.context.programBank * 65536 + snapshots.F.context.pc, checkpoint);
  assert.notEqual(instructionSteps, null, 'missing original instruction count');
  assert.equal(io.length, ioBytes, 'original boot IO count');
  if (video) {
    assert.equal(video.vram?.length, 65536);
    assert.equal(video.cgram?.length, 512);
    assert.equal(video.oam?.length, 544);
    assert.ok(video.rgb);
  }
  return {
    initial: snapshots.I,
    final: snapshots.F,
    io,
    ioBytes,
    nmis,
    chronology,
    instructionSteps,
    checkpoint,
    stopHits: checkpointHits,
    mainCalls,
    nativeCalls,
    video,
    frames,
    ppuWindows,
    recording: { ...result, lines: received, script, log },
  };
}
export function compareBootPrefix(
  recorded,
  { driverRounds = false, opcodeBudget = Infinity, mainBudget = Infinity } = {},
) {
  assert.equal(recorded.io.length, recorded.ioBytes, 'original boot IO count');
  const { initial, final } = recorded,
    mem = new VmMemory(rom, initial.wram.slice(), initial.sram.slice()),
    vm = new ScriptInterpreter(mem);
  vm.setContext(initial.context);
  vm.pc = initial.context.pc;
  const devices = driverRounds ? new ObservedDevices([]) : null;
  if (driverRounds) {
    vm.e = initial.context.e;
    vm.natives = new NativeCalls(vm, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
      devices,
    });
  }
  const a = driverRounds ? vm.natives.accessor : new TaskAccessor(vm);
  a.load();
  Object.assign(a.ctx, initial.context);
  a.trace = [];
  a.devices = devices ?? { write() {} };
  let cursor = 0,
    dmaBytes = 0;
  const writes = [],
    dmaRequests = [],
    dmaRegs = new Uint8Array(0x80);
  const nmis = recorded.chronology.filter((o) => o.kind === 'H');
  let nmiIndex = 0;
  const readWord = a.readWord;
  a.readWord = (address, wrap = 24, ...rest) => {
    // runObservedNmi reads the real vector before its hardware frame. At
    // that exact point enforce IO/NMI interleaving as observed by Mesen.
    if (address === 0xffea && wrap === 16) {
      const observed = nmis[nmiIndex++];
      assert.ok(observed, 'missing original boot NMI');
      assert.equal(cursor, observed.ioCursor, 'original boot NMI/IO order');
      assert.equal(a.ctx.programBank * 65536 + a.ctx.pc, observed.pc, 'original boot NMI resume');
      assert.deepEqual(a.ctx, observed.context, 'original interrupted boot registers');
    }
    return readWord(address, wrap, ...rest);
  };
  // Mesen records PC after the operands: long graphics stores have four
  // bytes, absolute stores three, and the notice's indirect store two.
  // Decode only in this oracle tool; product equations keep their fixed PCs.
  const instructionEnds = new Map();
  const pcAfter = (pc) => {
    if (!instructionEnds.has(pc)) {
      const i = decode(rom, pc, { e: 0, m: 0, x: 0 });
      assert.ok(
        ['abs', 'absx', 'absy', 'long', 'longx', 'di', 'diy', 'dil', 'dily'].includes(i.mode),
        'unproved boot IO instruction',
      );
      instructionEnds.set(pc, i.next);
    }
    return instructionEnds.get(pc);
  };
  // The lifted code's hardware port (anyBank) reaches the register at bank 0; it
  // matches the original's access at its data bank by register (Book I 21.2).
  const expectedByte = (kind, address, value, pc, anyBank = false) => {
    const actual = recorded.io[cursor++];
    assert.ok(actual, 'missing original boot IO');
    if (anyBank && (actual.address & 0xffff) === (address & 0xffff) && !(actual.address & 0x400000))
      address = actual.address;
    try {
      assert.deepEqual({ kind, address, value, pcAfter: pcAfter(pc) }, actual, 'original boot IO');
    } catch (error) {
      Object.assign(error, {
        ioCursor: cursor - 1,
        nativeContext: { ...a.ctx },
        originalWindow: recorded.io.slice(Math.max(0, cursor - 5), cursor + 3),
      });
      throw error;
    }
  };
  const dma = (mask, pc) => {
    const transfers = [];
    for (let channel = 0; channel < 8; channel++)
      if (mask & (1 << channel)) {
        const r = channel * 16,
          dmap = dmaRegs[r],
          bbad = dmaRegs[r + 1],
          bank = dmaRegs[r + 4];
        assert.ok(
          [0, 1, 8, 9, 0x81].includes(dmap),
          'unproved boot DMA mode ' +
            JSON.stringify({ channel, dmap, bbad, pc: pc.toString(16), cursor }),
        );
        const offsets = (dmap & 7) === 0 ? [0] : [0, 1],
          length = dmaRegs[r + 5] | (dmaRegs[r + 6] << 8) || 65536;
        let source = dmaRegs[r + 2] | (dmaRegs[r + 3] << 8);
        const sourceStart = source;
        const reverse = dmap === 0x81;
        if (reverse)
          assert.deepEqual(
            { channel, bbad, bank, source, length, pc },
            { channel: 5, bbad: 0x39, bank: 0x7e, source: 0x2ae0, length: 16, pc: 0x81aa93 },
            'original text DMA command',
          );
        for (let i = 0; i < length; i++) {
          const actual = recorded.io[cursor++];
          assert.ok(actual, 'missing original boot DMA byte');
          if (reverse) {
            assert.equal(actual.kind, 'dma-read');
            assert.equal(actual.address, bank * 65536 + source);
            assert.equal(actual.pcAfter, pcAfter(pc));
          } else
            assert.deepEqual(
              actual,
              {
                kind: 'dma-write',
                address: 0x2100 + bbad + offsets[i % offsets.length],
                value: mem.read8(bank * 65536 + source),
                pcAfter: pcAfter(pc),
              },
              'original boot DMA',
            );
          if (!(dmap & 8)) source = (source + 1) & 65535;
        }
        dmaBytes += length;
        transfers.push({ channel, dmap, bbad, bank, source: sourceStart, bytes: length });
      }
    dmaRequests.push({ pc, mask, transfers });
  };
  // Device accesses pass busRead/busWrite: the original's absolute accesses at the
  // data bank and the lifted code's hardware port at bank 0.
  const read = a.busRead;
  const hardware = (address) => {
    const offset = address & 0xffff;
    return (
      !(address & 0x400000) &&
      ((offset >= 0x2100 && offset <= 0x21ff) || (offset >= 0x4200 && offset <= 0x43ff))
    );
  };
  a.busRead = (address, width, pc, anyBank) => {
    if (!hardware(address)) return read(address, width, pc, anyBank);
    if (driverRounds) {
      const value = read(address, width, pc, anyBank);
      for (let n = 0; n < width; n++)
        expectedByte('read', address + n, (value >>> (n * 8)) & 255, pc, anyBank);
      return value;
    }
    let value = 0;
    for (let i = 0; i < width; i++) {
      const actual = recorded.io[cursor];
      assert.ok(actual, 'missing original boot read');
      expectedByte('read', address + i, actual.value, pc, anyBank);
      value |= actual.value << (i * 8);
    }
    return value;
  };
  const write = a.busWrite;
  a.busWrite = (address, value, width, pc, anyBank) => {
    // The lifted video port (src/video/video-port.mjs) writes without a site; this
    // oracle compares the accesses of original instructions only.
    if (!hardware(address) || pc === undefined) return write(address, value, width, pc, anyBank);
    const offset = address & 0xffff;
    for (let i = 0; i < width; i++) {
      const port = offset + i,
        byte = (value >>> (i * 8)) & 255;
      expectedByte('write', address + i, byte, pc, anyBank);
      if (port >= 0x4300 && port <= 0x437f) dmaRegs[port - 0x4300] = byte;
      if (port === 0x420b && byte) dma(byte, pc);
    }
    writes.push({ pc, address, width, value });
    return write(address, value, width, pc, anyBank);
  };
  const accessBudgets = [];
  const phase = (entry, run) => {
    a.resetAccessBudget(entry);
    try {
      return run();
    } finally {
      accessBudgets.push({ entry, accesses: a.accesses });
    }
  };
  if (!driverRounds)
    phase(initial.context.programBank * 65536 + initial.context.pc, () => runMainReset(a));
  const interrupts = [],
    absences = new Map();
  let pending = null;
  const instruction = (pc) => {
    if (pending !== null) {
      assert.equal(pc, pending, 'NMI outside recorded startup instructions');
      interrupts.push(Object.freeze({ pc, nmi: true }));
      pending = null;
    } else {
      if (!absences.has(pc)) absences.set(pc, Object.freeze({ pc, nmi: false }));
      interrupts.push(absences.get(pc));
    }
  };
  for (const o of recorded.chronology) {
    if (o.kind === 'H') {
      assert.equal(pending, null, 'nested original boot NMI');
      pending = o.pc;
    } else if (o.kind === 'L') {
      for (let i = 0; i < o.count; i++) for (const pc of o.pcs) instruction(pc);
    } else instruction(o.pc);
  }
  assert.equal(pending, null, 'unconsumed original boot NMI');
  assert.equal(interrupts.length, recorded.instructionSteps, 'original boot instruction count');
  // The recorded boot has every instruction of the title (prologue fill, polls at
  // bank 81): it runs the register-level reference (proof/frontend-reference).
  const routines = withFrontendReference(MAIN_STARTUP_ROUTINES),
    stop = Symbol('boot checkpoint');
  const events = {
    interrupts: Object.freeze(interrupts),
    interruptIndex: 0,
    interruptRoutines: routines,
    startupInterrupts: true,
    calls: [],
  };
  routines.set(recorded.checkpoint, () => {
    throw stop;
  });
  let execution = null;
  const startup = () => phase(0x80a133, () => runMainStartup(a, events, routines));
  if (driverRounds) {
    assert.equal(recorded.checkpoint, 0x8096c3, 'original main return checkpoint');
    assert.ok(recorded.mainCalls?.length > 0, 'original main caller records required');
    assert.equal(recorded.mainCalls.length, recorded.stopHits, 'original main call/return count');
    devices.sets = bootObservationSets(recorded, interrupts, routines);
    const driver = new MainLoopDriver(vm, {
      devices,
      routines,
      startRoutines: routines,
      frontendRoutines: routines,
      startupRoutines: routines,
      resetProgramBank: initial.context.programBank,
    });
    let callIndex = 0,
      nativeIndex = 0,
      budgetStops = 0,
      mainBudgetStops = 0;
    const rounds = [];
    const special = vm.natives.callSpecial.bind(vm.natives);
    const player = (point) => {
      if (!point.player) return;
      const { slot } = point.player;
      assert.equal(mem.read16(0x800cc2), slot, 'original player slot');
      assert.deepEqual(
        {
          slot,
          ...Object.fromEntries(
            [
              ['x', 0xe28],
              ['y', 0xe80],
              ['z', 0xed8],
              ['vx', 0xd20],
              ['vy', 0xd78],
              ['vz', 0xdd0],
            ].map(([name, offset]) => [name, mem.read16(0x800000 + offset + slot)]),
          ),
          input: mem.read16(0x8001ca),
        },
        point.player,
        'original player control state',
      );
    };
    vm.natives.callSpecial = (target) => {
      const point = recorded.nativeCalls?.[nativeIndex++];
      assert.ok(point, 'original native caller records required');
      assert.equal(point.start.target, target, 'original native target');
      assert.equal(point.round, callIndex - 1, 'original native main owner');
      assert.equal(cursor, point.start.ioCursor, 'original native caller IO order');
      assert.equal(
        mem.read16Bank0((a.ctx.s + 1) & 65535),
        point.start.returnWord,
        'original native caller return frame',
      );
      assert.equal(a.ctx.pc, target & 65535, 'original native entry');
      player(point.start);
      assert.deepEqual(
        { ...a.ctx, pc: 0xf52f },
        point.start.context,
        'original native caller registers',
      );
      special(target);
      assert.equal(cursor, point.end.ioCursor, 'original native return IO order');
      assert.deepEqual(
        nativeReturnContext(target, a.ctx),
        nativeReturnContext(target, point.end.context),
        'original native return registers',
      );
      player(point.end);
    };
    const call = driver.scheduler.call.bind(driver.scheduler);
    driver.scheduler.call = (entry, budget) => {
      const point = recorded.mainCalls[callIndex++];
      assert.ok(point, 'unexpected native main round');
      assert.equal(entry, 0xc1e3);
      assert.equal(vm.pc, 0x96c0, 'original main JSR position');
      assert.equal(cursor, point.ioCursor, 'original main caller IO order');
      assert.equal(
        vm.mem.read16Bank0((vm.s + 1) & 65535),
        point.returnWord,
        'original main caller return frame',
      );
      // MainLoopDriver has pushed the actual JSR frame; Scheduler.call owns
      // the following transfer to the fixed target C1E3 in program bank 80.
      assert.deepEqual(
        { ...vm.context(), e: vm.e, programBank: 0x80, pc: entry },
        point.context,
        'original main caller registers',
      );
      return call(entry, budget);
    };
    for (let index = 0; index < recorded.mainCalls.length; index++) {
      const beforeNatives = vm.natives.calls;
      let stop = driver.run(opcodeBudget, { mainBudget });
      while (stop === STOP_MAIN_WAIT) {
        mainBudgetStops++;
        stop = driver.resume(opcodeBudget, { mainBudget });
      }
      let opcodes = driver.scheduler.opcodesRun;
      if (stop === STOP_BUDGET) {
        assert.equal(driver.pending, true);
        budgetStops++;
        stop = driver.resume();
        opcodes += driver.scheduler.opcodesRun;
      }
      assert.equal(stop, STOP_RETURNED, 'whole original main task round');
      assert.equal(driver.pending, false);
      rounds.push({ opcodes, nativeCalls: vm.natives.calls - beforeNatives });
    }
    assert.equal(callIndex, recorded.mainCalls.length);
    assert.equal(nativeIndex, recorded.nativeCalls?.length ?? 0);
    assert.equal(devices.index, devices.sets.length);
    a.load();
    a.ctx.e = vm.e;
    execution = {
      rounds,
      roundsCompleted: driver.roundsCompleted,
      opcodes: rounds.reduce((n, r) => n + r.opcodes, 0),
      nativeCalls: vm.natives.calls,
      budgetStops,
      ...(mainBudget === Infinity ? {} : { mainBudgetStops }),
    };
  } else if (recorded.checkpoint === 0x81eebb)
    assert.throws(
      startup,
      (e) =>
        e.reason === 'wait_interrupt_observation_required' &&
        e.pc === 0x81eebb &&
        e.observationIndex === interrupts.length,
    );
  else if (recorded.checkpoint === 0x80a139) assert.equal(startup(), 0xa139);
  else {
    let stopped = false;
    try {
      startup();
      phase(0x80a139, () => runMainOwnerStart(a, events, routines));
      phase(0x809688, () => runMainStart(a, events, routines));
      stopped = a.ctx.programBank * 65536 + a.ctx.pc === recorded.checkpoint;
    } catch (error) {
      if (error !== stop) throw error;
      stopped = true;
    }
    assert.ok(stopped, 'original boot checkpoint not reached');
  }
  if (!driverRounds) finishInterruptObservations(events);
  assert.equal(nmiIndex, recorded.nmis, 'unused original boot NMI');
  assert.equal(cursor, recorded.io.length, 'unused original boot IO');
  assert.deepEqual(a.ctx, final.context, 'original boot registers');
  assert.deepEqual(mem.wram, final.wram, 'original boot WRAM');
  assert.deepEqual(mem.sram, final.sram, 'original boot SRAM');
  return {
    checkpoint: recorded.checkpoint.toString(16),
    wramBytes: mem.wram.length,
    sramBytes: mem.sram.length,
    interruptSteps: interrupts.length,
    ioBytes: cursor - dmaBytes,
    writeInstructions: writes.length,
    dmaBytes,
    dmaRequests,
    nmis: recorded.nmis,
    accessBudgets,
    execution,
    qualification:
      'Original cold reset through the selected checkpoint; real interrupted registers, CPU IO chronology, forward DMA source bytes and original reverse DMA results checked. Driver mode includes actual main/Native caller frames and completed task rounds. Dynamic PPU frames, SPC execution and real-hardware timing are separate contracts.',
  };
}

// Partition by original bridge/RTS records, never by guessed opcode counts or
// memory snapshots. Script-only gaps cannot own hardware or interrupt inputs.
// Nested scheduler calls inside a Native require their own future segments.
export function bootObservationSets(recorded, interrupts, routines) {
  let ioStart = 0,
    stepStart = 0,
    nativeIndex = 0;
  const sets = [],
    calls = recorded.nativeCalls ?? [],
    dmas = bootReadbackObservations(recorded.io);
  const interval = (point, target) => {
    assert.ok(
      Number.isSafeInteger(point.ioCursor) &&
        point.ioCursor >= ioStart &&
        point.ioCursor <= recorded.io.length,
      'original owner IO partition',
    );
    assert.ok(
      Number.isSafeInteger(point.instructionSteps) &&
        point.instructionSteps >= stepStart &&
        point.instructionSteps <= interrupts.length,
      'original owner instruction partition',
    );
    sets.push(
      Object.freeze({
        target,
        io: bootReadObservations(recorded.io.slice(ioStart, point.ioCursor)),
        wait: Object.freeze([]),
        input: Object.freeze([]),
        interrupts: Object.freeze(interrupts.slice(stepStart, point.instructionSteps)),
        interruptRoutines: routines,
        startupInterrupts: true,
        dmaTransfers: Object.freeze(
          dmas
            .filter((o) => o.ioCursor >= ioStart && o.ioCursor < point.ioCursor)
            .map((o) => o.observation),
        ),
      }),
    );
    ioStart = point.ioCursor;
    stepStart = point.instructionSteps;
  };
  for (const [index, point] of recorded.mainCalls.entries()) {
    interval(
      point,
      index === 0
        ? recorded.initial.context.programBank * 65536 + recorded.initial.context.pc
        : 0x8096c3,
    );
    while (nativeIndex < calls.length && calls[nativeIndex].round === index) {
      const call = calls[nativeIndex++];
      assert.equal(call.depth, 0, 'nested native owner partition required');
      assert.equal(call.start.ioCursor, ioStart, 'unowned task-round device input');
      assert.equal(call.start.instructionSteps, stepStart, 'unowned task-round interrupt input');
      assert.ok(call.end, 'original native return required');
      interval(call.end, call.start.target);
    }
  }
  assert.equal(nativeIndex, calls.length, 'original native main owner required');
  assert.equal(ioStart, recorded.io.length, 'unrecorded task-round device input');
  assert.equal(stepStart, interrupts.length, 'unrecorded task-round interrupt input');
  return Object.freeze(sets);
}

// Retained hardware registers come from the same original chronological bus
// writes. Each reverse transfer contributes its sixteen result bytes observed
// at AA98 immediately after DMA/REP, never a later checkpoint snapshot or
// invented PPU contents. No CPU memory writer intervenes before this record.
export function bootReadbackObservations(rows) {
  const regs = new Map(),
    out = [];
  for (let index = 0; index < rows.length; index++) {
    const o = rows[index],
      port = o.address & 65535;
    if (o.kind === 'dma-read') assert.fail('reverse DMA without original command');
    if (o.kind !== 'write') continue;
    regs.set(port, o.value);
    if (port !== 0x420b || !(o.value & 0x20) || regs.get(0x4350) !== 0x81) continue;
    assert.ok(
      o.address >= 0 && o.address <= 0xbfffff && !((o.address >>> 16) & 0x40),
      'original DMA hardware bank',
    );
    const word = (at) => {
      assert.ok(regs.has(at) && regs.has(at + 1), 'missing original DMA registers');
      return regs.get(at) | (regs.get(at + 1) << 8);
    };
    const header = {
      pc: 0x81aa93,
      address: o.address,
      width: 1,
      value: o.value,
      dmap: regs.get(0x4350),
      bbad: regs.get(0x4351),
      a1b: regs.get(0x4354),
      a1t: word(0x4352),
      das: word(0x4355),
      vmain: regs.get(0x2115),
      vmadd: word(0x2116),
    };
    assert.deepEqual(
      { ...header, vmadd: 0, address: 0x420b },
      {
        pc: 0x81aa93,
        address: 0x420b,
        width: 1,
        value: 0x20,
        dmap: 0x81,
        bbad: 0x39,
        a1b: 0x7e,
        a1t: 0x2ae0,
        das: 16,
        vmain: 0x80,
        vmadd: 0,
      },
      'original text DMA registers',
    );
    assert.equal(o.pcAfter, 0x81aa96, 'original text DMA trigger');
    const ioCursor = index,
      bytes = [];
    for (let n = 0; n < 16; n++) {
      const byte = rows[++index];
      assert.ok(byte, 'missing original reverse DMA byte');
      assert.equal(byte.kind, 'dma-read');
      assert.equal(byte.address, 0x7e2ae0 + n, 'original reverse DMA destination');
      assert.equal(byte.pcAfter, o.pcAfter);
      assert.ok(Number.isInteger(byte.value) && byte.value >= 0 && byte.value < 256);
      bytes.push(byte.value);
    }
    out.push(
      Object.freeze({
        ioCursor,
        observation: Object.freeze({ ...header, bytes: Object.freeze(bytes) }),
      }),
    );
  }
  return Object.freeze(out);
}

// Recorder bus bytes become the driver's strict read observations. All reached
// input instructions in this bounded path are pinned three-byte absolute
// reads. Arithmetic reads are computed by VmMemory and still compared on the
// global bus above. Two adjacent bytes belong to one original WORD read.
function bootReadObservations(rows) {
  const out = [];
  for (let n = 0; n < rows.length; n++) {
    const o = rows[n];
    if (o.kind !== 'read' || isArithmeticRegister(o.address, false)) continue;
    const pc = o.pcAfter - 3,
      i = decode(rom, pc, { e: 0, m: 0, x: 0 });
    assert.equal(i.next, o.pcAfter);
    assert.ok(
      ['abs', 'absx', 'absy'].includes(i.mode),
      'original absolute input instruction required',
    );
    assert.ok(
      ['LDA', 'CMP', 'INC'].includes(i.mnemonic) ||
        (i.mnemonic === 'EOR' && i.mode === 'abs' && [0x213c, 0x213d].includes(i.value)),
      'original input operation required',
    );
    const next = rows[n + 1];
    let value = o.value,
      width = 1;
    if (next?.kind === 'read' && next.pcAfter === o.pcAfter && next.address === o.address + 1) {
      width = 2;
      value |= next.value << 8;
      n++;
    }
    out.push(Object.freeze({ pc, address: o.address, width, value }));
  }
  return Object.freeze(out);
}
