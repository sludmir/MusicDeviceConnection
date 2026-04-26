/**
 * ProductImporter — Admin tool for bulk-importing 3D models into Firestore.
 *
 * Workflow:
 *  1. Scans Firebase Storage /models/ for GLB files
 *  2. Compares against existing Firestore products
 *  3. Auto-detects product info from the knowledge base
 *  4. Shows an editable review form for each new model
 *  5. Creates Firestore product docs with dimensions included
 */
import React, { useState, useEffect, useCallback } from 'react';
import { db, storage, auth } from './firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { lookupProduct, parseFilename } from './productKnowledgeBase';
import { PRODUCT_CATEGORIES } from './productManager';
import { MdCheckCircle, MdWarning, MdArrowBack, MdCloudUpload, MdEdit, MdDelete } from 'react-icons/md';

// ─── Styles (inline to keep it self-contained) ──────────────────────
const S = {
  page: { position: 'fixed', inset: 0, zIndex: 9999, background: '#0c0d14', color: '#e8e8ec', fontFamily: "'SF Pro Display', -apple-system, sans-serif", overflow: 'auto' },
  inner: { maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  backBtn: { background: 'none', border: 'none', color: 'rgba(232,232,236,0.6)', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' },
  title: { margin: 0, fontSize: 22, fontWeight: 700 },
  subtitle: { margin: '0 0 24px', fontSize: 14, color: 'rgba(232,232,236,0.45)' },
  scanBtn: { padding: '12px 28px', fontSize: 14, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' },
  scanBtnDisabled: { padding: '12px 28px', fontSize: 14, fontWeight: 600, background: '#333', color: '#666', border: 'none', borderRadius: 10, cursor: 'default' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  badgeNew: { background: 'rgba(99,102,241,0.2)', color: '#818cf8' },
  badgeExists: { background: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  badgeNoMatch: { background: 'rgba(250,204,21,0.15)', color: '#facc15' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  formGroupFull: { display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' },
  label: { fontSize: 11, fontWeight: 600, color: 'rgba(232,232,236,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '8px 10px', fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8ec', fontFamily: 'inherit', outline: 'none' },
  select: { padding: '8px 10px', fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8ec', fontFamily: 'inherit' },
  textarea: { padding: '8px 10px', fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8ec', fontFamily: 'inherit', minHeight: 50, resize: 'vertical' },
  dimRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  importBtn: { padding: '10px 24px', fontSize: 13, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  skipBtn: { padding: '10px 24px', fontSize: 13, fontWeight: 500, background: 'transparent', color: 'rgba(232,232,236,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer' },
  importAllBtn: { padding: '14px 36px', fontSize: 15, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 },
  log: { marginTop: 20, padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'rgba(232,232,236,0.6)', maxHeight: 300, overflow: 'auto' },
  stats: { display: 'flex', gap: 20, marginBottom: 24 },
  statBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', flex: 1, textAlign: 'center' },
  statVal: { fontSize: 24, fontWeight: 700 },
  statLabel: { fontSize: 11, color: 'rgba(232,232,236,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 },
};

// Build flat subcategory list for dropdowns
const SUBCATEGORY_OPTIONS = [];
for (const [cat, subs] of Object.entries(PRODUCT_CATEGORIES)) {
  for (const [key, val] of Object.entries(subs)) {
    SUBCATEGORY_OPTIONS.push({ value: key, label: `${cat} → ${val.name}`, category: cat });
  }
}

export default function ProductImporter({ onBack }) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [newModels, setNewModels] = useState([]); // models to import
  const [existingCount, setExistingCount] = useState(0);
  const [totalStorage, setTotalStorage] = useState(0);
  const [importLog, setImportLog] = useState([]);
  const [importing, setImporting] = useState(false);

  const appendLog = useCallback((msg) => setImportLog(prev => [...prev, msg]), []);

  // ── Scan Storage vs Firestore ────────────────────────────────────
  const scan = async () => {
    setScanning(true);
    setImportLog([]);
    setNewModels([]);
    try {
      appendLog('Scanning Firebase Storage models/ ...');
      const modelsRef = ref(storage, 'models');
      const result = await listAll(modelsRef);
      const glbFiles = result.items.filter(item => item.name.toLowerCase().endsWith('.glb'));
      setTotalStorage(glbFiles.length);
      appendLog(`Found ${glbFiles.length} GLB files in Storage.`);

      appendLog('Loading existing products from Firestore...');
      const snap = await getDocs(collection(db, 'products'));
      const existingPaths = new Set();
      const existingNames = new Set();
      snap.forEach(d => {
        const data = d.data();
        if (data.modelPath) existingPaths.add(data.modelPath);
        if (data.name) existingNames.add(data.name.toLowerCase().trim());
      });
      appendLog(`Found ${snap.size} existing products.`);
      setExistingCount(snap.size);

      // Resolve URLs for all storage files and compare
      const unmatched = [];
      for (const item of glbFiles) {
        try {
          const url = await getDownloadURL(item);
          if (existingPaths.has(url)) continue; // already linked

          // Try to auto-detect product from filename
          const parsed = parseFilename(item.name);
          const kbMatch = lookupProduct(parsed) || lookupProduct(item.name);

          // Check if a product with the same name already exists
          if (kbMatch && existingNames.has(kbMatch.name.toLowerCase().trim())) {
            continue; // product exists by name
          }

          unmatched.push({
            storageFile: item.name,
            storageUrl: url,
            parsedName: parsed,
            kbMatch,
            // Editable form state — pre-filled from KB or blank
            form: kbMatch ? {
              name: kbMatch.name,
              brand: kbMatch.brand,
              type: kbMatch.type,
              category: kbMatch.category,
              subcategory: kbMatch.subcategory,
              description: kbMatch.description,
              price: kbMatch.price,
              locationPriority: kbMatch.locationPriority,
              width_mm: kbMatch.width_mm || '',
              depth_mm: kbMatch.depth_mm || '',
              height_mm: kbMatch.height_mm || '',
              connections: (kbMatch.connections || []).join(', '),
              features: (kbMatch.features || []).join(', '),
            } : {
              name: parsed,
              brand: '',
              type: '',
              category: 'DJ',
              subcategory: 'players',
              description: '',
              price: 0,
              locationPriority: 500,
              width_mm: '',
              depth_mm: '',
              height_mm: '',
              connections: '',
              features: '',
            },
            skip: false,
          });
        } catch (e) {
          appendLog(`  Warning: couldn't resolve URL for ${item.name}`);
        }
      }

      setNewModels(unmatched);
      appendLog(`\n${unmatched.length} new model(s) ready for import.`);
      setScanned(true);
    } catch (e) {
      appendLog(`Error: ${e.message}`);
    }
    setScanning(false);
  };

  // ── Update form field for a model ────────────────────────────────
  const updateField = (index, field, value) => {
    setNewModels(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], form: { ...copy[index].form, [field]: value } };
      // Auto-update category when subcategory changes
      if (field === 'subcategory') {
        const match = SUBCATEGORY_OPTIONS.find(o => o.value === value);
        if (match) copy[index].form.category = match.category;
      }
      return copy;
    });
  };

  const toggleSkip = (index) => {
    setNewModels(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], skip: !copy[index].skip };
      return copy;
    });
  };

  // ── Import all non-skipped models ────────────────────────────────
  const importAll = async () => {
    setImporting(true);
    setImportLog([]);

    // Force token refresh
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }

    const toImport = newModels.filter(m => !m.skip);
    appendLog(`Importing ${toImport.length} product(s)...\n`);

    let success = 0, fail = 0;
    for (const model of toImport) {
      const f = model.form;
      // Build the KB match's full inputs/outputs if available
      const kbData = model.kbMatch || {};

      const docData = {
        name: f.name,
        brand: f.brand,
        type: f.type,
        category: f.category,
        subcategory: f.subcategory,
        description: f.description,
        price: Number(f.price) || 0,
        locationPriority: Number(f.locationPriority) || 500,
        inputs: kbData.inputs || [],
        outputs: kbData.outputs || [],
        connections: f.connections ? f.connections.split(',').map(s => s.trim()).filter(Boolean) : [],
        specifications: kbData.specifications || {},
        features: f.features ? f.features.split(',').map(s => s.trim()).filter(Boolean) : [],
        modelPath: model.storageUrl,
        modelScale: 1.0,
        imageUrl: '',
        isActive: true,
        ownerId: auth.currentUser.uid,
        // Dimensions stored on the product doc for auto-scaling
        width_mm: Number(f.width_mm) || 0,
        depth_mm: Number(f.depth_mm) || 0,
        height_mm: Number(f.height_mm) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        const docRef = await addDoc(collection(db, 'products'), docData);
        appendLog(`✓ "${f.name}" → ${docRef.id}`);
        success++;
      } catch (e) {
        appendLog(`✗ "${f.name}": ${e.message}`);
        fail++;
      }
    }

    appendLog(`\nDone! ${success} imported, ${fail} failed.`);
    setImporting(false);
  };

  const pendingCount = newModels.filter(m => !m.skip).length;

  return (
    <div style={S.page}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          {onBack && (
            <button style={S.backBtn} onClick={onBack}><MdArrowBack size={20} /></button>
          )}
          <h1 style={S.title}>Product Importer</h1>
        </div>
        <p style={S.subtitle}>
          Scans Firebase Storage for new 3D models, auto-detects product info, and lets you review before importing to Firestore.
        </p>

        {/* Scan button */}
        {!scanned && (
          <button
            style={scanning ? S.scanBtnDisabled : S.scanBtn}
            onClick={scan}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Scan for new models'}
          </button>
        )}

        {/* Stats */}
        {scanned && (
          <div style={S.stats}>
            <div style={S.statBox}>
              <div style={S.statVal}>{totalStorage}</div>
              <div style={S.statLabel}>In Storage</div>
            </div>
            <div style={S.statBox}>
              <div style={S.statVal}>{existingCount}</div>
              <div style={S.statLabel}>In Firestore</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statVal, color: newModels.length > 0 ? '#818cf8' : '#4ade80' }}>{newModels.length}</div>
              <div style={S.statLabel}>New to import</div>
            </div>
          </div>
        )}

        {/* New model cards */}
        {newModels.map((model, i) => (
          <div key={model.storageFile} style={{ ...S.card, opacity: model.skip ? 0.4 : 1 }}>
            <div style={S.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={S.cardTitle}>{model.storageFile}</h3>
                {model.kbMatch ? (
                  <span style={{ ...S.badge, ...S.badgeNew }}>Auto-detected</span>
                ) : (
                  <span style={{ ...S.badge, ...S.badgeNoMatch }}>Manual entry</span>
                )}
              </div>
              <button
                style={{ ...S.skipBtn, fontSize: 12, padding: '6px 14px' }}
                onClick={() => toggleSkip(i)}
              >
                {model.skip ? 'Include' : 'Skip'}
              </button>
            </div>

            {!model.skip && (
              <>
                <div style={S.formGrid}>
                  <div style={S.formGroup}>
                    <label style={S.label}>Product Name</label>
                    <input style={S.input} value={model.form.name} onChange={e => updateField(i, 'name', e.target.value)} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Brand</label>
                    <input style={S.input} value={model.form.brand} onChange={e => updateField(i, 'brand', e.target.value)} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Type</label>
                    <input style={S.input} value={model.form.type} onChange={e => updateField(i, 'type', e.target.value)} placeholder="e.g. mixer, synth, guitar" />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Category / Subcategory</label>
                    <select style={S.select} value={model.form.subcategory} onChange={e => updateField(i, 'subcategory', e.target.value)}>
                      {SUBCATEGORY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={S.formGroupFull}>
                    <label style={S.label}>Description</label>
                    <textarea style={S.textarea} value={model.form.description} onChange={e => updateField(i, 'description', e.target.value)} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Price ($)</label>
                    <input style={S.input} type="number" value={model.form.price} onChange={e => updateField(i, 'price', e.target.value)} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Location Priority (lower = more central)</label>
                    <input style={S.input} type="number" value={model.form.locationPriority} onChange={e => updateField(i, 'locationPriority', e.target.value)} />
                  </div>
                </div>

                {/* Dimensions */}
                <div style={{ marginTop: 12 }}>
                  <label style={S.label}>Real-world dimensions (mm)</label>
                  <div style={S.dimRow}>
                    <input style={S.input} type="number" placeholder="Width" value={model.form.width_mm} onChange={e => updateField(i, 'width_mm', e.target.value)} />
                    <input style={S.input} type="number" placeholder="Depth" value={model.form.depth_mm} onChange={e => updateField(i, 'depth_mm', e.target.value)} />
                    <input style={S.input} type="number" placeholder="Height" value={model.form.height_mm} onChange={e => updateField(i, 'height_mm', e.target.value)} />
                  </div>
                </div>

                {/* Connections & Features */}
                <div style={{ ...S.formGrid, marginTop: 10 }}>
                  <div style={S.formGroup}>
                    <label style={S.label}>Connections (comma-separated)</label>
                    <input style={S.input} value={model.form.connections} onChange={e => updateField(i, 'connections', e.target.value)} placeholder="RCA, USB, XLR" />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Features (comma-separated)</label>
                    <input style={S.input} value={model.form.features} onChange={e => updateField(i, 'features', e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Import all button */}
        {scanned && pendingCount > 0 && (
          <button
            style={{ ...S.importAllBtn, ...(importing ? { background: '#333', cursor: 'default' } : {}) }}
            onClick={importAll}
            disabled={importing}
          >
            <MdCloudUpload size={18} />
            {importing ? 'Importing...' : `Import ${pendingCount} product${pendingCount !== 1 ? 's' : ''}`}
          </button>
        )}

        {scanned && pendingCount === 0 && newModels.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,232,236,0.4)' }}>
            <MdCheckCircle size={36} style={{ color: '#4ade80', marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 15 }}>All models are already imported!</p>
          </div>
        )}

        {/* Log output */}
        {importLog.length > 0 && (
          <pre style={S.log}>{importLog.join('\n')}</pre>
        )}

        {/* Re-scan */}
        {scanned && !importing && (
          <button
            style={{ ...S.skipBtn, marginTop: 16 }}
            onClick={() => { setScanned(false); setNewModels([]); setImportLog([]); }}
          >
            Re-scan
          </button>
        )}
      </div>
    </div>
  );
}
