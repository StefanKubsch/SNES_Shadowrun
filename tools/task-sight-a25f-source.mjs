import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {formatBlock} from './disassemble.mjs';

// 81:A25F line of sight (src/task/line-of-sight.mjs): the whole graph reachable from the JSL entry,
// pinned in three windows. A60B and A62B are reached by BCC from the 8-bit tails (SEP #$20 at
// A5B3/A5D9) and start with EOR #$FF / INC A, so both windows decode with initialM 1.
export const sightA25FSpec={name:'task-sight-a25f',entry:0x81A25F,rootReturn:'RTL',maximumLocalStackBytes:2,
 instructions:716,returns:['81:A269','81:A32B','81:A32C'],
 windows:[
 {start:0x81A25F,hex:'6468A7FC29FF00D002186B8562645FB9280E4A4A850E85114A4A851AB9800E4A4A851485174A4A851DBD280E4A4AC50E900485118002850E4A4A38E51AB00849FFFF1AE65FE65FEB8520BD800E4A4AC51490048517800285144A4A38E51DB00649FFFF1AE65FEB8523BFA0437E8565BDD80E4A4A852C186565852FBBBFA0437E4A85264A1865268526BDD80E4A4A1865268526A00100B7FC8532C8C8B7FC8535C8C8C8C8B7FC8538C8C8B7FC853BC8C8B7FC855CC8C8202DA3900A2044A39005205CA5B008C662D0CD18A5686B6BA511C5329010A517C535900AA538C50E9004A53BC51460A55FF00C3AF07F3AD0034C4CA44CCEA4A5384A4A38E51A904205238D0242A5354A4A38E51D90370520AE16428D0242A53BEC164290254A4A38E51D901F05208D0242A5324A4A38E51A90110523AE16428D0242EAEAEAEC1642B001603860A53B4A4A38E51D90F405208D0242A5324A4A38E51A90E70523AE16428D0242EAEAEAEC1642B0D760A5384A4A38E51A904A05238D0242A53B4A4A856B38A51DE56B903B0520AE16428D0242A535EC164290294A4A856B38A51DE56B901F05208D0242A5324A4A38E51A90110523AE16428D0242EAEAEAEC1642B001603860A5354A4A856B38A51DE56B90F005208D0242A5324A4A38E51A90E30523AE16428D0242EAEAEAEC1642B0D360A5324A4A856B38A51AE56B904605238D0242A5354A4A38E51D903B0520AE16428D0242A53BEC164290294A4A38E51D902305208D0242A5384A4A856B38A51AE56B90110523AE16428D0242EAEAEAEC1642B001603860A53B4A4A38E51D90F405208D0242A5384A4A856B38A51AE56B90E30523AE16428D0242EAEAEAEC1642B0D360A5324A4A856B38A51AE56B904E05238D0242A53B4A4A856B38A51DE56B903F0520AE16428D0242A535EC1642902D4A4A856B38A51DE56B902305208D0242A5384A4A856B38A51AE56B90110523AE16428D0242EAEAEAEC1642B001603860A5354A4A856B38A51DE56B90F005208D0242A5384A4A856B38A51AE56B90DF0523AE16428D0242EAEAEAEC1642B0CF60A20000A55FF00F3AD0034C6BA63AD0034CC0A64C15A7A5384A4A38E51A8544A5324A4A38E51A853EB001E805238D0242A53B4A4A38E51D8547A5354A4A38E51D8541CAF03890100520AE16428D0242EAEAEACC1642B026E22038A55CE526904F8D0242A5218D0342C220EAAD16428D0442E220A53E8D0642C220EA8025E22038A55CE52690498D0242A5248D0342C220EAAD16428D0442E220A5418D0642C220EAEA18A5266D1442B064C52CB04C60'},
 {start:0x81A60B,initialM:1,hex:'49FF1A8D0242A5218D0342C220EAAD16428D0442E220A5448D0642C220EA801F'},
 {start:0x81A62B,initialM:1,hex:'49FF1A8D0242A5248D0342C220EAAD16428D0442E220A5478D0642C220EAEA18A526ED144290B8C52C90B438E52FB00F49FFFF1A0AC565B005A9FFFF85681860A5384A4A38E51A8544A5324A4A38E51A853EB001E805238D0242A5354A4A856B38A51DE56B8547A53B4A4A856B38A51DE56B8541CAD0034CD9A5B0034CB3A50520AE16428D0242EAEAEACC164290034CD9A54CB3A5A5324A4A856B38A51AE56B8544A5384A4A856B38A51AE56B853EB001E805238D0242A53B4A4A38E51D8547A5354A4A38E51D8541CAD0034CD9A5B0034CB3A50520AE16428D0242EAEAEACC164290034CD9A54CB3A5A5324A4A856B38A51AE56B8544A5384A4A856B38A51AE56B853EB001E805238D0242A5354A4A856B38A51DE56B8547A53B4A4A856B38A51DE56B8541CAD0034CD9A5B0034CB3A50520AE16428D0242EAEAEACC164290034CD9A54CB3A5'},
 ],
 contract:'Complete pinned 81:A25F graph (A25F/A2F5 loop, A32D box test, A344 quadrant lines with A3CA/A44C/A4CE, A55C spans with A66B/A6C0/A715, division tails A5B3/A5D9/A5FE/A60B/A62B/A64A/A656). JSL entry E0M0X0 D0, internal JSR/RTS only, no PHP/PHB/PLB, two local stack bytes; all three RTL exits M0X0 with entry DBR. Hardware multiply 4202/4203 to 4216 and divide 4204/4206 to 4214/4216 at their original instruction addresses. Pointer [FC] and object tables fresh; termination of the cell loop by the count byte only, no bound inferred.'};

export function proveSightSource(map,spec=sightA25FSpec) {
  assertPinnedTaskSource(map,spec.windows);
  const proof=proveWordStack(map,spec.entry,spec.rootReturn,{measureStack:true});
  if(proof.external_return_assumptions!==0||proof.reachable_instructions!==map.size||map.size!==spec.instructions
    ||proof.maximum_local_stack_bytes!==spec.maximumLocalStackBytes||proof.minimum_protected_stack_bytes!==spec.maximumLocalStackBytes+3
    ||proof.returns.map(r=>r.at).sort().join()!==spec.returns.join()||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Sight stack/mode drift');
  const calls=[...map.values()].filter(i=>['JSR','JSL','JMP','JML'].includes(i.mnemonic));
  if(calls.some(i=>i.mnemonic!=='JSR'&&i.mnemonic!=='JMP'||!map.has(i.target)))throw Error('Sight graph not closed');
  const hardware=[...map.values()].filter(i=>i.mode==='abs'&&i.value>=0x2000&&i.value<0x8000).sort((a,b)=>a.cpu-b.cpu)
    .map(i=>({at:cpuLabel(i.cpu),operation:i.mnemonic,register:i.value.toString(16).toUpperCase(),width:i.mnemonic==='STA'||i.mnemonic==='LDA'||i.mnemonic==='ADC'||i.mnemonic==='SBC'?(i.state.m?1:2):(i.state.x?1:2)}));
  return {...proof,root_return:spec.rootReturn,full_graph_closed:true,inner_calls:calls.filter(i=>i.mnemonic==='JSR').map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),return_word:(i.next-1)&65535})),
    hardware_accesses:hardware,qualification:spec.contract};
}
export async function emitSightSource(spec=sightA25FSpec) {
  const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
  if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
  const {map,blocks,windows}=decodeTaskWindows(bytes,spec.windows);
  for(const w of windows){const literal=spec.windows.find(s=>cpuLabel(s.start)===w.entry);if(w.machine_bytes!==literal.hex)throw Error('Sight source literal drift');}
  const proof=proveSightSource(map,spec),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
    scope:'Original 81:A25F JSL helper source contract; equations in src/task/line-of-sight.mjs, differential check in tools/task-sight-a25f.test.mjs.',
    windows,proofs:[proof],source_graph:{local_source_complete:true,full_graph_closed:true,classification:'jsl-helper-graph-source',
      code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:map.size},contract:spec.contract};
  await writeFile(`analysis/render-${spec.name}.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`analysis/render-${spec.name}.asm.txt`,blocks.map(formatBlock).join('\n'));
  console.log(`${spec.name}: ${report.source_graph.code_bytes}/${map.size}, closed JSL graph, RTL proof.`);
}
