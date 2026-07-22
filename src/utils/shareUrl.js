export function buildSetShareUrl(creatorId, setId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://liveset.io';
  return `${origin}/profile/${creatorId}?set=${encodeURIComponent(setId)}`;
}

export function buildClipShareUrl(clipId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://liveset.io';
  return `${origin}/feed?clip=${encodeURIComponent(clipId)}`;
}

export function getMediaShareUrl(media) {
  if (!media?.item) return '';
  if (media.type === 'set' && media.item.creatorId && media.item.id) {
    return buildSetShareUrl(media.item.creatorId, media.item.id);
  }
  if (media.type === 'clip' && media.item.id) {
    return buildClipShareUrl(media.item.id);
  }
  return '';
}

export function getMediaShareText(media) {
  const title = media?.item?.title?.trim();
  if (media?.type === 'set') {
    return title ? `Check out "${title}" on LiveSet` : 'Check out this live set on LiveSet';
  }
  return title ? `Check out "${title}" on LiveSet` : 'Check out this clip on LiveSet';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyShareLink(media) {
  const url = getMediaShareUrl(media);
  if (!url) return false;
  return copyText(url);
}

export function openSmsShare(url, text) {
  const body = encodeURIComponent(`${text} ${url}`);
  window.location.href = `sms:?&body=${body}`;
}

export function openWhatsAppShare(url, text) {
  const message = encodeURIComponent(`${text}\n${url}`);
  window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
}

export function openEmailShare(url, text) {
  const subject = encodeURIComponent('LiveSet');
  const body = encodeURIComponent(`${text}\n\n${url}`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export function openXShare(url, text) {
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
}

/** Instagram has no web share URL — opens the app/site after copying the link. */
export async function shareToInstagram(url) {
  const copied = await copyText(url);
  if (copied) {
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  }
  return copied;
}

// Kept for any legacy callers
export async function shareSetLink(set) {
  if (!set?.id || !set?.creatorId) return { ok: false };
  const url = buildSetShareUrl(set.creatorId, set.id);
  if (navigator.share) {
    try {
      await navigator.share({
        title: set.title || 'Live set on LiveSet',
        url,
      });
      return { ok: true, method: 'native', url };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }
  const copied = await copyText(url);
  return { ok: copied, method: copied ? 'clipboard' : 'failed', url };
}
