export const nativeCB4DSpec={name:'native-cb4d',id:0xCD,entry:0x80CB4D,
 windows:[{start:0x80CB4D,hex:'A600BF20B08DAABF03007E850060'}],
 anchors:[{kind:'pointer',start:0x82D952,hex:'4DCB'},{kind:'argument-metadata',start:0x82DB19,hex:'0100'},{kind:'return-metadata',start:0x82DA3D,hex:'0202'}],
 contract:'Whole CD/CB4D fullDP00 as LongX into8DB020 WORD pointer, no null guard. Actual7E0003+X WORD including high, no BYTE mask, then fullDP00 store. Null reads actual physicalDP03/04; full indices/24bit carry/aliases/fresh high/typedRTS. Own0001/0202 metadata, one pop and real resultPHA/F508/F509. No record/caller/init/task/scene/frame inference.'};
