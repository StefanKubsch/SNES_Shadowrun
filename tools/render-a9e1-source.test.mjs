import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc',import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a9e1.json',import.meta.url),'utf8'));
const specs = [
  ['transferA9E1',0x81A9E1,0x81AA9C,71,'ecc6ffbce77e7b8b8a31fa016053b6efdc82682daf4246fcf72c5b110f2bf46f'],
  ['pretransfer8949',0x818949,0x818A05,74,'e19f94eeb8313bc33e4bb2c708b1b46ebb3190d7eaefd43a2ceae109b20376de'],
  ['nativeNmi',0x00C112,0x00C14F,31,'c485e1b77a065309dda94b2a5c79961f2e47121666e9d3b1236c79181c449aeb'],
  ['dispatch',0x80C14F,0x80C152,1,'96aab457a6a9fb454aff554971c4e31fa56266fd5d210918294fd17382e11526'],
  ['callbackC152',0x80C152,0x80C1A6,28,'0a5abd0966147a44db1eb25e0cdd75850ecd8319a865e9c092f031fdcf7ac6af'],
  ['registerC109',0x80C109,0x80C112,6,'69f303df58a394e6102f7c1039a19891c7d88ad841ea2b2615b432e4750f6441'],
  ['registrationCaller',0x809663,0x809674,6,'4bad7ee8c078828ec7d0fc2368480e311427bde07c0f6234b1f5af7a0e7a2ba9'],
  ['initializeAB2C',0x81AB2C,0x81AC0C,86,'628b6c443d01591958186c775166ac9dd89b981dffb3dbcc1c11b02d08439279'],
];
// Widths independently selected from the actual REP/SEP/PLP joins, not the report.
const byteA = [[0x81AA14,0x81AA20],[0x81AA39,0x81AA45],[0x81AA61,0x81AA6D],[0x81AA89,0x81AA98],
  [0x81896D,0x818979],[0x81898D,0x818994],[0x8189B0,0x8189BC],[0x8189D0,0x8189D7],
  [0x8189E1,0x8189EF],[0x8189F6,0x818A04],[0x80C154,0x80C15B],[0x80C185,0x80C1A5],
  [0x80966F,0x809674],[0x81AB40,0x81AB5B],[0x81AB69,0x81ABC1]];
const map = new Map();
for (const [,start,end] of specs) for(let pc=start;pc<end;) {
  const i=decode(rom,pc,{e:0,m:byteA.some(([lo,hi])=>pc>=lo&&pc<hi)?1:0,x:pc>=0x80C10E&&pc<0x80C111?1:0});
  assert.ok(i.next<=end);map.set(pc,i);pc=i.next;
}
const at=(pc,op,value,target)=>{
  const i=map.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op);
  if(value!==undefined)assert.equal(i.value,value);if(target!==undefined)assert.equal(i.target,target);return i;
};
const range=(start,end)=>[...map.values()].filter(i=>i.cpu>=start&&i.cpu<end);

test('A9E1 source pins eight complete selected windows, byte widths and the true bank00 native vector',()=>{
  for(const [name,start,end,count,digest] of specs){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),digest);
    assert.equal(range(start,end).length,count);
    assert.deepEqual(report.windows.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:digest,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.code_bytes,773);assert.equal(report.instruction_count,303);
  assert.equal(rom.readUInt16LE(cpuToOffset(0x00FFEA,rom.length)),0xC112);
  assert.equal(report.vector.target,'00:C112');assert.match(report.vector.qualification,/actual hardware NMI PBR00/);
});

test('01F6 uses unsigned 1401 threshold and CMP Carry before SBC, clears early and always advances 020A by 0A00',()=>{
  at(0x81A9E1,'LDA',0x1F6);at(0x81A9E4,'BEQ',undefined,0x81AA20);
  at(0x81A9E6,'LDA',0xAC8C);at(0x81A9E9,'STA',0x4362);at(0x81A9EC,'LDA',0x20C);
  at(0x81A9EF,'CMP',0x1401);at(0x81A9F2,'BCC',undefined,0x81A9FF);at(0x81A9F4,'SBC',0x1400);
  at(0x81A9F7,'STA',0x20C);at(0x81A9FA,'LDA',0x1400);at(0x81A9FD,'BRA',undefined,0x81AA02);
  at(0x81A9FF,'STZ',0x1F6);at(0x81AA02,'STA',0x4365);at(0x81AA05,'LDA',0x20A);at(0x81AA08,'STA',0x2116);
  at(0x81AA0B,'CLC');at(0x81AA0C,'ADC',0xA00);at(0x81AA0F,'STA',0x20A);
  at(0x81AA14,'LDA',0x80);at(0x81AA16,'STA',0x2115);at(0x81AA19,'LDA',0x40);at(0x81AA1B,'STA',0x420B);
  for(const [size,remainder] of [[0x1401,1],[0x2800,0x1400],[0xFFFF,0xEBFF]])assert.equal((size-0x1400)&65535,remainder);
  assert.match(report.transfer.first,/<=1400 clears01F6 before transfer/);assert.match(report.transfer.first,/includingzero/);
  assert.equal((0xFC00+0xA00)&65535,0x600);
});

test('A9E1 services fresh 01F8 even while 01F6 remains pending and clears it after the channel7 trigger',()=>{
  assert.deepEqual(report.transfer.order,['WORD01F6','WORD01F8','WORD01FA','WORD01FC']);
  at(0x81AA20,'LDA',0x1F8);at(0x81AA23,'BEQ',undefined,0x81AA48);
  at(0x81AA25,'LDA',0x23A0);at(0x81AA28,'STA',0x4372);at(0x81AA2B,'LDA',0x740);at(0x81AA2E,'STA',0x4375);
  at(0x81AA31,'LDA',0x7800);at(0x81AA34,'STA',0x2116);at(0x81AA40,'STA',0x420B);
  at(0x81AA43,'REP',32);assert.equal(at(0x81AA45,'STZ',0x1F8).state.m,0);
  assert.match(report.transfer.second,/need not finish its request/);
});

test('01FA reuses channel7 with fresh size/destination and 01FC retains the BYTE213A read before channel5 trigger',()=>{
  at(0x81AA48,'LDA',0x1FA);at(0x81AA4B,'BEQ',undefined,0x81AA70);
  at(0x81AA4D,'LDA',0x2AE0);at(0x81AA50,'STA',0x4372);at(0x81AA53,'LDA',0x210);at(0x81AA56,'STA',0x4375);
  at(0x81AA59,'LDA',0x20E);at(0x81AA5C,'STA',0x2116);at(0x81AA68,'STA',0x420B);at(0x81AA6D,'STZ',0x1FA);
  at(0x81AA70,'LDA',0x1FC);at(0x81AA73,'BEQ',undefined,0x81AA9B);at(0x81AA75,'LDA',0x20E);
  at(0x81AA7B,'LDA',0x10);at(0x81AA7E,'STA',0x4355);at(0x81AA81,'LDA',0x2AE0);at(0x81AA84,'STA',0x4352);
  assert.equal(at(0x81AA8E,'LDA',0x213A).state.m,1);at(0x81AA91,'LDA',0x20);at(0x81AA93,'STA',0x420B);
  at(0x81AA98,'STZ',0x1FC);at(0x81AA9B,'RTL');
});

test('Pretransfer8949 has both early return gates and only selected channel3 writes before scrolling registers',()=>{
  at(0x818949,'LDA',0xCD8);at(0x81894C,'BNE',undefined,0x818953);
  at(0x81894E,'LDA',0x1562);at(0x818951,'BNE',undefined,0x818954);at(0x818953,'RTL');
  at(0x818954,'LDA',0xCD0);at(0x818957,'BEQ',undefined,0x818997);at(0x818997,'LDA',0xCD6);at(0x81899A,'BEQ',undefined,0x8189DA);
  const stores=range(0x818949,0x818A05).filter(i=>i.mnemonic==='STA');
  assert.ok(stores.every(i=>![0x4350,0x4351,0x4354,0x4360,0x4361,0x4364,0x4370,0x4371,0x4374].includes(i.value)));
  assert.equal(stores.filter(i=>i.value===0x420B).length,4);
  at(0x818994,'STZ',0xCD0);at(0x8189D7,'STZ',0xCD6);
  assert.deepEqual(range(0x8189DA,0x818A04).filter(i=>['STA','STZ'].includes(i.mnemonic)).map(i=>[i.mnemonic,i.value,i.state.m]),
    [['STA',0x210D,1],['STZ',0x210D,1],['STA',0x210F,1],['STZ',0x210F,1],
      ['STA',0x210E,1],['STZ',0x210E,1],['STA',0x2110,1],['STZ',0x2110,1]]);
});

test('True NMI normalizes widths before saving A, reads 4210 before DBR normalization and switches stacks before dispatch',()=>{
  for(const m of [0,1])for(const x of [0,1])assert.equal(decode(rom,0x00C112,{e:0,m,x}).value,0x30);
  at(0x00C114,'STA',0x7E1C78);at(0x00C118,'LDA',0x4210);at(0x00C11B,'TSC');at(0x00C11C,'STA',0x7E1C7A);
  at(0x00C120,'LDA',0x1CBB);at(0x00C123,'TCS');at(0x00C124,'LDA',0x7E1C78);
  assert.deepEqual(range(0x00C128,0x00C12D).map(i=>i.mnemonic),['PHA','PHX','PHY','PHB','PHD']);
  at(0x00C12D,'LDA',0);at(0x00C130,'TCD');at(0x00C131,'PHK');at(0x00C132,'PLB');
  at(0x00C133,'INC',0x1C76);at(0x00C136,'PHP');at(0x00C137,'JSL',undefined,0x80C14F);
  assert.match(report.nmi.bank,/BEFORE bank normalization/);assert.match(report.nmi.saved,/Counterincrement alone doesnotprove callback ran/);
});

test('NMI restoration needs a real callback return and restores old stack before hardware RTI',()=>{
  assert.deepEqual(range(0x00C13B,0x00C141).map(i=>i.mnemonic),['PLP','PLD','PLB','PLY','PLX','PLA']);
  at(0x00C141,'STA',0x7E1C78);at(0x00C145,'LDA',0x7E1C7A);at(0x00C149,'TCS');at(0x00C14A,'LDA',0x7E1C78);at(0x00C14E,'RTI');
  assert.match(report.nmi.restore,/original hardwareframe/);assert.match(report.nmi.restore,/No standalone full NMI return proof/);
});

test('Pointer registration writes WORD plus BYTE, restores widths but truncates index high bytes before indirect tail dispatch',()=>{
  at(0x80C109,'PHP');assert.equal(at(0x80C10A,'STX',0x6E).state.x,0);at(0x80C10C,'SEP',16);
  assert.equal(at(0x80C10E,'STY',0x70).state.x,1);at(0x80C110,'PLP');assert.equal(at(0x80C111,'RTL').state.x,0);
  at(0x809663,'LDX',0xC152);at(0x809666,'LDY',0x80);at(0x809669,'JSL',undefined,0x80C109);at(0x809671,'STA',0x4200);
  assert.equal(at(0x80C14F,'JML',0x6E).mode,'ind');
  assert.match(report.nmi.dispatch,/PLP doesnotrestore them/);assert.equal(0xC152&255,0x52);
});

test('Channel configuration precedes external loader, with flag clearing and direct A9E1 request only after its return',()=>{
  for(const [pc,value] of [[0x81AB84,0x4370],[0x81AB89,0x4360],[0x81AB8E,0x4350],
    [0x81AB93,0x4371],[0x81AB96,0x4361],[0x81AB9B,0x4351],[0x81ABA0,0x4374],[0x81ABA5,0x4364],[0x81ABAA,0x4354]]){
    assert.equal(at(pc,'STA',value).state.m,1);
  }
  at(0x81AB82,'LDA',1);at(0x81AB87,'LDA',9);at(0x81AB8C,'LDA',0x81);at(0x81AB91,'LDA',0x18);at(0x81AB99,'LDA',0x39);
  at(0x81AB9E,'LDA',0x7E);at(0x81ABA3,'LDA',0x81);at(0x81ABA8,'LDA',0x7E);
  at(0x81ABE2,'JSL',undefined,0x81AA9C);
  assert.deepEqual(range(0x81ABEC,0x81ABFE).map(i=>[i.mnemonic,i.value]),[['STZ',0x1F8],['STZ',0x1F6],['STZ',0x1FA],['STZ',0x1FC],['STZ',0x200],['STZ',0x202]]);
  at(0x81AC04,'INC',0x1F8);at(0x81AC07,'JSL',undefined,0x81A9E1);at(0x81AC0B,'RTL');
  assert.match(report.initialization.boundary,/doesnotprove it preceded anyparticular NMI/);
});

test('Complete local return graphs preserve WORD/DBR while callback subgraphs and native acknowledgment remain conditional',()=>{
  for(const p of report.structural_proofs)assert.deepEqual(proveWordStack(map,Number.parseInt(p.entry.replace(':',''),16)),p);
  assert.deepEqual(report.structural_proofs.map(p=>p.reachable_instructions),[71,74,6]);
  at(0x80C15B,'JSL',undefined,0x818949);at(0x80C15F,'JSL',undefined,0x81A9E1);
  assert.equal(range(0x80C163,0x80C183).filter(i=>['JSR','JSL'].includes(i.mnemonic)).length,9);
  assert.match(report.callback.after,/Do not equate clear01F8/);assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
