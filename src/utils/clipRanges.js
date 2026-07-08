// Shared clip-range math for the feed-clip pickers (PostSetModal quick post
// and SetEditor multi-angle post). A clip is { start, end } in seconds on the
// source video's timeline, bounded to CLIP_MIN_SEC..CLIP_MAX_SEC.

export const CLIP_MIN_SEC = 10; // 10 sec – clip minimum
export const CLIP_MAX_SEC = 60; // 1 min – clip maximum

function getValidDuration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function normalizeClipRange(range, durationSec) {
  const dur = getValidDuration(durationSec);
  if (!dur) {
    return { start: 0, end: CLIP_MIN_SEC };
  }

  const maxStart = Math.max(0, dur - CLIP_MIN_SEC);
  const rawStart = Number(range?.start);
  const rawEnd = Number(range?.end);
  const fallbackEnd = Math.min(dur, Math.max(CLIP_MIN_SEC, dur));

  let start = Number.isFinite(rawStart) ? rawStart : 0;
  let end = Number.isFinite(rawEnd) ? rawEnd : fallbackEnd;

  start = Math.max(0, Math.min(maxStart, start));
  end = Math.max(start + CLIP_MIN_SEC, end);
  end = Math.min(dur, start + CLIP_MAX_SEC, end);

  if (end - start < CLIP_MIN_SEC) {
    start = Math.max(0, Math.min(maxStart, end - CLIP_MIN_SEC));
    end = Math.min(dur, start + CLIP_MIN_SEC);
  }

  return {
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  };
}

// Grow or shrink a clip list to `n` entries. New clips land ~30s after the
// previous one; everything is normalized against the video duration.
export function resizeClipRanges(prev, n, durationSec) {
  const next = prev.slice(0, n);
  const dur = getValidDuration(durationSec);
  if (!dur) {
    while (next.length < n) {
      const last = next[next.length - 1];
      const start = Number.isFinite(last?.end) ? last.end + 30 : 0;
      next.push({
        start: Number(start.toFixed(2)),
        end: Number((start + CLIP_MIN_SEC).toFixed(2)),
      });
    }
    return next;
  }

  for (let i = 0; i < next.length; i++) {
    next[i] = normalizeClipRange(next[i], dur);
  }

  if (next.length === 0) {
    next.push(normalizeClipRange({ start: 0, end: CLIP_MIN_SEC }, dur));
  }

  while (next.length < n) {
    const last = next[next.length - 1];
    const maxStart = Math.max(0, dur - CLIP_MIN_SEC);
    const start = last ? Math.min(last.end + 30, maxStart) : 0;
    next.push(normalizeClipRange({ start, end: start + CLIP_MIN_SEC }, dur));
  }
  return next;
}
