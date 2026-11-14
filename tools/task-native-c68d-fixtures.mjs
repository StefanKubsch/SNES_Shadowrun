export function seedTaskDistanceFixture(f){
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);
 word(f.context.bank*65536+0x0CC2,0x20);
 for(const [offset,value] of [[0x0E38,400],[0x0E48,0],[0x0E90,200],[0x0EA0,0]])word(f.context.bank*65536+offset,value);
}
