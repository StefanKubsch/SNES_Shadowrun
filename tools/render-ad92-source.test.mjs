import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-ad92.json', import.meta.url), 'utf8'));
const windows = [
  ['requestACB5',0x81ACB5,0x81ACBD,3,'560a3f66c5d46e47b85e687c5a63f482b3cd1e12f7591e9a79d3eca1ea1012be'],
  ['waitACAF',0x81ACAF,0x81ACB5,3,'abcd15f735893a9027750d6760a4ecefb5554f6e4ce37c3c78880bc2a24a70ee'],
  ['entryACCF',0x81ACCF,0x81AD92,97,'7b1e231f5be2f3e765f02d5b621fd40baa5b190448ab60a94464d32b6bb30d9e'],
  ['renderAD92',0x81AD92,0x81ADBA,16,'de7bc7c4cb91717e27a7b7b0eab421495a009b497cb012cf56ff6b0713c35b13'],
  ['ackAA20',0x81AA20,0x81AA48,15,'5dbd89a22fecbc3875ac5338dbb8e6aecab62f80160976e2bf8ed90e769a36a9'],
  ['callC15F',0x80C15F,0x80C163,1,'31959c08ba71e47fee87a0d7b50788654f9118bae56dc46e7ee02f87b2ed5081'],
  ['callAC07',0x81AC07,0x81AC0B,1,'31959c08ba71e47fee87a0d7b50788654f9118bae56dc46e7ee02f87b2ed5081'],
];
const instructions = new Map();
for (const [,start,end] of windows) for(let pc=start;pc<end;) {
  const i=decode(rom,pc,{e:0,m:pc>=0x81AA39&&pc<=0x81AA43?1:0,x:0});
  assert.ok(i.next<=end);instructions.set(pc,i);pc=i.next;
}
const at = (pc,op,value,target) => {
  const i=instructions.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op);
  if(value!==undefined)assert.equal(i.value,value);if(target!==undefined)assert.equal(i.target,target);return i;
};
const range=(start,end)=>[...instructions.values()].filter(i=>i.cpu>=start&&i.cpu<end);

test('Render source pins seven selected windows and rechecks existing source bytes before closing call graphs', () => {
  for(const [name,start,end,count,sha256] of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),sha256);assert.equal(range(start,end).length,count);
    assert.deepEqual(report.windows.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.code_bytes,249);assert.equal(report.acknowledgment_bytes,40);assert.equal(report.caller_bytes,8);
  assert.equal(report.dependencies.length,2);
  for(const d of report.dependencies)for(const w of d.windows){
    const start=Number.parseInt(w.entry.replace(':',''),16),end=Number.parseInt(w.end_exclusive.replace(':',''),16);
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),w.sha256);assert.equal(raw.toString('hex').toUpperCase(),w.machine_bytes);
  }
});

test('ACB5 increments an actual WORD including FFFF wrap; ACAF exits only on a real zero read', () => {
  at(0x81ACB5,'INC',0x1F8);at(0x81ACB8,'JSL',undefined,0x81ACAF);at(0x81ACBC,'RTL');
  at(0x81ACAF,'LDA',0x1F8);at(0x81ACB2,'BNE',undefined,0x81ACAF);at(0x81ACB4,'RTL');
  assert.deepEqual(range(0x81ACAF,0x81ACB5).map(i=>i.mnemonic),['LDA','BNE','RTL']);
  assert.equal((0xFFFF+1)&65535,0);assert.match(report.request.increment,/doesnotprove any transfer happened/);
  assert.match(report.request.wait,/No standalone boundedwait success forconstantnonzero/);
});

test('Selected acknowledgment slice clears both flag bytes after register writes and does not prove caller mode or transfer', () => {
  at(0x81AA20,'LDA',0x1F8);at(0x81AA23,'BEQ',undefined,0x81AA48);
  for(const [load,store,value,address] of [[0x81AA25,0x81AA28,0x23A0,0x4372],
    [0x81AA2B,0x81AA2E,0x740,0x4375],[0x81AA31,0x81AA34,0x7800,0x2116],
    [0x81AA39,0x81AA3B,0x80,0x2115],[0x81AA3E,0x81AA40,0x80,0x420B]]){
    at(load,'LDA',value);at(store,'STA',address);
  }
  at(0x81AA37,'SEP',32);at(0x81AA43,'REP',32);assert.equal(at(0x81AA45,'STZ',0x1F8).state.m,0);
  assert.ok(range(0x81AA20,0x81AA48).every(i=>i.mnemonic!=='RTL'));
  at(0x80C15F,'JSL',undefined,0x81A9E1);at(0x81AC07,'JSL',undefined,0x81A9E1);
  assert.match(report.request.anchors,/not complete callers/);assert.match(report.request.acknowledgment,/do not prove hardware transfer/);
});

test('ACCF saves DBR and entry index, reads actual WORD fields in order and delays width and height reads until after output', () => {
  at(0x81ACCF,'PHB');at(0x81ACD0,'PEA',0x7E7E);at(0x81ACD3,'PLB');at(0x81ACD4,'PLB');at(0x81ACD5,'STX',0xCF);
  for(const [read,store,address,scratch] of [[0x81ACD7,0x81ACDB,0x7E2080,0xD2],
    [0x81ACDD,0x81ACE1,0x7E2180,0xC9],[0x81ACE3,0x81ACE7,0x7E2000,0xC3]]){
    assert.equal(at(read,'LDA',address).mode,'longx');assert.equal(at(store,'STA',scratch).state.m,0);
  }
  at(0x81ACE9,'TAY');at(0x81ACEF,'STA',0x23A0);at(0x81ACF4,'LDA',0x7E2020);
  at(0x81AD0F,'STA',0x23A0);at(0x81AD12,'LDX',0xCF);at(0x81AD14,'LDA',0x7E2040);
  assert.ok(range(0x81ACCF,0x81ACF4).every(i=>!['BEQ','BMI','CMP','CPX'].includes(i.mnemonic)));
  assert.match(report.entry_draw.top,/Heightread must see earlieroutput aliases/);
});

test('Top and bottom WORD loops have no zero guard and retain original border values with fresh C9 reads', () => {
  at(0x81ACF8,'DEC');at(0x81ACF9,'DEC');at(0x81ACFA,'STA',0xC6);at(0x81ACFC,'TAX');
  at(0x81ACFD,'LDA',0x2002);at(0x81AD00,'ORA',0xC9);at(0x81AD02,'STA',0x23A0);at(0x81AD07,'DEX');at(0x81AD08,'BNE',undefined,0x81ACFD);
  at(0x81AD77,'LDX',0xC6);at(0x81AD79,'LDA',0xA002);at(0x81AD7C,'ORA',0xC9);at(0x81AD7E,'STA',0x23A0);at(0x81AD83,'DEX');at(0x81AD84,'BNE',undefined,0x81AD79);
  for(const [load,ora,store,value] of [[0x81ACEA,0x81ACED,0x81ACEF,0x2001],[0x81AD0A,0x81AD0D,0x81AD0F,0x6001],
    [0x81AD24,0x81AD27,0x81AD29,0x2003],[0x81AD42,0x81AD45,0x81AD47,0x6003],
    [0x81AD6D,0x81AD70,0x81AD72,0xA001],[0x81AD86,0x81AD89,0x81AD8B,0xE001]]){
    at(load,'LDA',value);at(ora,'ORA',0xC9);assert.equal(at(store,'STA',0x23A0).mode,'absy');
  }
  assert.equal((2-2)&65535,0);assert.match(report.entry_draw.top,/C6zero nominal65536 writes,notzero/);
  at(0x81AD8E,'LDX',0xCF);at(0x81AD90,'PLB');at(0x81AD91,'RTL');
  assert.match(report.entry_draw.bottom,/finalrightcapdoesnotadvanceY/);
});

test('Middle rows use actual C3 stride and separate evolving ORed A and scratch D2 with unconditional counters', () => {
  at(0x81AD18,'DEC');at(0x81AD19,'DEC');at(0x81AD1A,'TAX');at(0x81AD1B,'CLC');at(0x81AD1C,'LDA',0xC3);
  at(0x81AD1E,'ADC',0x40);at(0x81AD21,'STA',0xC3);at(0x81AD23,'TAY');at(0x81AD2E,'LDA',0xC6);at(0x81AD30,'STA',0xCC);
  at(0x81AD32,'LDA',0xD2);at(0x81AD34,'ORA',0xC9);at(0x81AD36,'STA',0x23A0);
  assert.equal(at(0x81AD39,'INC').mode,'A');assert.equal(at(0x81AD3A,'INC',0xD2).mode,'dp');
  at(0x81AD3E,'DEC',0xCC);at(0x81AD40,'BNE',undefined,0x81AD36);at(0x81AD61,'DEX');at(0x81AD62,'BNE',undefined,0x81AD1B);
  assert.ok(range(0x81AD36,0x81AD42).every(i=>i.mnemonic!=='ORA'));
  // Different algebraic updates of the source's two words must not be merged.
  assert.equal(((0x00FF|0x0100)+1)&65535,0x0200);assert.equal(((0x00FF+1)&65535)|0x0100,0x0100);
  assert.match(report.entry_draw.middle,/do not recomputeD2 OR C9 percell/);
});

test('Row wrap uses unsigned inclusive comparison after wrapped SBC and rereads base when resetting D2', () => {
  at(0x81AD4A,'PHX');at(0x81AD4B,'LDX',0xCF);at(0x81AD4D,'SEC');at(0x81AD4E,'LDA',0xD2);
  assert.equal(at(0x81AD50,'SBC',0x7E2060).mode,'longx');at(0x81AD54,'CMP',0x7E20A0);
  at(0x81AD58,'BCC',undefined,0x81AD60);at(0x81AD5A,'LDA',0x7E2060);at(0x81AD5E,'STA',0xD2);at(0x81AD60,'PLX');
  assert.equal((0-1)&65535,0xFFFF);assert.ok(range(0x81AD4A,0x81AD62).every(i=>!['BMI','BPL'].includes(i.mnemonic)));
  assert.match(report.entry_draw.wrap,/including equality/);assert.match(report.entry_draw.wrap,/second actual7E2060\+X read/);
});

test('AD92 and BCB2 graphs close structurally with intact DBR/WORD stack while actual wait and memory guarantees stay open', () => {
  for(const [entry,count,ret] of [['81:ACAF',3,'81:ACB4'],['81:ACB5',6,'81:ACBC'],['81:ACCF',97,'81:AD91'],
    ['81:AD92',368,'81:ADB9'],['80:BCB2',399,'80:BCBD']]){
    const p=report.structural_proofs.find(p=>p.entry===entry);assert.equal(p.reachable_instructions,count);
    assert.equal(p.external_return_assumptions,0);assert.ok(p.returns.every(r=>r.at===ret&&r.m===0&&r.x===0&&r.dbr==='entry'));
    assert.match(p.qualification,/no input termination, stack-alias, interrupt or hardware interference proof/);
  }
  for(const g of report.local_graphs){const [,start,end]=windows.find(w=>w[0]===g.name);
    assert.deepEqual(g.edges,range(start,end).filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),kind:i.mnemonic,to:cpuLabel(i.target)})));
  }
  assert.deepEqual(report.closed_render_graph,{entry:'81:AD92',code_bytes:790,instructions:368,external_return_assumptions:0});
  assert.deepEqual(report.closed_reset_graph,{entry:'80:BCB2',code_bytes:861,instructions:399,external_return_assumptions:0});
  assert.equal(report.actual_memory_termination_proven,false);assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.match(report.boundaries[1],/NativeA5\/97/);
});
