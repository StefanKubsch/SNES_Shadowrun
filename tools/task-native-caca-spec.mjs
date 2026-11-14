export const nativeCACASpec={
  "name": "native-caca",
  "id": 122,
  "entry": 8440522,
  "windows": [
    {
      "start": 8440522,
      "hex": "A400BEA813F00EE220BF01007E25029F01007EC22060"
    }
  ],
  "anchors": [
    {
      "kind": "pointer",
      "start": 8575148,
      "hex": "CACA"
    },
    {
      "kind": "argument-metadata",
      "start": 8575686,
      "hex": "0201"
    },
    {
      "kind": "return-metadata",
      "start": 8575466,
      "hex": "0000"
    }
  ],
  "contract": "Whole Native7A/CACA: fresh full DP00/Y and actualDBR13A8+Y pointer WORD/X. Null pointer returns before record/DP02. Nonzero SEP20 reads long7E0001+X BYTE, ANDs fresh DP02 BYTE, writes only the actual record lowbyte, REP20 and protected RTS. Incoming A highbyte and C/V/Y/DBR retained; BYTE N/Z from AND. No DP02 high or destination high read. Own Native58 pointer/arg/return WORD anchors with highs, two actual WORDpops/no resultPHA, actual F508/F509 and fresh Taskframe/PC/ID/pointer/opcode. Full WORD indices/24bit carry and every alias/source/window/budget failure atomic; original record/caller/init/Task/scene/frames separate."
};
