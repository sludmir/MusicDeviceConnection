// Extracts a downsampled peak envelope from a media file's audio track,
// suitable for waveform display. Uses Web Audio API decodeAudioData which
// requires the entire file in memory — so we cap by file size.

const DEFAULT_MAX_FILE_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
const DEFAULT_MAX_SECONDS = 300; // 5 minutes of preview is plenty for manual sync
const DEFAULT_PEAKS_PER_SECOND = 40;

export const WAVEFORM_DEFAULTS = {
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  maxSeconds: DEFAULT_MAX_SECONDS,
  peaksPerSecond: DEFAULT_PEAKS_PER_SECOND,
};

/**
 * @param {File|Blob} file
 * @param {{ maxSeconds?: number, peaksPerSecond?: number, maxFileBytes?: number }} [opts]
 * @returns {Promise<{ peaks: Float32Array, peaksPerSecond: number, durationSeconds: number, previewDurationSeconds: number, truncated: boolean }>}
 */
export async function extractPeaks(file, opts = {}) {
  const {
    maxSeconds = DEFAULT_MAX_SECONDS,
    peaksPerSecond = DEFAULT_PEAKS_PER_SECOND,
    maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  } = opts;

  if (!file) throw new Error('No file provided');
  if (file.size > maxFileBytes) {
    const err = new Error(
      `File too large for in-browser analysis (${(file.size / 1e9).toFixed(1)} GB). Sync preview unavailable.`
    );
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio API not supported in this browser');

  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AC();
  let audioBuffer;
  try {
    audioBuffer = await new Promise((resolve, reject) => {
      // decodeAudioData supports both callback and promise forms across browsers.
      try {
        const result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
        if (result && typeof result.then === 'function') result.then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  } finally {
    try { ctx.close(); } catch (_) {}
  }

  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const limitSamples = Math.min(totalSamples, Math.floor(sampleRate * maxSeconds));
  const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSecond));
  const peakCount = Math.floor(limitSamples / samplesPerPeak);
  const peaks = new Float32Array(peakCount);

  const channelCount = audioBuffer.numberOfChannels;
  const channels = [];
  for (let c = 0; c < channelCount; c++) channels.push(audioBuffer.getChannelData(c));

  for (let i = 0; i < peakCount; i++) {
    const start = i * samplesPerPeak;
    const end = start + samplesPerPeak;
    let max = 0;
    for (let j = start; j < end; j++) {
      let v = 0;
      for (let c = 0; c < channelCount; c++) v += channels[c][j];
      v = Math.abs(v / channelCount);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }

  return {
    peaks,
    peaksPerSecond,
    durationSeconds: totalSamples / sampleRate,
    previewDurationSeconds: limitSamples / sampleRate,
    truncated: limitSamples < totalSamples,
  };
}
