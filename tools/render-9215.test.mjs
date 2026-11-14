import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRender9215, render9215 } from '../proof/render/selection-9215.mjs';
import { choice9215Entry as entry, choice9215Fixture as fixture,
  choice9215Windows as windows, choice9215Tokens as tokens } from './render-9215-fixtures.mjs';
import { menuFixture } from './render-menu-fixtures.mjs';
import { ad92Fixture } from './render-ad92-fixtures.mjs';
import { textWord as seed } from './render-text-compose-fixtures.mjs';
import { cpuToOffset } from './rom.mjs';

const run = (data, options = {}) => prepareRender9215({ ...entry, data, ...options });
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
const budget = (extra = {}) => ({ work: 0, maxWork: 1000000, outputBytes: 0, maxOutputBytes: 65536, ...extra });
const root = p => p.operations.filter(e => e.phase.startsWith('choice9215:'));
const token = id => tokens[id * 2] | tokens[id * 2 + 1] << 8;
function fail(data, options, reason, phase) {
  const before = data.snapshot(), p = run(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason, JSON.stringify(p));
  if (phase) assert.equal(p.compositionPhase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'byteWrites', 'ioRequests', 'calls']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
function clone(full, { omit = null, writeWindows = full.snapshot().writeWindows } = {}) {
  const data = createRenderData({ writeWindows });
  for (const [a, v] of full.snapshot().bytes) if (a !== omit) data.seed(a, [v]); return data;
}
function minimal(full, p) {
  const first = new Map();
  for (const e of p.byteOperations) { const a = renderAddress(e.address); if (!first.has(a)) first.set(a, e.kind); }
  const data = createRenderData({ writeWindows: full.snapshot().writeWindows });
  for (const [a, v] of full.snapshot().bytes) if (first.get(a) === 'read') data.seed(a, [v]); return data;
}
function early(ids = [255], flags = [1, 1]) {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7E0024], [0x7E0154, 0x7E01FF]] });
  data.seed(0x7E3CA3, [...ids, 0]); data.seed(0x7E3CD6, [...flags, 0]); data.seed(0x8D8000, tokens);
  return data;
}
// Explicit synthetic provider observations after the actual menu. PEI00,
// DP1A and second-scan flag reads stay fresh; all real callees execute.
function observed(data, { selection = null, releaseBuffer = null, flags = null, ids = null } = {}, context = {}) {
  const view = prepareRenderView(data), b = budget(); let copies = 0, saved = false, released = false, remapping = false;
  const events = [], base = (context.bank ?? entry.bank) * 65536;
  const inject = (address, bytes) => { bytes.forEach((value, i) => view.write(address + i, value));
    b.work += bytes.length; events.push({ address, bytes: [...bytes], space: 'external' }); };
  const provider = {
    read(address) {
      if (copies === 2 && address === 0 && !saved) {
        saved = true; if (selection !== null) inject(0, [selection & 255, selection >>> 8]);
      }
      if (saved && address === 0x1A && !released) {
        released = true; if (releaseBuffer !== null) inject(0x1A, [releaseBuffer & 255, releaseBuffer >>> 8]);
      }
      if (released && address === 0x7E3CD6 && !remapping) {
        remapping = true; if (flags !== null) inject(0x7E3CD6, flags); if (ids !== null) inject(0x7E3CA3, ids);
      }
      return view.read(address);
    },
    write(address, value) { view.write(address, value); if (address === base + 0x1CD) copies++; },
  };
  const p = render9215(provider, { ...entry, ...context }, b);
  assert.equal(saved, true); assert.equal(released, true);
  return { p, plan: view.finish(p), view, b, events };
}

test('9215 original176/76 source and510 token bytes are pinned separately from synthetic native probes', async () => {
  const rom = await readFile('Shadowrun (E).smc'), report = JSON.parse(await readFile('analysis/render-9215-native.json', 'utf8'));
  const raw = rom.subarray(cpuToOffset(0x809215, rom.length), cpuToOffset(0x8092C5, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '5bbcca6fc7cd254474a65f52ad4d02fd519a002e3482be22d30d1d9247be2b1d');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 76);
  const table = rom.subarray(cpuToOffset(0x8D8000, rom.length), cpuToOffset(0x8D8000, rom.length) + 510);
  assert.equal(createHash('sha256').update(table).digest('hex'), '9bad33072654e14111ebea142bd5cb2f2c480a79a957b39e96f9256d05a01623');
  assert.deepEqual([...table], tokens); assert.equal(report.stackProof.minimum_protected_stack_bytes, 28);
  assert.equal(report.stackProof.external_return_assumptions, 0); assert.match(report.scope, /synthetic/); assert.match(report.scope, /No CPU\/device/);
});

test('first lowFF sentinel preserves full incoming X/Y and V/I, emits only DP00 and calls no helpers', () => {
  for (let high = 0; high < 256; high++) {
    const data = early([255, high]), before = data.snapshot(), p = run(data);
    assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
    assert.deepEqual([p.a, p.x, p.y, p.status, p.work, p.outputBytes], [65535, entry.x, entry.y, 0xC5, 2, 2]);
    assert.equal(p.scanReads, 0); assert.equal(p.accepted, 0); assert.deepEqual(p.calls, []);
    assert.deepEqual(p.byteWrites, [[0x7E0000, 255], [0x7E0001, 255]]);
  }
  fail(clone(early(), { omit: 0x7E3CA4 }), {}, 'render_source_required', 'initial');
});

test('all65536 flag words mask only lowbyte but require both source bytes and never invent a token for rejected entries', () => {
  const data = early([0, 255]);
  for (let flag = 0; flag < 65536; flag++) {
    seed(data, 0x7E3CD6, flag); const p = run(data);
    if ((flag & 255) === 0) { assert.equal(p.handled, false); assert.equal(p.compositionPhase, 'F963'); assert.equal(p.reason, 'render_source_required'); }
    else { assert.equal(p.handled, true); assert.equal(p.outcome, 'choice_empty'); assert.equal(p.accepted, 0); assert.equal(p.x, 1); assert.equal(p.y, 0); }
  }
  fail(clone(data, { omit: 0x7E3CD7 }), {}, 'render_source_required', 'collect');
});

test('all255 original token indices use WORD DP23/ASL and actual fullY producer addresses before real allocation', () => {
  for (let id = 0; id < 255; id++) {
    const data = early([id, 255], [0]), before = data.snapshot(), view = prepareRenderView(data), b = budget();
    assert.throws(() => render9215(view, entry, b), e => e.reason === 'render_source_required' && e.compositionPhase === 'F963');
    assert.equal(view.read(0x154) | view.read(0x155) << 8, token(id));
    assert.equal(view.read(0x156) | view.read(0x157) << 8, 0); assert.deepEqual(data.snapshot(), before);
  }
});

test('standard cancel runs actual F963/A6C7/FA3E even onFFFF, preserves release A/X and restores saved selection Y', () => {
  const data = fixture(), before = data.snapshot(), p = run(data); assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.calls.map(c => [c.name, c.outcome]), [['F963', 'allocation_prepared'], ['A6C7', 'menu_cancelled'], ['FA3E', 'buffer_released']]);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0, 65534, 65535, 0x80, 7]);
  assert.equal(p.allocation, 2); assert.equal(p.releaseBuffer, 2); assert.equal(p.selection, 65535); assert.equal(p.remapReads, 0);
  assert.equal(p.accepted, 2); assert.equal(p.scanReads, 3); assert.equal(p.work, 31367); assert.equal(p.outputBytes, 4322);
  assert.deepEqual([p.productReads, p.pollsF6, p.pollsF8, p.counterPolls], [1, 1, 2, 1]);
  const last = root(p).slice(-5).map(e => [e.kind, e.phase, e.address, e.value]);
  assert.deepEqual(last, [['read', 'choice9215:save-selection', 0, 65535], ['read', 'choice9215:release-parameters', 0x1A, 2],
    ['write', 'choice9215:release-parameters', 0, 2], ['write', 'choice9215:cancel', 0x801D63, 65535], ['write', 'choice9215:cancel', 0, 65535]]);
  assert.equal(data.commit(p).handled, true); assert.equal(word(data, 0x154), token(0)); assert.equal(word(data, 0x156), token(1));
  assert.equal(word(data, 0x158), 0); assert.equal(word(data, 0x1D63), 65535); assert.equal(word(data, 0x204), 65534);
});

test('confirmation uses real audio then release and fresh second flagscan, with STX retaining A0 and DEY flags', () => {
  const data = fixture({ held: 0x40 }), p = run(data); assert.equal(p.handled, true);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0, 0, 65535, 0x80, 0x84]);
  assert.equal(p.selection, 0); assert.equal(p.remapReads, 1); assert.equal(p.apuPolls, 3);
  assert.equal(p.work, 31457); assert.equal(p.outputBytes, 4320);
  assert.deepEqual(root(p).slice(-2).map(e => [e.kind, e.address, e.value]), [['read', 0x7E3CD6, 0], ['write', 0, 0]]);
  data.commit(p); assert.equal(word(data, 0x1D63), 0x1234); assert.equal(word(data, 0), 0);
});

test('literal allocation/menu parameters and fresh DP00-toDP1A stores match the original root order', () => {
  const p = run(fixture()), ops = root(p);
  assert.deepEqual(ops.filter(e => e.phase === 'choice9215:allocate-parameters').map(e => [e.address, e.value]),
    [[0, 6], [2, 15], [4, 14], [6, 11], [8, 0]]);
  assert.deepEqual(ops.filter(e => e.phase === 'choice9215:menu-parameters').map(e => [e.kind, e.address, e.value]),
    [['read', 0, 2], ['write', 0x1A, 2], ['write', 2, 1], ['write', 4, 0], ['write', 6, 9], ['write', 8, 0x154], ['write', 10, 0x7E]]);
  assert.equal(p.calls[0].before.a, 0); assert.equal(p.calls[1].before.a, 0x7E); assert.equal(p.calls[2].before.a, 2);
  assert.equal(p.calls[2].buffer, 2); assert.equal(p.calls[2].trimmed, true);
});

test('fresh post-menu DP1A changes the actual released buffer rather than using a frozen allocation index', () => {
  const data = fixture(), before = data.snapshot(), { p, plan } = observed(data, { releaseBuffer: 4 });
  assert.equal(p.allocation, 2); assert.equal(p.releaseBuffer, 4); assert.equal(p.calls[2].buffer, 4); assert.equal(p.calls[2].trimmed, false);
  assert.equal(p.selection, 65535); assert.equal(p.y, 65535); assert.equal(p.a, p.calls[2].after.a); assert.equal(p.x, p.calls[2].after.x);
  assert.deepEqual(data.snapshot(), before); data.commit(plan); assert.equal(word(data, 0x22A), 0); assert.equal(word(data, 0x204), 2);
});

test('fresh second-scan flags can choose an index after collection while the identifier sentinel is ignored', () => {
  const data = fixture({ held: 0x40 }), before = data.snapshot();
  const { p, plan } = observed(data, { flags: [1, 1, 0, 0], ids: [255, 255, 255] });
  assert.equal(p.accepted, 2); assert.equal(p.selection, 0); assert.equal(p.x, 2); assert.equal(p.remapReads, 3);
  const remap = p.byteOperations.filter(e => e.phase === 'remap' && e.kind === 'read');
  assert.ok(remap.every(e => e.address >= 0x7E3CD6 && e.address <= 0x7E3CD9));
  assert.deepEqual(data.snapshot(), before); data.commit(plan); assert.equal(word(data, 0), 2);
});

test('general WORD selections follow actual DEY/sign/wrap, including8000 requiring32769 fresh flagreads', () => {
  const data = fixture(); data.seed(0x7E3CD6, Array(32770).fill(0));
  for (const [selection, x, y, reads] of [[0, 0, 65535, 1], [1, 1, 65535, 2], [0x7FFF, 0x7FFF, 65535, 32768],
    [0x8000, 0x8000, 65535, 32769], [0x8001, 0, 0x8000, 1], [0xFFFE, 0, 0xFFFD, 1]]) {
    const { p } = observed(data, { selection }); assert.equal(p.x, x); assert.equal(p.y, y); assert.equal(p.remapReads, reads);
    assert.equal(p.a, 0); assert.equal(p.status & 0x83, 0x80); assert.equal(p.selection, selection);
  }
});

test('collection passes51 entries without a cap, preserves fresh source/output aliases and real DP23 effects', () => {
  const data = early(); data.seed(0x7E3CA3, Array(110).fill(0)); data.seed(0x7E3CA3 + 58, [255]);
  const view = prepareRenderView(data), b = budget(); let writes = 0;
  const provider = { read: a => view.read(a), write(a, v) { view.write(a, v); if (a === 0x800154 + writes * 2) writes++; } };
  assert.throws(() => render9215(provider, entry, b), e => e.reason === 'render_source_required' && e.compositionPhase === 'F963');
  // The sentinel aliases a flags byte seven iterations earlier, so exactly one ID is skipped.
  assert.equal(writes, 58); // 57 accepted tokens plus terminator.
  assert.equal(view.read(0x154 + 57 * 2), 0);
});

test('32768 accepted entries wrap fullY tozero and use empty exit after real crossbank listwrites', () => {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7E0153], [0x7F0000, 0x7FFFFF]] });
  data.seed(0x7E3CA3, Array(32769 + 53).fill(0)); data.seed(0x7E3CA3 + 32769, [255]); data.seed(0x8D8000, tokens);
  const before = data.snapshot(), p = run(data, { bank: 0x7F, maxOutputBytes: 262144 }); assert.equal(p.handled, true, JSON.stringify({ reason: p.reason, phase: p.compositionPhase }));
  assert.equal(p.accepted, 32768); assert.equal(p.x, 32769); assert.equal(p.y, 0); assert.equal(p.outcome, 'choice_empty'); assert.deepEqual(p.calls, []);
  assert.ok(root(p).some(e => e.kind === 'write' && e.address === 0x800000));
  assert.deepEqual(data.snapshot(), before); assert.equal(data.commit(p).handled, true); assert.equal(word(data, 0), 65535);
});

test('fullX wraps after65536 rejected IDs with an explicit synthetic later sentinel and no invented scan cap', () => {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7E0024]] });
  data.seed(0x7E3CA3, Array(65536 + 53).fill(1)); const before = data.snapshot(), view = prepareRenderView(data);
  let firstReads = 0; const addresses = [];
  const provider = { read(a) { if (a === 0x7E3CA3 && ++firstReads === 3) return 255; return view.read(a); },
    write(a, v) { view.write(a, v); if (a === 0x23) addresses.push(a); } };
  const p = render9215(provider, entry, budget({ maxOutputBytes: 262144 }));
  assert.equal(p.x, 0); assert.equal(p.y, 0); assert.equal(p.scanReads, 65537); assert.equal(p.accepted, 0);
  assert.equal(addresses.length, 65536); assert.equal(p.outputBytes, 131074);
  assert.ok(p.byteOperations.some(e => e.address === 0x7F3CA2)); assert.deepEqual(data.snapshot(), before);
});

test('capacity end still reaches real menu, requires explicit buffer6 sources and calls real release', () => {
  fail(fixture({ cursor: 30 }), {}, 'render_source_required', 'A6C7');
  const data = fixture({ cursor: 30 });
  for (const [a, v] of menuFixture({ index: 6 }).snapshot().bytes) data.seed(a, [v]);
  for (let x = 0; x <= 30; x += 2) seed(data, 0x226 + x, 0);
  const p = run(data); assert.equal(p.handled, true); assert.equal(p.calls[0].outcome, 'capacity_end');
  assert.equal(p.allocation, 6); assert.equal(p.releaseBuffer, 6); assert.deepEqual(p.calls.map(c => c.name), ['F963', 'A6C7', 'FA3E']);
  assert.equal(p.calls[2].trimmed, false); assert.equal(p.productReads, 0); assert.equal(p.pollsF6, 0); assert.equal(p.pollsF8, 1);
});

test('physical7F producer and fixed7E menu consumer remain distinct; confirmation releases under returned80 DBR', () => {
  fail(fixture({ bank: 0x7F }), { bank: 0x7F }, 'render_source_required', 'A6C7');
  const data = fixture({ bank: 0x7F }); data.seed(0x7E0154, [tokens[0], tokens[1], 0, 0]);
  const p = run(data, { bank: 0x7F }); assert.equal(p.handled, true); assert.equal(p.bank, 0x7F); assert.equal(p.accepted, 2);
  data.commit(p); assert.equal(word(data, 0x7F0154), token(0)); assert.equal(word(data, 0x7F1D63), 65535);
  const other = fixture({ bank: 0x7F, held: 0x40 }); other.seed(0x7E0154, [tokens[0], tokens[1], 0, 0]);
  for (const [a, v] of ad92Fixture({ bank: 0x80, last: 2, flags: [0, 0] }).snapshot().bytes) other.seed(a, [v]);
  for (const [a, v] of [[0x1CA, 0x40], [0x1CC, 0], [0x1CE, 0], [0x1D97, 0], [0x1D63, 0x4567]]) seed(other, a, v);
  const q = run(other, { bank: 0x7F }); assert.equal(q.handled, true); assert.equal(q.bank, 0x80); assert.equal(q.calls[2].before.bank, 0x80);
  other.commit(q); assert.equal(word(other, 0x7F0228), 65535); assert.equal(word(other, 0x7E0228), 0); assert.equal(word(other, 0x1D63), 0x4567);
});

test('all256 DBRs can use fixedlong early sentinel; active unsupported DBRs halt before publishing listwrites', () => {
  const data = early(); for (let bank = 0; bank < 256; bank++) { const p = run(data, { bank }); assert.equal(p.handled, true); assert.equal(p.bank, bank); }
  for (const bank of [0, 0x3F, 0x7E, 0x80, 0xBF]) assert.equal(run(fixture({ bank }), { bank }).handled, true);
  for (const bank of [0x40, 0x60, 0xC0, 0xFF]) fail(fixture(), { bank }, 'render_address_required', 'collect');
});

test('binary statuses preserve release V/I with final CPY or DEY flags, not saved entry flags', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) for (const held of [0x40, 0x2000]) {
    const p = run(fixture({ held }), { status }); assert.equal(p.handled, true);
    assert.equal(p.status, (p.calls[2].after.status & ~0x83) | (held === 0x40 ? 0x80 : 3)); assert.equal(p.status & 4, status & 4);
  }
});

test('allocation and release consume one global chronological2134/F6/F8 stream with exact prefix failures', () => {
  const data = fixture(), extra = { ioRead2134: [108], waitRead01F6: [1, 0], waitRead01F8: [1, 0, 2, 0] }, p = run(data, extra);
  assert.equal(p.handled, true); assert.deepEqual([p.productReads, p.pollsF6, p.pollsF8], [1, 2, 4]);
  assert.deepEqual(p.calls.map(c => c.pollsF8), [2, 2, 4]);
  for (const [field, count, reason] of [['ioRead2134', p.productReads, 'render_io_read_required'],
    ['waitRead01F6', p.pollsF6, 'render_wait_read_required'], ['waitRead01F8', p.pollsF8, 'render_wait_read_required']])
    for (let n = 0; n < count; n++) fail(data, { ...extra, [field]: extra[field].slice(0, n) }, reason);
  const confirm = fixture({ held: 0x40 }), q = run(confirm);
  for (const [field, count, reason] of [['ioRead4216', q.resultReads, 'render_io_read_required'],
    ['waitRead01FA', q.pollsFA, 'render_wait_read_required'], ['waitRead01FC', q.pollsFC, 'render_wait_read_required'],
    ['waitRead1C76', q.counterPolls, 'render_wait_read_required'], ['ioRead4217', q.panResultReads, 'render_io_read_required'],
    ['ioRead2140', q.apuPolls, 'render_io_read_required']])
    for (let n = 0; n < count; n++) fail(confirm, { [field]: entry[field].slice(0, n) }, reason, 'A6C7');
});

test('active real AF1F release requires explicit stable arithmetic and keeps all earlier allocation/menu effects atomic', () => {
  fail(fixture({ active: true }), {}, 'render_division_context_required', 'FA3E');
  const p = run(fixture({ active: true }), { divisionMode: 'stable-native' }); assert.equal(p.handled, true);
  assert.equal(p.calls[2].after.x, 14); assert.equal(p.outputBytes, 4358);
  fail(fixture({ held: 0x3030 }), {}, 'render_reset_source_required', 'A6C7');
  fail(fixture({ held: 0 }), {}, 'render_wait_read_required', 'A6C7');
});

test('every required initial byte, every root output byte and selected helper window boundaries fail atomically', () => {
  const full = fixture(), p = run(full), small = minimal(full, p); assert.equal(run(small).handled, true);
  for (const [omit] of small.snapshot().bytes) fail(clone(small, { omit }), {}, 'render_source_required');
  const automatic = new Set([0xA2, 0xA3, 0xA5, 0xA6, 0xA8, 0xA9, 0xD8, 0xD9]);
  // Each output interval is checked at both ends and selected semantic bytes; helper tests cover every emitted byte.
  const missing = new Set([0x7E0000, 0x7E0001, 0x7E001A, 0x7E001B, 0x7E0023, 0x7E0024,
    0x7E0154, 0x7E0155, 0x7E0158, 0x7E0159, 0x7E0228, 0x7E0229, 0x7E1D63, 0x7E1D64,
    0x7E1D95, 0x7E1D96, 0x7E2002, 0x7E2003, 0x7E23A0, 0x7E23A1, 0x7E2ADF] );
  for (const e of root(p).filter(e => e.kind === 'write'))
    for (let i = 0; i < e.bytes; i++) missing.add(renderAddress(e.address + i));
  for (const [a] of p.byteWrites) if (a > 0x7E00F2 || a < 0x7E00DB && !automatic.has(a - 0x7E0000))
    if (windows.some(([first, last]) => a === first || a === last)) missing.add(a);
  for (const omit of missing) {
    assert.ok(p.byteWrites.some(([a]) => a === omit), omit.toString(16));
    const writeWindows = windows.flatMap(([a, b]) => omit < a || omit > b ? [[a, b]]
      : [...(a < omit ? [[a, omit - 1]] : []), ...(omit < b ? [[omit + 1, b]] : [])]);
    fail(clone(small, { writeWindows }), {}, 'render_write_window_required');
  }
});

test('28 protected stackbytes and source/output disjointness are required; unknown incoming X/Y are preserved on firstsentinel', () => {
  fail(fixture(), { stackWindow: [0x1FE5, 0x1FFF] }, 'render_stack_required');
  for (const a of [0, 0x1A, 0x23, 0x154, 0x1CA, 0x1D63, 0x2040, 0x23A0, 0x3CA3, 0x3CD6])
    fail(fixture(), { stackWindow: [a, a + 27] }, 'render_stack_alias_required');
  const p = run(early(), { x: null, y: null }); assert.equal(p.handled, true); assert.equal(p.x, null); assert.equal(p.y, null);
});

test('global work/output budgets retain late release and cancellation effects and permit exact thresholds', () => {
  for (const held of [0x40, 0x2000]) {
    const full = fixture({ held }), p = run(full), data = minimal(full, p);
    for (const maxWork of [1, 2, 5, 16, 32, p.calls[0].work, p.calls[1].work, p.work - 2, p.work - 1])
      fail(data, { maxWork }, 'render_work_budget_required');
    for (const maxOutputBytes of [1, 2, 6, 12, 22, p.calls[0].outputBytes, p.calls[1].outputBytes, p.outputBytes - 2, p.outputBytes - 1])
      fail(data, { maxOutputBytes }, 'render_output_budget_required');
    assert.equal(run(data, { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled, true);
  }
});

test('two real9215 calls share allocation/product/menu/release observations and one outer commit; late second failure holds both', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data), b = budget(), observations = {};
  const context = { ...entry, observations, ioRead2134: [108, 108], waitRead01F6: [0, 0], waitRead01F8: [0, 0, 0, 0], waitRead1C76: [1, 2] };
  const first = render9215(view, context, b); view.write(0x1CC, 0); view.write(0x1CD, 0);
  const second = render9215(view, context, b); assert.equal(second.productReads, 2); assert.equal(second.pollsF8, 4); assert.equal(second.counterPolls, 2);
  assert.equal(second.outputBytes, first.outputBytes * 2); assert.throws(() => data.commit(first), /Invalid render plan/);
  assert.deepEqual(data.snapshot(), before); assert.equal(data.commit(view.finish(second)).handled, true);
  assert.equal(word(data, 0x1D63), 65535);
  const other = fixture(), untouched = other.snapshot(), v = prepareRenderView(other), limited = budget();
  const short = { ...context, observations: {}, waitRead01F8: [0, 0, 0] };
  render9215(v, short, limited); v.write(0x1CC, 0); v.write(0x1CD, 0);
  assert.throws(() => render9215(v, short, limited), e => e.reason === 'render_wait_read_required' && e.compositionPhase === 'FA3E');
  assert.deepEqual(other.snapshot(), untouched);
});

test('collection rereads future ID bytes after an explicit outer-provider change during an actual token store', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data); let changed = false;
  const provider = { read: a => view.read(a), write(a, v) {
    view.write(a, v); if (a === 0x800155 && !changed) { view.write(0x7E3CA4, 255); changed = true; }
  } };
  const p = render9215(provider, entry, budget()); assert.equal(changed, true);
  assert.equal(p.accepted, 1); assert.equal(p.scanReads, 2);
  assert.deepEqual(data.snapshot(), before); data.commit(view.finish(p)); assert.equal(word(data, 0x156), 0);
});

test('fresh fullWORD DP23 can wrap ASL before actual token read under a synthetic byte observation', () => {
  const data = early([254, 255], [0]), before = data.snapshot(), view = prepareRenderView(data); let changed = false;
  const reads = [];
  const provider = { read(a) {
    if (a === 0x7E3CD7 && !changed) { view.write(0x23, 0); view.write(0x24, 0x80); changed = true; }
    reads.push(a); return view.read(a);
  }, write: (a, v) => view.write(a, v) };
  assert.throws(() => render9215(provider, entry, budget()), e => e.reason === 'render_source_required' && e.compositionPhase === 'F963');
  assert.equal(changed, true); assert.ok(reads.includes(0x8D8000)); assert.ok(!reads.includes(0x8D81FC));
  assert.equal(view.read(0x154) | view.read(0x155) << 8, token(0)); assert.deepEqual(data.snapshot(), before);
});

test('late3030 at final cancel or confirm input and late second-scan highbyte failure hold allocation/menu/release effects', () => {
  for (const held of [0x40, 0x2000]) {
    const data = fixture({ held }), before = data.snapshot(), view = prepareRenderView(data); let reads = 0;
    const provider = { read(a) {
      if (a === 0x8001CA && ++reads === 7) { view.write(a, 0x30); view.write(a + 1, 0x30); }
      return view.read(a);
    }, write: (a, v) => view.write(a, v) };
    assert.throws(() => render9215(provider, entry, budget()), e => e.reason === 'render_reset_source_required'
      && e.compositionPhase === 'A6C7' && e.menuStage === (held === 0x40 ? 'confirm-input' : 'cancel-input'));
    assert.deepEqual(data.snapshot(), before);
  }
  const data = fixture({ held: 0x40 }), before = data.snapshot(), view = prepareRenderView(data); let copies = 0, released = false;
  const provider = { read(a) {
    if (copies === 2 && a === 0x7E3CD7) throw { renderBoundary: true, reason: 'render_source_required', address: a };
    return view.read(a);
  }, write(a, v) { view.write(a, v); if (a === 0x8001CD) copies++; if (a === 0x800204 && copies === 2) released = true; } };
  assert.throws(() => render9215(provider, entry, budget()), e => e.reason === 'render_source_required' && e.compositionPhase === 'remap');
  assert.equal(released, true); assert.deepEqual(data.snapshot(), before);
});

test('foreign copied stale repeated and inner plans cannot commit; all unrelated seeded bytes survive', () => {
  const data = fixture(), p = run(data); assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/); assert.throws(() => { p.byteWrites[0][1] = 99; }, TypeError);
  const inner = render9215(prepareRenderView(data), entry, budget()); assert.throws(() => data.commit(inner), /Invalid render plan/);
  seed(data, 0x1CA, 0x40); const before = data.snapshot(); assert.equal(data.commit(p).reason, 'render_plan_stale'); assert.deepEqual(data.snapshot(), before);
  const other = fixture(), original = other.snapshot(), q = run(other), changed = new Set(q.byteWrites.map(([a]) => a));
  assert.equal(other.commit(q).handled, true); assert.equal(other.commit(q).reason, 'render_plan_stale');
  for (const [a, v] of original.bytes) if (!changed.has(a)) assert.equal(other.readByte(a).value, v);
});

test('invalid contexts/observations and unsupported entry modes remain explicit', () => {
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { waitMode: 'execute' }, { divisionMode: 'hardware' },
    { ioRead2134: [65536] }, { ioRead4214Word: [NaN] }, { ioRead4216Byte: [256] }, { waitRead01F8: Array(1) }, { maxWork: 0 }, { maxOutputBytes: 0 }])
    assert.throws(() => run(fixture(), options), /Invalid/);
  for (const options of [{ bank: null }, { status: null }, { emulation: 1 }, { directPage: 1 }, { status: 8 }, { status: 0x20 }])
    fail(fixture(), options, 'render_entry_required');
});

test('public9215 probes reproduce exactly through actual native APIs', async () => {
  const report = JSON.parse(await readFile('analysis/render-9215-native.json', 'utf8'));
  for (const { fixture: input, ...expected } of report.probes) assert.deepEqual(run(fixture(input), input), expected);
});
