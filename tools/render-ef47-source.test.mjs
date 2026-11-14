import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveAudioStack } from './render-audio-stack-proof.mjs';

const { bytes:rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc',import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-ef47.json',import.meta.url),'utf8'));
// Independent literal windows, hashes, instruction counts and width regions.
const windows = [
  ['selectEF47',0x81EF47,0x81EF63,9,'c0f2e310642f9af316f1b8cd02f2886d522a71241e5fa7c6bdc2bac9b74032b9'],
  ['modeF25A',0x81F25A,0x81F28F,25,'65ac365e2d7acf2087553a22b6278a13933b7c781170728735a949316845ab64'],
  ['modeEntriesF1FA',0x81F1FA,0x81F229,25,'31d47a60d85c178370f0301ab015d819f03f444858c2571810bdcc9e0490e15c'],
  ['selectedDialogMode',0x80939B,0x8093C5,17,'d4f87db680976a2c4d7a0a3a136990ff57bb792153af61826e12751aeea0c219'],
  ['selectedDialogRestore',0x8094E2,0x8094EA,4,'4268bb2d90801167212cbfde97c293f8372fb70ccb9ce2191fbfe5eafc5de1b5'],
  ['selectedACCall',0x808559,0x80855D,1,'6532597ea36f318fc005ac6c401af807462fc5c62eb190a940ffbaf8f2e50f00'],
  ['selectedTransitionCall',0x80A580,0x80A584,1,'6532597ea36f318fc005ac6c401af807462fc5c62eb190a940ffbaf8f2e50f00'],
  ['samplesF130',0x81F130,0x81F1E8,94,'50905b298f4518afafbf3df917de685631c0e9cd3788551efe018a8867987500'],
  ['repeatWordF1E8',0x81F1E8,0x81F1FA,10,'6e9c5e0eb71b5ec1190da695a8c990dcaa0d342bfc9368a0a3f85d8ab043cb6a'],
  ['subtractLengthF100',0x81F100,0x81F10A,6,'50fd916170eed9b16dd6faa9c206304ced967e27ace85de9485a85c5995509c9'],
  ['sendWordF122',0x81F122,0x81F130,8,'abc30bd5cf09fa55e91d91977bb8ddff733d40121d40762f7b064e2e23391254'],
  ['sendPairF03A',0x81F03A,0x81F067,21,'ffb4fab5ba66dd7c3b2d9a40891e6d169d1a4482beadfe9583a6e5a419f00d13'],
  ['apuF007',0x81F007,0x81F024,15,'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8'],
  ['directoryLoaderF092',0x81F092,0x81F100,57,'c262f6ce4794644b6a9e31e5a86ba7e1a564934604f8aad422929402713e3952'],
  ['selectedInitEF63',0x81EF63,0x81EF94,17,'4f2feb486619c9d21ccb86e68615b6d105b795938e76b6853d18f4b5fc009711'],
];
const byteRegions = [[0x81F25F,0x81F271],[0x81F287,0x81F28E],
  [0x81F1FA,0x81F203],[0x81F208,0x81F219],[0x81F221,0x81F229],
  [0x81F13D,0x81F156],[0x81F18E,0x81F1B4],[0x81F1C6,0x81F1D1],
  [0x81F1EB,0x81F1F5],[0x81F125,0x81F12F],[0x81F03A,0x81F067],
  [0x81F00A,0x81F023],[0x81F0BA,0x81F0C5],[0x81F0EA,0x81F0F6],[0x81F0FB,0x81F0FF]];
const all = new Map(), graph = new Map();
const graphNames = new Set(['selectEF47','modeF25A','modeEntriesF1FA',...report.dependencies[0].windows.map(w=>w.name)]);
for (const [name,start,end] of windows) for (let pc=start;pc<end;) {
  const i=decode(rom,pc,{e:0,m:Number(byteRegions.some(([lo,hi])=>pc>=lo&&pc<hi)),x:0});
  assert.ok(i.next<=end);all.set(pc,i);if(graphNames.has(name))graph.set(pc,i);pc=i.next;
}
const at = (pc,op,value) => {
  const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));return i;
};
const range = (lo,hi) => [...all.values()].filter(i=>i.cpu>=lo&&i.cpu<hi);

test('EF47 pins all fifteen complete/helper/caller/owner windows with independent decoder widths and hashes', () => {
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);
  const supplied=[...report.windows,...report.dependencies[0].windows,...report.selected_owners.windows];
  assert.equal(supplied.length,15);
  for(const[name,start,end,count,sha256]of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),sha256);assert.equal(range(start,end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,428);assert.equal(report.full_graph.instructions,213);
});

test('EF47 stores the full entry WORD before the real mode loader and two fixed command handshakes', () => {
  assert.equal(at(0x81EF47,'STA',0x1CDE).state.m,0);at(0x81EF4A,'JSL',0x81F25A);
  at(0x81EF4E,'LDA',13);at(0x81EF51,'LDX',0x2020);at(0x81EF54,'JSL',0x81F007);
  at(0x81EF58,'LDA',2);at(0x81EF5B,'LDX',0x7F7F);at(0x81EF5E,'JSL',0x81F007);at(0x81EF62,'RTL');
  assert.ok(range(0x81EF47,0x81EF63).every(i=>i.state.m===0&&i.state.x===0));
  assert.match(report.contract.ef47,/full entryA, even when lowA0/);assert.match(report.contract.ef47,/P=entryP withN\/Z cleared/);
  assert.match(report.contract.ef47,/Y actualF25A result/);
});

test('F25A preserves the low input byte across an unconditional command04 and zero exits before loader reads', () => {
  at(0x81F25A,'PHP');at(0x81F25B,'REP',16);at(0x81F25D,'SEP',32);at(0x81F25F,'PHA');
  at(0x81F260,'LDA',4);at(0x81F262,'LDX',0);at(0x81F265,'JSL',0x81F007);
  assert.equal(at(0x81F269,'PLA').state.m,1);at(0x81F26A,'BEQ',0x81F28D);at(0x81F26C,'JSR',0x81F1FA);
  assert.match(report.contract.f25a,/Zero path skipsF1FA\/F130\/finalmodehandshake/);
  assert.match(report.contract.f25a,/A0400\/X0\/Yentry/);
});

test('F25A selector formula and branch distinguish all65536 input WORDs by lowbyte only', () => {
  at(0x81F26F,'REP',32);at(0x81F271,'AND',255);at(0x81F274,'PHA');at(0x81F275,'EOR',65535);
  at(0x81F278,'CLC');at(0x81F279,'ADC',0x8100);at(0x81F27C,'JSL',0x81F130);
  at(0x81F280,'PLA');at(0x81F281,'ORA',0x100);at(0x81F284,'TAX');
  for(let value=0;value<=65535;value++){
    const mode=value&255;
    assert.equal(mode===0,value%256===0);
    if(mode){const total=(65535-mode)+0x8100;
      assert.equal(total&65535,0x80FF-mode);assert.equal(total>>>16,1);
      assert.ok((0x80FF-mode)>=0x8000&&(0x80FF-mode)<=0x80FE);assert.equal(mode|0x100,mode+256);}
  }
  assert.match(report.contract.f25a,/WORD80FF-modeByte/);assert.match(report.contract.f25a,/WORDPLA restores/);
});

test('F1FA stores BYTE mode then uses a fresh long WORD header and zero terminator before cache comparison', () => {
  assert.equal(at(0x81F1FA,'STA',0x1CE5).state.m,1);at(0x81F1FD,'PHP');at(0x81F1FE,'LDY',0);
  at(0x81F201,'REP',32);assert.equal(at(0x81F203,'LDA',0x8C).mode,'dily');assert.equal(all.get(0x81F203).state.m,0);
  at(0x81F205,'TAY');at(0x81F206,'SEP',32);assert.equal(at(0x81F208,'LDA',0x8C).state.m,1);
  at(0x81F20A,'BEQ',0x81F224);at(0x81F20C,'INY');assert.equal(at(0x81F20D,'CMP',0x1CE5).state.m,1);
  at(0x81F210,'BNE',0x81F221);
  assert.match(report.contract.f1fa,/zero exits before cacheCMP or nextbyte read/);
});

test('F1FA match builds8000|BYTE sample with XBA and protects WORDY around every actual F130', () => {
  at(0x81F212,'LDA',0x80);at(0x81F214,'XBA');assert.equal(at(0x81F215,'LDA',0x8C).state.m,1);
  at(0x81F217,'REP',32);assert.equal(at(0x81F219,'PHY').state.x,0);at(0x81F21A,'JSL',0x81F130);
  at(0x81F21E,'PLY');at(0x81F21F,'SEP',32);at(0x81F221,'INY');at(0x81F222,'BRA',0x81F206);
  for(let sample=0;sample<256;sample++)assert.equal(0x8000|sample,32768+sample);
  assert.equal(all.get(0x81F20C).state.x,0);assert.equal(all.get(0x81F221).state.x,0);
  for(let y=0;y<=65535;y++)assert.equal(((y+1)&65535)+1&65535,(y+2)%65536);
  assert.match(report.contract.f1fa,/matches do not stop scanning/);assert.match(report.contract.f1fa,/duplicates cause repeated realF130 calls/);
});

test('F1FA reloads cache after PLP and fixed transitive stores preserve the pointer/cache address families', () => {
  at(0x81F224,'PLP');assert.equal(at(0x81F225,'LDA',0x1CE5).state.m,1);at(0x81F228,'RTS');
  for(const i of graph.values())if(i.cpu!==0x81F1FA&&['STA','STX','STY','STZ','INC','DEC'].includes(i.mnemonic)&&i.mode!=='A'){
    assert.ok(['dp','abs'].includes(i.mode));
    const width=['STX','STY'].includes(i.mnemonic)?2:i.state.m?1:2;
    if(i.mode==='dp')assert.ok(i.value>0x8E||i.value+width-1<0x8C,cpuLabel(i.cpu));
    else assert.ok(i.value>0x1CE5||i.value+width-1<0x1CE5,cpuLabel(i.cpu));
  }
  assert.match(report.contract.freshness,/finalcache reload remains fresh/);
  assert.match(report.contract.f1fa,/C\/V\/I from savedentryP/);
});

test('EF47 whole213-instruction graph and real F25A/F1FA helper frames prove22/19/15 protected bytes', () => {
  assert.deepEqual(proveAudioStack(graph,0x81EF47,'RTL'),report.full_graph.proof);
  assert.equal(report.full_graph.proof.reachable_instructions,213);assert.equal(report.full_graph.proof.maximum_local_stack_bytes,19);
  assert.equal(report.full_graph.proof.minimum_protected_stack_bytes,22);assert.equal(report.full_graph.proof.external_return_assumptions,0);
  assert.deepEqual(report.full_graph.proof.returns,[{at:'81:EF62',m:0,x:0,dbr:'entry'}]);
  for(const[entry,ret,m,bytes,index]of[[0x81F25A,'RTL',0,19,0],[0x81F25A,'RTL',1,19,1],[0x81F1FA,'RTS',1,15,2]]){
    const p=proveAudioStack(graph,entry,ret,{entryM:m});assert.deepEqual(p,report.full_graph.helper_proofs[index]);
    assert.equal(p.minimum_protected_stack_bytes,bytes);assert.ok(p.returns.every(r=>r.m===m&&r.x===0&&r.dbr==='entry'));
  }
  assert.deepEqual(report.full_graph.calls,[...graph.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic))
    .map(i=>({from:cpuLabel(i.cpu),kind:i.mnemonic,to:cpuLabel(i.target)})));
});

test('EF47 structural proof rejects missing loader, lost status/index saves, wrong width and wrong return', () => {
  const missing=new Map(graph);missing.delete(0x81F130);assert.throws(()=>proveAudioStack(missing,0x81EF47),/Uncovered audio edge/);
  for(const[pc,change,pattern]of[[0x81F1FD,{mnemonic:'NOP'},/Audio stack mismatch/],
    [0x81F219,{mnemonic:'NOP'},/Audio stack mismatch/],[0x81F25D,{value:48},/Audio immediate width mismatch/],
    [0x81EF62,{mnemonic:'RTS'},/Wrong audio root return/],[0x81F228,{mnemonic:'RTL'},/Wrong audio call return/]]){
    const mutant=new Map(graph);mutant.set(pc,{...graph.get(pc),...change});assert.throws(()=>proveAudioStack(mutant,0x81EF47),pattern);
  }
});

test('EF47 selected936C caller preserves the old WORD across PHY-to-later-PLA with exact gates', () => {
  at(0x80939B,'AND',127);at(0x80939E,'BEQ',0x8093C2);at(0x8093A0,'LDA',0x1FD6);at(0x8093A3,'AND',1);
  at(0x8093A6,'BEQ',0x8093C2);at(0x8093A8,'LDA',0x1BA);at(0x8093AB,'AND',127);
  at(0x8093AE,'ASL');at(0x8093AF,'TAY');at(0x8093B0,'LDA',0x94E8);at(0x8093B3,'CMP',0x1CDE);
  at(0x8093B6,'BEQ',0x8093C2);at(0x8093B8,'LDY',0x1CDE);at(0x8093BB,'PHY');at(0x8093BC,'JSL',0x81EF47);
  at(0x8093C0,'BRA',0x8093C5);at(0x8093C2,'PEA',0xFFFF);
  at(0x8094E2,'PLA');at(0x8094E3,'BMI',0x8094E9);at(0x8094E5,'JSL',0x81EF47);at(0x8094E9,'RTS');
  assert.match(report.selected_callers.dialog,/PHY word is eventually consumed by PLA/);
  for(const caller of ['80:8559','80:A580','80:93BC','80:94E5'])assert.ok(report.selected_callers.scan.raw_jsl_candidates.includes(caller));
  assert.match(report.selected_callers.scan.qualification,/no indirect\/reachability\/allcallsite proof/);
});

test('EF47 original selected mode bytes and actual pointer owner are pinned without boot or initialization claims', () => {
  const specs=[['selectedDialogModes94E8',0x8094E8,256,'f87a6924bed824b85233fd60fc3ced0d4d0a3998cd59c1038a4df8d9ca27d90c'],
    ['selectedModePairs9FFF0A',0x9FFF0A,9,'fea5ad62ff9e79f092ba6b15c47e8aa80a0d3e542e836c192fac66bcf925a0fe'],
    ['selectedDirectoryPointer98FFFA',0x98FFFA,3,'253224875d64bc03ead47c41e2a96435b452c258bfe547ba35ff79aab80c512c'],
    ['selectedDirectory9FFEAC',0x9FFEAC,94,'bfed7bc5195ab8234d0e86beccc94a486bbed647072c56abdd3b3c5f51081821']];
  for(const[name,entry,length,hash]of specs){const offset=cpuToOffset(entry,rom.length),raw=rom.subarray(offset,offset+length);
    const supplied=[...report.tables,...report.selected_owners.tables].find(t=>t.name===name);
    assert.equal(supplied.sha256,hash);assert.equal(supplied.covered_bytes,length);assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal(supplied.machine_bytes,raw.toString('hex').toUpperCase());}
  assert.equal(rom.readUInt16LE(cpuToOffset(0x9FFEAC,rom.length)),94);
  assert.equal(report.tables[1].machine_bytes,'0238053706390C3800');
  at(0x81F096,'LDA',0x98FFFA);at(0x81F09A,'STA',0x8C);at(0x81F09C,'LDA',0x98FFFB);at(0x81F0A0,'STA',0x8D);
  assert.match(report.selected_owners.qualification,/does not initialize DP8C/);
});

test('EF47 source closure and manual native binding leave acknowledgement, termination and full caller boundaries explicit', () => {
  assert.equal(report.full_graph.closed,true);assert.equal(report.full_graph.native_binding,true);assert.equal(report.full_graph.actual_termination_proven,false);
  assert.match(report.contract.audio,/do not prove directory\/payload termination/);
  assert.match(report.selected_callers.other,/Native AC audio boundary/);assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.deepEqual(report.native_prerequisites.map(p=>[p.entry,p.accumulator_bytes,p.index_bytes,p.minimum_protected_stack_bytes,p.native_binding]),
    [['81:F1FA',1,2,15,true],['81:F25A',[2,1],2,19,true]]);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.equal(report.native_composition.native_binding,true);
  assert.equal(report.native_composition.minimum_protected_stack_bytes,22);
  assert.equal(report.native_composition.module,'proof/render/mode-ef47.mjs');
  assert.match(report.native_composition.qualification,/Original AC\/dialog\/transition callers and initialization remain open/);
});
