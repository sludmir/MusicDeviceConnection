/**
 * Weekly factory email digest (HTML) + optional Resend send.
 * Embeds local preview images as CID attachments (Gmail-safe).
 * Never uses file:// URLs in HTML.
 */

const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function cidForProduct(id) {
  const safe = String(id || 'product').replace(/[^a-zA-Z0-9_-]/g, '');
  return `factory-${safe}`;
}

function previewImgHtml(p, { width = 200 } = {}) {
  // Prefer Meshy 3D model preview (CID or https thumbnail) — that's what you approve
  if (p.modelPreviewCid) {
    return `
      <img src="cid:${escapeHtml(p.modelPreviewCid)}" alt="3D model: ${escapeHtml(p.name || '')}" width="${width}" style="border-radius:8px;display:block;margin-bottom:6px;max-width:${width}px;background:#1a1816;" />
      <div style="color:#D9C2A0;font-size:11px;margin-bottom:8px;">3D model preview</div>
      ${p.refPreviewCid ? `<img src="cid:${escapeHtml(p.refPreviewCid)}" alt="source" width="72" style="border-radius:6px;opacity:0.85;" /><div style="color:#6e655c;font-size:10px;margin-top:4px;">source photo</div>` : ''}
    `;
  }
  if (p.previewCid) {
    return `
      <img src="cid:${escapeHtml(p.previewCid)}" alt="3D model: ${escapeHtml(p.name || '')}" width="${width}" style="border-radius:8px;display:block;margin-bottom:6px;max-width:${width}px;background:#1a1816;" />
      <div style="color:#D9C2A0;font-size:11px;margin-bottom:8px;">3D model preview</div>
    `;
  }
  const modelHttps = [p.thumbnailUrl, p.modelThumbnailUrl].find(isHttpUrl);
  if (modelHttps) {
    return `
      <img src="${escapeHtml(modelHttps)}" alt="3D model: ${escapeHtml(p.name || '')}" width="${width}" style="border-radius:8px;display:block;margin-bottom:6px;max-width:${width}px;background:#1a1816;" />
      <div style="color:#D9C2A0;font-size:11px;margin-bottom:8px;">3D model preview</div>
    `;
  }
  const refHttps = [p.publicImageUrl, p.referenceImageUrl].find(isHttpUrl);
  if (refHttps) {
    return `
      <img src="${escapeHtml(refHttps)}" alt="${escapeHtml(p.name || '')}" width="${width}" style="border-radius:8px;display:block;margin-bottom:6px;max-width:${width}px;" />
      <div style="color:#e8a0a0;font-size:11px;">source photo only (no 3D thumb yet)</div>
    `;
  }
  return `<div style="width:${width}px;height:120px;background:#2a2622;border-radius:8px;color:#9a8f7f;font-size:12px;text-align:center;line-height:120px;">No preview</div>`;
}

function productCard(p) {
  const sizeMb = p.sizeBytes ? (p.sizeBytes / (1024 * 1024)).toFixed(2) : '?';
  const dims = [p.draft?.width_mm, p.draft?.depth_mm, p.draft?.height_mm]
    .every((n) => typeof n === 'number')
    ? `${p.draft.width_mm}×${p.draft.depth_mm}×${p.draft.height_mm} mm`
    : 'dims TBD';

  return `
  <tr>
    <td style="padding:16px 0;border-bottom:1px solid #333;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="220" valign="top">${previewImgHtml(p)}</td>
          <td valign="top" style="padding-left:16px;">
            <div style="font-size:18px;font-weight:600;color:#f5f0e8;">${escapeHtml(p.name)}</div>
            <div style="color:#b5a996;margin:4px 0 8px;">${escapeHtml(p.brand)} · ${escapeHtml(p.category)}/${escapeHtml(p.subcategory)}</div>
            <div style="color:#9a8f7f;font-size:13px;line-height:1.4;">
              ${escapeHtml((p.reasons || []).join('; '))}<br/>
              Size ${escapeHtml(sizeMb)} MB · ${escapeHtml(dims)} · poly ~${escapeHtml(p.targetPolycount || '10k')}
            </div>
            <div style="margin-top:12px;">
              ${p.hasGlb !== false && p.approveUrl
    ? `<a href="${escapeHtml(p.approveUrl)}" style="background:#D9C2A0;color:#0A0908;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;display:inline-block;margin-right:8px;">Approve</a>`
    : `<span style="color:#e8a0a0;font-size:13px;margin-right:8px;">Preview only — no 3D model yet (re-run without --dry-run / --skip-meshy)</span>`}
              <a href="${escapeHtml(p.rejectUrl)}" style="background:#2a2622;color:#f5f0e8;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;display:inline-block;">Reject</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function buildFactoryDigestHtml({ runId, generatedAt, products, approveAllUrl, skipped = [] }) {
  const cards = products.map(productCard).join('\n');
  const skippedBlock = skipped.length
    ? `<tr><td style="padding-top:28px;">
          <div style="font-size:16px;font-weight:600;color:#e8a0a0;">Skipped / needs retry</div>
          <ul style="color:#9a8f7f;font-size:13px;line-height:1.5;">
            ${skipped.map((s) => `<li><strong style="color:#f5f0e8;">${escapeHtml(s.name || s.id)}</strong> — ${escapeHtml(s.reason || 'unknown')}</li>`).join('')}
          </ul>
        </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>LiveSet Product Factory — ${escapeHtml(runId)}</title></head>
<body style="margin:0;padding:0;background:#0A0908;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0908;padding:24px 12px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
        <tr><td style="padding-bottom:20px;">
          <div style="font-size:28px;font-weight:700;color:#D9C2A0;">LiveSet Product Factory</div>
          <div style="color:#9a8f7f;margin-top:6px;">Run ${escapeHtml(runId)} · ${escapeHtml(generatedAt)}</div>
          <div style="color:#b5a996;margin-top:10px;">${products.length} model(s) ready for review. Approve publishes to Firestore + Storage.</div>
          ${approveAllUrl ? `<div style="margin-top:14px;"><a href="${escapeHtml(approveAllUrl)}" style="background:#D9C2A0;color:#0A0908;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700;display:inline-block;">Approve all remaining</a></div>` : ''}
        </td></tr>
        ${cards}
        ${skippedBlock}
        <tr><td style="padding-top:24px;color:#6e655c;font-size:12px;">
          Links expire in 7 days. Rejected models stay out of the live catalog.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPreviewAttachments(products) {
  const attachments = [];
  for (const p of products) {
    // Primary: Meshy 3D model thumbnail (what you're approving)
    const modelPath = p.modelPreviewPath;
    const modelHttps = [p.thumbnailUrl, p.modelThumbnailUrl].find(isHttpUrl);
    if (modelPath && fs.existsSync(modelPath)) {
      const cid = cidForProduct(`${p.id}-model`);
      p.modelPreviewCid = cid;
      p.previewCid = cid;
      const ext = path.extname(modelPath).toLowerCase() || '.png';
      const contentType =
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      attachments.push({
        filename: `${p.id || 'preview'}-model${ext}`,
        content: fs.readFileSync(modelPath).toString('base64'),
        content_id: cid,
        contentType,
      });
    } else if (modelHttps) {
      const cid = cidForProduct(`${p.id}-model`);
      p.modelPreviewCid = cid;
      p.previewCid = cid;
      attachments.push({
        filename: `${p.id || 'preview'}-model.jpg`,
        path: modelHttps,
        content_id: cid,
        contentType: 'image/jpeg',
      });
    }

    // Secondary: tiny source product photo (context only)
    const refPath = p.refPreviewPath || (!modelPath ? (p.previewPath || p.cachedPath) : null);
    if (refPath && fs.existsSync(refPath) && refPath !== modelPath) {
      const cid = cidForProduct(`${p.id}-ref`);
      p.refPreviewCid = cid;
      const ext = path.extname(refPath).toLowerCase() || '.jpg';
      const contentType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      attachments.push({
        filename: `${p.id || 'preview'}-ref${ext}`,
        content: fs.readFileSync(refPath).toString('base64'),
        content_id: cid,
        contentType,
      });
    }
  }
  return attachments;
}

/**
 * Prepare products for email: attach CIDs, then build HTML.
 */
function prepareFactoryDigest({ runId, generatedAt, products, approveAllUrl, skipped = [] }) {
  const attachments = buildPreviewAttachments(products);
  const html = buildFactoryDigestHtml({ runId, generatedAt, products, approveAllUrl, skipped });
  return { html, attachments };
}

async function sendFactoryDigestEmail({
  to = 'sebasludmir@gmail.com',
  subject,
  html,
  attachments = [],
  apiKey = process.env.RESEND_API_KEY || process.env.FACTORY_EMAIL_API_KEY,
  from = process.env.FACTORY_EMAIL_FROM || 'LiveSet Factory <onboarding@resend.dev>',
  allowDry = false,
}) {
  if (!apiKey) {
    if (allowDry) {
      return { dryRun: true, to, subject, attachmentCount: attachments.length };
    }
    throw new Error('RESEND_API_KEY / FACTORY_EMAIL_API_KEY is required to send email');
  }

  const body = {
    from,
    to: [to],
    subject,
    html,
  };
  if (attachments.length) {
    body.attachments = attachments.map((a) => {
      const att = {
        filename: a.filename,
        content_id: a.content_id,
      };
      // Prefer local base64 embed (Gmail-safe). Remote path only as fallback.
      if (a.content) {
        att.content = a.content;
      } else if (a.path && /^https?:\/\//i.test(a.path)) {
        att.path = a.path;
      }
      if (a.contentType) att.content_type = a.contentType;
      return att;
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = {
  buildFactoryDigestHtml,
  prepareFactoryDigest,
  sendFactoryDigestEmail,
  buildPreviewAttachments,
  cidForProduct,
  isHttpUrl,
  escapeHtml,
};
