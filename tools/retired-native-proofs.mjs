// Script natives whose source proofs were retired (user decision 2026-11-25,
// docs/STATE-MODEL-REBUILD.md, Progress): a golden trace reaches each of them
// (tools/golden/native-reach.json, checked by tools/retired-native-proofs.test.mjs), so
// the traces are their reference. Their spec entries, proof/task plan modules and render
// tools are gone; the completeness checks of the native catalog require a spec for every
// other target.
export const RETIRED_NATIVE_PROOFS = Object.freeze(
  new Set([
    0x808371, 0x80866f, 0x809ce4, 0x809d15, 0x809d6a, 0x80a1e6, 0x80caa2, 0x80ccb9, 0x80cf93,
    0x80d067, 0x80d134, 0x80d14a, 0x80d9ad, 0x80de7e, 0x80e262,
  ]),
);
// The native targets that keep their source proofs.
export const provedNativeTargets = (targets) =>
  targets.filter((target) => !RETIRED_NATIVE_PROOFS.has(target));
