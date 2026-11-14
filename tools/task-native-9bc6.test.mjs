import test from 'node:test';
import assert from 'node:assert/strict';
import { rom, window, decodeWindows, compareDialog, prng } from './task-native-dialog-harness.mjs';
import {
  chooseObjectNumberWithGlove,
  chooseObjectUnderGlove,
  targetWithSpellGlove,
  scriptChooseObjectWithGlove,
  scriptChooseObjectNumberWithGlove,
  choosePlaceWithGlove,
} from '../src/task/native-glove-target.mjs';
import { putOnActionGlove, moveGlove } from '../src/task/native-glove.mjs';
import { GLOVE_ROUTINES, measureTextWidth } from '../src/task/native-glove-target-support.mjs';
import { putGloveAway } from '../src/task/native-dialog-portrait.mjs';
import { waitForRandomStateChange } from '../src/task/native-frame-wait.mjs';
import { readTextBit } from '../src/task/native-text-prerequisites.mjs';
import { readInput } from '../src/task/native-input-apu.mjs';

// NativeD8/9BC6 (Ziel mit dem Aktionshandschuh wählen) gegen die Originalbefehle. AF04, B0A1 und 9E1A laufen
// auf beiden Seiten als bewiesene Module; F963, FE69, FA3E, FEC1 und AD92 haben eigene Beweise und laufen als
// gleiche Stubs mit echtem Rahmen. Alle Befehle der geprüften Fenster müssen erreicht werden.
const romOffset = (address) => (((address >>> 16) & 0x1f) << 15) | (address & 0x7fff);
const romWord = (address) => rom[romOffset(address)] | (rom[romOffset(address + 1)] << 8);
export const SELECT_WINDOWS = {
  '9bc6': [window(0x809bc6, 0x809bd3)],
  '9c40': [window(0x809c40, 0x809ce4)],
  bc67: [window(0x80bc36, 0x80bc80)],
  bcb2: [window(0x80bcb2, 0x80bcbe)],
  bcbe: [window(0x80bcbe, 0x80be5b)],
  be5b: [window(0x80be5b, 0x80be6d)],
  be6d: [window(0x80be6d, 0x80bf3b)],
  fadd: [window(0x80fadd, 0x80fb39, { initialM: 0 })],
  aeb0: [window(0x81aeb0, 0x81aeb8)],
};
// Namen der Objektarten (8C:EFB0, sechs Bytes je Art) und der Tabelle 80:9782 als echte Texte für FADD.
const typeNames = Array.from({ length: 0x60 }, (_, t) => romWord(0x8cefb0 + 6 * t));
const tableIds = Array.from({ length: 13 }, (_, k) => romWord(0x809700 + 2 * k));
const names = [
  ...new Set([
    ...typeNames.filter((v) => v !== 0xffff),
    ...Array.from({ length: 13 }, (_, k) => romWord(0x809782 + 2 * k)),
  ]),
];

function scenarioBase(seed, entry) {
  const r = prng(seed),
    int = (n) => Math.floor(r() * n),
    wram = new Uint8Array(0x20000);
  const put = (address, v) => {
    const o = address >= 0x7e0000 ? address - 0x7e0000 : address & 0xffff;
    wram[o] = v & 255;
    wram[o + 1] = (v >>> 8) & 255;
  };
  return {
    r,
    int,
    pick: (list) => list[int(list.length)],
    wram,
    put,
    s: {
      entry,
      wram,
      a: int(0x10000),
      x: int(0x10000),
      y: int(0x10000),
      dbr: 0x80,
      p: int(256) & 0xc7,
    },
  };
}
function check(name, windows, entry, scenarios, make, options, cover = windows) {
  test(`${name} matches the original instructions on every instruction`, () => {
    const map = decodeWindows(windows),
      required = decodeWindows(cover),
      covered = new Set();
    for (let seed = 1; seed <= scenarios; seed++) {
      const s = make(scenarioBase(seed * 7919 + entry, entry));
      const result = compareDialog(map, s, { ...options, feed: s.feed ?? null });
      assert.deepEqual(result.differences, [], `${name} seed ${seed}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...required.keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
      [],
    );
  });
}
// Stub mit echtem Rahmen (RTS oder RTL nach Bank); F963 liefert das Fenster aus der Szenarioliste in DP00.
function stub(target, acc, lists) {
  const { ctx } = acc,
    raw = acc.pullWord();
  if (target >>> 16 === 0x81) {
    ctx.programBank = acc.read((ctx.s + 1) & 0xffff);
    ctx.s = (ctx.s + 1) & 0xffff;
  }
  ctx.pc = (raw + 1) & 0xffff;
  const dp = [0, 2, 4, 6, 8, 0xa, 0xc].map((o) => acc.readWord(o, 16));
  acc.trace.push({
    kind: 'call',
    pc: target,
    address: dp[0] | (dp[1] << 16),
    value: (dp.slice(2).reduce((v, w) => v * 31 + w, ctx.a) + ctx.x * 7 + ctx.y) % 0x1000000,
  });
  if (target === 0x80f963)
    acc.writeWord(0, lists.windows.length ? lists.windows.shift() : 0x40, 16);
  const a = (dp[0] * 5 + dp[2] + target) & 0xffff;
  ctx.a = a;
  ctx.status = (ctx.status & ~0x83) | (a & 0x8000 ? 0x80 : 0) | (a === 0 ? 2 : 0) | (dp[3] & 1);
  return { rawReturnWord: raw };
}
// 92C5 (Dialog schließen), A9B2 und ACB5 (Fensterliste) haben eigene Beweise wie die übrigen Stubs.
const STUBBED = [0x80f963, 0x80fe69, 0x80fa3e, 0x80fec1, 0x81ad92, 0x8092c5, 0x81a9b2, 0x81acb5];
const lists = (s) => ({ windows: [...(s.windows ?? [])] });
// Native: bewiesene Module aus GLOVE_ROUTINES, die übrigen als Stubs. Referenz: dieselben Module.
const nativeRoutines = (s) => {
  const l = lists(s);
  const map = new Map(GLOVE_ROUTINES);
  for (const t of STUBBED) map.set(t, (h) => stub(t, h.a, l));
  map.set(0x80bcb2, (h, e) => putGloveAway(h, e, { fa3e: (acc) => stub(0x80fa3e, acc, l) }));
  return map;
};
const referenceCalls = (acc, e, s) => {
  const l = lists(s);
  return new Map([
    ...STUBBED.map((t) => [t, () => stub(t, acc, l)]),
    [0x81af04, () => readTextBit(acc, false)],
    [
      0x81b0a1,
      () => {
        const p = waitForRandomStateChange(
          acc,
          { waitObservations: Object.freeze(e.values.slice(e.waitIndex)) },
          false,
          true,
        );
        e.waitIndex += p.waitObservationsUsed;
        return p;
      },
    ],
    [
      0x809e1a,
      () => {
        const o = e.inputs[e.inputIndex++];
        acc.writeWord(0x8001ca, o.value, 24);
        return readInput(acc, false);
      },
    ],
  ]);
};

check(
  'BC67/BC36',
  SELECT_WINDOWS.bc67,
  0x80bc67,
  300,
  ({ s, int, pick, put }) => {
    const slot = pick([0x10, 0x20, 0x30, 0x56]);
    put(0xcc2, slot);
    for (const o of [0xf30, 0xed8, 0xe80, 0xe28]) put(o + slot, int(0x10000));
    put(0xcc4, int(0x10000));
    put(0xcc6, int(0x10000));
    return s;
  },
  { native: (h) => putOnActionGlove(h) },
);

check(
  'FADD/FB2A',
  SELECT_WINDOWS.fadd,
  0x80fadd,
  600,
  ({ s, int, pick, put }) => {
    put(0, pick(names));
    put(0xba, int(0x10000));
    put(0x206, int(0x10000));
    put(0x208, int(0x10000));
    return s;
  },
  { native: (h, e, s) => measureTextWidth(h, e, nativeRoutines(s)), calls: referenceCalls },
);

// Szene für BCBE: Objekte mit Kästen um den Handschuh, Arten mit und ohne Namen, Art $0B, Art 3 in $1458.
function scene({ s, int, pick, put }) {
  const slots = [0x10, 0x20, 0x30, 0x40, 0x56].slice(0, int(6));
  put(0x14b0, slots.length ? 2 * (slots.length - 1) : pick([0xfffe, 0x8000]));
  slots.forEach((o, k) => put(0x14b2 + 2 * k, o));
  put(0xcc4, int(0x10000));
  put(0xcc6, int(0x10000));
  put(0x1e4, pick([0x600, int(0x10000)]));
  put(0x1e6, pick([0xc00, int(0x10000)]));
  const glove = [pick([0x300, 0xef00, int(0x10000)]), pick([0x300, 0xce00, int(0x10000)])];
  for (const o of slots) {
    put(0x1090 + o, int(8) ? 1 + int(0xffff) : 0);
    const type = pick([0xb, 0xb, int(0x60), int(0x60), int(0x60)]);
    put(0x7e3f28 + o, type);
    put(0x1458 + o, int(0x10000) | (int(2) ? 3 : 0));
    put(0x150a + o, pick(tableIds));
    // Gewünschte Kastenlage (Werte 14/17) nahe am Handschuh, daraus die Positionen.
    const v17 = ((glove[1] >>> 8) + pick([-0x40, -8, 0, 4, 0x10, 0x30]) - int(0x10)) & 0xffff,
      v14 = ((glove[0] >>> 8) + pick([-0x40, -8, 0, 4, 0x10, 0x30]) - int(0x10)) & 0xffff;
    const height = int(0x200),
      camera = s.wram[0xcc6] | (s.wram[0xcc7] << 8);
    put(0xed8 + o, height);
    put(
      0xf30 + o,
      (0x10000 * 4 + (s.wram[0x1e6] | (s.wram[0x1e7] << 8)) - height - camera - 4 * v17 - int(4)) &
        0xffff,
    );
    const z = int(0x1000),
      cx = s.wram[0xcc4] | (s.wram[0xcc5] << 8);
    put(0xe80 + o, z);
    put(
      0xe28 + o,
      (0x10000 * 4 + (s.wram[0x1e4] | (s.wram[0x1e5] << 8)) + z - cx - 4 * v14 - int(4)) & 0xffff,
    );
    for (const b of [0x7e4240, 0x7e42f0, 0x7e43a0, 0x7e4298, 0x7e4348])
      put(b + o, pick([0, 0, int(0x20), int(0x80), int(0x10000)]));
  }
  put(0x1d4, glove[0]);
  put(0x1d6, glove[1]);
  put(0x1d5f, pick([0, 0, int(0x10000)]));
  put(0x1d6d, pick([0, int(0x10000)]));
  const marked = slots.length && int(2) ? pick(slots) : null;
  put(
    0x1da,
    marked !== null
      ? s.wram[0x3f28 + marked] | (s.wram[0x3f29 + marked] << 8)
      : pick([0xffff, 0x8000, int(0x60)]),
  );
  put(0x1de, marked !== null && int(4) ? marked : pick([0xffff, 0x10, int(0x10000)]));
  put(0x1e0, pick([0, int(0x20), 0xfff0, int(0x10000)]));
  put(0x1e2, pick([0, int(0x20), 0xfff0, int(0x10000)]));
  put(0x1dc, int(0x10000));
  s.windows = [int(0x10000)];
  return s;
}
const motion = ({ s, int, pick, put }) => {
  put(0x1d8, pick([0, 0xffff, 0xffff, 0xfffd, 1]));
  put(0x1ca, int(2) ? int(0x10000) & ~0x0f00 : int(0x10000));
  put(0x1d0, pick([0, 0x100, 0xff00, 0x2f0, 0xfd10, 0x300, 0xfd00, int(0x10000)]));
  put(0x1d2, pick([0, 0x100, 0xff00, 0x2f0, 0xfd10, 0x300, 0xfd00, int(0x10000)]));
};
check(
  'BE6D/BCBE/BE5B/FADD',
  [...SELECT_WINDOWS.be6d, ...SELECT_WINDOWS.bcbe, ...SELECT_WINDOWS.be5b, ...SELECT_WINDOWS.fadd],
  0x80be6d,
  6000,
  (b) => {
    motion(b);
    return scene(b);
  },
  { native: (h, e, s) => moveGlove(h, e, nativeRoutines(s)), calls: referenceCalls },
);

// Ganzes 9BC6: Frames mit Steuerkreuz, dann A/B/X/Y; Spielfigur nah oder fern am markierten Objekt.
const ALL = Object.values(SELECT_WINDOWS).flat();
check(
  '9BC6/9C40/AEB0',
  ALL,
  0x809bc6,
  1500,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    const player = pick([0x10, 0x20, 0x56, 0x60]);
    put(0xcc2, player);
    for (const o of [0xe28, 0xe80, 0xed8]) put(o + player, int(0x10000));
    const target = s.wram[0x1de] | (s.wram[0x1df] << 8);
    if (int(2))
      for (const o of [0xe28, 0xe80, 0xed8])
        put(
          o + target,
          ((s.wram[o + player] | (s.wram[o + player + 1] << 8)) +
            pick([0, 0x20, -0x20, 0x40, 0x80, -0x90, int(0x200)])) &
            0xffff,
        );
    put(0x1f62, pick([0, 0, 1]));
    put(0x1cc, pick([0, 0x0100, 0x2000, 0x0010]));
    put(0x7e1c76, int(0x10000));
    // Eingaben: Steuerkreuz (bis zu 4 Frames), dann ein neuer Tastendruck, danach ein letztes 9E1A.
    const inputs = [];
    for (let n = int(5); n > 0; n--)
      inputs.push(pick([0, 0x0100, 0x0200, 0x0400, 0x0800, 0x0500, 0x0a00, 0x0010, 0x2000]));
    inputs.push(pick([0x0080, 0x0040, 0x4000, 0x8000, 0x8100, 0x00c0]));
    inputs.push(pick([0, 0x0080]));
    s.inputs = inputs.map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value }));
    s.windows = Array.from({ length: 8 }, () => int(0x10000));
    let counter = s.wram[0x1c76] | (s.wram[0x1c77] << 8);
    s.feed = (d) => {
      if (d.pc !== 0x81b0a5) throw Error('unexpected wait ' + d.pc.toString(16));
      counter = (counter + 1) & 0xffff;
      return counter;
    };
    return s;
  },
  {
    native: (h, e, s) => chooseObjectNumberWithGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  [...SELECT_WINDOWS['9bc6'], ...SELECT_WINDOWS['9c40'], ...SELECT_WINDOWS.aeb0],
);

// NativeA6/8D0B: dieselbe Schleife ohne Abstandsprüfung und Fensterliste.
const GLOVE = ['bc67', 'bcb2', 'bcbe', 'be5b', 'be6d', 'fadd'].flatMap((k) => SELECT_WINDOWS[k]),
  WINDOW_8D0B = [window(0x808d0b, 0x808d3f)];
check(
  '8D0B',
  [...WINDOW_8D0B, ...GLOVE],
  0x808d0b,
  800,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    const player = pick([0x10, 0x20, 0x56, 0x60]);
    put(0xcc2, player);
    for (const o of [0xe28, 0xe80, 0xed8]) put(o + player, int(0x10000));
    put(0x1cc, pick([0, 0x0100, 0x2000, 0x0010]));
    put(0x7e1c76, int(0x10000));
    const inputs = [];
    for (let n = int(5); n > 0; n--)
      inputs.push(pick([0, 0x0100, 0x0200, 0x0400, 0x0800, 0x0500, 0x0a00, 0x0010, 0x2000]));
    inputs.push(pick([0x0080, 0x0040, 0x4000, 0x8000, 0x8100, 0x00c0]));
    inputs.push(pick([0, 0x0080]));
    s.inputs = inputs.map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value }));
    s.windows = Array.from({ length: 8 }, () => int(0x10000));
    let counter = s.wram[0x1c76] | (s.wram[0x1c77] << 8);
    s.feed = (d) => {
      if (d.pc !== 0x81b0a5) throw Error('unexpected wait ' + d.pc.toString(16));
      counter = (counter + 1) & 0xffff;
      return counter;
    };
    return s;
  },
  {
    native: (h, e, s) => chooseObjectUnderGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  WINDOW_8D0B,
);

// NativeBD/9BD3 (Zauberhandschuh) und NativeC1/9C33 (9C40 mit Merker 1D6D).
const WINDOWS_9BD3 = [
    window(0x809bd3, 0x809c33),
    window(0x80bc99, 0x80bcb2),
    window(0x81aeb8, 0x81aec8),
  ],
  WINDOW_9C33 = [window(0x809c33, 0x809c40)];
const selectInputs = ({ s, int, pick }) => {
  // Steuerkreuz, ein Tastendruck; falls weitergewählt wird: bewegen (Objekt frei) und A mit Steuerkreuz, dann 9E1A.
  const inputs = [];
  for (let n = int(5); n > 0; n--)
    inputs.push(pick([0, 0x0100, 0x0200, 0x0400, 0x0800, 0x0500, 0x0a00, 0x0010, 0x2000]));
  inputs.push(
    pick([0x0080, 0x0040, 0x4000, 0x8000, 0x8100, 0x00c0]),
    0x0100,
    0x0180,
    pick([0, 0x0080]),
  );
  s.inputs = inputs.map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value }));
  s.windows = Array.from({ length: 8 }, () => int(0x10000));
  let counter = s.wram[0x1c76] | (s.wram[0x1c77] << 8);
  s.feed = (d) => {
    if (d.pc !== 0x81b0a5) throw Error('unexpected wait ' + d.pc.toString(16));
    counter = (counter + 1) & 0xffff;
    return counter;
  };
};
check(
  '9BD3',
  [...WINDOWS_9BD3, ...ALL],
  0x809bd3,
  1200,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    for (const o of [0x10, 0x20, 0x30, 0x40, 0x56])
      put(0x1458 + o, int(3) ? 0x8000 | int(0x8000) : int(0x8000)); // scene slots only (14B2 follows)
    // 9BD3 reads 1458+01DE: a marked slot is a scene slot (random slots beyond WRAM fault on both sides).
    if ((s.wram[0x1de] | (s.wram[0x1df] << 8)) >= 0x58)
      put(0x1de, pick([0x10, 0x20, 0x30, 0x40, 0x56]));
    put(0x1f62, pick([0, 0, 1]));
    put(0x1cc, pick([0, 0x0100, 0x2000, 0x0010]));
    put(0x7e1c76, int(0x10000));
    selectInputs(b);
    return s;
  },
  {
    native: (h, e, s) => targetWithSpellGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  WINDOWS_9BD3,
);
check(
  '9C33',
  [...WINDOW_9C33, ...ALL],
  0x809c33,
  300,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    const player = pick([0x10, 0x20, 0x56, 0x60]);
    put(0xcc2, player);
    for (const o of [0xe28, 0xe80, 0xed8]) put(o + player, int(0x10000));
    put(0x1f62, pick([0, 1]));
    put(0x1cc, pick([0, 0x0100]));
    put(0x7e1c76, int(0x10000));
    selectInputs(b);
    return s;
  },
  {
    native: (h, e, s) => scriptChooseObjectWithGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  WINDOW_9C33,
);
const WINDOW_9BB9 = [window(0x809bb9, 0x809bc6)];
check(
  '9BB9',
  [...WINDOW_9BB9, ...ALL],
  0x809bb9,
  300,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    const player = pick([0x10, 0x20, 0x56, 0x60]);
    put(0xcc2, player);
    for (const o of [0xe28, 0xe80, 0xed8]) put(o + player, int(0x10000));
    put(0x1f62, pick([0, 1]));
    put(0x1cc, pick([0, 0x0100]));
    put(0x7e1c76, int(0x10000));
    selectInputs(b);
    return s;
  },
  {
    native: (h, e, s) => scriptChooseObjectNumberWithGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  WINDOW_9BB9,
);
// NativeA8/C724: Ort mit dem Handschuh; Datensatz 7E4138+DP00 und die Felder 7E41E8/7E4190/7E40E0.
const WINDOWS_C724 = [
  window(0x80c724, 0x80c729),
  window(0x80c72c, 0x80c79c),
  window(0x81aeb8, 0x81aec8),
];
check(
  'C724',
  [...WINDOWS_C724, ...ALL],
  0x80c724,
  600,
  (b) => {
    const { s, int, pick, put } = b;
    motion(b);
    scene(b);
    s.p &= ~0x30;
    const player = pick([0x10, 0x20, 0x56, 0x60]);
    put(0xcc2, player);
    for (const o of [0xe28, 0xe80, 0xed8]) put(o + player, int(0x10000));
    put(0, pick([0x10, 0x20, 0x30, 0x56]));
    put(0x1f62, pick([0, 1]));
    put(0x1cc, pick([0, 0x0100]));
    put(0x7e1c76, int(0x10000));
    selectInputs(b);
    return s;
  },
  {
    native: (h, e, s) => choosePlaceWithGlove(h.a, e, true, nativeRoutines(s)),
    calls: referenceCalls,
  },
  WINDOWS_C724,
);

import { decodeTaskWindows } from './task-partial-source.mjs';
import { romBytes } from './task-native-dialog-harness.mjs';
import {
  native9BC6Spec,
  prove9BC6Source,
  native8D0BSpec,
  prove8D0BSource,
  native9BD3Spec,
  prove9BD3Source,
  native9C33Spec,
  prove9C33Source,
  native9BB9Spec,
  prove9BB9Source,
  nativeC724Spec,
  proveC724Source,
} from './task-native-9bc6-source.mjs';
import { SPECIAL_NATIVES } from '../src/vm/special-natives.mjs';
test('9BC6 own code: pinned windows, stack/mode proof with external returns, bound as special native', () => {
  const proof = prove9BC6Source(decodeTaskWindows(romBytes, native9BC6Spec.windows).map);
  assert.equal(proof.reachable_instructions, 434);
  assert.equal(proof.maximum_local_stack_bytes, 12);
  // Die Vergleichsfenster dieses Tests decken genau die gepinnten Befehle ab.
  const pinned = decodeTaskWindows(romBytes, native9BC6Spec.windows).map,
    compared = decodeWindows(ALL);
  assert.deepEqual(
    [...pinned.keys()].filter((pc) => !compared.has(pc)),
    [],
  );
  assert.ok(SPECIAL_NATIVES.has(0x809bc6));
});
test('8D0B own code: pinned windows shared with 9BC6, stack/mode proof with external returns, bound as special native', () => {
  const pinned = decodeTaskWindows(romBytes, native8D0BSpec.windows).map,
    proof = prove8D0BSource(pinned);
  assert.equal(proof.reachable_instructions, 378);
  assert.equal(proof.maximum_local_stack_bytes, 10);
  const compared = decodeWindows([...WINDOW_8D0B, ...GLOVE]);
  assert.deepEqual(
    [...pinned.keys()].filter((pc) => !compared.has(pc)),
    [],
  );
  assert.ok(SPECIAL_NATIVES.has(0x808d0b));
});
test('9BD3 and 9C33 own code: pinned windows, stack/mode proofs with external returns, bound as special natives', () => {
  for (const [spec, prove, instructions, windows] of [
    [native9BD3Spec, prove9BD3Source, 402, [...WINDOWS_9BD3, ...ALL]],
    [native9C33Spec, prove9C33Source, 433, [...WINDOW_9C33, ...ALL]],
    [native9BB9Spec, prove9BB9Source, 439, [...WINDOW_9BB9, ...ALL]],
    [nativeC724Spec, proveC724Source, 421, [...WINDOWS_C724, ...ALL]],
  ]) {
    const pinned = decodeTaskWindows(romBytes, spec.windows).map;
    assert.equal(prove(pinned).reachable_instructions, instructions);
    const compared = decodeWindows(windows);
    assert.deepEqual(
      [...pinned.keys()].filter((pc) => !compared.has(pc)),
      [],
    );
    assert.ok(SPECIAL_NATIVES.has(spec.entry));
  }
});
