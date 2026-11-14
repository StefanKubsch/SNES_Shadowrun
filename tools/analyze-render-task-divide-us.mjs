import {emitTaskPartialSource} from './task-partial-source.mjs';import {spec,prove} from './render-task-divide-us-source-proof.mjs';
import {arithmeticOwners} from './task-arithmetic-source.mjs';
const report=await emitTaskPartialSource(spec,prove,[]);
report.synthetic_examples=report.proofs.map(p=>arithmeticOwners(p,{s:65535,d:65535,bank:128,y:4,pointerAfter:0x1200}));
const {writeFile}=await import('node:fs/promises');
await writeFile('analysis/render-task-divide-us.json',JSON.stringify(report,null,2)+'\n');
