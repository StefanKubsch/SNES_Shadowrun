// Reviewed original LDA immediates that supply Huffman text IDs. Source
// groups identify the native equations that consume or forward each ID.
// Numeric matches at other instructions are candidates, not text references.
export const NATIVE_TEXT_GROUPS = [
  ['native-fight-list-remove', [0x8085f8]],
  ['native-object-hit', [0x8087a4, 0x8087ea]],
  [
    'native-actions',
    [
      0x809992, 0x8099f4, 0x809a0a, 0x809a25, 0x809a40, 0x809a5b, 0x809a76, 0x809a91, 0x809aaf,
      0x809ace, 0x809ae9, 0x809b04, 0x809b1f,
    ],
  ],
  ['native-list-prerequisites', [0x80a5f0, 0x80a60e, 0x80a64a, 0x80a67f, 0x80a69c]],
  [
    'native-main-menu',
    [0x80ce56, 0x80ef91, 0x80f035, 0x80f054, 0x80f066, 0x80f0f3, 0x80f100, 0x80f1b5, 0x80f1c2],
  ],
  ['native-player-control', [0x80e09b, 0x80e0fb, 0x80ed6f, 0x80edf1, 0x80ee29]],
  ['native-spell-choice', [0x80e20d]],
  ['main-loop-upkeep', [0x80e2c8, 0x80e2cd]],
  ['native-member-spell-menu', [0x80e58b, 0x80e6d8, 0x80e9bc]],
  [
    'native-status-screen',
    [
      0x80e8f1, 0x80e93a, 0x80e94c, 0x80e969, 0x80e981, 0x80e999, 0x80ea28, 0x80ea4e, 0x80eba7,
      0x80ebd9, 0x80ebfd, 0x80ec26, 0x80ec52, 0x80ec67, 0x80ec7c,
    ],
  ],
].map(([module, instructions]) => ({ source: `src/task/${module}.mjs`, instructions }));
