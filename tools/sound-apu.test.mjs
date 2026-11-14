import test from 'node:test';
import assert from 'node:assert/strict';
import { Apu, DRIVER_LENGTH, DRIVER_FNV, fnv1a } from '../src/apu/apu.mjs';
import { Dsp, GAUSS } from '../src/apu/dsp.mjs';
import { SpcIo } from '../src/apu/spc-io.mjs';
import { SoundDriver, spcDivide, WAIT_PORT, IDLE } from '../src/apu/sound-driver.mjs';
import { Spc700Reference } from './spc700-reference.mjs';
import { decodeDriver, driverBytes } from './sound-driver-source.mjs';
import { roomSchedule, syntheticSchedule, runSchedule } from './sound-apu-schedule.mjs';
import { findMesen } from './mesen.mjs';
import { recordLiveRoom } from './mesen-live-room.mjs';
import {
  recordSpcDriver,
  ObservedSpcIo,
  observedEvents,
  READ,
  WRITE,
  GLOBAL_FIELDS,
} from './mesen-spc-driver.mjs';
import { rom } from './task-native-dialog-harness.mjs';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { ObservedRoom } from '../proof/video/room-observed.mjs';
import { SampleQueue } from '../src/browser/sample-queue.mjs';

const bytes = driverBytes(Buffer.from(rom));

// Book I sound part, chapter 5 (PDF 164-166): 8 kHz clock, timer register 0 = 256,
// only ST 0->1 clears the counters, reading CN clears only the 4-bit counter.
// Chapter 4 (PDF 162): PC10/PC32 clear the input ports.
test('SPC timers, counters and port clear follow the manual', () => {
  const io = new SpcIo(new Dsp(new Uint8Array(65536)));
  io.write(0xfa, 0);
  io.write(0xfb, 3);
  io.write(0xf1, 0x03);
  for (let n = 0; n < 256; n++) io.clock8k();
  assert.equal(io.read(0xfd, 0), 1);
  assert.equal(io.read(0xfd, 0), 0);
  assert.equal(io.read(0xfe, 0), 85 & 15); // 255 pulses of 3 clocks; the 4-bit counter overflows
  // The T1 stage stands at 1 after 256 clocks (256 mod 3).
  io.write(0xf1, 0x03);
  for (let n = 0; n < 2; n++) io.clock8k();
  assert.equal(io.read(0xfe, 0), 1, 'writing ST=1 again keeps the stage');
  io.write(0xf1, 0x01);
  io.write(0xf1, 0x03);
  for (let n = 0; n < 2; n++) io.clock8k();
  assert.equal(io.read(0xfe, 0), 0, '0 -> 1 restarts the stage');
  io.clock8k();
  assert.equal(io.read(0xfe, 0), 1);
  io.cpuWrite(0, 1);
  io.cpuWrite(3, 4);
  io.write(0xf1, 0x10);
  assert.deepEqual([...io.cpuIn], [0, 0, 0, 4]);
  io.write(0xf1, 0x20);
  assert.deepEqual([...io.cpuIn], [0, 0, 0, 0]);
  assert.throws(
    () => io.read(0xf1, 0x1234),
    (e) => e.reason === 'spc_io_read_unsupported',
  );
  assert.deepEqual(spcDivide(0x0960, 10), { a: 0xf0, y: 0 });
});

// Attack times of table 3-7-2 (Book I PDF 170) and release 8 ms (PDF 174) from
// the counter sequence of the model: the time from 0 to 1 after key on. With
// steps of 1/64 the chip already switches to decay at the first computed
// overflow; the visible envelope then ends at $7E0 (63 steps).
test('DSP attack and release times reproduce the manual tables', () => {
  const manual = [4100, 2600, 1500, 1000, 640, 380, 260, 160, 96, 64, 40, 24, 16, 10, 6, 0];
  for (let ar = 0; ar < 16; ar++) {
    const dsp = new Dsp(new Uint8Array(65536));
    dsp.write(0x6c, 0x20);
    dsp.write(0x05, 0x80 | ar);
    dsp.write(0x06, 0xe0);
    dsp.write(0x4c, 1);
    let samples = 0;
    for (; samples < 200000 && dsp.voices[0].env < 0x7e0; samples++) dsp.sample();
    const ms = samples / 32;
    assert.ok(
      Math.abs(ms - manual[ar]) <= Math.max(1, manual[ar] * 0.05),
      `AR ${ar}: ${ms} ms, manual ${manual[ar]} ms`,
    );
  }
  const dsp = new Dsp(new Uint8Array(65536));
  dsp.write(0x6c, 0x20);
  dsp.write(0x05, 0x8f);
  dsp.write(0x06, 0xe0);
  dsp.write(0x4c, 1);
  for (let n = 0; n < 64; n++) dsp.sample();
  assert.equal(dsp.voices[0].env, 0x7ff);
  dsp.write(0x5c, 1);
  let samples = 0;
  for (; dsp.voices[0].env; samples++) dsp.sample();
  assert.ok(Math.abs(samples / 32 - 8) < 0.2, `release ${samples / 32} ms`);
});

// Sound output by the formulas of the manual (Book I chapter 7) with a source of
// two BRR blocks (directory PDF 178, block format PDF 179): voice 0 with direct
// GAIN, main volume full, echo writes off.
const source = ({ range = 12, nybble = 1, voices = 1, regs = {} } = {}) => {
  const ram = new Uint8Array(65536),
    dsp = new Dsp(ram);
  ram.set([0x00, 0x03, 0x00, 0x03], 0x0200); // DIR 02: source 0 start and loop $0300
  const data = nybble * 0x11;
  ram.set([range << 4, ...Array(8).fill(data), (range << 4) | 3, ...Array(8).fill(data)], 0x0300);
  const set = { 0x6c: 0x20, 0x0c: 0x7f, 0x1c: 0x7f, 0x5d: 0x02, ...regs };
  for (let v = 0; v < voices; v++)
    Object.assign(set, {
      [v << 4]: 0x7f,
      [(v << 4) | 1]: 0x7f,
      [(v << 4) | 3]: 0x10,
      [(v << 4) | 7]: 0x7f,
      ...regs,
    });
  for (const [r, value] of Object.entries(set)) dsp.write(Number(r), value);
  dsp.out = new Int16Array(2 * 32000);
  return dsp;
};
const keyOn = (dsp, bits = 1, samples = 3200) => {
  dsp.write(0x4c, bits);
  for (let n = 0; n < samples; n++) dsp.sample();
  return dsp;
};
const loops = (dsp, samples) => {
  let n = 0;
  for (let k = 0; k < samples; k++) {
    dsp.sample();
    if (dsp.regs[0x7c] & 1) {
      n++;
      dsp.write(0x7c, 0);
    }
  }
  return n;
};
test('DSP output follows the manual: volume sign, mute, OUTX, pitch, PMON, noise clock and echo delay', () => {
  // PDF 169: VOL in two's complement, negative inverts the phase; OUTX (PDF 168)
  // is the value after the envelope and before VOL.
  const left = (vol) => {
    const d = keyOn(source({ regs: { 0x00: vol, 0x01: vol } }));
    return { d, l: d.out[d.outCount - 2], outx: d.regs[0x09] };
  };
  const plus = left(0x7f),
    minus = left(0x81),
    soft = left(0x20);
  assert.ok(plus.l > 3000 && Math.abs(plus.l + minus.l) <= 2, JSON.stringify([plus.l, minus.l]));
  assert.ok(plus.outx > 0 && plus.outx === minus.outx && plus.outx === soft.outx);
  // PDF 175: MUTE silences all voices.
  const muted = keyOn(source({ regs: { 0x6c: 0x60 } }));
  assert.ok(muted.out.subarray(0, muted.outCount).every((v) => v === 0) && muted.regs[0x09] !== 0);
  // PDF 169: P = 1000H gives the original rate (one value per Ts), 2000H an octave higher.
  const rate = (p) => loops(keyOn(source({ regs: { 0x02: p & 255, 0x03: p >> 8 } }), 1, 64), 3200);
  [
    [0x0800, 50],
    [0x1000, 100],
    [0x2000, 200],
  ].forEach(([p, n]) => assert.ok(Math.abs(rate(p) - n) <= 1, `P ${p.toString(16)}: ${rate(p)}`));
  // PDF 174: PMON, voice 1 modulated by OUTX of voice 0: P' = P(1 + y0).
  const pmon = (on) => {
    const d = keyOn(source({ range: 11, nybble: 7, voices: 2, regs: { 0x2d: on ? 2 : 0 } }), 3, 64);
    d.write(0x7c, 0);
    let n = 0;
    for (let k = 0; k < 6400; k++) {
      d.sample();
      if (d.regs[0x7c] & 2) {
        n++;
        d.write(0x7c, 0);
      }
    }
    return { n, y0: (((d.regs[0x09] << 24) >> 24) * 256) / 32768 };
  };
  const plain = pmon(false),
    modulated = pmon(true);
  assert.ok(
    Math.abs(modulated.n / plain.n - (1 + modulated.y0)) < 0.02,
    JSON.stringify({ plain, modulated }),
  );
  // Table 3-7-4 (PDF 175): noise clock NCK in Hz, measured over one second.
  const table = [
    0, 16, 21, 25, 31, 42, 50, 63, 83, 100, 125, 167, 200, 250, 333, 400, 500, 667, 800, 1000, 1300,
    1600, 2000, 2700, 3200, 4000, 5300, 6400, 8000, 10700, 16000, 32000,
  ];
  for (let nck = 0; nck < 32; nck++) {
    const d = new Dsp(new Uint8Array(65536));
    d.write(0x6c, nck);
    let changes = 0;
    for (let n = 0; n < 32000; n++) {
      const before = d.noise;
      d.sample();
      if (d.noise !== before) changes++;
    }
    assert.ok(
      Math.abs(changes - table[nck]) <= Math.max(1, table[nck] * 0.03),
      `NCK ${nck}: ${changes} Hz`,
    );
  }
  // PDF 176: EDL in steps of 16 ms (512 Ts) and 2 KB, EDL = 0 needs 4 bytes.
  // The tap C0 = 7F, as in the game, lies seven Ts behind the newest value.
  const first = (regs) => {
    const d = keyOn(source({ regs: { 0x4d: 1, 0x6d: 0x40, 0x0f: 0x7f, ...regs } }), 1, 4000);
    return Array.from(d.out.subarray(0, d.outCount)).findIndex((v) => v !== 0) >> 1;
  };
  const direct = first({});
  for (const edl of [0, 1, 3]) {
    const delay =
      first({ 0x0c: 0, 0x1c: 0, 0x2c: 0x7f, 0x3c: 0x7f, 0x6c: 0x00, 0x7d: edl }) - direct;
    assert.equal(delay, Math.max(1, edl * 512) + 7, `EDL ${edl}`);
  }
});

// Echo coupling of the infinitely fast driver: an FLG that enables echo writes
// waits until the DSP has taken over the last written echo length (echo offset 0)
// and takes the following FLG/ESA/EDL values along in order. The driver moves the
// echo in one instant from 8 KB at $8E00 to 4 KB at $E800; the DSP never writes
// outside the area in force.
test('echo register writes of one instant wait for the DSP to take over the echo length', () => {
  const apu = new Apu(),
    dsp = apu.dsp,
    ram = apu.ram;
  for (const [r, v] of [
    [0x6d, 0x8e],
    [0x7d, 4],
    [0x6c, 0x07],
  ])
    dsp.write(r, v);
  assert.equal(dsp.regs[0x6c], 0xe0, 'FLG waits for the echo length');
  apu.advance(2);
  assert.deepEqual([dsp.regs[0x6c], dsp.echoLength], [0x07, 0x2000]);
  apu.advance(1000);
  ram.fill(0x55, 0, 0xe800);
  ram.fill(0x55, 0xf800);
  for (const [r, v] of [
    [0x6c, 0xff],
    [0x7d, 0],
    [0x6d, 0xff],
    [0x6d, 0xe8],
    [0x7d, 2],
    [0x6c, 0x07],
  ])
    dsp.write(r, v);
  assert.deepEqual([dsp.regs[0x6c], dsp.regs[0x6d], dsp.regs[0x7d]], [0xff, 0xe8, 2]);
  let held = 0;
  while (dsp.regs[0x6c] !== 0x07) {
    apu.advance(1);
    held++;
  }
  assert.ok(
    held > 900 && held <= 1048 && dsp.echoLength === 0x1000 && dsp.echoOffset <= 4,
    JSON.stringify({ held, offset: dsp.echoOffset }),
  );
  apu.advance(2000);
  assert.ok(
    ram.subarray(0, 0xe800).every((v) => v === 0x55) &&
      ram.subarray(0xf800).every((v) => v === 0x55),
    'echo stays inside $E800-$F7FF',
  );
});

// The native driver against the original instructions (reference interpreter): the
// whole CPU port traffic of the room run from power-on (IPL transfer, all uploads,
// commands) and a fixed sequence for all other commands and song events. Compared
// are every I/O write, the ports and the whole ARAM except the stack. Only INC
// $05/BRA at $04C5/$04C7 stay unreached: Y runs in $04AC from $8D 94 steps to $EA
// and never becomes zero.
test('the native sound driver equals the original instructions', () => {
  let ref;
  const outx = function (a) {
    return (a & 15) === 9 ? ((a >> 4) * 0x23 + this.clocks) & 255 : this.regs[a];
  };
  const native = new Apu(),
    reference = new Apu({ driver: (ram, io) => (ref = new Spc700Reference(ram, io, 0x0200)) });
  native.dsp.read = outx;
  reference.dsp.read = outx;
  native.io.writeLog = [];
  reference.io.writeLog = [];
  const compare = (label) => {
    assert.deepEqual(native.io.writeLog, reference.io.writeLog, 'I/O writes ' + label);
    native.io.writeLog = [];
    reference.io.writeLog = [];
    assert.deepEqual([...native.io.spcOut], [...reference.io.spcOut], 'ports ' + label);
    for (let a = 0; a < 0x10000; a++)
      if (a < 0x01e0 || a >= 0x01f0)
        if (native.ram[a] !== reference.ram[a]) assert.fail(`ARAM ${a.toString(16)} ${label}`);
  };
  const room = roomSchedule(rom),
    synthetic = syntheticSchedule(Buffer.from(rom));
  for (let k = 0; k < room.length; k += 2000) {
    runSchedule([native, reference], room.slice(k, k + 2000));
    compare('room ' + k);
  }
  assert.equal(room.filter((e) => e[0] === 'f').length, 2273);
  for (let k = 0; k < synthetic.length; k += 500) {
    runSchedule([native, reference], synthetic.slice(k, k + 500));
    compare('synthetic ' + k);
  }
  assert.equal(native.state, 'ipl');
  assert.equal(reference.state, 'ipl');
  assert.deepEqual([...native.io.spcOut.subarray(0, 2)], [0xaa, 0xbb]);
  const missing = decodeDriver(bytes)
    .instructions.filter((d) => !ref.coverage.has(d.pc))
    .map((d) => d.pc);
  assert.deepEqual(missing, [0x04c5, 0x04c7]);
  assert.ok(ref.minSp >= 0xe0, 'stack stays inside the guarded $01E0-$01EF');
});

// Boundaries of the native driver: unknown command, writes into code still running
// or into the stack, stack reads with an invalid voice, a foreign program.
test('native driver boundaries are named, not guessed', () => {
  const boot = () => {
    const ram = new Uint8Array(65536);
    ram.set(bytes, 0x0200);
    const io = new SpcIo(new Dsp(ram)),
      driver = new SoundDriver(ram, io),
      run = driver.run();
    assert.equal(run.next().value, IDLE);
    return { ram, io, driver, run };
  };
  const send = (s, command, param = 0) => {
    s.io.cpuWrite(2, param & 255);
    s.io.cpuWrite(3, param >> 8);
    s.io.cpuWrite(1, command);
    s.io.cpuWrite(0, (s.io.cpuIn[0] + 1) & 255);
    return s.run.next();
  };
  assert.throws(
    () => send(boot(), 0x1a),
    (e) => e.reason === 'sound_driver_command_unknown',
  );
  const s = boot();
  assert.equal(send(s, 0x10, 2).value, WAIT_PORT);
  s.io.cpuWrite(1, 0x00);
  s.io.cpuWrite(2, 0x03);
  s.io.cpuWrite(0, (s.io.cpuIn[0] + 1) & 255);
  s.run.next();
  s.io.cpuWrite(1, 0xea);
  s.io.cpuWrite(2, 0xea);
  s.io.cpuWrite(0, (s.io.cpuIn[0] + 1) & 255);
  assert.throws(
    () => s.run.next(),
    (e) => e.reason === 'sound_driver_code_write' && e.address === 0x0300,
  );
  assert.throws(
    () => boot().driver.put(0x01e8, 0),
    (e) => e.reason === 'sound_driver_stack_write',
  );
  assert.throws(
    () => boot().driver.get(0x01ef),
    (e) => e.reason === 'sound_driver_stack_read',
  );
  assert.equal(fnv1a(bytes), DRIVER_FNV);
  assert.equal(bytes.length, DRIVER_LENGTH);
  // IPL (Book I appendix D): one block with one byte at $0200, then start at $0200.
  const apu = new Apu();
  assert.deepEqual([apu.cpuRead(0), apu.cpuRead(1)], [0xaa, 0xbb]);
  apu.cpuWrite(2, 0x0200, 2);
  apu.cpuWrite(1, 1);
  apu.cpuWrite(0, 0xcc);
  assert.equal(apu.cpuRead(0), 0xcc);
  apu.cpuWrite(1, 0xc0);
  apu.cpuWrite(0, 0);
  assert.equal(apu.cpuRead(0), 0);
  assert.equal(apu.ram[0x0200], 0xc0);
  apu.cpuWrite(2, 0x0200, 2);
  apu.cpuWrite(1, 0);
  assert.throws(
    () => apu.cpuWrite(0, 2),
    (e) => e.reason === 'apu_program_unknown',
  );
});

// Coupling of the infinitely fast driver: a second KON/KOF value in the same
// instant waits until the first is taken over (every second Ts).
test('KON/KOF writes of one instant take effect one latch after another', () => {
  const apu = new Apu(),
    dsp = apu.dsp;
  dsp.write(0x5c, 0x01);
  dsp.write(0x5c, 0x00);
  dsp.write(0x5c, 0x02);
  assert.equal(dsp.regs[0x5c], 0x01);
  const seen = [];
  for (let n = 0; n < 8; n++) {
    apu.advance(1);
    seen.push(dsp.regs[0x5c]);
  }
  assert.deepEqual([...new Set(seen)], [0x01, 0x00, 0x02]);
  // Note end as at $07A3/$027A/$0282: several KOF, then KOF=0 and KON in one
  // instant. KON does not overtake the earlier KOF and is taken over with KOF=0.
  const unit = new Apu(),
    d = unit.dsp,
    latched = [];
  for (const [r, v] of [
    [0x5c, 0x80],
    [0x5c, 0x01],
    [0x5c, 0x04],
    [0x5c, 0x00],
    [0x4c, 0x85],
  ])
    d.write(r, v);
  assert.deepEqual([d.regs[0x5c], d.regs[0x4c]], [0x80, 0x00]);
  for (let n = 0; n < 12; n++) {
    const before = d.latches;
    unit.advance(1);
    if (d.latches !== before) latched.push([d.koff, d.kon]);
  }
  assert.deepEqual(latched.slice(0, 4), [
    [0x80, 0],
    [0x01, 0],
    [0x04, 0],
    [0x00, 0x85],
  ]);
});

// The audio unit runs along in the room replay: it receives the CPU's port writes
// and one frame per NMI (2273). Every observed handshake read of port 0/1 is
// either already the native answer or still the value before the last write (the
// original had not answered yet); the last read of each handshake is the native
// answer (101 commands at F00E, 40,950 pairs at F046, 3157 IPL bytes at F001).
// Port 2 at E1B6/E510 (waiting for the music beat $8D) is bound to driver time and
// remains a boundary of the lag-free model. In live mode the unit answers the
// ports: Y opens the item list, command 02 is accepted and acknowledged; per frame
// it outputs 640 sample pairs.
test('the room replay drives the native audio unit and live mode answers the APU ports', () => {
  const bundle = JSON.parse(
    gunzipSync(readFileSync(new URL('../assets/room-observations.json.gz', import.meta.url))),
  );
  const room = new ObservedRoom(rom, bundle),
    a = room.vm.natives.accessor,
    busRead = a.busRead,
    before = [0, 0, 0, 0],
    stats = {};
  const write = room.apu.cpuWrite.bind(room.apu);
  room.apu.cpuWrite = (port, value, width) => {
    for (let n = 0; n < width; n++) before[(port + n) & 3] = room.apu.cpuRead(port + n);
    write(port, value, width);
  };
  // Every port read passes busRead: the original's absolute reads (80:2140) and the
  // lifted code's (src/apu, 00:2140).
  a.busRead = (address, width, pc, anyBank) => {
    const value = busRead(address, width, pc, anyBank),
      offset = address & 0xffff;
    if (offset >= 0x2140 && offset <= 0x2143 && !(address & 0x400000) && !room.liveFrames) {
      const port = offset - 0x2140,
        now = room.apu.cpuRead(port);
      const key =
        pc.toString(16) +
        ':' +
        port +
        ':' +
        (value === now ? 'native' : value === before[port] ? 'pending' : 'other');
      stats[key] = (stats[key] ?? 0) + 1;
    }
    return value;
  };
  room.finish();
  assert.equal(room.apu.dsp.clocks, 2273 * 640 * 32);
  assert.equal(room.apu.state, 'driver');
  assert.equal(room.apu.cpuRead(0), room.memory.read8(0x7e1ce4));
  assert.deepEqual(
    Object.fromEntries(Object.entries(stats).filter(([k]) => k.endsWith('native'))),
    {
      '81efaa:0:native': 1,
      '81efb1:1:native': 1,
      '81efb8:1:native': 1,
      '81efed:1:native': 1,
      '81f001:0:native': 3158,
      '81f00e:0:native': 101,
      '81f046:0:native': 40950,
    },
  );
  assert.deepEqual(
    Object.keys(stats)
      .filter((k) => k.endsWith('other'))
      .sort(),
    ['81e1b6:2:other', '81e510:2:other'],
  );
  const commands = [],
    live = room.apu.cpuWrite.bind(room.apu);
  room.apu.cpuWrite = (port, value, width) => {
    if (port === 0) commands.push(room.apu.io.cpuIn[1]);
    live(port, value, width);
  };
  const pads = [...Array(20).fill(0), ...Array(6).fill(0x4000)];
  const frames = room.live({ pad: (k) => pads[k] ?? 0 });
  // One live step can run many lag-free frames in the item list (about 90 with the
  // lifted game NMI), so the buffer holds more than the frames the loop waits for.
  room.apu.enableOutput(400);
  let stop = null;
  try {
    while (frames.nmis < 120) room.stepLive({ mainBudget: 4096, opcodeBudget: 4096 });
  } catch (error) {
    stop = error;
  }
  assert.deepEqual(commands, [0x02]);
  // Sound output: 640 L/R pairs per lag-free frame; the room music is audible.
  const audio = room.apu.takeOutput();
  assert.equal(audio.length, frames.nmis * 1280);
  assert.ok(audio.filter((v) => v !== 0).length > audio.length / 2);
  assert.equal(room.apu.cpuRead(0), room.memory.read8(0x7e1ce4));
  assert.equal(room.apu.dsp.clocks, (2273 + frames.nmis) * 640 * 32);
  // The item list with its HDMA window runs on without a boundary.
  assert.equal(stop, null);
});

// Queue of the AudioWorklet: it starts playing only from the prebuffer, in order,
// fills gaps with silence and then prebuffers again; above the limit the oldest
// blocks are dropped.
test('the browser sample queue prebuffers, keeps order, fills gaps with silence and drops the oldest', () => {
  const q = new SampleQueue({ prebuffer: 4, limit: 8, declick: false, maxPrebuffer: 4 }),
    l = new Float32Array(3),
    r = new Float32Array(3);
  const pairs = (...v) => Int16Array.from(v.flatMap((x) => [x, -x]));
  q.push(pairs(1, 2));
  q.fill(l, r);
  assert.deepEqual([...l], [0, 0, 0], 'waits for the prebuffer');
  q.push(pairs(3, 4));
  q.fill(l, r);
  assert.deepEqual(
    [...l].map((x) => x * 32768),
    [1, 2, 3],
  );
  assert.deepEqual(
    [...r].map((x) => x * 32768),
    [-1, -2, -3],
  );
  q.fill(l, r);
  assert.deepEqual(
    [...l].map((x) => x * 32768),
    [4, 0, 0],
    'silence when empty',
  );
  q.push(pairs(5, 6, 7));
  q.fill(l, r);
  assert.deepEqual([...l], [0, 0, 0], 'prebuffers again');
  for (let k = 0; k < 3; k++) q.push(pairs(10 + 2 * k, 11 + 2 * k));
  assert.deepEqual([q.queued, q.dropped], [6, 3]);
  q.fill(l, r);
  assert.deepEqual(
    [...l].map((x) => x * 32768),
    [10, 11, 12],
  );
  assert.deepEqual([q.played, q.silent], [7, 8]);
});

const { exe, reason } = findMesen();

// Live mode against Mesen (input plan of the room recording, then pad 0 per NMI,
// 300 live rounds): every voice is keyed on equally often, at the first live NMI
// the same voices sound, and every voice sounds in almost as many NMIs (lag
// frames of the original shift the count). Before the coupling in write order,
// later KOF switched off freshly keyed voices.
test(
  'the live room keeps the voices of the original in Mesen',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const original = await recordLiveRoom(exe, [0], 300, { sound: true });
    const bundle = JSON.parse(
      gunzipSync(readFileSync(new URL('../assets/room-observations.json.gz', import.meta.url))),
    );
    const room = new ObservedRoom(rom, bundle).finish(),
      env = [],
      keys = [];
    const frames = room.live({
      pad: () => 0,
      onFrame: (f) => {
        env[f.nmi] = room.apu.dsp.voices.map((v) => v.env);
      },
    });
    const write = room.apu.dsp.write.bind(room.apu.dsp);
    room.apu.dsp.write = (r, v) => {
      if (r === 0x4c) keys.push({ register: r, value: v });
      write(r, v);
    };
    const nmis = original.env.length;
    while (frames.nmis < nmis) room.stepLive();
    const keyOns = (list) =>
      Array.from(
        { length: 8 },
        (_, n) => list.filter((k) => k.register === 0x4c && (k.value >> n) & 1).length,
      );
    const sounding = (list) =>
      Array.from({ length: 8 }, (_, n) => list.slice(0, nmis).filter((e) => e[n] > 0).length);
    assert.ok(nmis > 290 && keyOns(original.keys).reduce((a, b) => a + b) > 20);
    assert.deepEqual(keyOns(keys), keyOns(original.keys), 'key-ons per voice');
    assert.deepEqual(
      env[0].map((e) => e > 0),
      original.env[0].map((e) => e > 0),
      'voices at the first live NMI',
    );
    const a = sounding(original.env),
      b = sounding(env);
    a.forEach((count, n) =>
      assert.ok(Math.abs(count - b[n]) <= nmis * 0.05, `voice ${n}: ${b[n]} / ${count} NMIs`),
    );
  },
);
let recording = null;
const record = async () => (recording ??= await recordSpcDriver(exe, { frames: 2400, snap: 200 }));
const exactApu = (events, order, options) =>
  new Apu({ dsp: (ram) => new Dsp(ram), io: (dsp) => new options.Io(dsp, events, order, options) });

// Mesen from power-on (2400 frames, input plan of the room run): the native driver
// with its IPL consumes all informative reads of the original in the same order
// with the same instruction addresses, every write to $F0-$FF is equal, and at
// every snapshot ARAM and the DSP registers match. Not compared: the stack, the
// RAM under $F0-$FF and the echo buffer ESA..ESA+EDL*2K, which the DSP writes
// itself with FLG bit 5 = 0 (echo follows with the sound output).
test(
  'native driver and IPL reproduce every SPC access of the original in Mesen',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { events, snapshots } = await record();
    const order = observedEvents(events, bytes);
    let apu,
      checked = 0,
      echoBytes = 0;
    const onSnapshot = (k) => {
      const s = snapshots[k],
        esa = s.dsp[0x6d] << 8,
        end = esa + (s.dsp[0x7d] & 15 ? (s.dsp[0x7d] & 15) * 2048 : 4);
      for (let a = 0; a < 0x10000; a++) {
        if ((a >= 0x01e0 && a < 0x01f0) || (a >= 0xf0 && a < 0x100)) continue;
        if (a >= esa && a < end) {
          echoBytes++;
          continue;
        }
        if (apu.ram[a] !== s.aram[a])
          assert.fail(`ARAM ${a.toString(16)} at frame ${s.frame}: ${apu.ram[a]} / ${s.aram[a]}`);
      }
      for (let r = 0; r < 128; r++)
        if (((r & 15) < 8 || (r & 15) > 9) && r !== 0x7c)
          assert.equal(apu.dsp.regs[r], s.dsp[r], `DSP ${r.toString(16)} at frame ${s.frame}`);
      checked++;
    };
    apu = exactApu(events, order, { Io: ObservedSpcIo, onSnapshot });
    for (let stuck = 0; !apu.io.done;) {
      const at = apu.io.at;
      apu.resume();
      stuck = apu.io.at === at ? stuck + 1 : 0;
      assert.ok(stuck < 3, 'stuck at ' + apu.io.describe(apu.io.peek()));
    }
    assert.equal(checked, snapshots.length);
    assert.ok(snapshots.length >= 11 && echoBytes > 0);
    assert.ok(
      apu.io.reads > 200000 && apu.io.writes > 60000,
      JSON.stringify({ reads: apu.io.reads, writes: apu.io.writes }),
    );
  },
);

// The same with the exact DSP model at the original clock: before every access of
// the original to $F0-$FF the model runs up to Mesen cycle / 2 (64 cycles per Ts,
// counter and half clock from power-on). Compared are every DSP read (ENVX, ENDX,
// others), at the end of every frame the whole inner state (per voice the
// envelope, BRR address and offset, the twelve decoded values, the interpolation
// position; shared the counter, noise, echo history and pointers, FIR sums, main
// and echo output, all intermediate values of the phases) and at every snapshot
// the whole ARAM with the echo buffer and all 128 DSP registers including ENVX,
// OUTX, ENDX. Timing boundary: during uploads (loop $0663-$0680) the native driver
// writes the second byte already at the port read, the original only at $067A. If
// the DSP reads exactly this byte in that time as BRR header, BRR byte or
// directory entry, only these shared intermediate values differ (frame end at
// most 32 cycles after a read of the loop); every voice stays equal.
const innerFields = (d) => ({
  outSamples0: d.mainOut[0],
  outSamples1: d.mainOut[1],
  echoIn0: d.echoIn[0],
  echoIn1: d.echoIn[1],
  echoOut0: d.echoOut[0],
  echoOut1: d.echoOut[1],
  echoHistoryPos: d.historyPos,
  echoOffset: d.echoOffset,
  echoLength: d.echoLength,
  echoPointer: d.echoPointer,
  echoRingBufferAddress: d.esa,
  noiseLfsr: d.noise,
  voiceOutput: d.output,
  outRegBuffer: d.outxBuf,
  envRegBuffer: d.envxBuf,
  voiceEndBuffer: d.endxBuf,
  looped: d.looped,
  pitch: d.pitch,
  brrData: d.brrByte,
  brrHeader: d.header,
  brrNextAddress: d.next,
  sourceNumber: d.srcn,
  sampleAddress: d.dirAddress,
  dirSampleTableAddress: d.dir,
  echoOn: d.eon,
  noiseOn: d.non,
  pitchModulationOn: d.pmon,
  keyOn: d.kon,
  keyOff: d.koff,
  newKeyOn: d.newKon,
  adsr1: d.adsr1,
  step: d.phase,
  echoEnabled: d.echoFlags & 0x20 ? 0 : 1,
});
const UPLOAD_TEMPORARIES = new Set(['brrData', 'brrHeader', 'brrNextAddress']);
test(
  'the DSP model matches every DSP read, the inner DSP state, the echo buffer and all registers in Mesen',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { events, voices, inner, snapshots } = await record();
    const order = observedEvents(events, bytes);
    let next = 0,
      envx = 0,
      other = 0,
      lastRead = null,
      echoWrites = 0,
      stale = 0,
      echoBytes = 0,
      checked = 0;
    class Exact extends Dsp {
      echoWrite(ch) {
        if (!(this.echoFlags & 0x20)) {
          echoWrites++;
          if (this.echoLength !== (this.regs[0x7d] & 15) << 11) stale++;
        }
        super.echoWrite(ch);
      }
    }
    const upload = new Set();
    const compare = (d, k) => {
      const v = voices[k],
        x = inner[k];
      assert.equal(v.cycle, x.cycle);
      v.voices.forEach(([, env, hidden, delay], n) =>
        assert.deepEqual(
          [d.voices[n].env, d.voices[n].hidden, d.voices[n].konDelay],
          [env, hidden, delay],
          `voice ${n} cycle ${v.cycle}`,
        ),
      );
      assert.deepEqual(
        [d.counter, d.everyOther],
        [v.counter, v.everyOther],
        `counter cycle ${v.cycle}`,
      );
      x.voices.forEach((f, n) => {
        const w = d.voices[n];
        assert.deepEqual(
          [w.brrAddress, w.brrOffset, w.bufPos, w.interpPos, w.envxOut, ...w.buf],
          f,
          `voice ${n} inner state cycle ${x.cycle}`,
        );
      });
      const mine = innerFields(d);
      GLOBAL_FIELDS.forEach((key, i) => {
        if (mine[key] === x.global[i]) return;
        const inUpload =
          UPLOAD_TEMPORARIES.has(key) &&
          lastRead.pc >= 0x0663 &&
          lastRead.pc <= 0x0680 &&
          x.cycle - lastRead.cycle <= 32;
        assert.ok(inUpload, `${key} cycle ${x.cycle}: ${mine[key]} / ${x.global[i]}`);
        upload.add(k);
      });
      assert.deepEqual(
        Array.from(d.history),
        x.global.slice(GLOBAL_FIELDS.length),
        `echo history cycle ${x.cycle}`,
      );
    };
    const advance = (d, cycle) => {
      const target = Math.floor(cycle / 2);
      while (d.clocks < target) {
        for (; next < inner.length && Math.floor(inner[next].cycle / 2) <= d.clocks; next++)
          frameEnd(d, next);
        d.clock(1);
      }
    };
    class Clocked extends ObservedSpcIo {
      read(address, pc) {
        const e = this.peek();
        if (
          e >= 0 &&
          this.events[e] === READ &&
          this.events[e + 1] === pc &&
          this.events[e + 2] === address
        ) {
          advance(this.dsp, this.events[e + 5]);
          if (address === 0xf3) {
            const register = this.dspAddress & 0x7f;
            assert.equal(
              this.dsp.regs[register],
              this.events[e + 3],
              `DSP ${register.toString(16)} read at cycle ${this.events[e + 5]}`,
            );
            if ((register & 15) === 8) envx++;
            else other++;
          }
        }
        return super.read(address, pc);
      }
      write(address, value, pc) {
        const e = this.peek();
        if (e >= 0 && this.events[e] === WRITE) advance(this.dsp, this.events[e + 5]);
        super.write(address, value, pc);
      }
    }
    // Every read of the original, dummy reads included, for the timing boundary.
    const reads = [];
    for (let n = 0; n < events.length; n += 6) if (events[n] === READ) reads.push(n);
    let readAt = 0;
    const frameEnd = (d, k) => {
      while (readAt + 1 < reads.length && events[reads[readAt + 1] + 5] <= inner[k].cycle) readAt++;
      lastRead = { pc: events[reads[readAt] + 1], cycle: events[reads[readAt] + 5] };
      compare(d, k);
    };
    const onSnapshot = (k) => {
      const s = snapshots[k],
        d = apu.dsp;
      advance(d, s.cycle);
      for (let a = 0; a < 0x10000; a++) {
        if ((a >= 0x01e0 && a < 0x01f0) || (a >= 0xf0 && a < 0x100)) continue;
        if (apu.ram[a] !== s.aram[a])
          assert.fail(`ARAM ${a.toString(16)} at frame ${s.frame}: ${apu.ram[a]} / ${s.aram[a]}`);
      }
      const esa = s.dsp[0x6d] << 8,
        end = esa + ((s.dsp[0x7d] & 15) << 11 || 4);
      for (let a = esa; a < end; a++) if (s.aram[a & 0xffff]) echoBytes++;
      assert.deepEqual([...d.regs], [...s.dsp], `DSP registers at frame ${s.frame}`);
      checked++;
    };
    const apu = new Apu({
      dsp: (ram) => new Exact(ram),
      io: (dsp) => new Clocked(dsp, events, order, { onSnapshot }),
    });
    while (!apu.io.done) apu.resume();
    assert.ok(envx > 1000 && other > 1000 && next >= 2399, JSON.stringify({ envx, other, next }));
    assert.equal(checked, snapshots.length);
    assert.ok(echoBytes > 10000, 'the echo buffers hold sound');
    assert.ok(upload.size <= 40, `frames with upload temporaries: ${upload.size}`);
    // Basis of the echo coupling (src/apu/apu.mjs): the original never wrote with
    // an echo length other than the one last written to EDL.
    assert.ok(echoWrites > 1000000 && stale === 0, JSON.stringify({ echoWrites, stale }));
  },
);

// The model's Gauss table is the emulator's (MesenCore.dll, 512 int16 values).
// Data comparison in the test only; the emulator is not shipped.
test('the DSP Gauss table equals the one in Mesen', { skip: exe ? false : reason }, () => {
  const dll = readFileSync(join(dirname(exe), 'MesenCore.dll')),
    tail = Buffer.from(GAUSS.slice(-32).buffer);
  const at = dll.indexOf(tail);
  assert.ok(at >= 0 && dll.indexOf(tail, at + 1) < 0, 'exactly one table in MesenCore.dll');
  const table = [];
  for (let i = 0; i < 512; i++) table.push(dll.readInt16LE(at + 64 - 1024 + i * 2));
  assert.deepEqual(table, [...GAUSS]);
});

// Basis of the coupling: in the original, two writes to KON or KOF are always at
// least two DSP latches apart (phase 30 of every second Ts), so every written
// value takes effect at least once.
test(
  'the original spaces KON and KOF writes by at least two DSP latches',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { events } = await record();
    const latches = (clock) => {
      const s = Math.floor((clock - 31) / 32);
      return s < 1 ? 0 : Math.floor((s + 1) / 2);
    };
    const last = new Map();
    let pairs = 0,
      fewest = Infinity;
    for (let n = 0; n < events.length; n += 6) {
      if (events[n] !== WRITE || events[n + 2] !== 0xf3 || ![0x4c, 0x5c].includes(events[n + 4]))
        continue;
      const clock = Math.floor(events[n + 5] / 2),
        before = last.get(events[n + 4]);
      if (before !== undefined) {
        fewest = Math.min(fewest, latches(clock) - latches(before));
        pairs++;
      }
      last.set(events[n + 4], clock);
    }
    assert.ok(pairs > 2000 && fewest >= 2, JSON.stringify({ pairs, fewest }));
  },
);
