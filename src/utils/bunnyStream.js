import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

/**
 * Reserves a Bunny Stream video record on the server (which holds the API key)
 * and returns everything the client needs to upload + later play the file.
 *
 * @param {Object} params
 * @param {string} params.title  — display title for the Bunny library entry
 * @param {'set'|'clip'} params.kind
 * @returns {Promise<{
 *   videoGuid: string,
 *   libraryId: string,
 *   uploadUrl: string,
 *   uploadHeaders: Record<string,string>,
 *   hlsUrl: string,
 *   thumbnailUrl: string,
 *   previewUrl: string,
 *   iframeUrl: string,
 * }>}
 */
export async function createBunnyVideo({ title, kind }) {
  const fn = httpsCallable(getFunctions(app), 'createBunnyVideo');
  const { data } = await fn({ title, kind });
  return data;
}

/**
 * Uploads a video File/Blob to a Bunny Stream upload URL with progress.
 * Resolves on HTTP 2xx, rejects otherwise.
 *
 * @param {File|Blob} file
 * @param {{ uploadUrl: string, uploadHeaders: Record<string,string> }} target
 * @param {(fraction:number)=>void} [onProgress]  — 0..1
 * @returns {Promise<void>}
 */
export function uploadToBunny(file, { uploadUrl, uploadHeaders }, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    Object.entries(uploadHeaders || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Bunny upload failed (HTTP ${xhr.status}): ${xhr.responseText || ''}`));
    };
    xhr.onerror = () => reject(new Error('Bunny upload network error'));
    xhr.onabort = () => reject(new Error('Bunny upload aborted'));
    xhr.send(file);
  });
}

/**
 * Build a Bunny CDN HLS playlist URL from a stored videoGuid.
 * Used as the `videoURL` we feed into <video> via attachHls().
 */
export function bunnyHlsUrl(cdnHostname, videoGuid) {
  return `https://${cdnHostname}/${videoGuid}/playlist.m3u8`;
}

export function bunnyThumbnailUrl(cdnHostname, videoGuid) {
  return `https://${cdnHostname}/${videoGuid}/thumbnail.jpg`;
}

export function bunnyPreviewUrl(cdnHostname, videoGuid) {
  return `https://${cdnHostname}/${videoGuid}/preview.webp`;
}
