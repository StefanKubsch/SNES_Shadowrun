// Explicit synthetic physical sources only; no array capacity or initialized scene.
export function seedTaskSmallFamilyFixture(f,entry){
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]),bank=f.context.bank*65536;
 if(entry===0x80AA4C)word(bank+0x12B0,0);
 if(entry===0x80E1B3)word(0x7E3C1C,0);
 if(entry===0x80913C)f.data.seed(0x7E3CA3,[0x10]);
 if(entry===0x80D105)f.data.seed(0x8D9017,[0xBC,0x9A]);
 if([0x808B16,0x808B9F].includes(entry))word(bank+0x1F60,3);
 if(entry===0x808B16)word(bank+0x1DA,65535);
 if(entry===0x80CCDB){word(0x7E3C0D,65534);word(0x7E3C0F,1);}
 if(entry===0x80CDB2)word(0x7E3C11,65534);
 if(entry===0x80A985)word(bank+0x1048,3);
 return f;
}
