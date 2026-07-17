# Catalog proposals

Versioned JSON proposals for affiliate-link validation and future product-ingestion workflows.

## Workflow

1. Run the audit (locally or via weekly automation):
   ```bash
   npm run audit-affiliate-links -- --dry-run
   npm run audit-affiliate-links -- --out catalog/proposals/YYYY-MM-DD-affiliate-audit.json
   ```
2. Review the generated proposal and open a PR with the JSON file.
3. After merge, GitHub Actions applies validated changes to Firestore.

Proposals must pass schema validation in `scripts/lib/proposalSchema.js`. Only approved purchase hosts and commerce fields are accepted.

## Proposal shape

```json
{
  "version": 1,
  "generatedAt": "2026-07-17T13:00:00.000Z",
  "runId": "2026-07-17-weekly-affiliate-audit",
  "summary": { "totalProducts": 20, "proposedChanges": 3 },
  "changes": [
    {
      "productId": "abc123",
      "productName": "CDJ-3000",
      "action": "update",
      "updates": {
        "purchaseUrl": "https://www.zzounds.com/item--PIOCDJ3000",
        "commerceStatus": "monetized",
        "commerceRetailer": "cj",
        "commerceAvailability": "in_stock",
        "commerceValidatedAt": "2026-07-17T13:00:00.000Z",
        "commerceValidationReason": "http_200"
      },
      "evidence": { "checkedUrl": "...", "httpStatus": 200 }
    }
  ]
}
```

Changes marked `review_required` are skipped by the apply workflow unless explicitly overridden.
