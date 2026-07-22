# LiveSet Product Factory — full process

One-page guide for the automated “pick gear → Meshy 3D → email approve → Firestore” pipeline.

---

## What this is

Agents fill the LiveSet catalog with 3D products (max **15/week**) for:

- Studio producers  
- Guitarists (amps/pedals)  
- Accessible DJs (controllers / mid-tier CDJs, not only flagship)

You **do not** model in Blender by default. You **approve or reject** from email after looking at the **3D model preview** Meshy generated.

---

## End-to-end flow

```
1. Gap analysis     npm run analyze-catalog
2. Weekly factory   npm run factory:week -- --limit N
      ├─ pick top products from backlog + persona targets
      ├─ auto-find product reference photos
      ├─ Meshy Image→3D (smart-topology, low poly, ≤10MB)
      ├─ upload run to Firebase Storage
      └─ email you Approve / Reject links
3. You click Approve in Gmail
4. Cloud Function copies GLB → models/ and creates Firestore product
5. npm run dump-products   (refresh PRODUCTS.md)
```

Dry-runs (`--dry-run` / `--skip-meshy`) find images and can email a preview, but **cannot publish** (no GLB).

---

## Reference photos (auto-pick)

The factory searches for a Meshy-friendly **packshot** first (white/gray bg, cutout, 3⁄4 or front). It **penalizes** lit demos / rainbow LEDs / lifestyle “in use” shots — image-to-3D often turns glow into bumpy geometry. Neutral cues (`unlit`, `pads off`, `screen off`) get a soft boost; if nothing neutral ranks well, it falls back to the best packshot.

**Override any auto pick:** drop a file at `catalog/factory/refs/{product-id}.jpg` (local refs always win). Prefer unlit / even lighting when the gear has dense lit grids or bright screens.

---

## Where secrets live

| Secret | Where |
|--------|--------|
| `MESHY_API_KEY` | Project `.env` (+ GitHub Actions later) |
| `RESEND_API_KEY` | Project `.env` |
| `FACTORY_HMAC_SECRET` | Project `.env` **and** Firebase: `firebase functions:secrets:set FACTORY_HMAC_SECRET` |
| Storage bucket | Already in `.env` as `REACT_APP_FIREBASE_STORAGE_BUCKET=musicdeviceconnection.firebasestorage.app` |

Put keys in **`.env`** at the repo root (never commit it). Scripts load it automatically — you don’t need `export` in the terminal each time.

One-time Firebase login (same as dump-products):

```bash
gcloud auth application-default login
```

Deploy approve endpoint (once, and again if `factoryDecide` code changes):

```bash
cd functions && firebase deploy --only functions:factoryDecide
```

---

## Commands you’ll actually use

```bash
cd /Users/sebastianludmir/dev/MusicDeviceConnection

# Rank what’s missing in the catalog
npm run analyze-catalog

# Real weekly batch (Meshy credits + Storage upload + email)
npm run factory:week -- --limit 2

# Retry one failed product
npm run factory:week -- --ids novation-launchpad-x --no-analyze

# Manual Storage upload (usually automatic after a real run)
npm run factory:upload -- --run YYYY-MM-DD

# After you Approve something
npm run dump-products
```

---

## What the email shows

For each ready product:

- **Large image = Meshy 3D model thumbnail** (what you’re approving)  
- Small caption / optional source photo for context  
- File size, dims, why it was picked  
- **Approve** → publish to live catalog  
- **Reject** → leave it out  

Skipped items (QA / Meshy failures) appear in a **Skipped / needs retry** section.

---

## QA rules (why something gets skipped)

- GLB must be **≤ 10MB** (auto remesh ladder if oversized)  
- Reject obvious “cube vs long rectangle” proportion fails  
- Flat square gear (e.g. Launchpad) won’t fail on mid-axis noise  
- No GLB → no Approve button  

---

## Important folders

| Path | Role |
|------|------|
| `catalog/targets/*.json` | Persona “popular products” seed lists |
| `catalog/backlog/latest.json` | Ranked queue |
| `catalog/factory/refs/` | Cached product photos (auto-downloaded) |
| `catalog/factory/runs/YYYY-MM-DD/` | That week’s drafts + GLBs + digest.html |
| `scripts/factory/runFactoryWeek.js` | Orchestrator |
| `functions/factoryDecide.js` | Approve/Reject Cloud Function |

---

## Typical week (happy path)

1. `npm run factory:week -- --limit 5`  
2. Open email at **sebasludmir@gmail.com**  
3. Look at **3D previews** → Approve good ones, Reject bad ones  
4. Confirm in `/admin/products`  
5. `npm run dump-products` and commit `PRODUCTS.md` when you feel like it  

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Approve → “No such object … manifest.json” | Run wasn’t uploaded, or dry-run had no GLB. Use a real `factory:week` (no `--skip-meshy`). |
| Email only has product photo, not 3D | Older build; current emails prefer Meshy thumbnail. Re-run factory. |
| Launchpad / big GLB skipped | Remesh ladder should retry; or `npm run factory:week -- --ids …` |
| Blank image in email | Fixed (no more `file://`); re-run for CID-embedded / Meshy thumb. |
| Approve link expired | Links last 7 days; run factory again. |

---

## Out of scope (for now)

- Meshy website browser automation (we use the **API**)  
- Manual Blender resize every file (Meshy low-poly + size gate)  
- Publishing without your Approve click  
- More than 15 products per week  
