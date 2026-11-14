// Orakel für den Kaltstart live (nur Werkzeug/Test): Mesen startet kalt
// (AllZeros wie tools/mesen.mjs), gibt je NMI ein Padwort aus pads und liefert
// das Bild am Ende des Frames vor NMI k für jedes k in shots. Die NMI-Zählung
// des Originals enthält seine Lag-NMIs; der Vergleich mit dem lagfreien
// nativen Lauf (src/video/live-game.mjs) geht daher über die Bildfolge.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {prepareScript,runMesen} from './mesen.mjs';
import {BOOT_PPU_OVERRIDES} from './mesen-boot-prefix.mjs';

const ROM_PATH=fileURLToPath(new URL('../Shadowrun (E).smc',import.meta.url));
export async function recordColdPictures(exe,{pads=[],shots,timeoutMs=900000}){
  assert.ok(shots.length>0&&shots.every(k=>Number.isSafeInteger(k)&&k>0));
  assert.ok(pads.every(w=>Number.isInteger(w)&&w>=0&&w<=0xFFFF&&!(w&15)),'standard pad words');
  const script=prepareScript('trace-cold-pictures.lua',{PADS:'{'+pads.join(',')+'}',SHOTS:'{'+shots.map(k=>'['+k+']=true').join(',')+'}'});
  const pictures=new Map();let received=0,announced=null,damage=null;
  const result=await runMesen(exe,ROM_PATH,script,raw=>{
    if(damage||announced!==null)return;
    if(raw.startsWith('N ')){announced=Number(raw.slice(2));return;}
    if(!raw.startsWith('SHOT '))return;
    try{
      const match=/ #(\d+)$/.exec(raw);assert.ok(match,'unsequenced picture record');assert.equal(Number(match[1]),++received,'damaged picture sequence');
      const t=raw.slice(5,match.index).split(' ');
      pictures.set(Number(t[0]),{k:Number(t[0]),scanline:Number(t[1]),width:Number(t[2]),height:Number(t[3]),
        rgb:Uint8Array.from(t[4].match(/.{6}/g).flatMap(h=>[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4),16)]))});
    }catch(error){damage=error;}
  },{timeoutMs,overrides:BOOT_PPU_OVERRIDES,keep:()=>!damage&&announced!==null&&announced===received});
  if(damage)throw damage;
  assert.equal(result.code,0,'Mesen cold picture run');assert.equal(announced,received,'complete picture record');
  assert.deepEqual([...pictures.keys()].sort((x,y)=>x-y),[...shots].sort((x,y)=>x-y),'every requested picture');
  return pictures;
}
