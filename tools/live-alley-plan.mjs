// The alley session of tools/live-alley-bus.test.mjs, shared with
// tools/main-upkeep-lift.test.mjs: from the title and the apartment save the closed
// route of BADGE_BUY_LIVE_PLAN into the alley with the same random draws as the
// original (explore.lua "counter" and "clock"), the Beretta picked up and equipped
// in the status screen, and shots with the crosshair.
import {BADGE_BUY_LIVE_PLAN} from './live-plans.mjs';

const EQUIP=[['wait',20],['press','start',80],['press','b',40],['press','down',20],['press','down',20],['press','down',20],
  ['press','b',40],['press','down',20],['press','b',40],['press','down',20],['press','down',20],['press','b',40],['press','b',40],
  ['press','b',60],['wait',30]];
const HEALTH=0x33DE,WATCH=[HEALTH,0x1CE8,0x01CA,0x01D8,0x01D4,0x01D6,0x01DA];
const sync=(health,seed)=>[['poke',HEALTH,health,1],['poke',0x1CE8,0,1],['clock',0],['counter',seed]];
const glove=(x,y)=>[['poke',0x1D4,x<<8],['poke',0x1D6,y<<8],['poke',0x1D0,0],['poke',0x1D2,0]];
const SHOTS=[['wait',10],['hold','b',1],...glove(120,100),['wait',5],['hold','a',1],['wait',1],['hold','a',1],['wait',11],
  ...glove(140,90),['wait',6],...glove(60,150),['wait',6],...glove(200,40),['wait',6],['hold','a',4],['wait',20],
  ...glove(100,100),['wait',6],['hold','a',4],['hold','b',4],['wait',60]];
const READS=[0x809906,0x809907,0x809A66,0x809A67,0x8C6000,0x8C7FFF,0x8D2000,0x8D5FFF];
export const PLAN=[['wait',2989],['press','start',150],['press','down',150],['press','start',300],['press','start',1400],
  ...BADGE_BUY_LIVE_PLAN.slice(3,39),...sync(0x13,0x12345678),['watch',...WATCH],['readwatch',...READS],
  ...BADGE_BUY_LIVE_PLAN.slice(39,49),...EQUIP,...sync(0x0C,0x2468ACE1),...SHOTS];
