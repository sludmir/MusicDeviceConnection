/**
 * Resolve a reference image for Meshy:
 * 1) catalog/factory/refs/{id}.{jpg,jpeg,png,webp}
 * 2) item.referenceImageUrl / researched.referenceImageUrl
 * 3) Auto-search (DuckDuckGo + Wikimedia), pick best Meshy-friendly shot, cache to refs/
 */

const fs = require('fs');
const path = require('path');
const {
  searchProductImageCandidates,
  pickBestImageCandidate,
} = require('./factoryImageSearch');

const EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MIN_SCORE = 15;

function mimeForExt(ext) {
  const e = ext.toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function extFromContentType(ct) {
  const mime = (ct || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  return '.jpg';
}

function findLocalRef(refsDir, productId) {
  if (!refsDir || !productId) return null;
  for (const ext of EXT) {
    const p = path.join(refsDir, `${productId}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function fileToDataUri(filePath) {
  const ext = path.extname(filePath);
  const buf = fs.readFileSync(filePath);
  return `data:${mimeForExt(ext)};base64,${buf.toString('base64')}`;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; LiveSetProductFactory/1.0; +https://liveset.io)',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Failed to fetch reference image ${res.status}: ${url}`);
  const ct = res.headers.get('content-type') || 'image/jpeg';
  if (!ct.startsWith('image/')) {
    throw new Error(`URL did not return an image (${ct}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`Image too small (${buf.length} bytes)`);
  if (buf.length > 12 * 1024 * 1024) throw new Error(`Image too large (${buf.length} bytes)`);
  return { buffer: buf, contentType: ct.split(';')[0].trim() };
}

async function urlToDataUri(url) {
  const { buffer, contentType } = await downloadImage(url);
  return `data:${contentType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

function cacheRef(refsDir, productId, buffer, contentType, meta = {}) {
  if (!refsDir || !productId) return null;
  fs.mkdirSync(refsDir, { recursive: true });
  const ext = extFromContentType(contentType);
  const dest = path.join(refsDir, `${productId}${ext}`);
  for (const e of EXT) {
    const p = path.join(refsDir, `${productId}${e}`);
    if (p !== dest && fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.writeFileSync(dest, buffer);
  const metaPath = path.join(refsDir, `${productId}.meta.json`);
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify({
      sourceUrl: meta.sourceUrl || null,
      savedAt: new Date().toISOString(),
      contentType: contentType || 'image/jpeg',
      score: meta.score ?? null,
      scoreReasons: meta.scoreReasons || null,
      hasMeshyTrap: meta.hasMeshyTrap ?? null,
      query: meta.query || null,
    }, null, 2)}\n`
  );
  return dest;
}

function readRefMeta(refsDir, productId) {
  const metaPath = path.join(refsDir, `${productId}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

function publicUrlFrom(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   imageUrl?: string,
 *   referenceImageUrl?: string,
 *   source?: string,
 *   score?: number,
 *   scoreReasons?: string[],
 *   cachedPath?: string,
 *   error?: string
 * }>}
 */
async function resolveReferenceImage(item, {
  refsDir,
  researched = {},
  dimsMm = null,
  autoSearch = true,
  persistCache = true,
} = {}) {
  const productId = item.id;
  const local = findLocalRef(refsDir, productId);
  if (local) {
    const meta = readRefMeta(refsDir, productId);
    const publicImageUrl = publicUrlFrom(
      meta?.sourceUrl,
      researched.referenceImageUrl,
      item.referenceImageUrl
    );
    return {
      ok: true,
      imageUrl: fileToDataUri(local),
      // Never file:// for email — https if known, else null (CID embed uses cachedPath)
      referenceImageUrl: publicImageUrl,
      publicImageUrl,
      source: 'local_ref',
      cachedPath: local,
      previewPath: local,
    };
  }

  const remote = researched.referenceImageUrl || item.referenceImageUrl || null;
  if (remote && /^https?:\/\//i.test(remote)) {
    try {
      const { buffer, contentType } = await downloadImage(remote);
      const cachedPath = persistCache
        ? cacheRef(refsDir, productId, buffer, contentType, { sourceUrl: remote })
        : null;
      return {
        ok: true,
        imageUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
        referenceImageUrl: remote,
        publicImageUrl: remote,
        source: 'remote_url',
        cachedPath,
        previewPath: cachedPath,
      };
    } catch (err) {
      if (!autoSearch) return { ok: false, error: err.message };
    }
  }

  if (!autoSearch) {
    return {
      ok: false,
      error: `No reference image for ${productId}. Enable auto-search or add a ref.`,
    };
  }

  let ranked = [];
  try {
    ranked = await searchProductImageCandidates(item, dimsMm);
  } catch (err) {
    return { ok: false, error: `Image search failed: ${err.message}` };
  }

  if (!ranked.length) {
    return { ok: false, error: `No image candidates found for ${item.name}` };
  }

  // Prefer a non-trap packshot when it is close to the top score; then try
  // remaining ranked downloads so a dead URL does not kill the batch.
  const preferred = pickBestImageCandidate(ranked, { minScore: MIN_SCORE });
  const tryOrder = [];
  if (preferred) tryOrder.push(preferred);
  for (const c of ranked.slice(0, 10)) {
    if (c.score < MIN_SCORE) continue;
    if (preferred && c.url === preferred.url) continue;
    tryOrder.push(c);
  }

  const errors = [];
  for (const candidate of tryOrder.slice(0, 8)) {
    try {
      const { buffer, contentType } = await downloadImage(candidate.url);
      const cachedPath = persistCache
        ? cacheRef(refsDir, productId, buffer, contentType, {
          sourceUrl: candidate.url,
          score: candidate.score,
          scoreReasons: candidate.scoreReasons,
          hasMeshyTrap: candidate.hasMeshyTrap,
          query: candidate.query,
        })
        : null;
      return {
        ok: true,
        imageUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
        referenceImageUrl: candidate.url,
        publicImageUrl: candidate.url,
        source: `auto_search:${candidate.source}`,
        score: candidate.score,
        scoreReasons: candidate.scoreReasons,
        hasMeshyTrap: candidate.hasMeshyTrap,
        cachedPath,
        previewPath: cachedPath,
        query: candidate.query,
      };
    } catch (err) {
      errors.push(`${candidate.url}: ${err.message}`);
    }
  }

  return {
    ok: false,
    error:
      `Could not download a usable image for ${item.name}. ` +
      `Top score was ${ranked[0]?.score}. Errors: ${errors.slice(0, 3).join(' | ')}`,
  };
}

module.exports = {
  findLocalRef,
  fileToDataUri,
  urlToDataUri,
  downloadImage,
  cacheRef,
  readRefMeta,
  resolveReferenceImage,
  MIN_SCORE,
};
