import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { readProgress, progressReference } from './progress.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function inventory(bytes, entry, {e=0,m=0,x=0}={}) {
  if(![e,m,x].every(v=>v===0||v===1)||e&&(!m||!x))throw Error('Invalid inventory entry widths');
  const pending = [{ pc:entry,e,m,x }], seen = new Set(), instructions = new Map(), boundaries = [];
  // 9490 contains four original unrolled pixel-composition paths (585
  // instructions); retain a finite root-specific planning bound.
  const stateBound=entry===0x819490?640:500;
  while (pending.length) {
    const s=pending.pop(),key=JSON.stringify(s);if(seen.has(key))continue;seen.add(key);if(seen.size>stateBound)throw Error('Inventory bound exceeded');
    const i=decode(bytes,s.pc,{e:s.e,m:s.m,x:s.x}),previous=instructions.get(i.cpu);
    if(previous && (previous.state.m!==i.state.m||previous.state.x!==i.state.x)) {
      boundaries.push({at:cpuLabel(i.cpu),reason:'unproved incoming width join'});continue;
    }
    instructions.set(i.cpu,i);const next={...s,pc:i.next};
    if(['REP','SEP'].includes(i.mnemonic)){if(i.value&32)next.m=Number(i.mnemonic==='SEP');if(i.value&16)next.x=Number(i.mnemonic==='SEP');}
    if(['RTS','RTL'].includes(i.mnemonic))continue;
    if(['PLP','XCE','PLD','TCD','TCS','RTI','BRK','COP','JML','WAI','STP'].includes(i.mnemonic)) {
      boundaries.push({at:cpuLabel(i.cpu),reason:'unproved '+i.mnemonic});continue;
    }
    if(['JMP','BRA','BRL'].includes(i.mnemonic)) {
      if(i.target===undefined)boundaries.push({at:cpuLabel(i.cpu),reason:'indirect jump'});
      else pending.push({...next,pc:i.target});continue;
    }
    if(i.mode==='rel8')pending.push({...next,pc:i.target});pending.push(next);
    if(i.mnemonic==='JSR'&&i.target===undefined)boundaries.push({at:cpuLabel(i.cpu),reason:'indirect call'});
  }
  const ordered=[...instructions.values()].sort((a,b)=>a.cpu-b.cpu);
  return {entry:cpuLabel(entry),source_closed:false,native_binding:false,...(e||m||x?{initial_state:{e,m,x}}:{}),
    inventoried_instructions:ordered.length,source_bytes_sha256:createHash('sha256').update(Buffer.concat(ordered.map(i=>i.raw))).digest('hex'),
    calls:ordered.filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),kind:i.mnemonic,to:i.target===undefined?null:cpuLabel(i.target),return_contract:'required'})),
    boundaries,instructions:ordered.map(i=>({at:cpuLabel(i.cpu),bytes:i.raw.toString('hex').toUpperCase(),op:i.mnemonic,mode:i.mode,state:i.state})),
    qualification:`Conditional local call inventory under E${e}M${m}X${x} and compatible external callee returns. Calls are not followed; PLP and unknown joins stop that path. No complete coverage, transitive stack, termination or original caller proof; no CPU execution.`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
  const progress = await readProgress(process.cwd());
  if (metadata.rom_sha256 !== progress.rom_sha256) throw Error('Wrong European ROM revision');
  const roots=progress.work_groups.flatMap(g=>g.entries.map(label=>inventory(bytes,parseInt(label.replace(':',''),16),g.entry_modes?.[label])));
  const report={rom_sha256:metadata.rom_sha256,progress_reference:progressReference,scope:'Planning evidence only; local calls decoded from ROM, external returns remain conditional. No source-completion or native status promotion.',roots};
  await writeFile('analysis/dialog-936c-inventory.json',JSON.stringify(report,null,2)+'\n');
  console.log(`936C: ${roots.length} conditional local inventories; grouping remains in ${progressReference}.`);
}
