import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rom,
  window,
  decodeWindows,
  compareDialog,
  prng,
  romBytes,
} from './task-native-dialog-harness.mjs';
import {
  unpackPortrait,
  clearFixedColour,
  setWindowTextWidth,
  shiftPortraitRows,
  uploadFirstPortrait,
  uploadSecondPortrait,
  openPortraitWindow,
  closePortraitWindow,
} from '../proof/system/native-dialog-portrait.mjs';
import { putGloveAway } from '../proof/system/native-glove-release.mjs';
import { waitForRandomStateChange } from '../proof/system/native-frame-wait.mjs';

// Window and portrait routines for dialog $936C against the original instructions. Each routine has its own
// scenarios; every instruction in its windows must be reached.
const romOffset = (address) => (((address >>> 16) & 0x1f) << 15) | (address & 0x7fff);
const romWord = (address) => rom[romOffset(address)] | (rom[romOffset(address + 1)] << 8);
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
function check(name, windows, entry, scenarios, make, options = {}) {
  test(`${name} matches the original instructions on every instruction`, () => {
    const map = decodeWindows(windows),
      covered = new Set();
    for (let seed = 1; seed <= scenarios; seed++) {
      const s = make(scenarioBase(seed * 7919 + entry, entry));
      const result = compareDialog(map, s, options.feed ? { ...options, feed: s.feed } : options);
      assert.deepEqual(result.differences, [], `${name} seed ${seed}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...map.keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
      [],
    );
  });
}
// B0A1 counter runs as a proved module on both sides with the same observations.
const counterCalls = (acc, events) =>
  new Map([
    [
      0x81b0a1,
      () => {
        const p = waitForRandomStateChange(
          acc,
          { waitObservations: Object.freeze(events.values.slice(events.waitIndex)) },
          false,
          true,
        );
        events.waitIndex += p.waitObservationsUsed;
        return p;
      },
    ],
  ]);
const counterWaits = (int, count, start) => {
  const list = [];
  let c = start;
  for (let n = 0; n < count; n++) {
    if (int(5) === 0) list.push({ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value: c });
    c = (c + 1 + int(2)) & 0xffff;
    list.push({ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value: c });
  }
  return list;
};

check('81:886A', [window(0x81886a, 0x818877)], 0x81886a, 50, ({ s }) => s, {
  native: (h) => clearFixedColour(h),
  root: 'RTL',
});

check(
  'FA92',
  [window(0x80fa92, 0x80faac)],
  0x80fa92,
  800,
  ({ s, int, pick, put }) => {
    const x = int(0x40) * 2;
    put(0, x);
    put(2, int(0x10000));
    put(4, pick([0, 1, 0x7fff, 0x8000, 0xfff8, int(0x10000)]));
    put(0x7e2020 + x, int(0x10000));
    return s;
  },
  { native: (h) => setWindowTextWidth(h) },
);

// Real compressed portraits from dialog records (pointer in 8D:0000 through 80:94F7).
const portraits = (() => {
  const set = new Map();
  for (let k = 0; k < 0x60; k++) {
    const record = 0x8d0000 | romWord(0x8094f7 + 2 * k),
      pointer = romWord(record) | (rom[romOffset(record + 2)] << 16);
    if (pointer >>> 16 < 0x80 || pointer >>> 16 > 0x9f) continue;
    set.set(romWord(pointer) | (rom[romOffset(pointer + 2)] << 16), k);
  }
  return [...set.keys()];
})();
check(
  '9F6D/9E65',
  [window(0x809e65, 0x809e7e), window(0x809f6d, 0x80a033)],
  0x809f6d,
  portraits.length * 2,
  ({ s, int, pick }) => {
    const source = pick(portraits);
    s.a = source & 0xffff;
    s.y = source >>> 16;
    s.x = pick([0x5250, 0x5250, 0x6000 + int(0x100)]);
    for (let n = 0; n < 0x100; n++) s.wram[0xe0 + n] = int(256);
    return s;
  },
  { native: (h) => unpackPortrait(h) },
);

check(
  '8F20',
  [window(0x808f20, 0x808f3a)],
  0x808f20,
  20,
  ({ s, int }) => {
    for (let n = 0x15000; n < 0x17000; n++) s.wram[n] = int(256);
    return s;
  },
  { native: (h) => shiftPortraitRows(h) },
);

// 8FF5 waits for $0140 to become negative (NMI); the reference reads observations at the same address.
const dmaWaits = (int) => {
  const list = [];
  for (let n = int(3); n > 0; n--)
    list.push({ pc: 0x80901c, address: 0x800140, width: 2, value: int(0x8000) });
  list.push({ pc: 0x80901c, address: 0x800140, width: 2, value: 0x8000 | int(0x8000) });
  return list;
};
check(
  '9022/8FF5',
  [window(0x809022, 0x80905e), window(0x808ff5, 0x809022)],
  0x809022,
  30,
  ({ s, int }) => {
    s.waits = dmaWaits(int);
    return s;
  },
  { native: (h, e) => uploadFirstPortrait(h, e), waits: [0x80901c] },
);
check(
  '905E/8FF5/A954',
  [window(0x80905e, 0x80908c), window(0x808ff5, 0x809022), window(0x81a954, 0x81a958)],
  0x80905e,
  60,
  ({ s, int, put }) => {
    s.waits = dmaWaits(int);
    put(0x1ba, int(0x10000));
    put(0x1562, int(0x10000));
    return s;
  },
  { native: (h, e) => uploadSecondPortrait(h, e), waits: [0x80901c] },
);

check(
  '8F3A/8EFE',
  [window(0x808f3a, 0x808f87), window(0x808efe, 0x808f20)],
  0x808f3a,
  40,
  ({ s, int, put }) => {
    const c = int(0x10000);
    put(0x7e1c76, c);
    s.waits = counterWaits(int, 11, c);
    put(0x1c4, int(0x10000));
    return s;
  },
  { native: (h, e) => openPortraitWindow(h, e), calls: counterCalls },
);
check(
  '8F97/8EFE',
  [window(0x808f97, 0x808fb3), window(0x808efe, 0x808f20)],
  0x808f97,
  40,
  ({ s, int, put }) => {
    const c = int(0x10000);
    put(0x7e1c76, c);
    s.waits = counterWaits(int, 11, c);
    put(0x1c4, int(0x10000));
    return s;
  },
  { native: (h, e) => closePortraitWindow(h, e), calls: counterCalls },
);

// FA3E has a separate proof; both sides use the same stub here with a real frame.
const fa3eStub = (acc) => {
  const raw = acc.pullWord();
  acc.ctx.pc = (raw + 1) & 0xffff;
  acc.trace.push({ kind: 'call', pc: 0x80fa3e, address: acc.readWord(0, 16), value: 0 });
  acc.ctx.a = acc.readWord(0, 16) ^ 0x5a5a;
  return { rawReturnWord: raw };
};
check(
  'BCB2/BE5B',
  [window(0x80bcb2, 0x80bcbe), window(0x80be5b, 0x80be6d)],
  0x80bcb2,
  200,
  ({ s, int, pick, put }) => {
    put(0x1da, pick([0xffff, 0x8000, 0, 0x18, int(0x10000)]));
    put(0x1dc, int(0x10000));
    put(0x1d8, int(0x10000));
    return s;
  },
  {
    native: (h, e) => putGloveAway(h, e, { fa3e: (acc) => fa3eStub(acc) }),
    calls: (acc) => new Map([[0x80fa3e, () => fa3eStub(acc)]]),
  },
);

// Text and selection: FA67, FAAC, FE69, A6C7, F963, FA3E, C34A and C1CA have separate proofs.
// Both sides use identical stubs with real frames; the menu and allocator provide the scenario result in DP00.
import {
  showDialogText,
  chooseDialogAction,
  chooseDialogTopic,
  dialogTopic,
} from '../proof/replay/native-dialog-text.mjs';
const TEXT_TARGETS = {
  request: 0x80fa67,
  cursor: 0x80faac,
  text: 0x80fe69,
  menu: 0x80a6c7,
  allocate: 0x80f963,
  release: 0x80fa3e,
  append: 0x80c34a,
  visit: 0x80c1ca,
};
function textStub(target, acc, results) {
  const raw = acc.pullWord();
  acc.ctx.pc = (raw + 1) & 0xffff;
  const dp = [0, 2, 4, 6, 8, 0xa].map((o) => acc.readWord(o, 16));
  acc.trace.push({
    kind: 'call',
    pc: target,
    address: dp[0] | (dp[1] << 16),
    value: dp.slice(2).reduce((v, w) => v * 31 + w, acc.ctx.x) % 0x1000000,
  });
  if (target === 0x80a6c7 || target === 0x80f963) acc.writeWord(0, results.shift() ?? 0xffff, 16);
  acc.ctx.a = (dp[0] * 3 + dp[2] + target) & 0xffff;
  acc.ctx.status = (acc.ctx.status & ~0x83) | (dp[3] & 0x83);
  return { rawReturnWord: raw };
}
const textRoutines = (s) => {
  const results = [...s.results];
  const r = Object.fromEntries(
    Object.entries(TEXT_TARGETS).map(([k, t]) => [k, (acc) => textStub(t, acc, results)]),
  );
  r.topic = dialogTopic(r.append, r.visit);
  return r;
};
const textCalls = (s) => (acc) => {
  const results = [...s.results];
  return new Map(Object.values(TEXT_TARGETS).map((t) => [t, () => textStub(t, acc, results)]));
};
// Dialog record [11] from Y=4: entries (key, length, flag byte, IDs, [action word], text word), ending at F8.
function dialogRecord(int, pick, put, key) {
  const bytes = [0, 0, 0, 0];
  const keys = [0xff, 0xfe, 0x10, 0x20, 0x30, int(256)];
  for (let n = 1 + int(4); n > 0; n--) {
    const k = pick(keys),
      ids = int(4),
      action = int(2);
    const flag = (action ? 0x80 : 0) | ids | (int(3) === 0 ? 0x40 : 0);
    const inner = [flag];
    for (let i = 0; i < ids; i++) inner.push(pick([0x10, 0x11, 0x30, 0x05, int(0xf0)]));
    if (action) inner.push(int(256), int(256));
    inner.push(int(256), int(256));
    bytes.push(k, inner.length + 1, ...inner);
  }
  if (int(4)) bytes.push(pick([key & 255, 0xff, 0xfe]), 5, int(256), int(256), int(256), int(256));
  bytes.push(0xf8);
  for (let n = 0; n < bytes.length; n++) put.byte(0x7f8000 + n, bytes[n]);
  put(0x11, 0x8000);
  put(0x13, 0x7f);
}
check(
  '9178/908C',
  [window(0x809178, 0x8091e2), window(0x80908c, 0x8090eb, { initialM: 1 })],
  0x809178,
  3000,
  ({ s, int, pick, put }) => {
    put.byte = (a, v) => {
      s.wram[a - 0x7e0000] = v;
    };
    const key = pick([0xffff, 0xfffe, 0xfffd, 0x10, 0x20, int(0x10000)]);
    s.a = key;
    dialogRecord(int, pick, put, key);
    put(0x14, int(0x10000));
    put(0x26, int(0x10000));
    const list = [
      ...new Set(Array.from({ length: int(6) }, () => pick([0x05, 0x10, 0x11, 0x20, int(0xf0)]))),
    ].sort((x, y) => x - y);
    for (let n = 0; n < 0x30; n++) {
      s.wram[0x3ca3 + n] = n < list.length ? list[n] : n === list.length ? 0xff : int(256);
      s.wram[0x3cd6 + n] = int(2);
    }
    s.results = [];
    return s;
  },
  {
    native: (h, e, s) => showDialogText(h, e, textRoutines(s)),
    calls: (acc, e, s) => textCalls(s)(acc),
  },
);
check(
  '91E2',
  [window(0x8091e2, 0x80920d)],
  0x8091e2,
  200,
  ({ s, int, pick, put }) => {
    put(0x17, int(0x10000));
    s.results = [pick([0, 1, 2, 0xffff])];
    return s;
  },
  {
    native: (h, e, s) => chooseDialogAction(h, e, textRoutines(s)),
    calls: (acc, e, s) => textCalls(s)(acc),
  },
);
check(
  '9215',
  [window(0x809215, 0x8092c5)],
  0x809215,
  1500,
  ({ s, int, pick }) => {
    const count = int(3) === 0 ? 0 : int(12);
    for (let n = 0; n < 0x40; n++) {
      s.wram[0x3ca3 + n] = n < count ? int(0xff) : n === count ? 0xff : int(256);
      s.wram[0x3cd6 + n] = int(3) === 0 ? 1 : 0;
    }
    s.results = [int(0x10000), pick([0, 1, 2, 3, 0xffff, int(8)])];
    return s;
  },
  {
    native: (h, e, s) => chooseDialogTopic(h, e, textRoutines(s)),
    calls: (acc, e, s) => textCalls(s)(acc),
  },
);

// Scene object tiles (ADF4/AE12/AC2F). Animation streams are in WRAM (bank 8C, offset < 2000),
// Picture pointers address ROM locations in 9B/9C with few tiles so every path is reachable.
import { reloadObjectTiles } from '../proof/system/native-scene-tiles.mjs';
import { DIALOG_WINDOWS } from './task-native-936c-windows.mjs';
const smallFrames = (() => {
  const list = [];
  for (let a = 0x8000; a < 0xff00; a += 7)
    for (const bank of [0x9b, 0x9c])
      if (rom[romOffset((bank << 16) | a)] >= 1 && rom[romOffset((bank << 16) | a)] <= 6)
        list.push((a & 0x7fff) | (bank === 0x9c ? 0x8000 : 0));
  return list;
})();
check(
  'ADF4/AE12/AC2F',
  DIALOG_WINDOWS.adf4,
  0x80adf4,
  2500,
  ({ s, int, pick, put }) => {
    const objects = [0x10, 0x20, 0x30, 0x40].slice(0, 1 + int(3));
    put(0x14b0, 2 * (objects.length - 1));
    objects.forEach((o, k) => put(0x14b2 + 2 * k, o));
    put(0x40, int(0x10000));
    put(0x82, pick([0, 4, 0x10, 0x20, 0x30, 0x48]));
    // Slot chain: free list from 0D1E through $1564, object chains from $12F8+X.
    const slots = Array.from({ length: 64 }, (_, k) => 0x60 + 2 * k);
    let next = 0;
    const chain = (n) => {
      const first = slots[next] ?? 0x60;
      for (let k = 0; k < n; k++) {
        const s = slots[next++] ?? 0x60;
        put(0x1564 + s, slots[next] ?? 0x60);
      }
      return first;
    };
    for (const o of objects) {
      const stream = 0x1e00 + (o - 0x10) * 4;
      for (let n = 0; n < 0x20; n += 2) put(stream + n, pick(smallFrames));
      for (let n = 0x20; n < 0x40; n++) s.wram[stream + n] = 2 * int(0xf);
      const noStream = int(4) === 0;
      put(0x1090 + o, noStream ? 0 : stream);
      put(0x11f0 + o, 2 + 2 * int(8));
      put(0x1198 + o, 0x20 + int(8));
      const count = pick([0, 1, 2, 3]);
      put(0x12a0 + o, count);
      put(0x12f8 + o, chain(count));
      put(0x1140 + o, noStream ? 0xffff : pick([0, 0, 0, 0xffff, pick(smallFrames)]));
      put(0x7e4088 + o, pick([0, 0x10, 0x7f, int(0x10000)]));
      put(0x7e4030 + o, pick([0, 0x70, int(0x80)]));
      put(0x7e3fd8 + o, pick([1, 1, 2, int(0x10000)]));
      put(0x10e8 + o, pick([0, 0, 5, 0x85]));
      put(0x1038 + o, int(0x10000));
      put(0x1350 + o, pick([0xffff, 0x10]));
      put(0x7e3f80 + o, int(0x10000));
      put(0xf88 + o, int(0x10000));
      put(0xfe0 + o, int(0x10000));
    }
    // Keep enough free slots; otherwise AE12 repeats the image change endlessly, as in the original.
    put(0xd1e, slots[next] ?? 0x60);
    chain(30);
    put(0xd1c, pick([28, 30]));
    put(0xba2 + 0x10, pick([0x8000, 5]));
    put(0x372 + 0x10, 0x20);
    put(0xba2 + 0x20, 3);
    put(0xc62 + 0x20, int(0x10000));
    put(0xc62 + 0x10, int(0x10000));
    put(0x1562, int(4));
    put(0x7e1c76, int(0x10000));
    s.waits = [];
    // Add observations as needed: counter (new value), task list (exit 0, DP82 from NMI).
    s.feed = (d) =>
      d.pc === 0x81b0a5
        ? int(0x10000)
        : d.address === 0x82
          ? pick([0xfffe, 0xfffe, 0xfffe, 0, 8])
          : d.address === 0x1562 && d.pc === 0x80ae23
            ? 0
            : pick([0, 0, 1]);
    return s;
  },
  {
    native: (h, e) => reloadObjectTiles(h, e),
    calls: counterCalls,
    waits: [0x80ae0c, 0x80ae5e, 0x80ae23],
    feed: true,
  },
);

// Scene sprites (B8DE with AFFC, AB0A, B20A, B130). Choose each object's camera so images land on, beside,
// and outside the screen; the bank 7F map uses empty (negative) and small cells.
import { buildSpriteList } from '../proof/replay/native-scene-sprites.mjs';
import { runSpriteList } from '../src/game/main-upkeep.mjs';
const romByte = (address) => rom[romOffset(address)];
// Image headers with 1..6 rows and columns (byte 2): 0 counts 65536 times as in the original; large images run
// into $1C72 through the occlusion buffers $1872/$1A72 (neither case occurs for real characters).
const pictures = (() => {
  const list = [];
  for (let a = 0x8000; a < 0xff00; a += 3)
    for (const bank of [0x9b, 0x9c]) {
      const b = rom[romOffset((bank << 16) | (a + 2))];
      if (b >> 4 && b >> 4 <= 6 && b & 15 && (b & 15) <= 6)
        list.push((a & 0x7fff) | (bank === 0x9c ? 0x8000 : 0));
    }
  return list;
})();
// The register-level reference and the lifted sprite list (src/game/sprite-list.mjs).
for (const [name, native] of [
  ['B8DE/AFFC/B20A/B130', (h) => buildSpriteList(h)],
  ['lifted B8DE', (h) => runSpriteList(h)],
])
  check(
    name,
    DIALOG_WINDOWS.b8de,
    0x80b8de,
    3000,
    ({ s, int, pick, put }) => {
      for (let n = 0x10000; n < 0x20000; n += 2)
        put(0x7e0000 + n, int(2) ? 0x8000 | int(0x8000) : 2 * int(0x800));
      const objects = [0x10, 0x20, 0x30, 0x40].slice(0, 1 + int(4)),
        count = int(8) === 0 ? 0 : objects.length;
      put(0x14b0, count ? 2 * (count - 1) : 0xfffe);
      objects.forEach((o, k) => put(0x14b2 + 2 * k, o));
      const sorted = int(3) === 0;
      put(0xcc2, pick([0xffff, ...objects]));
      // The first object sets the camera; the others stand beside it.
      let cx = null,
        cy = null;
      for (const o of objects) {
        const picture = pick(pictures),
          address = (picture & 0x8000 ? 0x9c0000 : 0x9b0000) | (picture | 0x8000);
        put(0x7e3f80 + o, int(6) === 0 ? 0 : picture);
        put(0x1458 + o, int(0x10000) & ~(int(3) ? 0x80 : 0));
        const depth = 0x200 + int(0x600),
          height = int(4) ? int(0x40) : int(0x400),
          x = int(0x800),
          z = int(0x800);
        put(0xf30 + o, depth);
        put(0xed8 + o, height);
        put(0xe28 + o, x);
        put(0xe80 + o, z);
        if (cx === null && int(6) === 0) {
          // Image just above map row 0: camera 0, large depth (B349..B350).
          const k = 1 + int(0x14);
          put(0xf30 + o, (0xc00 - height - 2 * romByte(address + 1) + 4 * k) & 0xffff);
          cy = int(4);
          const sx = (((0x600 + z - x - 2 * romByte(address)) << 16) >> 16) >> 2;
          cx = (sx - pick([0, 0x10, 0x80])) * 4;
        }
        if (cx === null) {
          const sy = (((0xc00 - depth - height - 2 * romByte(address + 1)) << 16) >> 16) >> 2,
            sx = (((0x600 + z - x - 2 * romByte(address)) << 16) >> 16) >> 2;
          cy = (sy - pick([-0x30, -8, 0, 0x10, 0x60, 0xc0, 0xd4, 0xe0])) * 4;
          cx = (sx - pick([-0x30, -8, 0, 0x10, 0x80, 0xe8, 0xf4, 0x100])) * 4;
        }
        put(0x12f8 + o, int(0x100));
        put(0x1400 + o, pick([0, 0, 0, 0, 1, 0x8000]));
        put(0x1248 + o, int(0x20));
        put(0xf88 + o, sorted ? 0 : pick([1, 2, 3, 4, 0x8001, 0x8002, 0x8003, 0x8004]));
        put(0xfe0 + o, int(0x80));
      }
      put(0xcc6, cy & 0xffff);
      put(0xcc4, cx & 0xffff);
      for (let n = 0; n < 0x200; n++) s.wram[0x1564 + n] = int(256);
      put(0x84, int(0x10000));
      put(0x1562, int(4));
      return s;
    },
    { native },
  );

// The lifted depth sort and palette slot alone (src/game/depth-sort.mjs, palette-slots.mjs),
// so that the registers and flags they leave, which the sprite list overwrites, are compared.
import { sortDrawList } from '../src/game/depth-sort.mjs';
import { paletteSlot } from '../src/game/palette-slots.mjs';
const b8deWindows = (starts) => DIALOG_WINDOWS.b8de.filter((w) => starts.includes(w.start));
check(
  'lifted AFFC',
  b8deWindows([0x80affc, 0x80b0ed, 0x80b0f2]),
  0x80affc,
  1500,
  ({ s, int, pick, put }) => {
    const count = int(6),
      objects = [0x10, 0x20, 0x30, 0x40, 0x50].slice(0, count),
      ruled = int(3) !== 0;
    put(0x14b0, count ? 2 * (count - 1) : pick([0xfffe, 0x8000]));
    objects.forEach((o, k) => put(0x14b2 + 2 * k, o));
    const near = int(4) === 0;
    for (const o of objects) {
      put(0xf30 + o, near ? 0x7f00 + int(0x200) : int(8) ? int(0x1000) : 0x400);
      put(0xf88 + o, ruled ? pick([1, 2, 3, 4, 0x8001, 0x8002, 0x8003, 0x8004]) : 0);
      put(0xfe0 + o, near ? 0x7f00 + int(0x200) : int(0x80));
      put(0xe28 + o, int(4) ? int(0x40) : 0x20);
      put(0xe80 + o, int(4) ? int(0x40) : 0x20);
    }
    return s;
  },
  { native: (h) => sortDrawList(h) },
);
check(
  'lifted AB0A',
  b8deWindows([0x80ab0a]),
  0x80ab0a,
  600,
  ({ s, int, pick, put }) => {
    s.a = pick([0, 1, int(0x20), 0x8000 | int(0x20)]);
    for (let n = 0; n < 0x20; n++)
      put(0x17e6 + 2 * n, int(2) ? 0x8000 | int(0x8000) : 2 * int(0x10));
    put(0x17d4, 2 * int(0x10));
    return s;
  },
  { native: (h) => paletteSlot(h) },
);

// Native95/936C code with 92C5: every called routine uses an identical stub with a real frame
// (RTS or RTL); menu (91E2), topics (9215), text (9178, sets $1D63) and window (F963) provide their
// results from scenario lists, followed by Exit.
import { talkWithObject } from '../proof/replay/native-dialog.mjs';
const DIALOG_CALLEES = [
  0x81886a, 0x80bcb2, 0x80ff79, 0x81ef47, 0x80f963, 0x80fa92, 0x809f6d, 0x808f20, 0x809022,
  0x80905e, 0x808f3a, 0x809178, 0x81b0a1, 0x8091e2, 0x809215, 0x80fa3e, 0x808f97, 0x80adf4,
  0x809e1a, 0x80b8de,
];
function dialogStub(target, acc, lists) {
  const { ctx } = acc,
    raw = acc.pullWord();
  if (target >>> 16 === 0x81) {
    ctx.programBank = acc.read((ctx.s + 1) & 0xffff);
    ctx.s = (ctx.s + 1) & 0xffff;
  }
  ctx.pc = (raw + 1) & 0xffff;
  const dp = [0, 2, 4, 6, 8, 0xa].map((o) => acc.readWord(o, 16));
  acc.trace.push({
    kind: 'call',
    pc: target,
    address: dp[0] | (dp[1] << 16),
    value: (dp.slice(2).reduce((v, w) => v * 31 + w, ctx.a) + ctx.x * 7 + ctx.y) % 0x1000000,
  });
  const next = (name, fallback) => (lists[name].length ? lists[name].shift() : fallback);
  let a = (dp[0] * 5 + dp[2] + target) & 0xffff;
  if (target === 0x8091e2) {
    a = next('menu', 0);
    acc.writeWord(0, a, 16);
  }
  if (target === 0x809215) acc.writeWord(0, next('topic', 0xff), 16);
  if (target === 0x809178) acc.writeWord(0x801d63, next('talk', 0), 24);
  if (target === 0x80f963) acc.writeWord(0, next('window', 0x40), 16);
  ctx.a = a;
  ctx.status = (ctx.status & ~0x83) | (a & 0x8000 ? 0x80 : 0) | (a === 0 ? 2 : 0) | (dp[3] & 1);
  return { rawReturnWord: raw };
}
const dialogLists = (s) => ({
  menu: [...s.menu],
  topic: [...s.topic],
  talk: [...s.talk],
  window: [...s.windows],
});
check(
  '936C/92C5',
  DIALOG_WINDOWS['936c'],
  0x80936c,
  3000,
  ({ s, int, pick, put }) => {
    put(0, int(0x60));
    put(2, pick([0x10, 0x20, 0x30, int(0x60)]));
    put(0x1fd6, int(0x10000));
    put(0x1cde, pick([9, 0xa, int(0x10000)]));
    s.wram[0x3c17] = pick([0, 1]);
    for (let n = 0; n < 0x40; n++) s.wram[0x3ca3 + n] = int(256);
    put(0x1d63, int(0x10000));
    // Dialog record [11] in bank 8D (through 80:94F7): flag byte at +3 comes from ROM.
    const steps = int(6);
    s.menu = Array.from({ length: steps }, () => pick([1, 1, 2, 2, int(4)]));
    s.menu.push(0);
    s.talk = Array.from({ length: steps }, () => (int(6) === 0 ? pick([1, 0x100]) : 0));
    s.topic = Array.from({ length: steps }, () => pick([0xff, 0, 1, 3, 0xffff]));
    s.windows = [int(0x10000), int(0x10000)];
    return s;
  },
  {
    native: (h, e, s) => {
      const lists = dialogLists(s);
      talkWithObject(
        h.a,
        e,
        true,
        new Map(DIALOG_CALLEES.map((t) => [t, (hh) => dialogStub(t, hh.a, lists)])),
      );
    },
    calls: (acc, e, s) => {
      const lists = dialogLists(s);
      return new Map(DIALOG_CALLEES.map((t) => [t, () => dialogStub(t, acc, lists)]));
    },
  },
);

import { decodeTaskWindows } from './task-partial-source.mjs';
import {
  native936CSpecs,
  prove936CSource,
  native936CExpected,
} from './task-native-936c-source.mjs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';
test('936C and its subroutines: pinned windows and stack/mode proofs per group, bound as special native', () => {
  assert.deepEqual(
    native936CSpecs.map((s) => s.name).sort(),
    Object.keys(native936CExpected).sort(),
  );
  for (const spec of native936CSpecs) {
    const { map } = decodeTaskWindows(romBytes, spec.windows),
      proof = prove936CSource(map, spec);
    assert.equal(
      proof.reachable_instructions,
      native936CExpected[spec.name].instructions,
      spec.name,
    );
  }
  assert.ok(SPECIAL_NATIVES.has(0x80936c));
});
