import {taskFixture} from './task-native-fixtures.mjs';
export const visitWord=(f,a,v)=>{f.data.seed(a,[v&255]);f.data.seed((a+1)&0xFFFFFF,[v>>>8]);};
export function taskVisitFixture(entry=0x80C1CA,kind='blocked'){
 const f=taskFixture(entry,{d:0,s:0x6FF,savedOuterS:0x6FF,outerWord:0x91D0,status:0x44,writeWindows:[[0x7E0000,0x7FFFFF]]});
 f.context=Object.freeze({...f.context,x:2});f.maxOutputBytes=512;
 for(const [a,v]of [[0x800250,2],[0x80024C,2],[0x800BA4,0x1000],[0x800314,4],[0x8002B4,0],[0x800254,0x200],
  [0x200,0x1200],[0x201,0x8012],[0x203,4],[0x207,0x3F0],[0x209,12],[0x801204,0xA514],[0x82E62F,0],
  [0x80024E,8],[0x800374,0xFFFF],[0x8003D2,0x8040],[0x800BA6,0],[0x800C64,0],[0x800C04,1]])visitWord(f,a,v);
 if(kind==='negative-tail')visitWord(f,0x80024C,0xFFFF);
 if(kind==='ready'||kind==='resume')visitWord(f,0x800BA4,0);
 if(kind==='resume')visitWord(f,0x8002B4,0xF494);
 if(kind==='post-kept')visitWord(f,0x800BA4,2);
 if(kind==='post-remove'){visitWord(f,0x800BA4,0);visitWord(f,0x800254,0x3D6);}
 if(entry===0x80C396)visitWord(f,0x800254,0x3D6);
 return f;
}
