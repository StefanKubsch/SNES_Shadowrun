export const nativeCB3CSpec={name:'native-cb3c',id:0xC7,entry:0x80CB3C,
 windows:[{start:0x80CB3C,hex:'A600BF20B08DAABF02007E29FF00850060'}],
 anchors:[{kind:'pointer',start:0x82D946,hex:'3CCB'},{kind:'argument-metadata',start:0x82DB13,hex:'0107'},{kind:'return-metadata',start:0x82DA37,hex:'0200'}],
 contract:'Whole C7/CB3C fullDP00/LongX8DB020 WORD pointer, no null guard: actual7E0002+X WORD including high, mask00FF then fullDP00 store. Null pointer reads physicalDP02 WORD; no inferred guard. Fullindices/24bitcarry/aliases/freshhigh/typedRTS retained. Own0701/0002 metadata including highs, one pop/resultPHA/F508/F509; no record/caller/scene/frame initialization.'};
export const native9DECSpec={name:'native-9dec',id:0x26,entry:0x809DEC,
 windows:[{start:0x809DEC,hex:'A600BF20B08DF016AAE22018BF02007E6502C9079002A9069F02007EC22060'}],
 anchors:[{kind:'pointer',start:0x82D804,hex:'EC9D'},{kind:'argument-metadata',start:0x82DA72,hex:'0202'},{kind:'return-metadata',start:0x82D996,hex:'0000'}],
 contract:'Whole26/9DEC fullDP00/LongX8DB020 WORD pointer; null skips DP02/record and remainsWORD. Nonzero SEP20, CLC, freshrecord+2 BYTE and DP02 BYTE ADC; BYTEwrap occurs BEFORE unsignedCMP7, then sourceLDA6 only for wrapped>=7, BYTEstore andREP20. A-high from pointer and actualADC V/C followed byCMP/conditionalLDA N/Z preserved; recordhigh/DP02high notread. Own0202/0000 metadata/two actualWORDpops/zeroresultPHA/F508/F509. Binaryrequired, fullcarry/alias/provider/budget/commit, no scene/init/frame inference.'};
export const tierRootSpecs=[nativeCB3CSpec,native9DECSpec];
