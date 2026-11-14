export const nativeCCA4Spec={name:'native-cca4',id:0xDB,entry:0x80CCA4,
 windows:[{start:0x80CCA4,hex:'A600A90000382ACAD0FCCFE42D7E90048FE42D7E60'}],
 anchors:[{kind:'pointer',start:0x82D96E,hex:'A4CC'},
  {kind:'argument-metadata',start:0x82DB27,hex:'019C'},
  {kind:'return-metadata',start:0x82DA4B,hex:'0001'}],
 contract:'Whole original NativeDB/CCA4..CCB8, full WORD DP00/X, LDA0/SEC and do ROL16/DEX/BNE with original 17-bit accumulator/carry rotation. Initial X0 runs 65536 iterations; every iteration consumes explicit work budget, no clamp or inferred guard. Fresh CMP long7E2DE4 WORD; BCC skips store, greater-or-equal including equality stores actual accumulator WORD. CMP N/Z/C and entry V preserved; actual protected root RTS. Original argument9C01 is one WORDpop, return0100 has no result PHA; both metadata highs lie in the next table and remain mandatory reads. No original input initialization, caller occurrence, Task/scene/frame integration inferred.'};
