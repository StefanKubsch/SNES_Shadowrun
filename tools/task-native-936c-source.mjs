import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {formatBlock} from './disassemble.mjs';
import {DIALOG_WINDOWS,SPRITE_COMPARE_TARGETS,SPRITE_ORDER_TARGETS} from './task-native-936c-windows.mjs';

// Native95/936C (Dialog, src/task/native-dialog.mjs) und seine neu umgesetzten Unterroutinen: je Gruppe
// gepinnte Originalbytes, statischer Stapel-/Modusbeweis mit echten Rahmen und externen Rücksprüngen in
// Routinen mit eigenem Beweis. Die Gleichungen vergleicht tools/task-native-dialog.test.mjs mit den
// Originalbefehlen; Mesen bestätigt den ganzen Dialog (docs/MESEN-ORACLE.md).
const RTS='RTS',RTL='RTL';
const ext={
 FF79:[0x80FF79,RTS,'clear windows, releaseNoticeWindows (src/task/native-slot-release.mjs)'],
 EF47:[0x81EF47,RTL,'music mode, setMusicMode (src/task/native-audio-compose.mjs)'],
 F963:[0x80F963,RTS,'window allocation, openWindow (src/task/native-window-open.mjs)'],
 FA3E:[0x80FA3E,RTS,'window release, releaseWindow (src/task/native-render-compose.mjs)'],
 B0A1:[0x81B0A1,RTL,'frame counter wait, waitForRandomStateChange (src/task/native-frame-wait.mjs)'],
 '9E1A':[0x809E1A,RTS,'joypad, readInput (src/task/native-input-apu.mjs)'],
 FA67:[0x80FA67,RTS,'window request, requestWindowUpload (src/task/native-menu-compose.mjs)'],
 FAAC:[0x80FAAC,RTS,'cursor, setTextCursor (src/task/native-list-prerequisites.mjs)'],
 FE69:[0x80FE69,RTS,'text, printText (src/task/native-text-compose.mjs)'],
 A6C7:[0x80A6C7,RTS,'menu, runTaskMenuCompose (src/task/native-menu-compose.mjs)'],
 C34A:[0x80C34A,RTS,'append task, appendScriptTask (src/task/task-append.mjs; topic path)'],
 C1CA:[0x80C1CA,RTS,'visit, nested scheduler round NativeCalls.round (src/vm/native-call.mjs; topic path)'],
};
const own=(target,op,name)=>[target,op,`own proof ${name} in this file`];
export const native936CSpecs=[
 {name:'936c',entry:0x80936C,root:RTS,externalReturns:[own(0x81886A,RTL,'886a'),own(0x80BCB2,RTS,'bcb2'),ext.FF79,ext.EF47,ext.F963,
   own(0x80FA92,RTS,'fa92'),own(0x809F6D,RTS,'9f6d'),own(0x808F20,RTS,'8f20'),own(0x809022,RTS,'9022'),own(0x80905E,RTS,'905e'),
   own(0x808F3A,RTS,'8f3a'),own(0x809178,RTS,'9178'),ext.B0A1,own(0x8091E2,RTS,'91e2'),own(0x809215,RTS,'9215'),ext.FA3E,
   own(0x808F97,RTS,'8f97'),own(0x80ADF4,RTS,'adf4'),ext['9E1A'],own(0x80B8DE,RTS,'b8de')],
  // $94E2 PLA nimmt die alte Musik: PHY bei Musikwechsel ($93BB) oder PEA FFFF ($93C2).
  lemmas:{pullKinds:new Map([[0x8094E2,['index','byte']]])}},
 {name:'886a',entry:0x81886A,root:RTL,externalReturns:[]},
 {name:'fa92',entry:0x80FA92,root:RTS,externalReturns:[]},
 {name:'9f6d',entry:0x809F6D,root:RTS,externalReturns:[]},
 {name:'8f20',entry:0x808F20,root:RTS,externalReturns:[]},
 {name:'9022',entry:0x809022,root:RTS,externalReturns:[]},
 {name:'905e',entry:0x80905E,root:RTS,externalReturns:[]},
 {name:'8f3a',entry:0x808F3A,root:RTS,externalReturns:[ext.B0A1]},
 {name:'8f97',entry:0x808F97,root:RTS,externalReturns:[ext.B0A1]},
 {name:'bcb2',entry:0x80BCB2,root:RTS,externalReturns:[ext.FA3E]},
 // $91D8 REP #$20 wird aus dem BYTE-Teil ($9191) erreicht.
 {name:'9178',entry:0x809178,root:RTS,externalReturns:[ext.FA67,ext.FAAC,ext.FE69,ext.C34A,ext.C1CA],lemmas:{widthJoins:new Set([0x8091D8])}},
 {name:'91e2',entry:0x8091E2,root:RTS,externalReturns:[ext.A6C7]},
 // PEI ($00) sichert die Menüauswahl, PLY nimmt sie zurück.
 {name:'9215',entry:0x809215,root:RTS,externalReturns:[ext.F963,ext.A6C7,ext.FA3E],
  lemmas:{peiWordPushes:new Map([[0x80929B,0]]),dataPulls:new Set([0x8092A4])}},
 {name:'adf4',entry:0x80ADF4,root:RTS,externalReturns:[ext.B0A1]},
 // Sprungziele aus den ROM-Tabellen 80:B0E3/B126 (Einträge 1..4) und der ausgerollten Folge ab 80:B936.
 {name:'b8de',entry:0x80B8DE,root:RTS,externalReturns:[],
  lemmas:{indirectTargets:new Map([[0x80B0AC,SPRITE_COMPARE_TARGETS],[0x80B0EF,SPRITE_ORDER_TARGETS],
   // DP84 beginnt bei 4 und wächst nur: k = DP84/4 von 1 bis 128 (STA $3D09 für Sprite 0 bleibt unerreicht).
   [0x80B930,Array.from({length:128},(_,k)=>0x80B936+3*k)]]),
  // $B7EB REP #$20 vereinigt BYTE- und WORD-Pfade der OAM-Einträge; $B7DC SEP #$20 folgt linear auf BYTE-Code.
  widthJoins:new Set([0x80B7EB,0x80B7DC])}},
].map(s=>({...s,windows:DIALOG_WINDOWS[s.name]}));
// Festgeschriebene Beweiswerte je Gruppe: Befehle, lokale Stapelbytes, Rücksprungstellen.
export const native936CExpected={
 '9022':{instructions:43,stack:2,returns:['80:905D']},
 '9178':{instructions:99,stack:3,returns:['80:91D7','80:91E1']},
 '9215':{instructions:76,stack:2,returns:['80:9253','80:92AF','80:92C4']},
 '936c':{instructions:201,stack:8,returns:['80:94E9']},
 '886a':{instructions:6,stack:0,returns:['81:8876']},
 'fa92':{instructions:12,stack:0,returns:['80:FAAB']},
 '9f6d':{instructions:120,stack:8,returns:['80:A032']},
 '8f20':{instructions:13,stack:1,returns:['80:8F39']},
 '905e':{instructions:36,stack:3,returns:['80:908B']},
 '8f3a':{instructions:51,stack:4,returns:['80:8F86']},
 '8f97':{instructions:33,stack:4,returns:['80:8FB2']},
 'bcb2':{instructions:12,stack:2,returns:['80:BCBD']},
 '91e2':{instructions:18,stack:0,returns:['80:920C']},
 'adf4':{instructions:285,stack:10,returns:['80:AE11']},
 'b8de':{instructions:1206,stack:10,returns:['80:BABA']},
};
export function prove936CSource(map,spec){
 assertPinnedTaskSource(map,spec.windows);
 const proof=proveWordStack(map,spec.entry,spec.root,{measureStack:true,externalReturns:new Map(spec.externalReturns.map(([t,op])=>[t,op])),...spec.lemmas});
 if(proof.reachable_instructions!==map.size||proof.external_return_assumptions!==spec.externalReturns.length
  ||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error(spec.name+' stack/mode drift');
 const expected=native936CExpected[spec.name];
 if(map.size!==expected.instructions||proof.maximum_local_stack_bytes!==expected.stack
  ||proof.returns.map(r=>r.at).sort().join()!==expected.returns.join())throw Error(spec.name+' pinned proof drift');
 return {...proof,root_return:spec.root,external_return_contracts:spec.externalReturns.map(([t,op,source])=>({target:cpuLabel(t),return:op,source}))};
}
export async function emit936CSource(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
 if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const groups=[],listing=[];
 for(const spec of native936CSpecs){
  const {map,blocks,windows}=decodeTaskWindows(bytes,spec.windows);
  for(const w of windows){const literal=spec.windows.find(s=>cpuLabel(s.start)===w.entry);if(w.machine_bytes!==literal.hex)throw Error(spec.name+' source literal drift');}
  const proof=prove936CSource(map,spec);groups.push({name:spec.name,windows,proof});listing.push(...blocks.map(formatBlock));
 }
 const report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Native95/936C dialog with its newly composed subroutines; pinned windows, static stack/mode proof per group with external returns into separately proved routines. Equations in src/task/native-dialog.mjs, native-dialog-*.mjs, native-scene-*.mjs; comparison with the original instructions in tools/task-native-dialog.test.mjs.',
  groups,source_graph:{classification:'native58-dialog-with-external-returns',code_bytes:groups.reduce((n,g)=>n+g.windows.reduce((m,w)=>m+w.covered_bytes,0),0),
   instructions:groups.reduce((n,g)=>n+g.proof.reachable_instructions,0)}};
 await writeFile('analysis/render-task-native-936c.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-936c.asm.txt',listing.join('\n'));
 console.log(`native-936c: ${groups.length} groups, ${report.source_graph.code_bytes} bytes/${report.source_graph.instructions} instructions, RTS/RTL proofs.`);
}
