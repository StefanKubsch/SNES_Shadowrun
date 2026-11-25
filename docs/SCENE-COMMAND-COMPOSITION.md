# Scene command data ownership

The scene command runtime resolves `scene_list_commands` into named operations
at the data boundary in [scene-commands.mjs](../src/data/scene-commands.mjs).
The original 81:EC2F entries remain editable data. Every established target has
its operation assigned explicitly; aliases retain their behavior and unsupported
targets retain their original address in `main_scene_command_frontier`.

[The runtime](../src/system/scene-list.mjs) reads arguments from live memory in
their original order and executes the established callback, palette, packed
VRAM, single-register and empty commands. It no longer constructs an array of
allowed instruction addresses for each command. Resolution is cached once per
loaded image, as before; command lists and their arguments are never cached.

[The former caller](../proof/caller/scene-list.mjs) retains the original
address-based selection independently. [Composition tests](../tools/scene-command-composition.test.mjs)
compare complete WRAM, source reads, ordered video/port writes and frontier
details for every supported target, edited aliases, mixed commands, a palette
crossing a bank boundary, a zero palette count, packed graphics with a bank word,
and unknown or absent table entries. The existing `runSceneList 81:EC16` random
comparison in [scene-shared-lift-functions.test.mjs](../tools/scene-shared-lift-functions.test.mjs)
retains the register-level original comparison.

The callback bank remains a full word at this wide-register entry. A zero
palette count still transfers 65,536 bytes. DMA stores remain requests to the
existing video interface. No additional hardware, frame timing or route evidence
is claimed by these fixture comparisons.
