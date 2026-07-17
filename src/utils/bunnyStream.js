import { getFunctions, httpsCallable } from 'firebase/functions';
import * as tus from 'tus-js-client';
import { app } from '../firebaseConfig';

/**
 * Reserves a Bunny Stream video record on the server (which holds the API key)
 * and returns everything the client needs to upload + later play the file.
 *
 * The server returns a presigned TUS signature — NOT the Bunny API key — so the
 * browser can upload directly without ever seeing a credential.
 *
 * @param {Object} params
 * @param {string} params.title  — display title for the Bunny library entry
 * @param {'set'|'clip'} params.kind
 * @returns {Promise<{
 *   videoGuid: string,
 *   libraryId: string,
 *   tusEndpoint: string,
 *   tusSignature: string,
 *   tusExpire: number,
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
 * Uploads a video File/Blob to Bunny Stream via the resumable TUS protocol,
 * authenticated with the server-issued presigned signature (no API key in the
 * browser). Resolves when Bunny confirms the upload, rejects on error.
 *
 * @param {File|Blob} file
 * @param {{ tusEndpoint: string, tusSignature: string, tusExpire: number,
 *          libraryId: string|number, videoGuid: string }} bunny
 *          — the object returned by createBunnyVideo()
 * @param {(fraction:number)=>void} [onProgress]  — 0..1
 * @returns {Promise<void>}
 */
export function uploadToBunny(file, bunny, onProgress) {
  const { tusEndpoint, tusSignature, tusExpire, libraryId, videoGuid } = bunny || {};
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: tusSignature,
        AuthorizationExpire: String(tusExpire),
        VideoId: videoGuid,
        LibraryId: String(libraryId),
      },
      metadata: {
        filetype: file.type || 'video/mp4',
        title: (file.name || 'video').slice(0, 200),
      },
      onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal && typeof onProgress === 'function') {
          onProgress(bytesUploaded / bytesTotal);
        }
      },
      onSuccess: () => resolve(),
    });
    // Resume a prior interrupted upload of the same file if one exists.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
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
