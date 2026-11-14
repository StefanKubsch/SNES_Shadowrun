import {emitTaskPartialSource} from './task-partial-source.mjs';import {spec,prove,describeEnd} from './render-task-end-return-source-proof.mjs';
await emitTaskPartialSource(spec,prove,[describeEnd({bank:128,s:0x3F0,resultWord:0x1234,savedOuterS:0x1EF,outerReturnWord:0xC20A}),describeEnd({bank:255,s:65535,resultWord:65535,savedOuterS:65535,outerReturnWord:65535})]);
