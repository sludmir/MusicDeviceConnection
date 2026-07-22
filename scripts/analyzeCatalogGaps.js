#!/usr/bin/env node
/**
 * Analyzes live catalog vs persona targets + KB gaps.
 * Writes catalog/backlog/latest.json + latest.md (+ dated copy).
 *
 * Auth (preferred): firebase-admin Application Default Credentials
 *   gcloud auth application-default login
 * Fallback: parse PRODUCTS.md when Firestore is unavailable.
 *
 * Usage:
 *   npm run analyze-catalog
 *   npm run analyze-catalog -- --offline
 *   npm run analyze-catalog -- --out-dir catalog/backlog
 */

const fs = require('fs');
const path = require('path');

const {
  analyzeCatalogGaps,
  parseProductsMarkdown,
  parseKnowledgeBaseSource,
  renderBacklogMarkdown,
} = require('./lib/catalogGapAnalysis');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'catalog', 'backlog');
const TARGETS_DIR = path.join(ROOT, 'catalog', 'targets');
const PRODUCTS_MD = path.join(ROOT, 'PRODUCTS.md');
const KB_PATH = path.join(ROOT, 'src', 'productKnowledgeBase.js');
const PROJECT_ID = 'musicdeviceconnection';

function parseArgs(argv) {
  const args = {
    offline: false,
    outDir: DEFAULT_OUT_DIR,
    dated: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--offline') args.offline = true;
    else if (a === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (a === '--no-dated') args.dated = false;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/analyzeCatalogGaps.js [--offline] [--out-dir DIR] [--no-dated]`);
      process.exit(0);
    }
  }
  return args;
}

function loadTargetFiles() {
  if (!fs.existsSync(TARGETS_DIR)) return [];
  return fs
    .readdirSync(TARGETS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(TARGETS_DIR, f), 'utf8'));
      return raw;
    });
}

function loadKbProducts() {
  if (!fs.existsSync(KB_PATH)) return [];
  return parseKnowledgeBaseSource(fs.readFileSync(KB_PATH, 'utf8'));
}

function loadPriorItems(outDir) {
  const latestPath = path.join(outDir, 'latest.json');
  if (!fs.existsSync(latestPath)) return [];
  try {
    const prior = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    return Array.isArray(prior.items) ? prior.items : [];
  } catch {
    return [];
  }
}

async function loadProductsFromFirestore() {
  // Lazy require so --offline works without ADC.
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  }
  const snap = await admin.firestore().collection('products').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function loadProductsFromMarkdown() {
  if (!fs.existsSync(PRODUCTS_MD)) {
    throw new Error(`PRODUCTS.md not found at ${PRODUCTS_MD}`);
  }
  return parseProductsMarkdown(fs.readFileSync(PRODUCTS_MD, 'utf8'));
}

async function resolveProducts(offline) {
  if (offline) {
    return { products: loadProductsFromMarkdown(), source: 'products.md' };
  }
  try {
    const products = await loadProductsFromFirestore();
    return { products, source: 'firestore' };
  } catch (err) {
    console.warn(`Firestore unavailable (${err.message}); falling back to PRODUCTS.md`);
    return { products: loadProductsFromMarkdown(), source: 'products.md' };
  }
}

function writeOutputs(outDir, analysis, dated) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'latest.json');
  const mdPath = path.join(outDir, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderBacklogMarkdown(analysis));

  if (dated) {
    const day = analysis.generatedAt.slice(0, 10);
    const datedPath = path.join(outDir, `${day}-gap-analysis.json`);
    fs.writeFileSync(datedPath, `${JSON.stringify(analysis, null, 2)}\n`);
    console.log(`Wrote ${datedPath}`);
  }

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(
    `Open backlog: ${analysis.summary.backlogOpen} | Live matched: ${analysis.summary.backlogLive} | Source: ${analysis.source}`
  );
  if (analysis.topRecommendations.length) {
    console.log('Top picks:');
    analysis.topRecommendations.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} (${r.score}) — ${r.reasons.join('; ')}`);
    });
  }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const { products, source } = await resolveProducts(args.offline);
  const targetFiles = loadTargetFiles();
  const kbProducts = loadKbProducts();
  const priorItems = loadPriorItems(args.outDir);

  const analysis = analyzeCatalogGaps({
    products,
    targetFiles,
    kbProducts,
    priorItems,
    generatedAt: new Date().toISOString(),
    source,
  });

  writeOutputs(args.outDir, analysis, args.dated);
  process.exit(0);
})().catch((err) => {
  console.error('analyze-catalog failed:', err);
  process.exit(1);
});
