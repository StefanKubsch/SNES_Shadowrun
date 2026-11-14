export const nativeCAB4Spec={
  "name": "native-cab4",
  "id": 51,
  "entry": 8440500,
  "windows": [
    {
      "start": 8440500,
      "hex": "A400BEA813F00EE220BF01007E05029F01007EC22060"
    }
  ],
  "anchors": [
    {
      "kind": "pointer",
      "start": 8575006,
      "hex": "B4CA"
    },
    {
      "kind": "argument-metadata",
      "start": 8575615,
      "hex": "0202"
    },
    {
      "kind": "return-metadata",
      "start": 8575395,
      "hex": "0000"
    }
  ],
  "contract": "Whole Native33/CAB4: fresh full DP00/Y and actualDBR13A8+Y pointer WORD/X. Null pointer returns before record and DP02. Nonzero SEP20 loads long7E0001+X BYTE, ORs fresh DP02 BYTE, writes only low record byte, REP20 and actual protected RTS. A highbyte, C/V/Y/DBR retained; BYTE N/Z from OR. No DP02 high or record high preread. Full WORD indexes, 24bit carry, aliases, source/owner/window/budget failures atomic; original caller/init/Task/scene/frames separate."
};
