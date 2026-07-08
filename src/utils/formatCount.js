// Compact number formatting for view/like counters (1234 -> "1.2K").
export function formatCompactNumber(n) {
  const num = Number(n) || 0;
  if (num < 1000) return String(num);
  if (num < 1000000) {
    const v = num / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0)}K`;
  }
  const v = num / 1000000;
  return `${v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0)}M`;
}
