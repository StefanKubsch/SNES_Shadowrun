// The depth comparisons behind the jump tables 80:B0E3 (JMP (B0E3,X) at 80:B0AC, rule of
// the first object) and 80:B126 (JMP (B126,X) at 80:B0EF, rule of the second object),
// rules 1 to 4 each. The lifted depth sort (src/game/depth-sort.mjs) maps the rules
// directly; rom-map and extract-tables check these targets against the ROM tables.
export const DEPTH_COMPARE_FIRST = Object.freeze([0x80b0af, 0x80b0ba, 0x80b0c5, 0x80b0d0]),
  DEPTH_COMPARE_SECOND = Object.freeze([0x80b0f2, 0x80b0fd, 0x80b108, 0x80b113]);
