import {readFile,writeFile} from 'node:fs/promises';
// Explicit local registration of an already created bounded source. Never commits/pushes.
const [name,group,nextGroup,nextEntry,nextObjective]=process.argv.slice(2);
const nextEntries=(nextEntry??'').split(',');
if(![name,group,nextGroup].every(s=>/^[a-z0-9-]+$/.test(s))||!nextEntries.every(s=>/^80:[A-F0-9]{4}$/.test(s))||new Set(nextEntries).size!==nextEntries.length||!nextObjective)throw Error('Explicit scoped block registration required');
const read=p=>readFile(p,'utf8'),json=async p=>JSON.parse(await read(p)),put=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const progress=await json('docs/PORTIERUNGSSTAND.json'),report=await json(`analysis/render-task-${name}.json`);
if(progress.next_block.group!==group||report.rom_sha256!==progress.rom_sha256||report.source_graph.native_binding!==false)throw Error('Wrong current block/revision');
const g=progress.work_groups.find(g=>g.id===group);if(!g||JSON.stringify(g.entries)!==JSON.stringify(report.proofs.map(p=>p.entry)))throw Error('Block entries drift');
g.status=report.source_graph.source_closed_to_dispatch?'native-required':'source-required';g.reason=`Lokaler Quellenblock geliefert: analysis/render-task-${name}.json. ${report.proofs[0].qualification} Native/gesamteTaskbindung separat.`;
if(!progress.work_groups.some(g=>g.id===nextGroup))progress.work_groups.push({id:nextGroup,entries:nextEntries,status:'source-required',reason:nextObjective});
progress.next_block={group:nextGroup,entries:nextEntries,kind:'source',objective:nextObjective};if(!progress.autonomous_batch.completed_groups.includes(group))progress.autonomous_batch.completed_groups.push(group);
if(progress.autonomous_batch.completed_groups.length>progress.autonomous_batch.authorized_blocks)throw Error('Authorized batch exhausted');
const registry=await json('tools/task-supplemental-sources.json');registry.push({source:`analysis/render-task-${name}.json`,entries:g.entries,...(report.source_graph.source_closed_to_dispatch===false?{closed_dispatch:false,classification:report.source_graph.classification}:{})});
const pkg=await json('package.json');pkg.scripts[`analyze:render-task-${name}`]=`node tools/analyze-render-task-${name}.mjs`;
let tests=await read('tools/dialog-inventory.test.mjs');for(const entry of nextEntries)if(!tests.includes(`'${entry}':[]`))tests=tests.replace("    '80:C1CA':",`    '${entry}':[],\n    '80:C1CA':`);
await put('docs/PORTIERUNGSSTAND.json',progress);await put('tools/task-supplemental-sources.json',registry);await put('package.json',pkg);await writeFile('tools/dialog-inventory.test.mjs',tests);
console.log(`Registered ${group}; batch ${progress.autonomous_batch.completed_groups.length}/${progress.autonomous_batch.authorized_blocks}, next ${nextEntry}.`);
