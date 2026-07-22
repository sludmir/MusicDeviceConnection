/**
 * Factory QA gates for generated GLBs.
 *
 * Hard fails: empty / >10MB / obvious "cube vs long rectangle" mismatch.
 * Soft flags (warn only): mid-axis ratio noise — flat square pads (Launchpad)
 * often trip this without being wrong.
 */

const MAX_GLB_BYTES = 10 * 1024 * 1024; // 10MB

function checkGlbSize(glbBuffer) {
  const sizeBytes = glbBuffer?.length || 0;
  const reasons = [];
  if (!sizeBytes) reasons.push('empty_glb');
  if (sizeBytes > MAX_GLB_BYTES) {
    reasons.push(`glb_too_large_${(sizeBytes / (1024 * 1024)).toFixed(2)}MB`);
  }
  return { ok: reasons.length === 0, sizeBytes, reasons };
}

/**
 * Compare model bbox aspect ratios to researched mm dims.
 * Returns hardReasons (fail) + softReasons (warn).
 */
function checkProportion(bbox, dimsMm, { cubeSlack = 0.25 } = {}) {
  const hardReasons = [];
  const softReasons = [];
  if (!bbox || !dimsMm) {
    return {
      ok: true,
      reasons: ['proportion_skipped'],
      hardReasons,
      softReasons: ['proportion_skipped'],
      ratios: null,
    };
  }
  const { width_mm: w, depth_mm: d, height_mm: h } = dimsMm;
  if (![w, d, h].every((n) => typeof n === 'number' && n > 0)) {
    return {
      ok: true,
      reasons: ['proportion_skipped_incomplete_dims'],
      hardReasons,
      softReasons: ['proportion_skipped_incomplete_dims'],
      ratios: null,
    };
  }
  const bx = Math.abs(bbox.x) || 0;
  const by = Math.abs(bbox.y) || 0;
  const bz = Math.abs(bbox.z) || 0;
  if (![bx, by, bz].every((n) => n > 0)) {
    return {
      ok: true,
      reasons: ['proportion_skipped_no_bbox'],
      hardReasons,
      softReasons: ['proportion_skipped_no_bbox'],
      ratios: null,
    };
  }

  const sortNums = (a, b, c) => [a, b, c].sort((x, y) => x - y);
  const [ms, mm, ml] = sortNums(bx, by, bz);
  const [ds, dm, dl] = sortNums(w, d, h);

  const modelSpread = ml / ms;
  const dimSpread = dl / ds;
  // Product clearly elongated but mesh nearly cubic — hard fail
  if (dimSpread >= 1.8 && modelSpread < 1.2 + cubeSlack) {
    hardReasons.push('looks_like_cube_vs_rectangular_product');
  }

  const modelMid = mm / ms;
  const dimMid = dm / ds;
  // Flat square gear (Launchpad: 241×241×21) often mismatches mid-axis — soft only
  if (Math.abs(modelMid - dimMid) > 1.2 && dimSpread >= 1.5) {
    softReasons.push('mid_axis_ratio_mismatch');
  }

  return {
    ok: hardReasons.length === 0,
    reasons: [...hardReasons, ...softReasons],
    hardReasons,
    softReasons,
    ratios: { modelSpread, dimSpread, modelMid, dimMid },
  };
}

function estimateGlbBbox(glbBuffer) {
  try {
    if (!glbBuffer || glbBuffer.length < 12) return null;
    const magic = glbBuffer.readUInt32LE(0);
    if (magic !== 0x46546c67) return null; // glTF
    const jsonLength = glbBuffer.readUInt32LE(12);
    const jsonStart = 20;
    const json = JSON.parse(glbBuffer.slice(jsonStart, jsonStart + jsonLength).toString('utf8'));
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    let found = false;
    for (const acc of json.accessors || []) {
      if (!acc.min || !acc.max || acc.min.length < 3) continue;
      found = true;
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], acc.min[i]);
        max[i] = Math.max(max[i], acc.max[i]);
      }
    }
    if (!found) return null;
    return {
      x: max[0] - min[0],
      y: max[1] - min[1],
      z: max[2] - min[2],
    };
  } catch {
    return null;
  }
}

function runFactoryQa(glbBuffer, dimsMm) {
  const size = checkGlbSize(glbBuffer);
  const bbox = estimateGlbBbox(glbBuffer);
  const proportion = checkProportion(bbox, dimsMm);
  const hardReasons = [
    ...size.reasons,
    ...(proportion.hardReasons || []),
  ];
  const softFlags = [
    ...(proportion.softReasons || []).filter((r) => !r.startsWith('proportion_skipped')),
    ...(proportion.softReasons || []).filter((r) => r.startsWith('proportion_skipped')),
  ];
  return {
    ok: size.ok && proportion.ok,
    sizeBytes: size.sizeBytes,
    bbox,
    reasons: hardReasons,
    softFlags: softFlags.filter(Boolean),
  };
}

module.exports = {
  MAX_GLB_BYTES,
  checkGlbSize,
  checkProportion,
  estimateGlbBbox,
  runFactoryQa,
};
