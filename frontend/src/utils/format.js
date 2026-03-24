/**
 * fmt — full precision display (up to 2 decimal places, trailing zeros stripped)
 * e.g.  1234.5  → ₹1,234.5
 *        1234.56 → ₹1,234.56
 *        1234.00 → ₹1,234
 */
export const fmt = (n) =>
  '₹' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

/**
 * fmtCompact — shortened form for chart axes / summary tiles
 * e.g.  1500    → ₹1.5k
 *        1000000 → ₹10L
 *        500     → ₹500
 */
export const fmtCompact = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 100_000)  return '₹' + (v / 100_000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (Math.abs(v) >= 1_000)    return '₹' + (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₹' + v.toFixed(2).replace(/\.00$/, '');
};

