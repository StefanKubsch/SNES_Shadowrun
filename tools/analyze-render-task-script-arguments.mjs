import {emitTaskPartialSource} from './task-partial-source.mjs';import {spec,prove,describeArguments} from './render-task-script-arguments-source-proof.mjs';
const ctx={d:0x3D6,bank:0x80,s:0x3F0,y:65535,pointer:0x1200,scriptId:65535,carry:1,idAfterWorkspace:6,savedOuterS:0x1EF};
await emitTaskPartialSource(spec,prove,[0,1,2,3,255].map(argumentWord=>describeArguments({...ctx,argumentWord})));
