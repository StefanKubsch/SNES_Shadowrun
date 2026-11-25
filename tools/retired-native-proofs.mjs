// Script natives whose source proofs were retired (user decision 2026-11-25,
// docs/STATE-MODEL-REBUILD.md, Progress): a golden trace reaches each of them
// (tools/golden/native-reach.json, checked by tools/retired-native-proofs.test.mjs), so
// the traces are their reference. Their spec entries, proof/task plan modules and render
// tools are gone; the completeness checks of the native catalog require a spec for every
// other target.
export const RETIRED_NATIVE_PROOFS = Object.freeze(
  new Set([
    0x808371, 0x80866f, 0x809ce4, 0x809d15, 0x809d6a, 0x80a1e6, 0x80caa2, 0x80ccb9, 0x80cf93,
    0x80d067, 0x80d134, 0x80d14a, 0x80d9ad, 0x80de7e, 0x80e262, 0x808b9f, 0x808ef5, 0x8094ee,
    0x809d7a, 0x809dae, 0x80a91d, 0x80a92f, 0x80a959, 0x80a963, 0x80a96d, 0x80aa4c, 0x80c6c4,
    0x80c716, 0x80c7c2, 0x80ca05, 0x80ca15, 0x80ca20, 0x80ca49, 0x80cab4, 0x80caca, 0x80cb2b,
    0x80cbb3, 0x80cc07, 0x80cc10, 0x80cccc, 0x80ccdb, 0x80cd97, 0x80d016, 0x80d105, 0x80d13e,
    0x80d16d, 0x80d18a, 0x80d1ca, 0x80d1d2, 0x80d255, 0x80e24e, 0x80c6bf,
  ]),
);
// The native targets that keep their source proofs.
export const provedNativeTargets = (targets) =>
  targets.filter((target) => !RETIRED_NATIVE_PROOFS.has(target));
