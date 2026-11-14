// Nativer Livelauf über das Game Over (nur Werkzeug/Test): Jake stirbt in der
// Gasse (ALLEY_PLAN bis PLAN_END), danach läuft der Menübesitzer weiter. Ab
// start drückt der Lauf Start (neues Spiel) oder spielt plan (Rundenzähler für
// Befehle mit Rundenzahl); pictures hält je NMI ab PLAN_END den Bildhash.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {rom} from './task-native-dialog-harness.mjs';
import {ObservedRoom} from '../proof/video/room-observed.mjs';
import {livePlanDriver} from './live-plan-driver.mjs';
import {ALLEY_PLAN} from './mesen-f390-oracle.mjs';

// Native menu after Game Over at NMI 9166, the original's at NMI 10400.
export const PLAN_END=8900,NATIVE_START=9166,ORIGINAL_START=10400;
export const hash=pixels=>createHash('sha1').update(Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength)).digest('hex');
export function liveGameOver({start=null,until,sram=null,plan=null}){
  const bundle=JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
  const room=new ObservedRoom(rom,bundle);room.finish();if(sram)room.memory.sram.set(sram);
  const driver=livePlanDriver(ALLEY_PLAN,room.memory.wram),pads=[],pictures=new Map();
  const after=plan&&livePlanDriver(plan,room.memory.wram,()=>room.driver.roundsCompleted);
  const pad=k=>k<PLAN_END?driver.pad(k):after?(k>=start?after.pad(k):0):start!==null&&k>=start&&k<start+4?0x1000:0;
  const frames=room.live({pad:k=>pads[k]=pad(k),onFrame:f=>{if(f.nmi>=PLAN_END)pictures.set(f.nmi,hash(f.pixels));}});
  const events=[];let owns=true,error=null,widest=0;
  try{
    while(frames.nmis<until&&!after?.done()){const before=frames.nmis;room.stepLive({mainBudget:4096,opcodeBudget:4096});
      if(before>=PLAN_END)widest=Math.max(widest,frames.nmis-before);
      if(owns!==room.driver.ownsGame){owns=room.driver.ownsGame;events.push([owns?'game':'owner-return',frames.nmis,room.driver.roundsCompleted-bundle.rounds]);}
    }
  }catch(e){error=e;}
  return {room,bundle,driver,after,pads,pictures,events,error,nmis:frames.nmis,widest};
}
// Pads for the original: the native Gasse plan, then nothing up to its menu.
export function originalPads(run){
  const pads=run.pads.slice(0,PLAN_END);for(let k=PLAN_END;k<ORIGINAL_START;k++)pads[k]=0;
  return pads;
}
