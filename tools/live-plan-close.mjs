// Geschlossene Livepläne (nur Werkzeug): Ein Mesen-Weg mit Dauerbefehlen
// (tools/mesen-f390-oracle.mjs) wird im Original nachgespielt und in Befehle
// übersetzt, die nicht von Lag-Frames abhängen (tools/live-plan-driver.mjs):
// Jedes "hold" wird ein "walk" auf die Position, an der das Original es beendet;
// springt die Position darin oder im folgenden "wait" (Szenenwechsel), hält ein
// "exit" vorher bzw. danach die Tasten bis zum Sprung. Ein zweiter Lauf mit dem
// so geschlossenen Plan zählt die Runden je Befehl; "wait" und "press" mit
// mindestens MIN_ROUNDS Runden (Spielfeld, Ladezeit) enden danach nach dieser
// Rundenzahl statt nach NMIs. Menüs und Handschuhwahl (kaum Runden) behalten
// ihre NMI-Dauer.
// Aufruf: node tools/live-plan-close.mjs badge|badge-buy  (gibt den Plan als JSON aus)
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {findMesen} from './mesen.mjs';
import {recordLiveRoom} from './mesen-live-room.mjs';
import {BADGE_OFFER_PLAN,LOAD_SLOT1} from './mesen-f390-oracle.mjs';

const MIN_ROUNDS=10,JUMP=32;
const position=end=>[end[2]>>2,end[3]>>2];
function jumps(ends,positions,i){
  const from=ends[i-1][0],to=ends[i][0];
  const path=[position(ends[i-1]),...positions.filter(([k])=>k>from&&k<to).map(([,,x,y])=>[x>>2,y>>2]),position(ends[i])];
  return path.some((p,n)=>n&&(Math.abs(p[0]-path[n-1][0])>JUMP||Math.abs(p[1]-path[n-1][1])>JUMP));
}
export function walkPlan(plan,ends,positions){
  return plan.flatMap((command,i)=>{
    if(command[0]!=='hold')return [command];
    const walk=['walk',command[1],...position(ends[i])];
    if(jumps(ends,positions,i))return [['exit',command[1]],walk];
    if(plan[i+1]?.[0]==='wait'&&jumps(ends,positions,i+1))return [walk,['exit',command[1]]];
    return [walk];
  });
}
export function roundPlan(plan,ends){
  return plan.map((command,i)=>{
    const rounds=ends[i][4]-(i?ends[i-1][4]:ends[0][4]);
    if(rounds<MIN_ROUNDS)return command;
    if(command[0]==='wait')return ['wait',command[1],rounds];
    if(command[0]==='press')return ['press',command[1],command[2]??12,rounds];
    return command;
  });
}
// pads: Padwörter bis livePlanFrom; der Lauf endet am Planende.
export async function closeLivePlan(exe,pads,plan,{livePlanFrom,liveSram=null,timeoutMs=3000000}){
  const options={liveSram,livePlanFrom,timeoutMs};
  const first=await recordLiveRoom(exe,pads,1e6,{...options,livePlan:plan,track:20});
  const walked=walkPlan(plan,first.ends,first.positions);
  const second=await recordLiveRoom(exe,pads,1e6,{...options,livePlan:walked});
  return roundPlan(walked,second.ends);
}

// Vom Hauptmenü nach dem Game Over: Start saved game, Resume game 1, dann der
// Weg von BADGE_OFFER_PLAN bis zur Geldprüfung des Geschäftsmanns.
export const BADGE_OFFER_SOURCE=Object.freeze([['press','down',20],['press','start',80],['press','b',120],
  ...BADGE_OFFER_PLAN.slice(LOAD_SLOT1.length),['wait',30]]);

// Geld für die Marke (Walkthrough Zeilen 1423–1430): Der Weg von BADGE_OFFER_LIVE_PLAN biegt in Südwest
// in die Gasse ab, Jake hebt die Beretta ($4C) neben dem Toten mit R auf und geht zurück, ohne den Orc zu
// bekämpfen (er schießt weiter). Danach Club und Lone Star wie dort. Im Büro des Geschäftsmanns: Start,
// Weapon, Beretta Pistol, Give auf ihn, Yes ("I'll give ya... 200"); Ask about Lone Star, Yes (150 Nuyen,
// bleiben 70); Exit, Y, LoneStar Badge, Use ("I'll tack it onto my pocket..."). Schon geschlossene Befehle
// bleiben, walk-Punkte der Gasse erkundet mit tools/mesen-explore.mjs (walk).
const at=(plan,command)=>plan.findIndex(c=>JSON.stringify(c.slice(0,command.length))===JSON.stringify(command));
const ALLEY_BERETTA=[['walk','up+left',219,509],['exit','down+left'],['walk','down+left',366,363],
  ['walk','down',341,343],['walk','down+left',342,308],['walk','left',364,285],['walk','down',349,270],['walk','right',327,280],
  ['press','b'],['glove',146,140],['wait',8],['press','r',40],
  ['walk','up',345,305],['walk','up+right',342,344],['walk','up',354,360],['walk','up',372,393],['exit','up+right'],['wait',60],
  ['walk','up+right',207,369],['walk','up+left',269,369],['walk','up+right',269,389]];
const SELL_BERETTA=[['press','start',80],['press','b',40],['press','down',20],['press','down',20],['press','down',20],['press','b',40],
  ['press','down',20],['press','b',40],['press','down',20],['press','b',60],['glove',140,106],['wait',8],['press','b',120],
  ['wait',120],['press','b',120]];
const BUY_BADGE=[['press','down',20],['press','down',20],['press','b',80],['press','down',20],['press','down',20],['press','b',250],
  ['press','b',120],['press','b',120],['wait',30],['press','y',20],['wait',150],['press','down',20],['press','down',20],['press','b',40],
  ['press','down',20],['press','down',20],['press','b',140],['wait',60],['press','b',60],['wait',60]];
export function badgeBuySource(offer){
  const southwest=at(offer,['walk','up+left',170,509]),street=at(offer,['walk','up+left',639,389]),office=at(offer,['walk','up',393,315]);
  if(southwest<0||street<0||office<0)throw Error('BADGE_OFFER_LIVE_PLAN without the expected positions');
  return [...offer.slice(0,southwest+2),...ALLEY_BERETTA,...offer.slice(street,office+2),...SELL_BERETTA,...BUY_BADGE];
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const name=process.argv[2];
  if(name!=='badge'&&name!=='badge-buy')throw Error('usage: node tools/live-plan-close.mjs badge|badge-buy');
  const {exe,reason}=findMesen();if(!exe)throw Error(reason);
  const {liveGameOver,originalPads,PLAN_END,ORIGINAL_START}=await import('./live-game-over-run.mjs');
  const run=liveGameOver({until:PLAN_END});
  if(run.error)throw run.error;
  const source=name==='badge'?BADGE_OFFER_SOURCE:badgeBuySource((await import('./live-plans.mjs')).BADGE_OFFER_LIVE_PLAN);
  const plan=await closeLivePlan(exe,originalPads(run),source,
    {livePlanFrom:ORIGINAL_START,liveSram:readFileSync('tools/mesen/saves/apartment.srm')});
  console.log(JSON.stringify(plan));
}
