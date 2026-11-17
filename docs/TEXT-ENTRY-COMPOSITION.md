# Register text entry composition

The live register entries own the same renderer as their direct game callers.
Their original caller frames and cooperative return contracts stay intact.

## Decimal entry

The 80:FD80 entry and its continuation compose decimal conversion and real glyph
drawing directly. They never inspect a supplied legacy routine table. The random
original comparison explicitly retains the former number caller with its recorded
renderer; it does not substitute the new live entry for that reference.

[Caller tests](../tools/text-entry-caller.test.mjs) compare the live entry against
the independently retained number and glyph callers with real glyph uploads,
decimal digit boundaries, zero and FFFF, multiple styles, upload counter wrap,
budgets one and seven, and synchronous draining. Upload waits are serviced fixture
boundaries; they do not establish additional hardware or whole-scene evidence.

## Huffman entry

The 80:FE69 entry and continuation now compose the live renderer directly as
well. Its caller comparisons cover identities in both text banks, effective
translated text, a hidden text and bold markers, with the same styles, request
wrap and budgets. The retained former Huffman caller supplies the recorded
renderer for the independent random original comparison. The last routine-table
renderer adapter has no game consumer and moves to `proof/caller/`.
