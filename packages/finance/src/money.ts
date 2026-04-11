/**
 * Money helpers — all monetary math in this package works in PAISE
 * (1 rupee = 100 paise) as integers to avoid float drift. Only the
 * presentation layer ever divides by 100.
 *
 * The math functions in this package, however, accept and return rupees
 * (integer) as the user-facing unit since the API schemas were designed
 * that way. We round aggressively at every boundary to keep drift bounded
 * to 1 rupee across a 30-year projection.
 */

export function round(value: number): number {
  return Math.round(value);
}

/**
 * Format a rupee amount for display.
 *
 *   formatInr(123456789)   → "₹12.35 Cr"
 *   formatInr(1234567)     → "₹12.35 L"
 *   formatInr(12345)       → "₹12,345"
 */
export function formatInr(rupees: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(rupees)) return "—";
  const compact = opts?.compact ?? true;
  const abs = Math.abs(rupees);
  if (compact && abs >= 10_000_000) {
    return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  }
  if (compact && abs >= 100_000) {
    return `₹${(rupees / 100_000).toFixed(2)} L`;
  }
  if (compact && abs >= 1_000) {
    // Indian comma grouping for <1L values
    return `₹${rupees.toLocaleString("en-IN")}`;
  }
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Format a percentage value (0.075 → "7.50%")
 */
export function formatPct(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
