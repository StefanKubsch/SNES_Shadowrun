# Register text entry composition

The live register entries own the same renderer as their direct game callers.
Their original caller frames and cooperative return contracts stay intact.

## Phase 4 direct rendering

Text, short numbers and 32-bit decimal numbers compose `drawTextBuffer` directly.
Glyph drawing, read-back and line/final uploads create no CPU frames and change
neither the program bank nor the data bank. Decimal conversion also keeps no
saved data bank on the CPU stack. The direct renderer leaves register widths
unchanged. `drawTextBufferSequence` remains the outer RTS adapter for existing
register-level entries; it retains their 16-bit accumulator return contract.

`renderTextBuffer` supplies the former bank/frame contract only for explicitly
injected register-level renderers used by independent comparisons. Normal game
callers select the direct renderer. Sixteen flow contracts check all four direct
operations at every single-step boundary, zero budgets, request wrap, repeated
completion and upload failure/replay rejection. Existing glyph, text, number,
dialog and menu comparisons keep their game-state and device assertions.

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
