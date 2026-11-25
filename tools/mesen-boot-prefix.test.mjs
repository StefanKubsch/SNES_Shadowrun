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
