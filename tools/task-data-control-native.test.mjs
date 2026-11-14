import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTaskSignExtension as sign} from '../proof/task/sign-extension.mjs';
import {prepareTaskStateReads as stateRead} from '../proof/task/state-reads.mjs';
import {prepareTaskStateWrites as stateWrite} from '../proof/task/state-writes.mjs';
import {prepareTaskStateSignExtension as stateSign} from '../proof/task/state-sign-extension.mjs';
import {prepareTaskJumpZero as zero} from '../proof/task/jump-zero.mjs';
import {prepareTaskJumpNonzero as nonzero} from '../proof/task/jump-nonzero.mjs';
import {prepareTaskJump as jump} from '../proof/task/jump.mjs';
import {prepareTaskCallLocal as call} from '../proof/task/call-local.mjs';
import {prepareTaskReturnLocal as ret} from '../proof/task/return-local.mjs';
import {taskControlFixture as fixture} from './task-control-native-fixtures.mjs';
import {taskFixture} from './task-native-fixtures.mjs';
import {prepared, commit, unchangedFailure, writes, reads} from './task-native-test-support.mjs';

test('immediate/local sign extension reads full WORDs and sets CMP Carry for every byte', () => {
  for (const entry of [0x80F3F6, 0x80F408]) for (let low = 0; low < 256; low++) {
    const f = fixture(entry); f.data.seed(0x801204, [low, 0xAB]);
    if (entry === 0x80F408) f.data.seed(0x213 + low, [low, 0xCD]);
    const p = prepared(sign, f);
    assert.equal(p.value, low < 128 ? low : 0xFF00 + low);
    assert.equal(p.outputContext.status & 1, Number(low >= 128));
    assert.deepEqual(writes(p), [[0x3F0, low < 128 ? 0 : 255], [0x3EF, low]]);
    assert.ok(reads(p).includes(0x801205));
    if (entry === 0x80F408) assert.ok(reads(p).includes(0x214 + low));
  }
});
test('PHA may replace its DP pointer; fresh opcode uses both poststore bytes', () => {
  const f = taskFixture(0x80F3F6, {s:0x201}); f.data.seed(0x801204, [0x80, 0x12]);
  f.data.seed(0x80FF85, [0x7A, 0xBC]); const p = prepared(sign, f);
  assert.equal(p.opcodeWord, 0xBC7A); assert.equal(p.outputContext.a, 0x7A);
});
test('state WORD and masked BYTE/sign reads cross physical 7E/7F without losing high source', () => {
  for (const [entry, prepare, value] of [[0x80F8D4,stateRead,0x80],[0x80F8E4,stateRead,0xAB80],[0x80F90F,stateSign,0xFF80]]) {
    const f = fixture(entry); f.data.seed(0x801204,[255,255]); f.data.seed(0x7EFFFF,[128,171]);
    const p = commit(prepare,f); assert.equal(p.value,value); assert.ok(reads(p).includes(0x7F0000));
    assert.equal(p.outputContext.y,7); assert.equal(p.outputContext.s,0x3EE);
  }
});
test('state stores consume one WORD and cross bank boundary with original widths', () => {
  for (const entry of [0x80F8F1,0x80F902]) {
    const f = fixture(entry,{top:0xABCD,writeWindows:[[0x7E0000,0x7FFFFF]]}); f.data.seed(0x801204,[255,255]);
    const p = commit(stateWrite,f); assert.deepEqual(writes(p),entry===0x80F8F1?[[0x7EFFFF,0xCD]]:[[0x7EFFFF,0xCD],[0x7F0000,0xAB]]);
    assert.equal(p.outputContext.s,0x3F2); assert.equal(p.outputContext.y,7);
  }
});
test('state store replaces opcode; full next WORD is fresh after all output bytes', () => {
  const f = fixture(0x80F902,{pointer:0x400,top:0x3456}); f.data.seed(0x800404,[6,4,0xAA,0xBB]);
  const p = prepared(stateWrite,f); assert.equal(p.opcodeWord,0x3456);
});
test('zero/nonzero jumps consume full condition, skip unreadable target when untaken and keep flags', () => {
  for (const [prepare,entry] of [[zero,0x80F420],[nonzero,0x80F42E]]) for (const top of [0,1,0x8000,65535]) {
    const f = fixture(entry,{top}), taken=prepare===zero?top===0:top!==0, p=prepared(prepare,f);
    assert.equal(p.taken,taken); assert.equal(p.outputContext.y,taken?0x21:7); assert.equal(p.outputContext.s,0x3F2);
    assert.equal(p.outputContext.status & ~0x82,f.context.status & ~0x82); assert.equal(p.outputBytes,0);
    assert.equal(reads(p).includes(0x801204),taken);
  }
  for(const [prepare,entry,top] of [[zero,0x80F420,1],[nonzero,0x80F42E,0]]) {
    const f=taskFixture(entry,{top,seedOpcode:false}); f.data.seed(0x801206,[0x14,0xA5]); prepared(prepare,f);
  }
});
test('unconditional jump uses complete target without stack reads or writes', () => {
  const f=fixture(0x80F43C), p=prepared(jump,f); assert.equal(p.targetWord,0x20); assert.equal(p.outputContext.y,0x21);
  assert.equal(p.outputContext.s,f.context.s); assert.equal(p.outputBytes,0); assert.ok(!reads(p).includes(0x3F1));
});
test('local call return save may overwrite DP05 before fresh decrement', () => {
  const f=fixture(0x80F442); f.data.seed(0x205,[5,2]); const p=prepared(call,f);
  assert.equal(p.destination,0x205); assert.equal(p.freshPointer,6); assert.equal(p.newPointer,4);
  assert.deepEqual(writes(p),[[0x800205,6],[0x800206,0],[0x205,4],[0x206,0]]); assert.equal(p.outputContext.y,0x21);
});
test('local return increments pointer before reading aliased return data', () => {
  const f=fixture(0x80F454); f.data.seed(0x205,[3,2]); f.data.seed(0x801405,[0x14,0xA5]);
  const p=prepared(ret,f); assert.equal(p.newPointer,0x205); assert.equal(p.returnWord,0x205); assert.equal(p.outputContext.y,0x206);
});
test('local call and return preserve original 16bit pointer wrap', () => {
  const c=fixture(0x80F442); c.data.seed(0x205,[0,0]); assert.equal(prepared(call,c).newPointer,65534);
  const r=fixture(0x80F454); r.data.seed(0x205,[254,255]); r.data.seed(0x800000,[0x20,0]); assert.equal(prepared(ret,r).newPointer,0);
});
test('ignored state sourceHigh and late nextOpcodeHigh failures hold every prior write back', () => {
  const f=taskFixture(0x80F8D4); f.data.seed(0x801204,[255,255]); f.data.seed(0x7EFFFF,[128]);
  unchangedFailure(stateRead,f,{},'render_source_required');
  const c=taskFixture(0x80F442,{seedOpcode:false}); c.data.seed(0x801204,[0x20,0]); c.data.seed(0x205,[0,5]); c.data.seed(0x801220,[0x14]);
  unchangedFailure(call,c,{},'render_source_required');
});
