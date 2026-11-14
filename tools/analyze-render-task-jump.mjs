import {emitTaskControlSource} from './task-control-source.mjs';import {spec,prove,describeJump} from './render-task-jump-source-proof.mjs';
await emitTaskControlSource(spec,prove,[{d:65535,bank:255,s:0,y:65535,targetWord:0x8001,pointerBefore:65535,pointerAfter:0xA001},{d:0x3D6,bank:0x80,s:0x3F0,y:4,targetWord:65535,pointerBefore:0x1200,pointerAfter:0x1200}].map(describeJump));
