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

/**
 * Builds a peak envelope for the FIRST `maxSeconds` of a media file by streaming
 * it through a hidden media element + Web Audio graph. Unlike extractPeaks, this
 * never loads the whole file into memory, so it works on arbitrarily large
 * videos. Resolution-for-speed: playback is sped up so a 30s preview is captured
 * in roughly maxSeconds / playbackRate real seconds.
 *
 * @param {File|Blob} file
 * @param {{ maxSeconds?: number, peaksPerSecond?: number, playbackRate?: number }} [opts]
 * @returns {Promise<{ peaks: Float32Array, peaksPerSecond: number, durationSeconds: number, previewDurationSeconds: number, truncated: boolean }>}
 */
export async function extractPeaksStreaming(file, opts = {}) {
  const {
    maxSeconds = 30,
    peaksPerSecond = DEFAULT_PEAKS_PER_SECOND,
    playbackRate = 4,
  } = opts;

  if (!file) throw new Error('No file provided');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio API not supported in this browser');

  const isVideo = (file.type || '').startsWith('video');
  const el = document.createElement(isVideo ? 'video' : 'audio');
  // NOTE: do NOT set el.muted = true — a muted element feeds silence into the
  // Web Audio graph in Chrome. We silence output via a zero-gain node instead.
  el.playsInline = true;
  el.preload = 'auto';
  el.style.position = 'fixed';
  el.style.left = '-99999px';
  el.style.width = '1px';
  el.style.height = '1px';

  const url = URL.createObjectURL(file);
  el.src = url;
  document.body.appendChild(el);

  const ctx = new AC();
  const bufferSize = 256;
  const peakCount = Math.max(1, Math.floor(maxSeconds * peaksPerSecond));
  const peaks = new Float32Array(peakCount);
  const secPerBlock = (bufferSize / ctx.sampleRate) * playbackRate;

  let contentTime = 0;
  let source;
  let processor;
  let gain;
  let settled = false;
  let stallTimer;

  const cleanup = () => {
    if (stallTimer) clearTimeout(stallTimer);
    try { el.pause(); } catch (_) {}
    try { processor && (processor.onaudioprocess = null); } catch (_) {}
    try { processor && processor.disconnect(); } catch (_) {}
    try { source && source.disconnect(); } catch (_) {}
    try { gain && gain.disconnect(); } catch (_) {}
    try { ctx.close(); } catch (_) {}
    try { el.removeAttribute('src'); el.load(); } catch (_) {}
    try { el.remove(); } catch (_) {}
    try { URL.revokeObjectURL(url); } catch (_) {}
  };

  return new Promise((resolve, reject) => {
    const fail = (msg, code) => {
      if (settled) return;
      settled = true;
      cleanup();
      const err = new Error(msg);
      if (code) err.code = code;
      reject(err);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      const duration = Number.isFinite(el.duration) ? el.duration : maxSeconds;
      cleanup();
      resolve({
        peaks,
        peaksPerSecond,
        durationSeconds: duration,
        previewDurationSeconds: Math.min(maxSeconds, duration),
        truncated: duration > maxSeconds + 0.5,
      });
    };

    el.addEventListener('error', () =>
      fail('Could not read this media file for preview.', 'MEDIA_ERROR')
    );
    el.addEventListener('ended', finish);

    el.addEventListener('loadedmetadata', async () => {
      try {
        source = ctx.createMediaElementSource(el);
        processor = ctx.createScriptProcessor(bufferSize, 1, 1);
        gain = ctx.createGain();
        gain.gain.value = 0; // silent — we only want the peak data, not playback

        processor.onaudioprocess = (e) => {
          if (settled) return;
          const input = e.inputBuffer.getChannelData(0);
          let max = 0;
          for (let i = 0; i < input.length; i++) {
            const v = input[i] < 0 ? -input[i] : input[i];
            if (v > max) max = v;
          }
          const bucket = Math.floor(contentTime * peaksPerSecond);
          if (bucket >= 0 && bucket < peakCount && max > peaks[bucket]) {
            peaks[bucket] = max;
          }
          contentTime += secPerBlock;
          if (contentTime >= maxSeconds) finish();
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(ctx.destination);

        el.playbackRate = playbackRate;
        await ctx.resume().catch(() => {});
        await el.play();

        const budgetMs = (maxSeconds / playbackRate) * 1000 * 3 + 15000;
        stallTimer = setTimeout(() => {
          if (contentTime >= 2) finish();
          else fail('Timed out reading media for preview.', 'TIMEOUT');
        }, budgetMs);
      } catch (e) {
        fail(e?.message || 'Audio preview failed', e?.code);
      }
    });
  });
}
