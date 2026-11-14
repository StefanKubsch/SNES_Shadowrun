// Relative monitor controls, not measured Sony knob positions. See docs/CRT-FILTER.md.
// Brightness is a normalized voltage bias; contrast is relative emitted-light gain.
export const DEFAULT_CONTROLS = Object.freeze({ brightness: 0, contrast: 1 });
const CONTROL_LIMITS = Object.freeze({
  brightness: Object.freeze([-0.1, 0.1]),
  contrast: Object.freeze([0, 2]),
});

// Each field is independent: invalid or missing values use its default;
// finite numbers are clamped without coercing strings or other value types.
// Return a fresh settings object so callers cannot mutate defaults or input.
export function normalizeControls(value) {
  return {
    brightness: clampControl(
      value?.brightness,
      DEFAULT_CONTROLS.brightness,
      CONTROL_LIMITS.brightness,
    ),
    contrast: clampControl(value?.contrast, DEFAULT_CONTROLS.contrast, CONTROL_LIMITS.contrast),
  };
}

function clampControl(value, fallback, limits) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(limits[1], Math.max(limits[0], value));
}

// Browser storage can be missing, malformed or from an older settings shape.
export function parseControls(text) {
  try {
    return normalizeControls(JSON.parse(text));
  } catch {
    return { ...DEFAULT_CONTROLS };
  }
}
