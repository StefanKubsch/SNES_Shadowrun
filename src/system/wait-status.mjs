// Live frame jobs consume condition bits and carry as values. Recorded NMI
// comparisons also retain every unaffected bit of the original caller's status.
export const waitStatus = (h, events, clear, set = 0) =>
  ((events.frameJobs ? 0 : h.ctx.status) & ~clear) | set;
