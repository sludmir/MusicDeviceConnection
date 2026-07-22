/**
 * Find Meshy-friendly product reference images (clear width/height, studio/product shots).
 *
 * Sources (in order):
 * 1. DuckDuckGo image search (no API key)
 * 2. Wikimedia Commons (no API key)
 *
 * Scoring prefers packshots / cutouts and demotes Meshy traps (lit LEDs, lifestyle,
 * rainbow demos) that image-to-3D often misreads as bumpy geometry.
 */

/** Within this many points of the top score, prefer a non-trap packshot over a trap winner. */
const TRAP_FALLBACK_SCORE_WINDOW = 15;

const PREFERRED_HOST_FRAGMENTS = [
  'sweetwater.com',
  'thomann.',
  'zzounds.com',
  'guitarcenter.com',
  'musiciansfriend.com',
  'boss.info',
  'pioneerdj.com',
  'roland.com',
  'novationmusic.com',
  'focusrite.com',
  'shure.com',
  'fender.com',
  'marshall.com',
  'amazon.com',
  'amazon.',
  'media-amazon',
  'static.',
  'cdn.',
  'cloudfront.net',
  'akamai',
  'b&h',
  'bhphotovideo',
  'reverb.com',
];

const PENALIZED_HOST_OR_TEXT = [
  'pinterest',
  'pinimg',
  'instagram',
  'tiktok',
  'facebook',
  'fbcdn',
  'youtube',
  'youtu.be',
  'reddit',
  'imgur.com/a/',
  'unboxing',
  'live-set',
  'concert',
  'gig-',
  'meme',
  'screenshot',
  'forum',
  'pedalboard',
  'in-use',
  'in use',
  'lifestyle',
  'on stage',
  'on-stage',
  'bedroom',
  'rig tour',
];

/**
 * Title/URL cues that often produce bad Meshy geometry (glow → fake height).
 * Soft penalty — still usable as fallback when nothing else ranks.
 */
const MESHY_TRAP_TEXT = [
  'rainbow',
  'led on',
  'leds on',
  'pads on',
  'pads lit',
  'lit pads',
  'demo mode',
  'demo pattern',
  'light show',
  'lightshow',
  'screen on',
  'display on',
  'glowing',
  'neon',
  'night shot',
  'rgb mode',
  'illuminated pads',
];

/** Soft boosts for neutral / packshot geometry friendly to image-to-3D. */
const NEUTRAL_GEOMETRY_TEXT = [
  'unlit',
  'pads off',
  'screen off',
  'display off',
  'powered off',
  'cutout',
  'packshot',
  'white background',
  'white-bg',
  'isolated',
  'product only',
  'front view',
  'front-facing',
];

const POSITIVE_TEXT = [
  'product',
  'studio',
  'official',
  'gallery',
  'cutout',
  'white',
  'packshot',
  'hero',
  'main',
  'front',
  'angle',
  '3/4',
  'three-quarter',
];

function buildSearchQueries(item) {
  const brand = (item.brand || '').trim();
  const name = (item.name || '').trim();
  const core = [brand, name].filter(Boolean).join(' ').trim() || name;
  return [
    `${core} packshot white background cutout`,
    `${core} product photo studio white background`,
    `${core} official product shot front`,
    `${core} unlit OR "pads off" OR "screen off" product photo`,
    `${core} packshot`,
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);
}

function textBlob(candidate) {
  const url = String(candidate.url || '').toLowerCase();
  const title = String(candidate.title || '').toLowerCase();
  return `${url} ${title}`;
}

function hasMeshyTrap(candidate) {
  const blob = textBlob(candidate);
  return MESHY_TRAP_TEXT.some((t) => blob.includes(t));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Score a candidate for Meshy image-to-3D success.
 * Prefers clear product geometry (width + height visible) over lifestyle / lit demos.
 *
 * @param {{ url: string, title?: string, width?: number, height?: number, source?: string }} candidate
 * @param {{ width_mm?: number, depth_mm?: number, height_mm?: number }|null} dimsMm
 */
function scoreImageCandidate(candidate, dimsMm = null) {
  let score = 0;
  const reasons = [];
  const url = String(candidate.url || '').toLowerCase();
  const blob = textBlob(candidate);
  const host = hostOf(candidate.url);
  let trapHits = 0;
  let neutralHits = 0;

  for (const frag of PREFERRED_HOST_FRAGMENTS) {
    if (host.includes(frag) || url.includes(frag)) {
      score += 25;
      reasons.push(`preferred_host:${frag}`);
      break;
    }
  }

  for (const bad of PENALIZED_HOST_OR_TEXT) {
    if (blob.includes(bad)) {
      score -= 40;
      reasons.push(`penalized:${bad}`);
    }
  }

  for (const trap of MESHY_TRAP_TEXT) {
    if (blob.includes(trap)) {
      trapHits += 1;
      score -= 28;
      reasons.push(`meshy_trap:${trap}`);
    }
  }

  for (const good of POSITIVE_TEXT) {
    if (blob.includes(good)) {
      score += 8;
      reasons.push(`keyword:${good}`);
    }
  }

  for (const neutral of NEUTRAL_GEOMETRY_TEXT) {
    if (blob.includes(neutral)) {
      neutralHits += 1;
      score += 14;
      reasons.push(`neutral_geometry:${neutral}`);
    }
  }

  const w = Number(candidate.width) || 0;
  const h = Number(candidate.height) || 0;
  if (w >= 800 && h >= 600) {
    score += 20;
    reasons.push('hi_res');
  } else if (w >= 400 && h >= 300) {
    score += 10;
    reasons.push('med_res');
  } else if (w > 0 && h > 0 && (w < 300 || h < 300)) {
    score -= 15;
    reasons.push('low_res');
  }

  if (w > 0 && h > 0) {
    const aspect = w / h;
    // Prefer 3/4 / landscape product shots that show length and height
    if (aspect >= 1.15 && aspect <= 2.4) {
      score += 18;
      reasons.push('landscape_product_angle');
    } else if (aspect >= 0.85 && aspect <= 1.15) {
      // Square is ok for pad controllers / square pedals, weaker for wide decks
      const productWide =
        dimsMm?.width_mm &&
        dimsMm?.height_mm &&
        dimsMm.width_mm / dimsMm.height_mm >= 1.6;
      if (productWide) {
        score -= 12;
        reasons.push('square_vs_wide_product');
      } else {
        score += 4;
        reasons.push('square_ok');
      }
    } else if (aspect < 0.7) {
      score -= 10;
      reasons.push('tall_portrait_weak_for_gear');
    }
  }

  if (candidate.source === 'wikimedia') {
    score += 5;
    reasons.push('wikimedia');
  }

  // File-type preference
  if (/\.(jpe?g)(\?|$)/i.test(url)) {
    score += 3;
  }
  if (/\.gif(\?|$)/i.test(url) || /\.svg(\?|$)/i.test(url)) {
    score -= 30;
    reasons.push('bad_format');
  }

  return {
    score,
    reasons,
    hasMeshyTrap: trapHits > 0,
    hasNeutralGeometry: neutralHits > 0,
  };
}

/**
 * Among ranked candidates, prefer a non-trap shot when it is close to the top score.
 * Falls back to the top packshot when nothing neutral exists (variety at scale).
 *
 * @param {Array<{ url?: string, score?: number, title?: string }>} ranked best-first
 * @param {{ minScore?: number, window?: number }} [opts]
 */
function pickBestImageCandidate(ranked, {
  minScore = 15,
  window = TRAP_FALLBACK_SCORE_WINDOW,
} = {}) {
  const usable = (ranked || []).filter(
    (c) => c?.url && Number(c.score) >= minScore
  );
  if (!usable.length) return null;

  const top = usable[0];
  const topIsTrap = top.hasMeshyTrap === true || hasMeshyTrap(top);
  if (!topIsTrap) return top;

  const floor = Number(top.score) - window;
  const safer = usable.find((c) => {
    if (c === top) return false;
    if (Number(c.score) < floor) return false;
    const trap = c.hasMeshyTrap === true || hasMeshyTrap(c);
    return !trap;
  });
  return safer || top;
}

async function fetchDuckDuckGoImages(query, { limit = 12 } = {}) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (compatible; LiveSetProductFactory/1.0; +https://liveset.io)',
  };
  const home = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
    headers,
  });
  if (!home.ok) throw new Error(`DuckDuckGo home ${home.status}`);
  const html = await home.text();
  const vqdMatch =
    html.match(/vqd=["']([^"']+)["']/) ||
    html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) throw new Error('DuckDuckGo vqd not found');
  const vqd = vqdMatch[1];

  const apiUrl =
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}` +
    `&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`;
  const res = await fetch(apiUrl, {
    headers: { ...headers, Referer: 'https://duckduckgo.com/' },
  });
  if (!res.ok) throw new Error(`DuckDuckGo images ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, limit).map((r) => ({
    url: r.image || r.thumbnail,
    title: r.title || query,
    width: Number(r.width) || 0,
    height: Number(r.height) || 0,
    source: 'duckduckgo',
    thumbnail: r.thumbnail,
  })).filter((c) => c.url && /^https?:\/\//i.test(c.url));
}

async function fetchWikimediaImages(query, { limit = 8 } = {}) {
  const api =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '1200',
    });
  const res = await fetch(api, {
    headers: {
      'User-Agent': 'LiveSetProductFactory/1.0 (liveset.io; catalog bot)',
    },
  });
  if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
  const data = await res.json();
  const pages = data.query?.pages || {};
  return Object.values(pages)
    .map((p) => {
      const info = (p.imageinfo && p.imageinfo[0]) || {};
      if (!info.url || !(info.mime || '').startsWith('image/')) return null;
      return {
        url: info.thumburl || info.url,
        title: p.title || query,
        width: Number(info.thumbwidth || info.width) || 0,
        height: Number(info.thumbheight || info.height) || 0,
        source: 'wikimedia',
      };
    })
    .filter(Boolean);
}

/**
 * Search + rank candidates. Returns sorted best-first.
 */
async function searchProductImageCandidates(item, dimsMm = null) {
  const queries = buildSearchQueries(item);
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    try {
      const ddg = await fetchDuckDuckGoImages(query);
      for (const c of ddg) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        const scored = scoreImageCandidate(c, dimsMm);
        candidates.push({
          ...c,
          score: scored.score,
          scoreReasons: scored.reasons,
          hasMeshyTrap: scored.hasMeshyTrap,
          hasNeutralGeometry: scored.hasNeutralGeometry,
          query,
        });
      }
    } catch (err) {
      // continue other sources
      candidates.push({
        url: null,
        error: `ddg:${err.message}`,
        score: -999,
      });
    }

    try {
      const wiki = await fetchWikimediaImages(query);
      for (const c of wiki) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        const scored = scoreImageCandidate(c, dimsMm);
        candidates.push({
          ...c,
          score: scored.score,
          scoreReasons: scored.reasons,
          hasMeshyTrap: scored.hasMeshyTrap,
          hasNeutralGeometry: scored.hasNeutralGeometry,
          query,
        });
      }
    } catch {
      // optional
    }

    // Enough strong candidates — stop spending round-trips
    const strong = candidates.filter((c) => c.url && c.score >= 30);
    if (strong.length >= 5) break;
  }

  return candidates
    .filter((c) => c.url)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

module.exports = {
  PREFERRED_HOST_FRAGMENTS,
  MESHY_TRAP_TEXT,
  NEUTRAL_GEOMETRY_TEXT,
  TRAP_FALLBACK_SCORE_WINDOW,
  buildSearchQueries,
  scoreImageCandidate,
  hasMeshyTrap,
  pickBestImageCandidate,
  searchProductImageCandidates,
  fetchDuckDuckGoImages,
  fetchWikimediaImages,
};
