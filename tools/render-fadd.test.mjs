import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderAF04, prepareRenderFADD, renderAF04, renderFADD } from '../proof/render/text-width-fadd.mjs';

const entry = { bank: 0x80, status: 0x45, emulation: 0, directPage: 0,
  a: 0xBEEF, x: 0xCAFE, y: 0xABCD, stackWindow: [0x1F00, 0x1FFF] };
const windows = [[0x7E00BA, 0x7E00BB], [0x7E00CF, 0x7E00D3], [0x7E0206, 0x7E0209]];
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function bitData(count = 1, buffer = 0x8001, writeWindows = windows) {
  const data = createRenderData({ writeWindows });
  word(data, 0x206, count); word(data, 0x208, buffer); return data;
}
function fixture({ text = 0x1800, first = 0xC142, second = 0x8A00, stream = 0x0040,
  widths = [[0x41, 7], [0x42, 9]], writeWindows = windows } = {}) {
  const data = createRenderData({ writeWindows });
  word(data, 0, text); word(data, (text & 0x8000 ? 0x9E0000 : 0x9D0000) + (text | 0x8000), stream);
  word(data, 0x9D8000, first); word(data, 0x9D8002, second);
  for (const [index, width] of widths) data.seed(0x81AC0C + index, [width]);
  return data;
}
function atomicFailure(data, run, reason, extra = {}) {
  const before = data.snapshot(), p = run({ data, ...entry, ...extra });
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  assert.equal(p.byteWrites, undefined); assert.equal(p.operations, undefined);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(p), /Invalid render plan/);
}

test('FADD synthetic pair decodes width16, ordered writes, final flags and preserved Y', () => {
  const data = fixture(), before = data.snapshot(), p = prepareRenderFADD({ data, ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, 16); assert.equal(p.x, 2); assert.equal(p.y, entry.y);
  assert.equal(p.status, 5); assert.equal(p.bits, 2); assert.equal(p.characters, 2);
  assert.deepEqual(p.ioWrites, []); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.operations[0].address, 0xD0); assert.equal(p.operations[0].value, 0x9DFF);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0xBA), 16);
  assert.equal(get(data, 0xCF), 0x9802); assert.equal(data.readByte(0xD1).value, 0x9D);
});

for (const [first, width, chars, x, widths] of [
  [0x8A7F, 0, 0, 0, []], [0xC10A, 7, 1, 0x41, [[0x41, 7]]],
  [0xC100, 7, 1, 2, [[0x41, 7]]], [0x8000, 3, 1, 2, [[0, 3]]],
]) test(`FADD terminal/zero character contract ${first.toString(16)}`, () => {
  const p = prepareRenderFADD({ data: fixture({ first, widths }), ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, width); assert.equal(p.characters, chars);
  assert.equal(p.x, x); assert.equal(p.carry, 1);
  assert.equal(p.overflow, chars === 0 ? 1 : 0); assert.equal(p.status & 0x30, 0);
});

test('FADD negative text selects bank9E while dictionary stays fixed9D', () => {
  const p = prepareRenderFADD({ data: fixture({ text: 0x9800 }), ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, 16);
  assert.ok(p.readAddresses.includes(0x9E9800)); assert.ok(p.readAddresses.includes(0x9D8000));
  assert.ok(!p.readAddresses.includes(0x9E8000));
});

test('FADD traverses nonleaf WORD indices including odd and full bank-carry addresses', () => {
  const data = fixture({ first: 0x7FFF, stream: 0, widths: [] });
  // 9D8000+7FFF=9DFFFF; its WORD high byte is 9E0000 (WRAM mirror).
  data.seed(0x9DFFFF, [0]); data.seed(0x9E0000, [0x8A]);
  // The carried dictionary byte aliases text DP00 before entry as well.
  word(data, 0x9D988A, 0);
  const p = prepareRenderFADD({ data, ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, 0); assert.equal(p.x, 0x7FFF);
  assert.ok(p.readAddresses.includes(0x9DFFFF)); assert.ok(p.readAddresses.includes(0x7E0000));
});

test('FADD hidden high A affects both second-character table index and WORD addition', () => {
  const data = fixture({ first: 0xC141, stream: 0x0020, widths: [[0x41, 255], [0x241, 9]] });
  const p = prepareRenderFADD({ data, ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, 0x506); assert.equal(p.characters, 4);
  assert.deepEqual(p.operations.filter(o => o.kind === 'read' && o.bytes === 1 && o.address >= 0x81AC0C)
    .map(o => o.address), [0x81AC4D, 0x81AC4D, 0x81AC4D, 0x81AE4D]);
});

test('FADD preserves final signed ADC overflow through newline CMP and WORD result load', () => {
  const indices = [0x41, 0x141, 0x441, 0x941, 0x1341, 0x2841, 0x5141];
  const data = fixture({ first: 0xC141, stream: 1, widths: indices.map(i => [i, 170]) });
  const p = prepareRenderFADD({ data, ...entry });
  assert.equal(p.handled, true); assert.equal(p.a, 0xA34C); assert.equal(p.characters, 14);
  assert.equal(p.status, 0xC5); assert.equal(p.overflow, 1); assert.equal(p.carry, 1);
});

test('AF04 late unavailable and unsupported source bytes discard the entire plan', () => {
  for (const [bank, pointer, reason] of [[0x9D, 0x9800, 'render_source_required'],
    [0x80, 0x2134, 'render_address_required']]) {
    const data = bitData(0); word(data, 0xCF, pointer); data.seed(0xD1, [bank]);
    atomicFailure(data, prepareRenderAF04, reason);
  }
});

test('AF04 source stack alias is rejected late with no counter writes; minimum5 stack succeeds', () => {
  const data = bitData(0); word(data, 0xCF, 0x1F00); data.seed(0xD1, [0]);
  atomicFailure(data, prepareRenderAF04, 'render_stack_alias_required');
  const p = prepareRenderAF04({ data: bitData(), ...entry, stackWindow: [0x1F00, 0x1F04] });
  assert.equal(p.handled, true); assert.equal(p.work, 4); assert.ok(Object.isFrozen(p.byteWrites));
});

for (const count of [0, 1, 0x7FFF, 0x8000, 0x8001, 0xFFFF]) test(`AF04 signed decrement gate ${count}`, () => {
  const data = bitData(count); word(data, 0xCF, 0x9800); data.seed(0xD1, [0x9D]); word(data, 0x9D9800, 0x0080);
  const p = prepareRenderAF04({ data, ...entry }), reload = Boolean(((count - 1) & 65535) & 0x8000);
  assert.equal(p.handled, true); assert.equal(p.reloaded, reload); assert.equal(p.a, entry.a);
  assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.overflow, 1);
  assert.equal(p.carry, 1); assert.equal(p.status & 0x82, reload ? 2 : 0);
  data.commit(p); assert.equal(get(data, 0x206), reload ? 15 : (count - 1) & 65535);
  assert.equal(get(data, 0xCF), reload ? 0x9802 : 0x9800);
});

test('AF04 low pointer wrap preserves bank and long WORD source carries into next bank', () => {
  const data = bitData(0); word(data, 0xCF, 0xFFFF); data.seed(0xD1, [0x7E]);
  data.seed(0x7EFFFF, [0x80]); data.seed(0x7F0000, [0]);
  const p = prepareRenderAF04({ data, ...entry }); assert.equal(p.handled, true); assert.equal(p.carry, 1);
  data.commit(p); assert.equal(get(data, 0xCF), 1); assert.equal(data.readByte(0xD1).value, 0x7E);
});

test('AF04 source may alias shift buffer; both INCs read the updated pointer', () => {
  const data = bitData(0, 0x0080); word(data, 0xCF, 0x208); data.seed(0xD1, [0]);
  const p = prepareRenderAF04({ data, ...entry }); assert.equal(p.handled, true); assert.equal(p.carry, 1);
  const reads = p.operations.filter(o => o.kind === 'read' && o.address === 0xCF).map(o => o.value);
  assert.deepEqual(reads, [0x208, 0x208, 0x209]); data.commit(p); assert.equal(get(data, 0x208), 0);
});

test('AF04 DBR7F absolute state differs from fixed bank00 direct page', () => {
  const data = createRenderData({ writeWindows: [...windows, [0x7F0206, 0x7F0209]] });
  word(data, 0x7F0206, 0); word(data, 0xCF, 0x9800); data.seed(0xD1, [0x9D]); word(data, 0x9D9800, 0x0080);
  const p = prepareRenderAF04({ data, ...entry, bank: 0x7F }); assert.equal(p.handled, true);
  data.commit(p); assert.equal(get(data, 0x7F0208), 0); assert.equal(data.readByte(0x208).available, false);
  assert.equal(get(data, 0xCF), 0x9802);
});

for (const [name, run, data, extra, reason] of [
  ['missing A', prepareRenderAF04, () => bitData(), { a: null }, 'render_entry_required'],
  ['BYTE entry', prepareRenderFADD, fixture, { status: 0x20 }, 'render_entry_required'],
  ['unknown bank', prepareRenderFADD, fixture, { bank: null }, 'render_entry_required'],
  ['AF04 small stack', prepareRenderAF04, () => bitData(), { stackWindow: [0x1F00, 0x1F03] }, 'render_stack_required'],
  ['FADD small stack', prepareRenderFADD, fixture, { stackWindow: [0x1F00, 0x1F05] }, 'render_stack_required'],
  ['DP stack alias', prepareRenderFADD, fixture, { stackWindow: [0xCF, 0xD5] }, 'render_stack_alias_required'],
  ['late missing width', prepareRenderFADD, () => fixture({ widths: [[0x41, 7]] }), {}, 'render_source_required'],
  ['late write outside window', prepareRenderFADD, () => fixture({ writeWindows: [[0x7E00CF, 0x7E00D1]] }), {}, 'render_write_window_required'],
  ['budget', prepareRenderFADD, fixture, { maxWork: 15 }, 'render_work_budget_required'],
]) test(`atomic boundary: ${name}`, () => atomicFailure(data(), run, reason, extra));

test('unterminated dictionary is bounded by work, without invented traversal cap', () => {
  const data = fixture({ first: 0, stream: 0 });
  atomicFailure(data, prepareRenderFADD, 'render_work_budget_required', { maxWork: 50 });
});

test('AF04 and FADD inner results cannot commit; outer payload is stale after seeding', () => {
  for (const [run, data] of [[renderAF04, bitData()], [renderFADD, fixture()]]) {
    const result = run(prepareRenderView(data), entry, { work: 0, maxWork: 1000 });
    assert.throws(() => data.commit(result), /Invalid render plan/); assert.equal(result.byteWrites, undefined);
  }
  const data = fixture(), plan = prepareRenderFADD({ data, ...entry });
  data.seed(0x41, [3]); const before = data.snapshot();
  assert.deepEqual(data.commit(plan), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});

test('FADD minimum stack succeeds; successful shared budget is exact and one fewer fails atomically', () => {
  const p = prepareRenderFADD({ data: fixture(), ...entry, stackWindow: [0x1F00, 0x1F06] });
  assert.equal(p.handled, true); assert.equal(p.work, p.operations.length);
  assert.equal(prepareRenderFADD({ data: fixture(), ...entry, maxWork: p.work }).handled, true);
  atomicFailure(fixture(), prepareRenderFADD, 'render_work_budget_required', { maxWork: p.work - 1 });
});

test('native probe pins the three independently source-verified windows and synthetic scope', async () => {
  const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
  const probe = JSON.parse(await readFile('analysis/render-fadd-native.json', 'utf8'));
  assert.equal(probe.romSha256, source.rom_sha256);
  assert.deepEqual(probe.sources, source.windows.filter(w => ['widthFADD', 'widthByteFB2A', 'bitAF04'].includes(w.name)));
  assert.match(probe.scope, /synthetic/); assert.equal(probe.probes.length, 3);
  assert.deepEqual(probe.probes.map(p => p.a), [16, 0, 0x506]);
});
