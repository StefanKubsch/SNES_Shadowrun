import '../proof/system/recorded-routines.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  counterWindows,
  prove as proveCounter,
} from './render-task-native-counter-b0a1-source-proof.mjs';
import {
  inputApuWindows,
  decodeSource,
  prove as proveInput,
} from './render-task-native-input-apu-source-proof.mjs';
import { gameNmiSpecs } from './main-game-nmi-source.mjs';
import { matrixNmiSpecs } from './main-matrix-nmi-source.mjs';
import { sceneAnimationSpecs, proveSceneAnimation } from './main-scene-animation-source.mjs';
import { decodeWindows, DialogTestMemory, rom, romBytes } from './task-native-dialog-harness.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { runReference } from './w65c816-reference.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { GAME_NMI_ROUTINES } from '../proof/replay/main-game-nmi.mjs';
import { MAIN_LOOP_ROUTINES, runMainLoop } from '../proof/vm/main-loop.mjs';
import { MAIN_MOTION_ROUTINES } from '../proof/replay/main-loop-motion.mjs';
import { SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES } from '../proof/scene-reference-routines.mjs';
import {
  waitForRandomStateChangeWithInterrupts,
  readInputWithInterrupts,
} from '../proof/system/main-wait-interrupt.mjs';
import { finishInterruptObservations } from '../src/system/main-wait-interrupt.mjs';
import { inputWaitF953Window } from './task-native-input-wait-f953-source.mjs';
import { DIALOG_WINDOWS } from './task-native-936c-windows.mjs';
import { requestWindows } from './render-task-native-menu-compose-source-proof.mjs';
import { waitForConfirmKey } from '../proof/replay/native-input-wait.mjs';
import { waitForRandomStateChange } from '../proof/system/native-frame-wait.mjs';
import {
  waitWord,
  nmiWords,
  uploadPortraitTiles,
  openPortraitWindow,
  closePortraitWindow,
} from '../proof/system/native-dialog-portrait.mjs';
import { waitForWindowUpload, requestWindowUpload } from '../proof/replay/native-menu-compose.mjs';
import { cpuToOffset } from './rom.mjs';

const inputWindow = { start: 0x809e1a, hex: inputApuWindows[0].hex.slice(0, 0x23 * 2) };
const counter = decodeWindows(counterWindows),
  input = decodeWindows([inputWindow]);
const byteSpec = sceneAnimationSpecs.find((s) => s.name === 'eebb'),
  byteWait = decodeWindows(byteSpec.windows);
const nmi = decodeWindows([
  ...matrixNmiSpecs[2].windows,
  ...gameNmiSpecs.flatMap((s) => s.windows),
]);
const freeze = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
const expand = (t) =>
  t.flatMap((o) =>
    o.width === 2
      ? [
          { ...o, width: 1, value: o.value & 255 },
          { ...o, width: 1, address: o.address + 1, value: o.value >>> 8 },
        ]
      : [{ ...o, width: 1 }],
  );
function side({
  baseline = 0,
  previous = 0,
  current = 0,
  dbr = 0x80,
  p = 0x41,
  s = 0x1ef0,
  dp30 = 0x80,
  x = 0xdead,
} = {}) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom);
  for (const [at, v] of [
    [0x6e, 0xc152],
    [0x1c76, baseline],
    [0x1ca, current],
    [0x1cc, previous],
    [0x140, 0xffff],
    [0xcd8, 1],
  ])
    mem.write16(at, v);
  mem.write8(0x70, 0x80);
  mem.write8(0x30, dp30);
  const a = new TaskAccessor({ mem, a: 0xa55a, x, y: 0xbeef, s, d: 0, dbr, p, pc: 0x96ab });
  a.load();
  a.trace = [];
  a.io = [];
  a.devices = { write() {} };
  if (p & 0x10) {
    a.ctx.x &= 255;
    a.ctx.y &= 255;
  }
  return { mem, a, h: dialogAccess(a) };
}
function devices(dbr, value) {
  return [
    ...(dbr === 0x7e
      ? []
      : [{ pc: 0x00c118, address: (dbr << 16) | 0x4210, width: 2, value: 0xab80 }]),
    { pc: 0x809e0b, address: 0x4212, width: 2, value: 1 },
    { pc: 0x809e0b, address: 0x4212, width: 2, value: 0 },
    { pc: 0x809e13, address: 0x4218, width: 2, value },
  ];
}
// Independent hardware entry followed by the complete pinned original handler
// and callback, ending at RTI. No native NMI implementation on this side.
function originalNmi(v, value) {
  const { a, h, mem } = v,
    before = { ...a.ctx };
  a.io.push(...devices(a.ctx.bank, value));
  h.pushByte(a.ctx.programBank);
  h.push(a.ctx.pc, 2);
  h.pushByte(a.ctx.status);
  a.ctx.status = (a.ctx.status | 4) & ~8;
  a.ctx.programBank = 0;
  runReference(nmi, mem, a.ctx, { entry: 0x00c112, root: 'RTI', io: a.trace });
  assert.deepEqual(a.ctx, before);
}
function referenceIo(v) {
  let byte = 0;
  const read = v.mem.read8.bind(v.mem);
  v.mem.read8 = (address) => {
    const o = v.a.io[v.a.ioIndex];
    if (o && address === o.address + byte) {
      const value = (o.value >>> (8 * byte++)) & 255;
      if (byte === o.width) {
        v.a.ioIndex++;
        byte = 0;
      }
      return value;
    }
    return read(address);
  };
}
function compare(options, entry, choose, graph = null) {
  const r = side(options),
    n = side(options),
    map = graph?.map ?? (entry === 0x81b0a1 ? counter : entry === 0x809e1a ? input : byteWait),
    root = graph?.root ?? (entry === 0x809e1a ? 'RTS' : 'RTL');
  if (graph?.setup) for (const v of [r, n]) graph.setup(v);
  const records = [],
    hits = new Map();
  referenceIo(r);
  const hooks = new Map(
    [...(graph?.observations ?? map).keys()].map((pc) => [
      pc,
      () => {
        const hit = (hits.get(pc) ?? 0) + 1;
        hits.set(pc, hit);
        const value = choose(pc, hit),
          nmi = value !== null;
        records.push({ pc, nmi });
        r.a.ctx.programBank = pc >>> 16;
        r.a.ctx.pc = pc & 65535;
        if (nmi) originalNmi(r, value);
        if (pc === 0x81eec2)
          r.a.io.push({
            pc,
            address: (r.a.ctx.bank << 16) | 0x4212,
            width: 1,
            value: hit < 3 ? 0x80 : 0,
          });
      },
    ]),
  );
  // Both original caller frames, including the bank byte of the B0A1 JSL.
  for (const v of [n, r]) {
    if (root === 'RTL') v.h.pushByte(0x80);
    v.h.push(entry === 0x81b0a1 ? 0x96ae : 0x96b9, 2);
    v.a.ctx.programBank = entry >>> 16;
    v.a.ctx.pc = entry & 65535;
  }
  const stop = Symbol('inline fallthrough');
  if (graph?.stopAt)
    hooks.set(graph.stopAt, () => {
      throw stop;
    });
  try {
    runReference(map, r.mem, r.a.ctx, { entry, root, io: r.a.trace, before: hooks });
  } catch (error) {
    if (error !== stop) throw error;
  }
  n.a.io = r.a.io;
  const e = {
    interrupts: freeze(records),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
    startupInterrupts: graph?.startupInterrupts,
    values: freeze([]),
    waitIndex: 0,
    waitEvents: [],
    calls: [],
    inputs: freeze([]),
    inputIndex: 0,
  };
  const result = graph
    ? graph.run(n, e)
    : (MAIN_LOOP_ROUTINES.get(entry) ?? MAIN_SCENE_ROUTINES.get(entry))(n.h, e);
  finishInterruptObservations(e);
  assert.deepEqual(n.a.ctx, r.a.ctx);
  assert.deepEqual(n.mem.wram, r.mem.wram);
  assert.deepEqual(expand(n.a.trace), expand(r.a.trace));
  assert.equal(n.a.ioIndex, r.a.io.length);
  assert.equal(r.a.ioIndex, r.a.io.length);
  assert.equal(e.waitIndex, 0);
  assert.equal(e.inputIndex, 0);
  assert.deepEqual(e.waitEvents, []);
  return { n, r, e, records, result };
}

test('AC2F retains the full stream WORD across an original NMI before AC8F AND', () => {
  const at = cpuToOffset(0x80ac2f, romBytes.length),
    map = decodeWindows([
      { start: 0x80ac2f, hex: romBytes.subarray(at, at + 453).toString('hex') },
    ]);
  assert.equal(map.get(0x80ac8d).mnemonic, 'LDA');
  assert.equal(map.get(0x80ac8f).mnemonic, 'AND');
  assert.equal(map.get(0x80ac8f).value, 255);
  for (const dbr of [0, 0x80, 0x81])
    for (const interrupt of [false, true]) {
      const { records, n } = compare({ dbr, x: 0 }, 0x80ac2f, () => (interrupt ? 0x4000 : null), {
        map,
        root: 'RTS',
        observations: new Map([[0x80ac8f, map.get(0x80ac8f)]]),
        startupInterrupts: true,
        setup: (v) => {
          for (const [address, value] of [
            [0x4088, 0x80],
            [0x3fd8, 1],
            [0x1090, 0x8000],
            [0x10e8, 2],
            [0x1198, 0],
            [0x82, 0x100],
            [0x40, 0x8c],
          ])
            v.mem.write16(0x7e0000 + address, value);
        },
        run: (v, e) => MAIN_MOTION_ROUTINES.get(0x80ac2f)(v.h, e),
      });
      assert.deepEqual(records, [{ pc: 0x80ac8f, nmi: interrupt }]);
      assert.equal(n.mem.read16(0x1c76), interrupt ? 1 : 0);
      if (interrupt)
        assert.equal(n.mem.read16(0x1c78), 0x800a, 'NMI saves the full pre-AND accumulator');
    }
});

test('direct counter adapter and complete F953 use real NMI/input state without old observation writers', () => {
  const f953 = decodeWindows([inputWaitF953Window, ...counterWindows, inputWindow]);
  assertPinnedTaskSource(f953, [inputWaitF953Window, ...counterWindows, inputWindow]);
  for (const dbr of [0, 0x80, 0x81]) {
    const c = compare(
      { baseline: 0xffff, dbr },
      0x81b0a1,
      (pc, hit) => (pc === 0x81b0a5 && hit === 2 ? 0x4000 : null),
      {
        map: counter,
        root: 'RTL',
        run: (v, e) => waitForRandomStateChange(v.a, { interruptEvents: e }, false, true),
      },
    );
    assert.equal(c.result.waitObservationsUsed, 0);
    assert.deepEqual(c.result.waitEvents, []);
    const p = compare(
      { baseline: 0xffff, dbr },
      0x80f953,
      (pc, hit) =>
        pc === 0x81b0a5 && hit === 2 ? 0 : pc === 0x81b0a5 && hit === 4 ? 0x4000 : null,
      {
        map: f953,
        root: 'RTS',
        observations: new Map([...counter, ...input]),
        run: (v, e) => waitForConfirmKey(v.a, { interruptEvents: e }, false),
      },
    );
    assert.equal(p.result.iterations, 2);
    assert.equal(p.result.waitObservationsUsed, 0);
    assert.equal(p.result.inputObservationsUsed, 0);
    assert.deepEqual(p.result.waitEvents, []);
    assert.equal(p.n.mem.read16(0x1c76), 1);
  }
});

test('portrait open/close and portrait transfer polls keep their original callers, flags and NMI writes', () => {
  const specs = [
    ['8f3a', 0x808f3a, openPortraitWindow],
    ['8f97', 0x808f97, closePortraitWindow],
    ['9022', 0x808ff5, uploadPortraitTiles],
  ];
  for (const [name, entry, run] of specs) {
    const windows = [...DIALOG_WINDOWS[name], ...counterWindows],
      map = decodeWindows(windows);
    assertPinnedTaskSource(map, windows);
    const observations =
      entry === 0x808ff5
        ? new Map([...map].filter(([pc]) => pc === 0x80901c || pc === 0x80901f))
        : counter;
    for (const dbr of [0, 0x80, 0x81])
      compare(
        { x: 0x1234, dbr, baseline: 0xffff },
        entry,
        (pc, hit) => ((pc === 0x81b0a5 || pc === 0x80901c) && hit % 2 === 0 ? 0 : null),
        { map, root: 'RTS', observations, run: (v, e) => run(v.h, e) },
      );
  }
});

test('inline tile polls preserve original LDA/BNE flags and consume actual A98E clear and DP82 effects', () => {
  const source = decodeWindows(DIALOG_WINDOWS.adf4);
  assertPinnedTaskSource(source, DIALOG_WINDOWS.adf4);
  for (const pc of [0x80ae0c, 0x80ae5e]) {
    assert.equal(source.get(pc).mnemonic, 'LDA');
    assert.equal(source.get(pc).value, 0x1562);
    assert.equal(source.get(pc + 3).mnemonic, 'BNE');
    assert.equal(source.get(pc + 3).target, pc);
    for (const phase of [pc, pc + 3]) {
      const poll = new Map([
        [pc, source.get(pc)],
        [pc + 3, source.get(pc + 3)],
      ]);
      // Stop before the actual original fallthrough instruction, with its
      // caller frame still present on both sides. No synthetic instruction.
      const { n } = compare({ dbr: 0x80 }, pc, (at) => (at === phase ? 0 : null), {
        map: source,
        root: 'RTS',
        observations: poll,
        stopAt: pc + 5,
        setup: (v) => {
          v.mem.write16(0x1562, 1);
          v.mem.write16(0x82, 0xfffe);
        },
        run: (v, e) => {
          waitWord(v.h, e, pc, 0x1562, (x) => x === 0, [0x82]);
          nmiWords(v.h, e, pc, [0x82, 0x1562]);
        },
      });
      assert.equal(n.mem.read16(0x1562), 0);
      assert.equal(n.mem.read16(0x82), 0xfffe);
    }
  }
});

test('menu request and poll wrappers use the shared interrupt set and original request frame', () => {
  const request = decodeWindows(requestWindows);
  assertPinnedTaskSource(request, requestWindows);
  compare({}, 0x80fa67, (pc, hit) => (pc === 0x81acbd && hit === 2 ? 0 : null), {
    map: request,
    root: 'RTS',
    observations: decodeWindows([requestWindows[1]]),
    setup: (v) => {
      v.mem.write16(0, 0);
      v.mem.write16(0x7e2060, 1);
      v.mem.write16(0x7e20a0, 1);
    },
    run: (v, e) => requestWindowUpload(v.a, e, false),
  });
  compare({}, 0x81acbd, () => null, {
    map: decodeWindows([requestWindows[1]]),
    root: 'RTL',
    run: (v, e) => waitForWindowUpload(v.a, e, false),
  });
});

test('interrupt wait roots retain pinned source, long counter stack and original input reset boundary', () => {
  proveCounter(counter);
  assertPinnedTaskSource(input, [inputWindow]);
  // The existing complete input proof also includes the nonreturning reset tail.
  const decoded = decodeSource(romBytes);
  proveInput(decoded.map, 0x809e1a);
  proveSceneAnimation(byteWait, byteSpec);
  assert.equal(counter.size, 4);
  assert.equal(input.size, 13);
  for (const target of [0x81b0a1, 0x809e1a])
    assert.equal(MAIN_LOOP_ROUTINES.get(target), MAIN_SCENE_ROUTINES.get(target));
});
test('EEBB preserves PHP/PLP, BYTE baseline, high A, WORD counter wrap and branch flags across interrupts', () => {
  for (const baseline of [0, 0xff, 0xffff])
    for (const p of [0, 0x20, 0x30, 0xb7])
      for (const dbr of [0, 0x80, 0x81, 0x7e]) {
        compare({ baseline, p, dbr }, 0x81eebb, (pc, hit) =>
          pc === 0x81eecd && hit === 3 ? 0x8000 : pc === 0x81eed1 && hit === 1 ? 0 : null,
        );
      }
  for (const pc of [
    0x81eebb, 0x81eebc, 0x81eebe, 0x81eec0, 0x81eec9, 0x81eecd, 0x81eed1, 0x81eed3, 0x81eed4,
  ]) {
    compare({ baseline: 0xff, p: 0x30 }, 0x81eebb, (at, hit) =>
      at === pc && hit === 1 ? 0 : at === 0x81eecd && hit === 4 ? 0x4000 : null,
    );
  }
});
test('EEBB hardware branch keeps BYTE width and original poll PC with explicit device and interrupt order', () => {
  for (const dbr of [0, 0x80, 0x81])
    for (const p of [0, 0x20, 0x30, 0xb7])
      for (const phase of [0x81eec2, 0x81eec5, 0x81eec7, 0x81eec8]) {
        compare({ dp30: 0, dbr, p }, 0x81eebb, (pc, hit) =>
          pc === phase && hit === 1 ? 0x2000 : null,
        );
      }
});
test('B0A1 compares real NMI writes across unchanged polls, pre-baseline interrupts, branch interrupts and WORD wrap', () => {
  for (const baseline of [0, 0x7fff, 0xffff])
    for (const dbr of [0, 0x80, 0x81, 0x7e])
      for (const phase of [0x81b0a1, 0x81b0a5, 0x81b0a9, 0x81b0ab]) {
        const { n, records } = compare({ baseline, dbr }, 0x81b0a1, (pc, hit) =>
          pc === phase && (pc !== 0x81b0a5 || hit === 3)
            ? 0x8000
            : pc === 0x81b0a5 && hit === 4
              ? 0x4000
              : null,
        );
        assert.ok(records.length >= 4);
        assert.notEqual(n.mem.read16(0x1c76), baseline);
      }
});
test('input keeps each fresh edge/copy/filter read when NMI interrupts every possible original instruction', () => {
  for (const pc of input.keys())
    for (const dbr of [0, 0x80, 0x81, 0x7e])
      for (const current of [0, 0x8000, 0x8001]) {
        compare({ current, previous: 0x4000, dbr }, 0x809e1a, (at) => (at === pc ? 0x4000 : null));
      }
  compare({ current: 0x8000 }, 0x809e1a, (pc) =>
    pc === 0x809e20 ? 0x4000 : pc === 0x809e26 ? 0x2000 : null,
  );
});
test('real main-loop caller shares one interrupt stream, counter, joypad and original call frames', () => {
  const v = side({ baseline: 0xffff }),
    records = [
      [0x81b0a1, false],
      [0x81b0a5, false],
      [0x81b0a9, false],
      [0x81b0a5, true],
      [0x81b0a9, false],
      [0x81b0ab, false],
      ...[
        0x809e1a, 0x809e1d, 0x809e20, 0x809e23, 0x809e26, 0x809e29, 0x809e2c, 0x809e2f, 0x809e31,
        0x809e34, 0x809e3c,
      ].map((pc) => [pc, false]),
    ];
  v.a.io = devices(0x80, 0x8000);
  v.a.ctx.pc = 0x96c3;
  const e = {
    interrupts: freeze(records.map(([pc, nmi]) => ({ pc, nmi }))),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
  };
  // Unrelated helpers are synthetic here, as in main-loop.test. No R-to-C oracle claim.
  const routines = new Map(MAIN_LOOP_ROUTINES);
  routines.set(0x808000, (h) => {
    h.ctx.status |= 1;
    return h.rts();
  });
  for (const target of [0x818877, 0x818076]) routines.set(target, (h) => h.rtl());
  for (const target of [0x80be6d, 0x80bf3b]) routines.set(target, (h) => h.rts());
  assert.equal(runMainLoop(v.a, e, routines), 0x96c0);
  finishInterruptObservations(e);
  assert.equal(v.mem.read16(0x1c76), 0);
  assert.equal(v.mem.read16(0x1ca), 0x8000);
  assert.equal(v.mem.read16(0x1ce), 0x8000);
  assert.equal(v.a.ctx.s, 0x1ef0);
  assert.equal(v.a.ioIndex, 4);
  const m = side();
  m.a.io = devices(0x80, 0x4000);
  const em = {
    interrupts: freeze(
      [
        [0x81b0a1, false],
        [0x81b0a5, true],
        [0x81b0a9, false],
        [0x81b0ab, false],
      ].map(([pc, nmi]) => ({ pc, nmi })),
    ),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
  };
  m.h.call(0x80cc5c, 0x81b0a1, () => MAIN_MOTION_ROUTINES.get(0x81b0a1)(m.h, em), true);
  finishInterruptObservations(em);
  assert.equal(m.a.ctx.pc, 0xcc60);
  assert.equal(m.mem.read16(0x1c76), 1);
});
test('missing, mutable, wrong-PC and exhausted interrupt records stop without a fabricated counter change', () => {
  for (const interrupts of [
    undefined,
    [],
    freeze([{ pc: 0x81b0a5, nmi: true }]),
    [{ pc: 0x81b0a1, nmi: false }],
    Object.freeze([{ pc: 0x81b0a1, nmi: false }]),
  ]) {
    const v = side(),
      e = { interrupts, interruptIndex: 0, interruptRoutines: GAME_NMI_ROUTINES };
    v.a.ctx.programBank = 0x81;
    const before = v.mem.wram.slice();
    assert.throws(
      () => waitForRandomStateChangeWithInterrupts(v.h, e),
      (e) => e.reason === 'wait_interrupt_observation_required',
    );
    assert.deepEqual(v.mem.wram, before);
  }
  const v = side(),
    e = { interrupts: freeze([{ pc: 0x81b0a1, nmi: false }]), interruptIndex: 0 };
  v.a.ctx.programBank = 0x81;
  assert.throws(
    () => waitForRandomStateChangeWithInterrupts(v.h, e),
    (e) => e.reason === 'wait_interrupt_observation_required' && e.pc === 0x81b0a5,
  );
  assert.equal(v.mem.read16(0x1c76), 0);
  assert.throws(
    () => finishInterruptObservations({ interruptIndex: 0, interrupts: [{}] }),
    (e) => e.reason === 'wait_interrupt_observation_unused',
  );
});
test('missing NMI callback/device values and corrupt interrupted return remain explicit boundaries', () => {
  for (const kind of ['callback', 'device', 'alias']) {
    const v = side({ s: kind === 'alias' ? 0x1c7d : 0x1ef0 });
    v.a.ctx.programBank = 0x81;
    const e = {
      interrupts: freeze([{ pc: 0x81b0a1, nmi: true }]),
      interruptIndex: 0,
      interruptRoutines: kind === 'callback' ? new Map() : GAME_NMI_ROUTINES,
    };
    if (kind === 'alias') v.a.io = devices(0x80, 0);
    assert.throws(
      () => waitForRandomStateChangeWithInterrupts(v.h, e),
      (err) =>
        err.reason ===
        (kind === 'callback'
          ? 'observed_nmi_callback_frontier'
          : kind === 'device'
            ? 'device_observation_required'
            : 'wait_interrupt_return_required'),
    );
  }
});
test('fresh exact 3030 reset after an NMI retains preceding direct effects and never assumes a return', () => {
  const v = side(),
    pcs = [0x809e1a, 0x809e1d, 0x809e20, 0x809e23, 0x809e26, 0x809e29, 0x809e2c, 0x809e2f];
  v.a.io = devices(0x80, 0x3030);
  const e = {
    interrupts: freeze(pcs.map((pc) => ({ pc, nmi: pc === 0x809e1a }))),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
  };
  assert.throws(
    () => readInputWithInterrupts(v.h, e),
    (err) => err.reason === 'task_reset_source_required' && err.pc === 0x809e2f,
  );
  assert.equal(v.mem.read16(0x1cc), 0x3030);
  assert.equal(v.mem.read16(0x1ce), 0x3030);
  assert.equal(v.mem.read16(0x1c76), 1);
});
