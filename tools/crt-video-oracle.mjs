// Independent quadrature of Gaussian monitor noise-coordinate g and the
// causal RC response to a unit held interval. No production erf/CDF helpers.
// Split at the interval's two edges; resolve the faster of sigma and tau.
export function heldCircuitVoltage(from, to, x, sigma, tau) {
  const lower = -10 * sigma;
  const upper = Math.min(10 * sigma, x - from);
  if (upper <= lower) return 0;
  const pulse = (g) => {
    const afterEnd = x - g - to;
    const response =
      afterEnd >= 0
        ? Math.exp(-afterEnd / tau) * -Math.expm1(-(to - from) / tau)
        : -Math.expm1(-(x - g - from) / tau);
    return (response * Math.exp(-0.5 * (g / sigma) ** 2)) / (sigma * Math.sqrt(2 * Math.PI));
  };
  const middle = Math.max(lower, Math.min(upper, x - to));
  return integrate(lower, middle) + integrate(middle, upper);

  function integrate(a, b) {
    if (a === b) return 0;
    const count = Math.max(512, 2 * Math.ceil(((b - a) * 16) / Math.min(sigma, tau)));
    const step = (b - a) / count;
    let sum = pulse(a) + pulse(b);
    for (let i = 1; i < count; i++) sum += (i % 2 ? 4 : 2) * pulse(a + i * step);
    return (sum * step) / 3;
  }
}
