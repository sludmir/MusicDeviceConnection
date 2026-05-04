import Hls from 'hls.js';

/**
 * Attach an HLS or plain video URL to a <video> element.
 *
 * - Safari / iOS play HLS natively, no library needed.
 * - Other browsers use hls.js to feed the playlist into MSE.
 * - Plain MP4/WebM URLs (including legacy Firebase Storage downloadURLs) just
 *   get assigned to videoEl.src — same as before.
 *
 * Returns a cleanup function. Call it on unmount or when src changes.
 */
export function attachHls(videoEl, src) {
  if (!videoEl || !src) return () => {};

  const isHls = /\.m3u8(\?|$)/i.test(src);

  if (!isHls) {
    videoEl.src = src;
    return () => {
      try {
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch (_) {}
    };
  }

  if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = src;
    return () => {
      try {
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch (_) {}
    };
  }

  if (Hls.isSupported()) {
    const hls = new Hls({
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      backBufferLength: 30,
      enableWorker: true,
    });
    hls.loadSource(src);
    hls.attachMedia(videoEl);
    return () => {
      try { hls.destroy(); } catch (_) {}
    };
  }

  // Last-resort fallback (very old browsers): try native and hope for the best.
  videoEl.src = src;
  return () => {
    try {
      videoEl.removeAttribute('src');
      videoEl.load();
    } catch (_) {}
  };
}
