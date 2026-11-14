// Larger compositions opt into one cumulative output counter. Existing
// standalone helper limits retain their public meaning.
export function renderOutputBytes(budget, bytes) {
  if (budget.outputBytes === undefined) return;
  budget.outputBytes += bytes;
  if (budget.outputBytes > budget.maxOutputBytes)
    throw { renderBoundary: true, reason: 'render_output_budget_required' };
}
