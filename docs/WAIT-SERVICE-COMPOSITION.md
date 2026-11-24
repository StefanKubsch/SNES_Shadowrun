# Wait services without CPU state

Live waits consume the condition of a counter or upload request and the carry
needed by the frame jobs. Their status bits describe that condition; they do not
inherit a CPU register. The recorded interrupt path still combines those bits
with the caller's original status and restores its full context after the NMI.

The shared wait boundary covers byte and word frame counters, window tile and
map requests, text uploads, object job lists and portrait DMA completion.
Live callers may supply only game services (`h.a`), with no `h.ctx`.
Compatibility callers continue to use their existing register adapter.

The focused wait-service tests run these graphs with CPU context access rejected.
The existing caller comparisons retain their device ordering, condition flags,
stack and completed-context assertions. All five golden traces remain binding.
