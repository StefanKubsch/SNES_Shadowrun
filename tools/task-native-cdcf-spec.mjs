export const nativeCDCFSpec={name:'native-cdcf',id:0x80,entry:0x80CDCF,
 windows:[{start:0x80CDCF,hex:'A9FFFF8D631D60'}],
 anchors:[{kind:'pointer',start:0x82D8B8,hex:'CFCD'},
  {kind:'argument-metadata',start:0x82DACC,hex:'0002'},
  {kind:'return-metadata',start:0x82D9F0,hex:'0000'}],
 contract:'Whole original Native80/CDCF..CDD5: WORD LDA FFFF sets N and clears Z, preserving C/V and other status; WORD STA actual DBR1D63 without destination pre-read. No DP arguments, no index changes, actual protected root RTS. Separate Native58/80 source proof with original CDCF/0200/0000 WORD anchors and mandatory fresh highs: zero WORDpops, no result PHA, actual F508/F509, live A2, stack, DP, DBR, ID, PC, pointer and following opcode. Source/owner/window/budget failures publish no effects. No inferred flag meaning, original caller, initialization, Task, scene or frame lifecycle.'};
