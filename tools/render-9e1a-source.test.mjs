import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';
import { proveInput9E1A } from './render-9e1a-proof.mjs';
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-9e1a.json', import.meta.url), 'utf8'));
const pins = [
  [0x809E1A,0x809E59,26,'947b5802e14cc8c39c08d9976b76f46dec1e8ca657e4a5a9e4ebec186578ad80'],
  [0x81F007,0x81F024,15,'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8'],
  [0x809E0B,0x809E1A,6,'5f9981eb736ef5ecdf0b2b1ee8a1c696f7903bab08c0c9a0a62ce6d03058cecb'],
  [0x809E59,0x809E5F,3,'58a931c8320e48f04f9d151aee8c1d71a311ff7d481a6c5b697e6ea6003c51ff'],
  [0x809E5F,0x809E65,3,'63b6db4a45ad43af9fbe878eeacfc86982cd57fa77ba7a81c7d1594fe43115f7'],
  [0x80F298,0x80F2A0,5,'be6aae08b4cfac3aa3872769e26e894697a5c22343d3fe6b17e09264a2834628'],
  [0x80C067,0x80C06B,2,'6e196858af654424abc6ec6d2dd42b4c5f8c133a9c3b1cbeda155a36637fc84b'],
  [0x8096B7,0x8096BA,1,'871135e68518809e9a68b051f83e61a56ce11eed105a970a71759e6b7c443629'],
  [0x81D1F0,0x81D1F3,1,'c2bbe24872a0e6f1fe29cce98856af67976edd3fb13e9c2c83ca90a19fc34cad'],
  [0x80E382,0x80E39F,12,'5444d39df317de571ca30c24b5b4854329265aebe846f062f917dbed22299f06'],
];
const blocks = pins.map(([lo,hi],j) => {
  let state = j===9 ? {e:1,m:1,x:1} : {e:0,m:0,x:0}; const result=[],saved=[];
  for(let pc=lo;pc<hi;) {
    const i=decode(rom,pc,state);assert.ok(i.next<=hi);result.push(i);pc=i.next;
    if(i.mnemonic==='PHP')saved.push({...state});
    if(i.mnemonic==='PLP')state=saved.pop();
    if(['SEP','REP'].includes(i.mnemonic)){if(i.value&32)state.m=Number(i.mnemonic==='SEP');if(i.value&16)state.x=Number(i.mnemonic==='SEP');}
    if(i.cpu===0x809E54)state.e=1;
  }return result;
});
const at = (j,pc) => {const i=blocks[j].find(i=>i.cpu===pc);assert.ok(i);return i;};
test('9E1A originalROM and all ten independent windows are pinned, graph92/41',()=>{
  assert.equal(createHash('sha256').update(rom).digest('hex'),'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  pins.forEach(([lo,hi,count,hash],j)=>{const raw=rom.subarray(cpuToOffset(lo,rom.length),cpuToOffset(hi,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);assert.equal(blocks[j].length,count);
    assert.equal(report.windows[j].sha256,hash);assert.equal(report.windows[j].machine_bytes,raw.toString('hex').toUpperCase());});
  assert.equal(report.code_bytes,63);assert.equal(report.callee_bytes,29);assert.equal(report.graph_instruction_count,41);
});
test('9E1A fresh WORDedge reads precede copy and preserve full previousinput',()=>{
  assert.deepEqual(blocks[0].slice(0,6).map(i=>[i.mnemonic,i.value]),[['LDA',0x1CA],['EOR',0x1CC],['AND',0x1CA],['STA',0x1CE],['LDA',0x1CA],['STA',0x1CC]]);
  assert.ok(blocks[0].slice(0,6).every(i=>i.state.m===0&&i.mode==='abs'));
  assert.match(report.contract.edge,/freshWORD01CA/);
});
test('9E1A exact3030 branch precedes lowNibblefilter, only CA/CE clear',()=>{
  assert.equal(at(0,0x809E2C).value,0x3030);assert.equal(at(0,0x809E2F).target,0x809E3D);
  assert.equal(at(0,0x809E31).value,15);assert.equal(at(0,0x809E34).target,0x809E3C);
  assert.deepEqual(blocks[0].filter(i=>i.mnemonic==='STZ').map(i=>[i.value,i.state.m]),[[0x1CA,0],[0x1CE,0],[0x4200,1]]);
  assert.equal(at(0,0x809E3C).mnemonic,'RTS');assert.match(report.contract.returns,/C from unsignedCMP/);
});
test('9E1A reset changesDBR twice, preservesactualWORDX forF007, then entersE1 and neverRTS',()=>{
  assert.deepEqual(blocks[0].filter(i=>i.mnemonic==='PEA').map(i=>i.value),[0x8080,0x8080]);
  assert.equal(at(0,0x809E42).value,0);assert.equal(at(0,0x809E45).target,0x81F007);
  assert.equal(at(0,0x809E4E).value,0x30);assert.deepEqual(at(0,0x809E50).state,{e:0,m:1,x:1});
  assert.equal(at(0,0x809E53).mnemonic,'SEC');assert.equal(at(0,0x809E54).mnemonic,'XCE');
  assert.equal(at(0,0x809E55).target,0x80E382);assert.deepEqual(at(0,0x809E55).state,{e:1,m:1,x:1});
  assert.ok(!blocks[0].slice(13).some(i=>['RTS','PHB','LDX'].includes(i.mnemonic)));
});
test('F007 BYTEtoken once, freshBYTEpoll, orderedWORDX/command/token writes, fullstatusrestore',()=>{
  assert.equal(at(1,0x81F007).mnemonic,'PHP');assert.equal(at(1,0x81F008).value,32);
  assert.equal(at(1,0x81F00B).value,0x1CE4);assert.equal(at(1,0x81F00E).value,0x2140);assert.equal(at(1,0x81F011).target,0x81F00E);
  assert.deepEqual(blocks[1].filter(i=>['STA','STX'].includes(i.mnemonic)).map(i=>[i.mnemonic,i.value,i.state.m,i.state.x]),
    [['STX',0x2142,1,0],['STA',0x2141,1,0],['STA',0x2140,1,0],['STA',0x1CE4,1,0]]);
  assert.equal(at(1,0x81F022).mnemonic,'PLP');assert.deepEqual(at(1,0x81F023).state,{e:0,m:0,x:0});
  assert.match(report.contract.apu,/incomingAhLow is command/);
});
test('Structural wholegraph proves WORDreturn or explicit startupterminal, six protectedbytes',()=>{
  const map=new Map(blocks.slice(0,2).flatMap(b=>b.map(i=>[i.cpu,i]))), proof=proveInput9E1A(map);
  assert.deepEqual(proof,report.graph.proof);assert.equal(proof.reachable_instructions,41);
  assert.deepEqual(proof.returns,[{at:'80:9E3C',e:0,m:0,x:0,dbr:'entry'}]);
  assert.equal(proof.terminals.length,1);assert.equal(proof.terminals[0].to,'80:E382');assert.equal(proof.terminals[0].carry,0);
  assert.equal(proof.max_local_stack_bytes,4);assert.equal(proof.protected_with_root_jsr_bytes,6);
  assert.equal(proof.external_return_assumptions,0);assert.equal(proof.actual_apu_termination_proven,false);assert.equal(proof.startup_graph_proven,false);
  const bad=new Map(map);bad.set(0x809E53,{...bad.get(0x809E53),mnemonic:'CLC'});assert.throws(()=>proveInput9E1A(bad));
});
test('SelectedE382 is separatelyE1 decoded, callerwrapper return conditional and owners qualified',()=>{
  assert.ok(blocks[9].every(i=>i.state.e===1&&i.state.m===1&&i.state.x===1));
  assert.equal(blocks[9][0].mnemonic,'SEI');assert.equal(blocks[9].at(-1).mnemonic,'XCE');
  assert.deepEqual(blocks[5].map(i=>i.mnemonic),['PHP','REP','JSR','PLP','RTL']);
  assert.equal(report.owners.raw_patterns.jsr9E1A.length,19);assert.deepEqual(report.owners.raw_patterns.sta01CC,['80:9E29']);
  assert.deepEqual(report.owners.raw_patterns.stz01CA,['80:9E36','81:D1F0']);assert.match(report.owners.qualification,/not exhaustive/);
});
test('Priorcapture/edge/getter/APU bytes agree, manualcallback stilldoesnotconsume',async()=>{
  const prior=JSON.parse(await readFile(new URL('../analysis/render-9e0b.json',import.meta.url),'utf8'));
  assert.equal(report.windows[0].machine_bytes.slice(0,36),prior.windows[2].machine_bytes);
  assert.equal(report.windows[3].machine_bytes+report.windows[4].machine_bytes,prior.windows[3].machine_bytes);
  assert.match(report.owners.capture,/does not call9E1A/);assert.match(report.boundaries[0],/withhold all earlier/);
});
