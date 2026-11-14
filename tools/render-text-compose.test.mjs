import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderFE69, prepareRenderFB39, renderFE69, renderFB39 } from '../proof/render/text-compose.mjs';
import { textEntry as entry, textWindows as windows, textFixture as fixture, textWord as word } from './render-text-compose-fixtures.mjs';

const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
const run = (data, extra = {}, fn = prepareRenderFB39) => fn({ ...entry, data, ...extra });
function failure(data, extra, reason, fn = prepareRenderFB39) {
  const before = data.snapshot(), p = run(data, extra, fn);
  assert.equal(p.handled, false); assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
const glyphReads = p => p.operations.filter(e => e.kind === 'read' && e.address >= 0x95F2D0 && e.address <= 0x9672CF);
const wrapFixture = () => fixture({ width: 4, text: [65, 66, 32, 67, 68, 69, 0, 0] });
const wrapContext = { ioRead4214: [0, 1], ioRead4216: [0, 0, 1, 0, 0], waitRead01FA: [5, 0, 7, 8, 0] };

test('FE69 decodes and composes in one immutable plan with complete chronological helper access', () => {
  const data = fixture(), before = data.snapshot(), p = run(data, {}, prepareRenderFE69);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.characters, 1); assert.equal(p.bits, 2); assert.equal(p.glyphs, 1); assert.equal(p.rows, 8);
  assert.equal(p.outputBytes, 66); assert.equal(p.resultReads, 2); assert.equal(p.pollsFA, 1); assert.equal(p.pollsFC, 1);
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.operations)); assert.ok(Object.isFrozen(p.operations[0]));
  assert.ok(data.commit(p).handled); assert.equal(data.readByte(0x7E21A0).value, 65);
  assert.equal(data.readByte(0x7E21A1).value, 0); assert.equal(get(data, 0xCF), 0x8012);
  assert.equal(get(data, 0x7E20C2), 0x21); assert.equal(get(data, 0x7E20E2), 4);
  const phases = p.operations.map(e => e.phase);
  assert.ok(phases.indexOf('bit') < phases.indexOf('ADBA')); assert.ok(phases.indexOf('ADBA') < phases.indexOf('AE14'));
  assert.equal(p.ioRequests.filter(e => e.kind === 'read').length, 2);
});
test('FB39 eight independently expected glyph rows, split masks and cursor are preserved', () => {
  const data = fixture(), p = run(data); assert.ok(p.handled); data.commit(p);
  for (const [row, expected] of [0xF0, 0x10, 0x20, 0x40, 0x80, 0, 0, 0].entries()) {
    assert.equal(get(data, 0x7E2AE0 + row * 2), 0xFF00 | expected);
    assert.equal(get(data, 0x7E2AF0 + row * 2), 0xFF00);
  }
  assert.equal(get(data, 0xAB), 16); assert.equal(get(data, 0xBA), 0); assert.equal(get(data, 0xA8), 60);
  assert.equal(p.a, 0); assert.equal(p.x, 2); assert.equal(p.y, 0); assert.equal(p.status, 6);
});
test('FE69 keeps both packed characters and only stops on the actual newline token', () => {
  for (const [terminal, characters, decoded] of [[0xC142, 2, [65, 66, 0]], [0xC10A, 1, [65, 0]], [0x8A41, 0, [0]]]) {
    const data = fixture(); word(data, 0x9D8000, terminal);
    const p = run(data, {}, prepareRenderFE69); assert.ok(p.handled); assert.equal(p.characters, characters);
    assert.equal(p.bits, terminal === 0xC142 ? 2 : 1); data.commit(p);
    assert.deepEqual(decoded.map((_, i) => data.readByte(0x7E21A0 + i).value), decoded);
  }
});
test('FE69 negative offset selects9E stream while dictionary lookups remain9D', () => {
  const data = fixture({ sourceOffset: 0x8010 }), p = run(data, {}, prepareRenderFE69); assert.ok(p.handled);
  assert.ok(p.operations.some(e => e.kind === 'read' && e.address === 0x9E8010));
  assert.ok(p.operations.some(e => e.kind === 'read' && e.address === 0x9D8000));
  data.commit(p); assert.equal(data.readByte(0xD1).value, 0x9E);
});
test('FE69 dictionary traversal has fresh WORD nodes and Carry-selected edges', () => {
  const data = fixture(); word(data, 0x9D8000, 4); word(data, 0x9D8006, 0xC10A);
  const p = run(data, {}, prepareRenderFE69); assert.ok(p.handled); assert.equal(p.bits, 2);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.address >= 0x9D8000 && e.address < 0x9D8010)
    .map(e => e.address), [0x9D8000, 0x9D8006]);
});
test('FE69 restores all entry banks and PLB BYTE N/Z; helpers always receive actual7E', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = run(fixture(), { bank }, prepareRenderFE69); assert.ok(p.handled); assert.equal(p.bank, bank);
    assert.equal(p.status & 0x82, (bank & 0x80) | (bank === 0 ? 2 : 0)); assert.equal(p.status & 4, 4);
    assert.ok(p.ioRequests.every(e => e.address >>> 16 === 0x80));
    assert.ok(p.operations.some(e => e.address === 0x7E01FC));
  }
});
test('empty FB39 still requests initialization but never glyph/final transfers', () => {
  const p = run(fixture({ text: [0, 0] })); assert.ok(p.handled);
  assert.equal(p.glyphs, 0); assert.equal(p.rows, 0); assert.equal(p.outputBytes, 16); assert.equal(p.pollsFA, 0);
  assert.equal(p.pollsFC, 1); assert.equal(p.a, 0); assert.equal(p.x, 0); assert.equal(p.y, 0);
  assert.equal(p.status, 6); assert.equal(glyphReads(p).length, 0);
});
test('standalone FB39 uses actualDBR7F buffers/counters and fixed7E Long window headers', () => {
  const data = fixture(); data.seed(0x7F21A0, [65, 0, 0]); data.seed(0x7F2AE0, Array(256).fill(0xAA));
  word(data, 0x7F01FA, 0); word(data, 0x7F01FC, 0);
  const p = run(data, { bank: 0x7F }); assert.ok(p.handled); data.commit(p);
  assert.equal(get(data, 0x7E20C2), 0x21); assert.equal(get(data, 0x7F2AE0), 0xFFF0);
  assert.equal(get(data, 0x7E2AE0), 0xAAAA);
  assert.ok(p.operations.some(e => e.phase === 'wait' && e.address === 0x7F01FA));
});
test('all style bytes preserve uppercase, doubled glyph reads and all eight rendering rows', () => {
  for (let style = 0; style < 256; style++) {
    const p = run(fixture({ style, text: [97, 0, 0] })); assert.ok(p.handled, `style${style}`);
    const glyph = style & 128 ? 65 : 97, reads = glyphReads(p);
    assert.equal(reads.length, style & 8 ? 16 : 8);
    assert.equal(reads[0].address, 0x95F2D0 + glyph * 8); assert.equal(p.rows, 8);
  }
});
test('style shifts and underline are independently reflected in B4 row stores', () => {
  for (const style of [0, 8, 0x10, 0x20, 0x40, 0x60, 0x78]) {
    const p = run(fixture({ style })); assert.ok(p.handled);
    const writes = p.operations.filter(e => e.kind === 'write' && e.address === 0xB4);
    const finalRows = [];
    for (let i = 0; i < p.operations.length; i++) if (p.operations[i].kind === 'write' && p.operations[i].address === 0xB5)
      finalRows.push(p.operations.slice(0, i).findLast(e => e.kind === 'write' && e.address === 0xB4).value);
    const expected = [15, 1, 2, 4, 8, 16, 32, 64].map((bits, row) => {
      let n = style & 8 ? bits | bits * 2 : bits;
      const counter = 7 - row;
      if ((style & 0x60) === 0x60 ? counter % 2 === 0 : style & 0x20 ? counter < 5 : style & 0x40 && counter >= 5) n *= 2;
      if (style & 0x10 && counter === 0) n = 255;
      return n & 255;
    });
    assert.deepEqual(finalRows, expected); assert.ok(writes.length >= 8);
  }
});
test('underline excludes the literal space glyph0107 only', () => {
  const p = run(fixture({ style: 0x10, text: [32, 0, 0] })); assert.ok(p.handled);
  assert.ok(!p.operations.some(e => e.kind === 'write' && e.address === 0xB4 && e.value === 255));
});
test('literal style marker is rewritten in-place and style is reset at a word boundary', () => {
  const data = fixture({ text: [0x7C, 65, 32, 66, 0, 0] }), p = run(data); assert.ok(p.handled); data.commit(p);
  assert.equal(data.readByte(0x7E21A0).value, 0x1A); assert.equal(get(data, 0xAE), 0);
  assert.equal(p.glyphs, 4); assert.equal(glyphReads(p).length, 48);
  assert.equal(p.operations.filter(e => e.kind === 'write' && e.address === 0x7E21A0).length, 1);
});
test('initial masks use fresh old words and A2; nonzero full offset retains mask values', () => {
  const p = run(fixture({ offset: 4, text: [0, 0] })); assert.ok(p.handled);
  assert.equal(p.operations.find(e => e.kind === 'write' && e.address === 0xA2).value, 0xF0F0);
  const writes = p.operations.filter(e => e.kind === 'write' && e.phase === 'composeFB39'
    && e.address >= 0x7E2AE0 && e.address <= 0x7E2AEE);
  assert.deepEqual(writes.map(e => e.value), Array(8).fill(0xA0A0));
  assert.equal(p.pollsFA, 1);
});
test('word transition globally distributes arithmetic reads and repeated wait polls', () => {
  const data = wrapFixture(), p = run(data, wrapContext); assert.ok(p.handled);
  assert.equal(p.glyphs, 6); assert.equal(p.rows, 48); assert.equal(p.newlines, 1);
  assert.equal(p.quotientReads, 2); assert.equal(p.resultReads, 5); assert.equal(p.pollsFA, 5); assert.equal(p.pollsFC, 1);
  assert.deepEqual(p.ioRequests.filter(e => e.kind === 'read').map(e => e.value), [0, 0, 0, 1, 1, 0, 0]);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.phase === 'wait' && e.address === 0x7E01FA)
    .map(e => e.value), [5, 0, 7, 8, 0]);
  const maskWrites = p.operations.filter(e => e.kind === 'write' && e.phase === 'composeFB39' && e.bytes === 2
    && e.address >= 0x7E2AE0 && e.address <= 0x7E2AEE);
  assert.deepEqual(maskWrites.slice(8).map(e => e.value), Array(8).fill(0));
  data.commit(p); assert.equal(get(data, 0x7E20C2), 0x23); assert.equal(get(data, 0x7E20E2), 4);
});
test('no-flush line transition keeps the measured character index rather than reloadingDP00', () => {
  const data = fixture({ width: 3, text: [65, 66, 0, 0] });
  const p = failure(data, wrapContext, 'render_source_required'); assert.equal(p.phase, 'AE4D');
  // Its cursor read aliases the seeded origin2102; the next base read
  // exposes the unreloaded character index66.
  assert.equal(p.address, 0x7E2060 + 66);
});
test('BYTE word measure wraps separately from full WORD glyph width', () => {
  const data = fixture({ width: 40, glyphWidth: 200, text: [65, 66, 0, 0] }); word(data, 0x81AE2D, 0);
  const p = run(data); assert.ok(p.handled);
  assert.equal(p.newlines, 0); assert.equal(p.glyphs, 2);
  assert.equal(p.operations.find(e => e.kind === 'read' && e.address === 0xA8 && e.phase === 'composeFB39').value, 304);
  assert.deepEqual(p.operations.filter(e => e.kind === 'write' && e.address === 0xA8).map(e => e.value), [304, 104, 65440]);
});
test('full width256 gets doubled WORD mask index512 and wrapped left-loop count', () => {
  const data = fixture({ width: 100, glyphWidth: 255, style: 0x20 }); word(data, 0x81AE9D, 0x1234);
  const p = run(data); assert.ok(p.handled); assert.equal(p.glyphs, 1);
  assert.ok(p.operations.some(e => e.kind === 'read' && e.address === 0x81AE9D && e.value === 0x1234));
  assert.equal(p.operations.find(e => e.kind === 'write' && e.address === 0x7E2AF0).value, 0x34);
});
test('full initial offsetWORD65535 is not clamped and right-shift mask settles to zero', () => {
  const data = fixture({ offset: 0xFFFF, text: [0, 0], width: 0xFFFF });
  word(data, 0x82AC8B, 0);
  const p = run(data); assert.ok(p.handled);
  assert.equal(p.operations.find(e => e.kind === 'write' && e.address === 0xA2).value, 65535);
  assert.equal(p.operations.filter(e => e.phase === 'AEC8' && e.kind === 'read')[2].address, 0x82AC8B);
});
test('full window index65535 carries Long header accesses into7F', () => {
  const data = fixture({ index: 65535 }), p = run(data); assert.ok(p.handled); data.commit(p);
  assert.equal(get(data, 0x7F20BF), 0x21); assert.equal(get(data, 0x7F20DF), 4);
  assert.ok(p.operations.some(e => e.kind === 'read' && e.address === 0x7F213F));
});
test('glyph index retains its fullWORD before BYTE style transfers and TYA', () => {
  const data = fixture({ text: [127, 0, 0] }); data.seed(0x81AC8C, [4]);
  const p = run(data); assert.ok(p.handled);
  // The final glyph index03F8 puts03 in hiddenB before the first BYTE style
  // load. BYTE TYA must keep thisB: first subsequent WORD B4 load resets it.
  const firstRow = p.operations.findIndex(e => e.kind === 'write' && e.address === 0xB1);
  assert.deepEqual(p.operations.slice(firstRow + 1, firstRow + 5).map(e => e.address), [0xAE, 0x95F6C8, 0xB4, 0xB5]);
  assert.equal(p.rows, 8);
});
test('second byte of glyph widthWORD is required even though AND00FF discards it', () => {
  // Measurement reads only the first width byte; the render read requires
  // both. Keep all other width bytes explicitly seeded.
  const p = failure(fixture({ omit: 0x81AC0C + 66 }), {}, 'render_source_required');
  assert.equal(p.address, 0x81AC0C + 66);
});
test('missing final glyphBYTE leaves initial masks, counters and DP completely unapplied', () => {
  const p = failure(fixture({ omit: 0x95F2D0 + 65 * 8 + 7 }), {}, 'render_source_required');
  assert.equal(p.address, 0x95F2D0 + 65 * 8 + 7);
});
test('missing actual quotient and late arithmetic result discard all earlier glyph and external writes', () => {
  failure(wrapFixture(), { ...wrapContext, ioRead4214: [0] }, 'render_io_read_required');
  failure(wrapFixture(), { ...wrapContext, ioRead4216: [0, 0, 1, 0] }, 'render_io_read_required');
  failure(fixture(), { ioMode: null }, 'render_io_context_required');
});
test('missing late wait observation and wait authorization have no partial effects', () => {
  failure(wrapFixture(), { ...wrapContext, waitRead01FA: [5, 0, 7, 8] }, 'render_wait_read_required');
  failure(fixture(), { waitMode: null }, 'render_wait_context_required');
  failure(fixture(), { waitRead01FC: [2] }, 'render_wait_read_required');
});
test('wrapping counterFFFF reaches actual zero with no external completion claim', () => {
  const data = fixture({ text: [0, 0] }); word(data, 0x7E01FC, 65535);
  const p = run(data, { waitMode: null, waitRead01FC: null }); assert.ok(p.handled); assert.equal(p.pollsFC, 1);
  assert.ok(!p.operations.some(e => e.space === 'external'));
});
test('unobserved nonzero wait and unterminated dictionary are bounded', () => {
  failure(fixture(), { waitRead01FC: null, maxWork: 200 }, 'render_work_budget_required');
  const data = fixture(); word(data, 0x9D8000, 0); word(data, 0x9D8002, 0);
  failure(data, { maxWork: 50 }, 'render_work_budget_required', prepareRenderFE69);
});
test('output budgets include decoder, rewrite, mask initialization, glyph and AEC8 mask bytes', () => {
  failure(fixture(), { maxOutputBytes: 65 }, 'render_output_budget_required', prepareRenderFE69);
  assert.ok(run(fixture(), { maxOutputBytes: 66 }, prepareRenderFE69).handled);
  failure(fixture(), { maxOutputBytes: 63 }, 'render_output_budget_required');
  assert.ok(run(fixture(), { maxOutputBytes: 64 }).handled);
});
test('output windows and protected stack aliases fail atomically', () => {
  failure(fixture({ writeWindows: windows.filter((_, i) => i !== 2) }), {}, 'render_write_window_required');
  failure(fixture(), { stackWindow: [0x2AE0, 0x2AEF] }, 'render_stack_alias_required');
});
test('complete static stack boundary is12 forFE69 and9 forFB39', () => {
  for (const [fn, bytes] of [[prepareRenderFE69, 12], [prepareRenderFB39, 9]]) {
    failure(fixture(), { stackWindow: [0x1F00, 0x1F00 + bytes - 2] }, 'render_stack_required', fn);
    assert.ok(run(fixture(), { stackWindow: [0x1F00, 0x1F00 + bytes - 1] }, fn).handled);
  }
});
test('invalid mode, observation arrays and absent binary entry are explicit', () => {
  for (const extra of [{ bank: null }, { status: 32 }, { emulation: 1 }, { directPage: 1 }])
    failure(fixture(), extra, 'render_entry_required');
  for (const extra of [{ ioRead4214: [256] }, { ioRead4216: [65536] }, { waitRead01FA: [null] },
    { waitRead01FC: Array(1) }, { ioMode: 'calculate' }, { maxOutputBytes: 0 }])
    assert.throws(() => run(fixture(), extra), /Invalid render/);
});
test('innerFE69/FB39 plans share caller overlay and only one outer finish/commit', () => {
  for (const fn of [renderFE69, renderFB39]) {
    const data = fixture(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), before = data.snapshot();
    const p = fn(view, entry, { work: 0, maxWork: 100000, maxOutputBytes: 10000, outputBytes: 0 });
    assert.ok(p.handled); assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(p), /Invalid render plan/);
    const outer = view.finish(p); assert.ok(data.commit(outer).handled);
  }
});
test('stale complete composition never applies a partial plan', () => {
  const data = fixture(), p = run(data, {}, prepareRenderFE69); assert.ok(p.handled); word(data, 0, 3);
  const before = data.snapshot(); assert.equal(data.commit(p).reason, 'render_plan_stale'); assert.deepEqual(data.snapshot(), before);
});
test('six recorded probes are reproducible synthetic successes and late failures', async () => {
  const report = JSON.parse(await readFile('analysis/render-text-compose-native.json', 'utf8'));
  assert.match(report.scope, /synthetic/); assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json'); assert.equal(report.probes.length, 6);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, false, false]);
  for (const probe of report.probes) {
    const data = fixture(probe.fixture), p = run(data, probe.extra, probe.helper === 'FE69' ? prepareRenderFE69 : prepareRenderFB39);
    const { helper, fixture: f, extra, ...recorded } = probe; assert.deepEqual(JSON.parse(JSON.stringify(p)), recorded);
  }
});
