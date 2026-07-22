---
name: catalog-scout
description: >-
  Inspects the LiveSet product factory queue and catalog gaps. Use when the user
  asks what products to add next, to scout DJ/producer/guitar gear, or mentions
  analyze-catalog / factory:week. Images are auto-searched by the factory.
---

# Catalog scout (Product Factory)

Helps with the **LiveSet Product Factory**. Full guide: `catalog/factory/PROCESS.md`.

The factory **auto-finds** product photos and emails **Meshy 3D model previews** for Approve/Reject.

## Workflow

1. `npm run analyze-catalog`
2. Read `catalog/backlog/latest.json`
3. Recommend ≤15 picks (balance `guitar-rig`, `studio-producer`, `accessible-dj`)
4. Run or suggest:
   ```bash
   npm run factory:week -- --dry-run --limit 3   # verifies image search
   npm run factory:week -- --limit 5             # spends Meshy credits
   npm run factory:upload -- --run YYYY-MM-DD
   ```
5. Remind: approve via email links only.

## Image policy

Prefer auto-search scores that reward packshots / cutouts, boost neutral geometry (`unlit`, pads/screen off), and penalize Meshy traps (rainbow demos, lit pads, lifestyle). Override by placing `catalog/factory/refs/{id}.jpg` or `referenceImageUrl` on a target.
