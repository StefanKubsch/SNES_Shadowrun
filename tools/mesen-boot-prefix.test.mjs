import test from 'node:test';
import assert from 'node:assert/strict';
import { findMesen } from './mesen.mjs';
import { recordBootPrefix, compareBootPrefix } from './mesen-boot-prefix.mjs';

const { exe, reason } = findMesen();
// Historical wait/SPC totals belong to the original six recorder windows.
// Count those windows positively; new graphics/audio observations must not
// change their meaning. The independent total still checks every new node.
const legacyRanges = [
  [0x81eebb, 0x81eed4],
  [0x81efa5, 0x81f006],
  [0x81f07f, 0x81f091],
  [0x81ef07, 0x81ef25],
  [0x809e1a, 0x809e3c],
  [0x81de28, 0x81de28],
];
const legacySteps = (r) =>
  r.chronology.reduce(
    (sum, o) =>
      sum +
      (o.kind === 'L'
        ? o.count * 2
        : Number(o.kind === 'T' && legacyRanges.some(([lo, hi]) => o.pc >= lo && o.pc <= hi))),
    0,
  );
test(
  'Mesen cold reset and initial display setup match through the first original wait entry',
  { skip: exe ? false : 'Mesen not available: ' + reason },
  async (t) => {
    const recorded = await recordBootPrefix(exe),
      report = compareBootPrefix(recorded);
    t.diagnostic(JSON.stringify({ ...report, recording: recorded.recording }));
    // A byte of game state (the main stack below S is free).
    const changed = recorded.final.wram.slice();
    changed[0x200] ^= 1;
    assert.throws(
      () => compareBootPrefix({ ...recorded, final: { ...recorded.final, wram: changed } }),
      /original boot WRAM/,
    );
    assert.throws(
      () => compareBootPrefix({ ...recorded, io: recorded.io.slice(1) }),
      /original boot IO/,
    );
  },
);

test(
  'Mesen title skip reaches the new-game menu with an NMI inside the real buffer MVN',
  { skip: exe ? false : 'Mesen not available: ' + reason },
  async (t) => {
    const recorded = await recordBootPrefix(exe, {
        checkpoint: 0x81e14a,
        menuInput: true,
        menuStart: false,
      }),
      report = compareBootPrefix(recorded);
    const { dmaRequests, ...summary } = report;
    t.diagnostic(
      JSON.stringify({
        ...summary,
        dmaRequests: dmaRequests.length,
        recording: recorded.recording,
      }),
    );
    assert.equal(report.nmis, 436);
    assert.equal(legacySteps(recorded), 7124147);
    assert.equal(report.ioBytes, 416475);
    assert.equal(report.dmaBytes, 316896);
    assert.equal(dmaRequests.length, 52);
    assert.ok(
      recorded.io.some((o) => o.address === 0x812140),
      'DDB1 original DBR81 APU reads',
    );
    const at = recorded.chronology.findIndex((o) => o.kind === 'H' && o.pc === 0x81de28),
      nmi = recorded.chronology[at];
    assert.ok(nmi);
    assert.deepEqual(nmi.context, {
      a: 0x252,
      x: 0x5454,
      y: 0x5455,
      s: 0x133,
      d: 0,
      bank: 0x7e,
      status: 5,
      programBank: 0x81,
      pc: 0xde28,
      e: 0,
    });
    const chronology = recorded.chronology.slice();
    chronology[at] = { ...nmi, context: { ...nmi.context, bank: nmi.context.bank ^ 1 } };
    assert.throws(
      () => compareBootPrefix({ ...recorded, chronology }),
      /original interrupted boot registers/,
    );
    assert.throws(
      () => compareBootPrefix({ ...recorded, io: recorded.io.slice(1) }),
      /original boot IO count/,
    );
  },
);

test(
  'Mesen cold boot logo, SPC transfer and notice reach the original title owner with real NMI chronology',
  { skip: exe ? false : 'Mesen not available: ' + reason },
  async (t) => {
    const recorded = await recordBootPrefix(exe, { checkpoint: 0x80a139 }),
      report = compareBootPrefix(recorded);
    t.diagnostic(JSON.stringify({ ...report, recording: recorded.recording }));
    assert.equal(report.nmis, 397);
    assert.equal(legacySteps(recorded), 6523598);
    assert.equal(report.dmaRequests.length, 10);
    assert.equal(report.dmaBytes, 162784);
    // Moving an actual interrupt relative to the device stream must fail,
    // even though all IO values and the instruction path are unchanged.
    const first = recorded.chronology.findIndex((o) => o.kind === 'H'),
      chronology = recorded.chronology.slice();
    chronology[first] = { ...chronology[first], ioCursor: chronology[first].ioCursor + 1 };
    assert.throws(
      () => compareBootPrefix({ ...recorded, chronology }),
      /original boot NMI\/IO order/,
    );
    const poll = recorded.chronology.findIndex((o) => o.kind === 'L'),
      shortened = recorded.chronology.slice();
    assert.ok(shortened[poll].count > 1);
    shortened[poll] = { ...shortened[poll], count: shortened[poll].count - 1 };
    assert.throws(
      () => compareBootPrefix({ ...recorded, chronology: shortened }),
      /original boot instruction count/,
    );
    // The ROM notice actually uses STA ($0E) to write each scroll latch twice.
    const scroll = recorded.io.filter((o) => o.kind === 'write' && o.pcAfter === 0x81ecc9);
    assert.deepEqual(
      scroll.map((o) => [o.address, o.value]),
      [
        [0x80210d, 0xfc],
        [0x80210d, 0xff],
      ],
    );
    assert.equal(
      recorded.io.filter((o) => o.kind === 'write' && o.pcAfter === 0x81effd).length,
      0xc55,
    );
  },
);

test(
  'Mesen cold boot completes the new-game menu with inner unpack NMIs and original audio polling',
  { skip: exe ? false : 'Mesen not available: ' + reason },
  async (t) => {
    const recorded = await recordBootPrefix(exe, { checkpoint: 0x81ef63, menuInput: true }),
      report = compareBootPrefix(recorded);
    const { dmaRequests, ...summary } = report;
    t.diagnostic(
      JSON.stringify({
        ...summary,
        dmaRequests: dmaRequests.length,
        recording: recorded.recording,
      }),
    );
    const first = recorded.chronology.findIndex((o) => o.kind === 'H' && o.pc === 0x809ff7),
      nmi = recorded.chronology[first];
    assert.ok(nmi);
    assert.deepEqual(nmi.context, {
      a: 0x30a,
      x: 3,
      y: 0x37,
      s: 0x12d,
      d: 0,
      bank: 0x7f,
      status: 0x34,
      programBank: 0x80,
      pc: 0x9ff7,
      e: 0,
    });
    for (const pc of [0x81eb88, 0x80a01c, 0x809e65, 0x809e67, 0x81e1b9, 0x81e513])
      assert.ok(
        recorded.chronology.some((o) => o.kind === 'H' && o.pc === pc),
        'actual inner NMI ' + pc.toString(16),
      );
    const move = recorded.chronology.find((o) => o.kind === 'H' && o.pc === 0x80a01c);
    assert.deepEqual(move.context, {
      a: 0x507,
      x: 0x2b58,
      y: 0x2b59,
      s: 0x12d,
      d: 0,
      bank: 0x7f,
      status: 5,
      programBank: 0x80,
      pc: 0xa01c,
      e: 0,
    });
    const chronology = recorded.chronology.slice();
    chronology[first] = { ...nmi, context: { ...nmi.context, bank: nmi.context.bank ^ 1 } };
    assert.throws(
      () => compareBootPrefix({ ...recorded, chronology }),
      /original interrupted boot registers/,
    );
  },
);

test(
  'Mesen cold boot completes the first scene on the original owner with exact inner NMI and DMA chronology (M3)',
  { skip: exe ? false : 'Mesen not available: ' + reason },
  async (t) => {
    const recorded = await recordBootPrefix(exe, { checkpoint: 0x8096ab, menuInput: true }),
      report = compareBootPrefix(recorded);
    const { dmaRequests, ...summary } = report;
    t.diagnostic(
      JSON.stringify({
        ...summary,
        dmaRequests: dmaRequests.length,
        recording: recorded.recording,
      }),
    );
    assert.equal(report.nmis, 636);
    assert.equal(report.interruptSteps, 11005441);
    assert.equal(report.ioBytes, 1051707);
    assert.equal(report.writeInstructions, 161380);
    assert.equal(report.dmaBytes, 943460);
    assert.equal(dmaRequests.length, 1369);
    assert.deepEqual(
      dmaRequests.filter((q) => q.transfers.some((x) => x.dmap === 8)),
      [1, 2].map(() => ({
        pc: 0x81a7bc,
        mask: 4,
        transfers: [{ channel: 2, dmap: 8, bbad: 4, bank: 0x81, source: 0xa7fb, bytes: 544 }],
      })),
    );
    const at = recorded.chronology.findIndex((o) => o.kind === 'H' && o.pc === 0x818fcb),
      nmi = recorded.chronology[at];
    assert.ok(nmi);
    assert.deepEqual(nmi.context, {
      a: 0x616,
      x: 0x616,
      y: 0x16,
      s: 0x133,
      d: 0,
      bank: 0x7e,
      status: 4,
      programBank: 0x81,
      pc: 0x8fcb,
      e: 0,
    });
    const chronology = recorded.chronology.slice();
    chronology[at] = { ...nmi, context: { ...nmi.context, s: nmi.context.s ^ 1 } };
    assert.throws(
      () => compareBootPrefix({ ...recorded, chronology }),
      /original interrupted boot registers/,
    );
    const index = recorded.io.findIndex((o) => o.kind === 'dma-write' && o.pcAfter === 0x81a7bf),
      io = recorded.io.slice();
    assert.ok(index >= 0);
    io[index + 41] = { ...io[index + 41], value: io[index + 41].value ^ 1 };
    assert.throws(() => compareBootPrefix({ ...recorded, io }), /original boot DMA/);
  },
);
