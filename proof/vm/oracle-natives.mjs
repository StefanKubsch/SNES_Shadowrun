// Oracle-checked natives (STRATEGY.md, section 2): implementations whose paths
// are not proven statically over the whole call graph but are compared against the
// real course of the game in Mesen2 (tools/mesen-f390-oracle.mjs).
// Each native names its implemented paths explicitly: before the call, supports() checks
// without writing whether the path is implemented. Other paths
// do not run; the call ends as for an unbound native.
//
// Target -> {supports(memory), run(accessor, outerReturn)}. Currently empty: $8BC5 and $8AB5 have been
// special natives since 2026-10-14, as has $E014 (src/task/native-player-control.mjs, whole graph proven statically); their equations
// were checked against Mesen2 in the oracle phase. The mechanism remains for future partial paths.
export const ORACLE_NATIVES = new Map();
