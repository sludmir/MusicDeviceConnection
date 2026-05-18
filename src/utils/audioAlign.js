// Cross-correlates two peak envelopes to suggest a time offset (in seconds)
// that will align the angle waveform with the master waveform.
//
// Returned offset is what to SET as the angle's offsetSeconds — i.e. the time
// position on the master timeline where the angle's t=0 should sit. Positive
// values mean the angle starts later than master (slide it right); negative
// values mean it starts earlier (slide it left).

/**
 * @param {Float32Array} masterPeaks
 * @param {Float32Array} anglePeaks
 * @param {number} peaksPerSecond
 * @param {number} [maxOffsetSec=15]
 * @returns {{ offsetSeconds: number, confidence: number } | null}
 */
export function suggestOffsetSeconds(masterPeaks, anglePeaks, peaksPerSecond, maxOffsetSec = 15) {
  if (!masterPeaks || !anglePeaks || !masterPeaks.length || !anglePeaks.length) return null;
  if (!Number.isFinite(peaksPerSecond) || peaksPerSecond <= 0) return null;

  // Use up to the first 60 seconds of envelope for correlation — enough signal
  // to lock alignment in most cases, fast enough to run on the main thread.
  const window = Math.min(masterPeaks.length, anglePeaks.length, peaksPerSecond * 60);
  if (window < peaksPerSecond * 2) return null; // need at least 2s of data

  const maxShift = Math.min(window - 1, Math.floor(peaksPerSecond * maxOffsetSec));

  const m = masterPeaks.subarray(0, window);
  const a = anglePeaks.subarray(0, window);

  let mSum = 0;
  let aSum = 0;
  for (let i = 0; i < window; i++) { mSum += m[i]; aSum += a[i]; }
  const mMean = mSum / window;
  const aMean = aSum / window;

  let mVar = 0;
  let aVar = 0;
  for (let i = 0; i < window; i++) {
    const dm = m[i] - mMean;
    const da = a[i] - aMean;
    mVar += dm * dm;
    aVar += da * da;
  }
  const norm = Math.sqrt(mVar * aVar) || 1;

  let bestShift = 0;
  let bestScore = -Infinity;
  // shift > 0: angle is delayed (angle[i + shift] aligns with master[i])
  // shift < 0: angle is ahead   (angle[i + shift] for negative shift aligns master[i])
  for (let shift = -maxShift; shift <= maxShift; shift++) {
    let score = 0;
    let count = 0;
    const iStart = Math.max(0, -shift);
    const iEnd = Math.min(window, window - shift);
    for (let i = iStart; i < iEnd; i++) {
      const j = i + shift;
      score += (m[i] - mMean) * (a[j] - aMean);
      count++;
    }
    if (count > peaksPerSecond) {
      // normalize for the overlap length so short overlaps aren't unfairly low
      const overlapFactor = count / window;
      const normalized = (score / norm) * overlapFactor;
      if (normalized > bestScore) {
        bestScore = normalized;
        bestShift = shift;
      }
    }
  }

  // angle[k] ≈ master[k - bestShift]  =>  angle time k/pps corresponds to master time (k - bestShift)/pps
  // For angle k=0 → master t = -bestShift / pps. So offsetSeconds = -bestShift / pps.
  const offsetSeconds = -bestShift / peaksPerSecond;
  return { offsetSeconds, confidence: Math.max(0, Math.min(1, bestScore)) };
}
