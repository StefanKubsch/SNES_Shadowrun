import {readFile,writeFile} from 'node:fs/promises';
const [name,group,nextGroup,nextObjective]=process.argv.slice(2),json=async path=>JSON.parse(await readFile(path)),put=(path,v)=>writeFile(path,JSON.stringify(v,null,2)+'\n');
if(![name,group,nextGroup].every(s=>/^[a-z0-9-]+$/.test(s))||!nextObjective)throw Error('Explicit native registration');
const p=await json('docs/PORTIERUNGSSTAND.json'),r=await json(`analysis/render-task-${name}-native.json`),g=p.work_groups.find(g=>g.id===group),next=p.work_groups.find(g=>g.id===nextGroup);
if(p.next_block.group!==group||p.next_block.kind!=='native'||!g||!next||r.rom_sha256!==p.rom_sha256||r.native_binding!==true||r.manual_only!==true||r.full_task_binding!==false
  ||JSON.stringify(r.bindings.map(b=>b.entry))!==JSON.stringify(g.entries))throw Error('Native progress drift');
g.manual_native={module:r.bindings[0].module,report:`analysis/render-task-${name}-native.json`};
const frontier=r.probes.find(p=>p.handled)?.frontier;
const boundary=frontier==='observed-outer-RTS-target'||name==='end-return'?'outer return target is reported, not executed':
  frontier==='80:F488'||frontier==='80:F4F6'?`complete argument prefix stops BEFORE ${frontier} TCS stack migration`:
    'fresh poststore F389 fetch stops BEFORE dynamic F390 indexed dispatch';
g.status='composition-required';g.reason=`Manuelle native Bindung geliefert: ${g.manual_native.module}. Source-specific atomic prefix only, explicit frozen context/physical owners/protected outerstack/windows/budgets; ${boundary}. Whole Task/C1CA/9178/initialization/scene/frame composition remains open.`;
const id=group+':manual-native';if(p.autonomous_batch.completed_groups.includes(id))throw Error('Native block already registered');p.autonomous_batch.completed_groups.push(id);if(p.autonomous_batch.completed_groups.length>p.autonomous_batch.authorized_blocks)throw Error('Batch exhausted');
p.next_block={group:nextGroup,entries:next.entries,kind:'native',objective:nextObjective};
const pkg=await json('package.json');pkg.scripts[`probe:render-task-${name}`]=`node tools/probe-render-task-${name}.mjs`;
await put('docs/PORTIERUNGSSTAND.json',p);await put('package.json',pkg);console.log(`Registered ${id}: ${p.autonomous_batch.completed_groups.length}/${p.autonomous_batch.authorized_blocks}.`);
