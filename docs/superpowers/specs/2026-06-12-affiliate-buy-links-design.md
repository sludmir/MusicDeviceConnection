# Affiliate Buy Links + Creator Attribution — Design

Date: 2026-06-12
Status: Approved approach (Approach A), pending spec review

## Goal

Start generating revenue from the existing 3D builder by adding a "Buy" action to
placed devices that opens an Amazon affiliate link, and lay the attribution
groundwork so creators can later be paid a share of commissions their setups
drive. Also ship the public-facing pages Amazon Associates requires for
application approval.

Out of scope (future projects): public logged-out browsing, automated payout
rails (Stripe Connect), other retailers' affiliate programs, admin payout
dashboard.

## Background / constraints

- The owner is creating an Amazon Associates account (no account exists yet).
  The tracking tag (e.g. `liveset0a-20`) becomes available at signup and is
  configured via env var — no code change needed when it arrives.
- Amazon requires: a visible affiliate disclosure, a privacy policy, and a
  publicly reviewable site. The app is currently fully auth-gated
  (`App.js` renders only a sign-in header when logged out), so the legal page
  must be reachable without signing in.
- Amazon kill rules to respect: 3 qualifying sales within 180 days; no
  self-purchases; links must not be cloaked/shortened.
- Many products won't be on Amazon. The design stores a plain URL per product
  so other retailers' links work later with no schema change.

## Architecture overview

Four pieces:

1. **Link builder** — `src/utils/affiliateLink.js`, a pure utility that turns
   `(product, attribution)` into a final URL.
2. **Buy UI** — a Buy button in `DeviceHoverMenu` (third button beside
   Swap/Remove) and a fuller Buy button in the device mini-profile panel in
   `ThreeScene.js`.
3. **Attribution + click ledger** — App-level "whose setup is this" context,
   logged to a new `affiliateClicks` Firestore collection on every Buy click.
4. **Public legal page** — `/legal` route with affiliate disclosure + privacy
   policy, reachable logged out.

## 1. Link builder (`src/utils/affiliateLink.js`)

```
buildAffiliateUrl(product, attribution) -> string | null
```

- If `product.affiliateUrl` is set: use it as the base. If it is an
  `amazon.*` URL, ensure `tag=<ASSOC_TAG>` and `ascsubtag=<subtag>` query
  params are present (add or overwrite). Non-Amazon URLs are returned as-is.
- Else: build an Amazon search link
  `https://www.amazon.com/s?k=<brand+name>&tag=<ASSOC_TAG>&ascsubtag=<subtag>`
  so every product is monetized from day one.
- `ASSOC_TAG` comes from `REACT_APP_AMAZON_ASSOC_TAG` in `.env`. If unset,
  links are still built (without `tag`) and a console warning fires — the
  button never breaks the UX.
- Subtag format: `<creatorId>-<setupId>`, characters outside `[A-Za-z0-9-]`
  stripped, truncated to 90 chars, omitted entirely when there is no
  attributed creator. (`ascsubtag` is Amazon's sub-tracking parameter and
  appears in earnings reports; verify it shows up after the first real
  clicks. Fallback if it doesn't: Amazon allows up to 100 tracking IDs per
  account — one per top creator.)
- Unit-tested: tagged Amazon URL passthrough, tag injection, search fallback,
  subtag sanitization, missing env tag.

## 2. Buy UI

**DeviceHoverMenu** (`src/components/DeviceHoverMenu.js`): add a third button
(cart icon, `aria-label="Buy"`) before Swap/Remove, wired to a new `onBuy`
prop. Styling follows the existing `dhm-btn` pattern with a distinct accent
color.

**Mini-profile panel** (`ThreeScene.js`, the panel showing name/price on device
click): a prominent button — label "Buy on Amazon ↗" when the link is an
Amazon link or search fallback, otherwise "Buy ↗". Below it, a one-line
caption: "Affiliate link — purchases support LiveSet and this creator." (drop
"and this creator" when there is no attributed creator).

**Click behavior (both buttons):** call `window.open(url, '_blank',
'noopener')` synchronously in the click handler (popup blockers kill async
opens), then fire-and-forget the Firestore click log. A logging failure never
blocks or errors the purchase flow.

**Product Manager form** (`ProductManagerForm.js`): new optional text field
"Affiliate link (paste tagged Amazon product URL)" persisted as
`affiliateUrl` on the product document.

## 3. Attribution + click ledger

**Attribution context.** `App.js` tracks `affiliateAttribution: { creatorId,
setupId } | null` alongside the selected setup. It is set whenever a setup is
loaded whose `ownerId !== auth.currentUser.uid` — i.e. "Copy Setup" from a
feed clip or opening a setup from someone else's profile. It is `null` for
the user's own setups and cleared when switching to one. Passed down to
`ThreeScene` as a prop and through to the buy handlers.

**`affiliateClicks` collection.** One doc per Buy click:

| Field | Value |
|---|---|
| `productId` / `productName` | the clicked product |
| `creatorId` | attributed creator uid, or `null` |
| `setupId` | the loaded setup id, or `null` |
| `clickerUid` | `auth.currentUser.uid` |
| `source` | `'hover-menu'` or `'mini-profile'` |
| `urlKind` | `'product-link'` or `'search-fallback'` |
| `createdAt` | `serverTimestamp()` |

**Firestore rules:** `affiliateClicks` allows `create` for signed-in users with
field validation (string types, `clickerUid == request.auth.uid`); `read`,
`update`, `delete` only for the admin claim. The whole app is auth-gated
today, so no unauthenticated path is needed yet; revisit when public browsing
ships.

This ledger plus the Amazon report's `ascsubtag` column is the payout source
of truth. Payouts are manual in this phase: monthly, group the Amazon
earnings report by subtag, pay each creator their share (owner-chosen %, e.g.
50% of commission) via PayPal above a $25 threshold. No payout code is built
until manual handling hurts.

## 4. Public legal page

New route `/legal` rendering `src/components/LegalPage.js`: affiliate
disclosure ("As an Amazon Associate, LiveSet earns from qualifying
purchases."), a plain-English privacy policy (Google sign-in, Firebase
storage of profiles/sets/videos, affiliate click logging, contact email), and
a short "what is LiveSet" blurb so Amazon's reviewer sees real content.

Routing: the route must render for logged-out visitors, so it is handled
before the `if (!user)` gate in `App.js` (the gate currently returns early
for every path). The logged-out header and the hub footer both link to it.
Apply to Amazon Associates only after this page is deployed to liveset.io.

## Error handling summary

- Missing env tag → untagged link + console warning, button still works.
- Firestore log failure → swallowed (console.warn), purchase tab already open.
- Product with no name/brand → search fallback uses whatever exists; button
  hidden only if there is literally nothing to search on.

## Testing

- Jest unit tests for `affiliateLink.js` (the only pure logic).
- Manual verification: hover-menu and mini-profile buttons open correct URLs
  in a new tab; `affiliateClicks` docs appear with correct attribution after
  Copy Setup; `/legal` renders logged out; Product Manager saves
  `affiliateUrl`.
