import test from 'node:test';
import assert from 'node:assert/strict';
import {SPC700_OPS,spc700Length,decodeSpc700} from './spc700-decode.mjs';
import {DRIVER,driverBytes,dispatchTargets,decodeDriver} from './sound-driver-source.mjs';
import {fileURLToPath} from 'node:url';
import {findMesen,prepareScript,runMesen} from './mesen.mjs';
import {rom} from './task-native-dialog-harness.mjs';

const bytes=driverBytes(Buffer.from(rom));
test('the uploaded sound driver, its command dispatch and reachable code are pinned',()=>{
  assert.equal(SPC700_OPS.length,256);assert.ok(SPC700_OPS.every((_,op)=>[1,2,3].includes(spc700Length(op))));
  // F07F: Y=8000, A=97, X=0C55 to EFA5; the final IPL block starts ARAM 0200.
  const at=((0x81&0x7F)*0x8000)+(0xF084-0x8000);
  assert.deepEqual([...rom.subarray(at,at+8)],[0xA0,0x00,0x80,0xA9,0x97,0xA2,0x55,0x0C]);
  assert.equal(bytes.length,0xC55);
  // 02A7..02C5: new token on port 0 -> Y=port 1, operand of CALL 02C2 from both tables.
  const window=[...bytes.subarray(0x2A7-0x200,0x2C8-0x200)].map(b=>b.toString(16).padStart(2,'0')).join('');
  assert.equal(window,'69f41cf098baf6da1ebaf4da1cc4f4f6c802c5c302f6e202c5c4023fc8025f4402');
  const targets=dispatchTargets(bytes);assert.equal(targets.length,26);
  assert.deepEqual(targets.slice(0,4),[0x619,0x635,0x688,0x68D]);assert.equal(targets[0x19],0xA00);
  const {instructions,external}=decodeDriver(bytes);
  assert.equal(instructions.length,1513);assert.deepEqual(external,[0xFFC0]);
  assert.equal(decodeSpc700(bytes,0x200,0x200).text,'DI');assert.equal(decodeSpc700(bytes,0x200,0x2C2).text,'CALL $02C8');
});

// Mesen executes the original driver: every observed successor of a driver
// instruction is either pc+length or its decoded target. The patched CALL
// at 02C2 reaches exactly the dispatch targets.
const {exe,reason}=findMesen();
test('Mesen SPC execution agrees with the decoded instruction lengths',{skip:exe?false:reason,timeout:900000},async()=>{
  const script=prepareScript('trace-spc-exec.lua',{FRAMES:1500}),rows=[];let ended=false;
  const result=await runMesen(exe,fileURLToPath(new URL('../Shadowrun (E).smc',import.meta.url)),script,line=>{
    if(line.startsWith('E '))rows.push(line.split(' ').slice(1).map(x=>parseInt(x,16)));else if(line.startsWith('END '))ended=true;
  },{timeoutMs:600000,keep:()=>ended});
  assert.equal(result.code,0);assert.ok(ended);
  const targets=new Set(dispatchTargets(bytes)),ops=new Set();let checked=0;
  for(const [pc,op,next]of rows){
    if(pc<DRIVER.aram||pc>=DRIVER.aram+bytes.length)continue;
    assert.equal(bytes[pc-DRIVER.aram],op,'unchanged opcode at '+pc.toString(16));
    const d=decodeSpc700(bytes,DRIVER.aram,pc),m=SPC700_OPS[op].split(' ')[0];ops.add(op);checked++;
    if(pc===DRIVER.dispatchCall){assert.ok(targets.has(next),'dispatch target '+next.toString(16));continue;}
    assert.ok(next===pc+d.length||next===d.target||/^(RET|RETI|JMP|TCALL|BRK|PCALL)$/.test(m),
      `${pc.toString(16)} ${d.text} -> ${next.toString(16)}`);
  }
  assert.ok(checked>900&&ops.size>90,JSON.stringify({checked,ops:ops.size}));
});

// Every data byte of the original run up to the first room: the pairs sent by
// F03A (port 1, port 2) equal the catalogued block lists in upload order.
test('the sound catalog reproduces every data byte the original sends to the driver',async()=>{
  const {soundCatalog,romReader}=await import('./sound-catalog.mjs');
  const {readFileSync}=await import('node:fs');const {gunzipSync}=await import('node:zlib');
  const {ObservedRoom}=await import('../proof/video/room-observed.mjs');
  const catalog=soundCatalog(Buffer.from(rom)),r=romReader(Buffer.from(rom));
  assert.deepEqual(catalog.map(d=>[d.directory,d.base.destination,d.base.bytes,d.items.length]),
    [[0x9FFEAC,0xEFE,49539,22],[0x99FFC8,0xEFE,29053,2]]);
  const bundle=JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
  const room=new ObservedRoom(rom,bundle),write=room.devices.write.bind(room.devices),sent=[],commands=[];let param=null;
  room.devices.write=(pc,address,value,width)=>{
    if(pc===0x81F050||pc===0x81F054)sent.push(value&255);
    if(pc===0x81F013)param=value;if(pc===0x81F018&&(value===1||value===0x10))commands.push([value,param]);
    write(pc,address,value,width);};
  room.finish();
  // Upload order in this run: directory 3 base, directory 0 base, item F8 of directory 0.
  assert.deepEqual(commands,[[1,29053],[1,49539],[0x10,3299]]);
  const expected=[],list=(l,id)=>{
    let at=l.destination;const pad=()=>{if(expected.length%2)expected.push(null);};
    for(const [n,c]of l.chunks.entries()){
      if(n===0||id!==undefined){expected.push(at&255,at>>>8);}
      if(c.kind==='raw')expected.push(...r.bytes(c.source,c.bytes));
      else for(let k=0;k<c.count;k++)expected.push(c.word&255,c.word>>>8);
      at+=c.bytes;
      if(id!==undefined)pad();
    }
    pad();
  };
  list(catalog[1].base);list(catalog[0].base);list(catalog[0].items.find(i=>i.id===0xF8),0xF8);
  assert.equal(sent.length,81900);assert.equal(expected.length,81900);
  for(let n=0;n<sent.length;n++)if(expected[n]!==null)assert.equal(sent[n],expected[n],'byte '+n);
});
