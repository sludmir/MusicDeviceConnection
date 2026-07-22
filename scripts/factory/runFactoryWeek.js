#!/usr/bin/env node
/**
 * LiveSet Product Factory — weekly orchestrator.
 *
 * 1) Refresh / read catalog backlog
 * 2) Pick ≤15 products
 * 3) Resolve reference images (auto-search studio/product shots if needed)
 * 4) Meshy smart-topology generation (+ remesh if >10MB)
 * 5) QA gates
 * 6) Stage drafts + GLBs under catalog/factory/runs/{runId}/
 * 7) Email digest with one-click Approve/Reject (or --dry-run HTML only)
 *
 * Usage:
 *   npm run factory:week -- --dry-run --limit 2
 *   npm run factory:week -- --limit 15
 *
 * Env:
 *   MESHY_API_KEY
 *   FACTORY_HMAC_SECRET
 *   FACTORY_DECIDE_URL   (Cloud Function URL)
 *   RESEND_API_KEY / FACTORY_EMAIL_API_KEY
 *   FACTORY_EMAIL_TO     (default sebasludmir@gmail.com)
 */

const fs = require('fs');
const path = require('path');
const { loadFactoryEnv } = require('../lib/loadEnv');
loadFactoryEnv(path.join(__dirname, '..', '..'));
const {
  analyzeCatalogGaps,
  parseKnowledgeBaseSource,
  parseProductsMarkdown,
} = require('../lib/catalogGapAnalysis');
const { pickWeeklyBatch } = require('../lib/factoryPick');
const { buildProductDraft, suggestedModelFilename } = require('../lib/factoryDraft');
const { resolveReferenceImage } = require('../lib/factoryImages');
const {
  createImageTo3dTask,
  waitForTask,
  remeshUntilSmallEnough,
  downloadBinary,
  pickGlbUrl,
  pickThumbnailUrl,
} = require('../lib/meshyClient');
const { runFactoryQa, MAX_GLB_BYTES } = require('../lib/factoryQa');
const { mintFactoryToken, buildDecisionUrl } = require('../lib/factoryTokens');
const { prepareFactoryDigest, sendFactoryDigestEmail } = require('../lib/factoryEmail');

const ROOT = path.join(__dirname, '..', '..');
const BACKLOG_JSON = path.join(ROOT, 'catalog', 'backlog', 'latest.json');
const TARGETS_DIR = path.join(ROOT, 'catalog', 'targets');
const REFS_DIR = path.join(ROOT, 'catalog', 'factory', 'refs');
const RUNS_DIR = path.join(ROOT, 'catalog', 'factory', 'runs');
const KB_PATH = path.join(ROOT, 'src', 'productKnowledgeBase.js');
const PRODUCTS_MD = path.join(ROOT, 'PRODUCTS.md');
const WEEKLY_LIMIT = 15;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: WEEKLY_LIMIT,
    skipMeshy: false,
    analyze: true,
    ids: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--skip-meshy') args.skipMeshy = true;
    else if (a === '--no-analyze') args.analyze = false;
    else if (a === '--limit') args.limit = Math.min(WEEKLY_LIMIT, Math.max(1, Number(argv[++i]) || 1));
    else if (a === '--ids') {
      args.ids = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/factory/runFactoryWeek.js [--dry-run] [--limit N] [--ids id1,id2] [--skip-meshy] [--no-analyze]`);
      process.exit(0);
    }
  }
  return args;
}

function loadTargetsByName() {
  const map = new Map();
  if (!fs.existsSync(TARGETS_DIR)) return map;
  for (const f of fs.readdirSync(TARGETS_DIR).filter((x) => x.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(TARGETS_DIR, f), 'utf8'));
    for (const t of data.targets || []) {
      map.set(t.name, { ...t, persona: data.persona });
    }
  }
  return map;
}

async function loadLiveProducts(offline) {
  if (offline) {
    return {
      products: parseProductsMarkdown(fs.readFileSync(PRODUCTS_MD, 'utf8')),
      source: 'products.md',
    };
  }
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'musicdeviceconnection',
        credential: admin.credential.applicationDefault(),
      });
    }
    const snap = await admin.firestore().collection('products').get();
    return {
      products: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      source: 'firestore',
    };
  } catch (err) {
    console.warn(`Firestore unavailable (${err.message}); using PRODUCTS.md`);
    return {
      products: parseProductsMarkdown(fs.readFileSync(PRODUCTS_MD, 'utf8')),
      source: 'products.md',
    };
  }
}

function loadTargetFiles() {
  return fs
    .readdirSync(TARGETS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(TARGETS_DIR, f), 'utf8')));
}

async function ensureBacklog(analyze) {
  if (!analyze && fs.existsSync(BACKLOG_JSON)) {
    return JSON.parse(fs.readFileSync(BACKLOG_JSON, 'utf8'));
  }
  const { products, source } = await loadLiveProducts(process.env.FACTORY_OFFLINE === '1');
  const kbProducts = parseKnowledgeBaseSource(fs.readFileSync(KB_PATH, 'utf8'));
  const prior = fs.existsSync(BACKLOG_JSON)
    ? JSON.parse(fs.readFileSync(BACKLOG_JSON, 'utf8')).items || []
    : [];
  const analysis = analyzeCatalogGaps({
    products,
    targetFiles: loadTargetFiles(),
    kbProducts,
    priorItems: prior,
    generatedAt: new Date().toISOString(),
    source,
  });
  fs.mkdirSync(path.dirname(BACKLOG_JSON), { recursive: true });
  fs.writeFileSync(BACKLOG_JSON, `${JSON.stringify(analysis, null, 2)}\n`);
  return analysis;
}

async function generateWithMeshy(imageUrl, dimsMm, { dryRun, skipMeshy }) {
  if (dryRun || skipMeshy) {
    return {
      skipped: true,
      glbBuffer: null,
      thumbnailUrl: null,
      taskId: null,
      qa: { ok: true, sizeBytes: 0, reasons: ['meshy_skipped'], softFlags: [] },
    };
  }

  const taskId = await createImageTo3dTask(imageUrl);
  console.log(`  Meshy task ${taskId}…`);
  const task = await waitForTask(taskId);
  let glbUrl = pickGlbUrl(task);
  if (!glbUrl) throw new Error('Meshy succeeded but no GLB URL');
  let glbBuffer = await downloadBinary(glbUrl);
  let thumbnailUrl = pickThumbnailUrl(task);
  console.log(`  Initial GLB ${(glbBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

  let qa = runFactoryQa(glbBuffer, dimsMm);
  if (qa.softFlags?.length) {
    console.log(`  QA soft flags: ${qa.softFlags.filter((f) => !f.startsWith('proportion_skipped')).join(', ') || 'none'}`);
  }

  if (!qa.ok && qa.reasons.some((r) => r.startsWith('glb_too_large'))) {
    console.log(`  Over 10MB — remeshing ladder…`);
    const remesh = await remeshUntilSmallEnough(taskId, glbBuffer, {
      maxBytes: MAX_GLB_BYTES,
      polycounts: [5000, 3000, 2000],
    });
    glbBuffer = remesh.buffer;
    if (remesh.glbUrl) glbUrl = remesh.glbUrl;
    if (remesh.thumbnailUrl) thumbnailUrl = remesh.thumbnailUrl;
    qa = runFactoryQa(glbBuffer, dimsMm);
  }

  return { skipped: false, glbBuffer, thumbnailUrl, taskId, qa, glbUrl };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const hmacSecret = process.env.FACTORY_HMAC_SECRET || (args.dryRun ? 'dry-run-secret' : '');
  const decideBase =
    process.env.FACTORY_DECIDE_URL ||
    'https://us-central1-musicdeviceconnection.cloudfunctions.net/factoryDecide';

  if (!args.dryRun && !args.skipMeshy && !process.env.MESHY_API_KEY) {
    throw new Error('MESHY_API_KEY required (or pass --dry-run / --skip-meshy)');
  }
  if (!hmacSecret) throw new Error('FACTORY_HMAC_SECRET required');

  const analysis = await ensureBacklog(args.analyze);
  let batch;
  if (args.ids?.length) {
    const byId = new Map((analysis.items || []).map((i) => [i.id, i]));
    batch = args.ids.map((id) => byId.get(id) || { id, name: id, brand: '', score: 0, personas: [] });
    console.log(`Forced ids: ${args.ids.join(', ')}`);
  } else {
    batch = pickWeeklyBatch(analysis.items || [], { limit: args.limit });
  }
  const runId = new Date().toISOString().slice(0, 10);
  const runDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(REFS_DIR, { recursive: true });

  const kbProducts = parseKnowledgeBaseSource(fs.readFileSync(KB_PATH, 'utf8'));
  const targetsByName = loadTargetsByName();

  const staged = [];
  const skipped = [];

  for (const item of batch) {
    console.log(`\n→ ${item.name}`);
    const target = targetsByName.get(item.name) || {};
    const researched = {
      referenceImageUrl: target.referenceImageUrl,
      width_mm: target.width_mm,
      depth_mm: target.depth_mm,
      height_mm: target.height_mm,
      purchaseUrl: target.purchaseUrl,
      affiliateUrl: target.affiliateUrl,
      description: target.notes,
    };
    const draft = buildProductDraft(
      { ...item, kbKeys: target.kbKeys },
      { kbProducts, researched }
    );

    const dimsMm = {
      width_mm: draft.width_mm,
      depth_mm: draft.depth_mm,
      height_mm: draft.height_mm,
    };

    const image = await resolveReferenceImage(
      { ...item, brand: draft.brand || item.brand, referenceImageUrl: target.referenceImageUrl },
      {
        refsDir: REFS_DIR,
        researched,
        dimsMm,
        autoSearch: true,
        persistCache: true,
      }
    );
    if (!image.ok) {
      console.warn(`  SKIP: ${image.error}`);
      skipped.push({ id: item.id, name: item.name, reason: image.error });
      continue;
    }
    console.log(
      `  Image: ${image.source}` +
        (image.score != null ? ` (score ${image.score})` : '') +
        (image.cachedPath ? ` → ${path.relative(ROOT, image.cachedPath)}` : '')
    );

    let gen;
    try {
      gen = await generateWithMeshy(image.imageUrl, dimsMm, args);
    } catch (err) {
      console.warn(`  Meshy failed: ${err.message}`);
      skipped.push({ id: item.id, name: item.name, reason: err.message });
      continue;
    }

    if (!gen.skipped && !gen.qa.ok) {
      console.warn(`  QA failed: ${gen.qa.reasons.join(', ')}`);
      skipped.push({ id: item.id, name: item.name, reason: gen.qa.reasons.join(', ') });
      continue;
    }

    const productDir = path.join(runDir, item.id);
    fs.mkdirSync(productDir, { recursive: true });
    const filename = suggestedModelFilename(draft);
    const glbPath = path.join(productDir, filename);
    if (gen.glbBuffer) {
      fs.writeFileSync(glbPath, gen.glbBuffer);
    }

    // Download Meshy 3D thumbnail for email (approve the model, not just the photo)
    let modelPreviewPath = null;
    if (gen.thumbnailUrl) {
      try {
        const thumbBuf = await downloadBinary(gen.thumbnailUrl);
        modelPreviewPath = path.join(productDir, 'model-preview.jpg');
        fs.writeFileSync(modelPreviewPath, thumbBuf);
        console.log(`  Model preview saved (${(thumbBuf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.warn(`  Could not download Meshy thumbnail: ${err.message}`);
      }
    }

    const hasGlb = Boolean(gen.glbBuffer);
    const approveToken = hasGlb
      ? mintFactoryToken(
        { runId, productId: item.id, decision: 'approve' },
        hmacSecret
      )
      : null;
    const rejectToken = mintFactoryToken(
      { runId, productId: item.id, decision: 'reject' },
      hmacSecret
    );

    const record = {
      id: item.id,
      name: item.name,
      brand: draft.brand,
      category: draft.category,
      subcategory: draft.subcategory,
      reasons: item.reasons,
      draft,
      filename,
      glbRelativePath: gen.glbBuffer ? path.relative(ROOT, glbPath) : null,
      hasGlb,
      sizeBytes: gen.qa.sizeBytes,
      thumbnailUrl: gen.thumbnailUrl,
      modelThumbnailUrl: gen.thumbnailUrl,
      modelPreviewPath,
      referenceImageUrl: image.publicImageUrl || image.referenceImageUrl,
      publicImageUrl: image.publicImageUrl || null,
      previewPath: modelPreviewPath || image.previewPath || image.cachedPath || null,
      refPreviewPath: image.cachedPath || image.previewPath || null,
      cachedPath: image.cachedPath || null,
      meshyTaskId: gen.taskId,
      targetPolycount: 10000,
      qa: gen.qa,
      status: 'staged_pending_approval',
      approveUrl: approveToken ? buildDecisionUrl(decideBase, approveToken) : null,
      rejectUrl: buildDecisionUrl(decideBase, rejectToken),
    };

    fs.writeFileSync(path.join(productDir, 'draft.json'), `${JSON.stringify(record, null, 2)}\n`);
    staged.push(record);
    console.log(`  Staged (${record.sizeBytes || 0} bytes)`);
  }

  const approveAllUrl = buildDecisionUrl(
    decideBase,
    mintFactoryToken({ runId, productId: '*', decision: 'approve_all' }, hmacSecret)
  );

  const manifest = {
    version: 1,
    runId,
    generatedAt: new Date().toISOString(),
    limit: args.limit,
    dryRun: args.dryRun,
    staged: staged.map((s) => s.id),
    skipped,
    products: staged,
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // Upload to Storage BEFORE email so Approve links work
  const shouldUpload = !args.dryRun || process.env.FACTORY_FORCE_UPLOAD === '1';
  if (shouldUpload && staged.some((s) => s.hasGlb)) {
    try {
      const { spawnSync } = require('child_process');
      console.log(`\nUploading run ${runId} to Firebase Storage…`);
      const up = spawnSync(
        process.execPath,
        [path.join(__dirname, 'uploadRunToStorage.js'), '--run', runId],
        { stdio: 'inherit', env: process.env }
      );
      if (up.status !== 0) {
        console.warn('Storage upload failed — Approve links will not work until you run: npm run factory:upload -- --run ' + runId);
      }
    } catch (err) {
      console.warn(`Storage upload error: ${err.message}`);
    }
  } else if (!staged.some((s) => s.hasGlb)) {
    console.warn('\nNo GLBs in this run (dry-run / --skip-meshy). Approve links are disabled until you run Meshy.');
  }

  // Embed local previews as CID attachments (Gmail cannot load file:// URLs)
  const { html, attachments } = prepareFactoryDigest({
    runId,
    generatedAt: manifest.generatedAt,
    products: staged,
    approveAllUrl,
    skipped,
  });
  fs.writeFileSync(path.join(runDir, 'digest.html'), html);

  if (staged.length === 0) {
    console.log('\nNo products staged (missing refs or Meshy failures). Wrote empty manifest.');
    process.exit(0);
  }

  const subject = `LiveSet Factory: ${staged.length} product(s) ready — ${runId}`;
  const mail = await sendFactoryDigestEmail({
    to: process.env.FACTORY_EMAIL_TO || 'sebasludmir@gmail.com',
    subject,
    html,
    attachments,
    allowDry: args.dryRun,
  });
  console.log(mail.dryRun ? `\nDry-run email written to ${path.join(runDir, 'digest.html')}` : `\nEmail sent: ${JSON.stringify(mail)}`);
  console.log(`Run directory: ${runDir}`);
  console.log(`Staged ${staged.length}, skipped ${skipped.length}, max ${MAX_GLB_BYTES} bytes`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
