# Affiliate Strategy — Research & Application Plan

*Updated 2026-07-08. Owner: Sebastian. Status: pre-launch (no public traffic yet).*

## The model

- **Setups** (3D gear scenes) are open to everyone. Gear in a setup links out through affiliate links.
- Creators earn a **50/50 split** of affiliate commission with LiveSet on sales driven by their setups.
- **No affiliate program splits payments automatically.** All revenue lands in LiveSet's account; we attribute per-creator via SubID tracking and pay out their half ourselves.
- **LiveSet is the single publisher account** on every network. Creators do not hold their own affiliate accounts on the platform.
- Buyers receive **no incentive** (no cashback, rebates, discounts, or rewards for using Buy links). Standard retail price only.
- Attribution mechanism: append `creatorId-setupId` as the SubID on every outbound link (see retailer table below). Firebase UIDs are 28-char alphanumeric and fit all network limits.
- Existing plumbing: `products.affiliateUrl` (free-form, works with any program), `utils/affiliateLink.js` (link builder with per-retailer SubID injection), `affiliateClicks` Firestore ledger (click side of reconciliation), `/legal` affiliate disclosure page (required by every program — done).

### SubID params by retailer

| Retailer | Network | SubID param | Max len | Reporting |
|---|---|---|---|---|
| Amazon | Direct Associates | `ascsubtag` | 90 | Amazon earnings report |
| zZounds, Guitar Center, Musician's Friend | CJ Affiliate | `sid` | 64 | CJ transaction report |
| Reverb | Awin | `clickref` | 50 | Awin transaction report |
| Thomann | Clickfire (direct) | `subid` | 50 | Clickfire dashboard |
| Sweetwater | Impact Radius | `subId` | 50 | Impact reporting |

Implemented in `src/utils/affiliateLink.js`. `affiliateClicks` docs include a `retailer` field for reconciliation.

## Why not aggregators (Skimlinks / Sovrn)

Skimlinks was evaluated and **deprioritized** (application pending as of 2026-07-08; do not install the JS snippet):

1. **Wrong merchant mix** — Skimlinks' ~48k merchants skew general retail/lifestyle. LiveSet's catalog (Pioneer DJ, Allen & Heath, Sequential, etc.) lives on specialized music retailers that aggregators often don't cover.
2. **LiveSet already knows what it links to** — `products.affiliateUrl` per product is a better fit than a JS snippet that auto-affiliates unknown outbound links.
3. **Direct programs pay more** — 6% at zZounds/Guitar Center beats ~75% of an aggregator's rev-share on a lower base rate.
4. **Buy buttons use `window.open()`** — aggregator JS snippets intercept `<a>` clicks; our buy flow is programmatic and needs explicit link wrapping anyway.

Sovrn remains a **last-resort fallback** only if direct program applications fail across the board. Not pursuing unless needed.

## Program stack (direct retailers)

### Primary — apply now

| Program | Commission | Cookie | Network | Requirements |
|---|---|---|---|---|
| **zZounds** | 6% + volume bonuses (up to 80% at $10k/mo) | 45d | In-house or CJ | Active site + original content |
| **CJ Affiliate** | Varies per advertiser | Varies | CJ (network) | Free signup; per-advertiser approval inside CJ |
| **Guitar Center** | ~6% | 14d | CJ Affiliate | CJ membership + advertiser approval |
| **Musician's Friend** | Up to 8% | 45d | CJ Affiliate | CJ membership + advertiser approval |
| **Reverb** | 5% + $5/new buyer | 30d | Awin | Application review |

### Secondary — when traffic justifies it

| Program | Commission | Cookie | Network | Requirements |
|---|---|---|---|---|
| **Amazon Associates** | ~3% (instruments) | **24h** | Direct | 3 qualifying sales within 180 days |
| **Sweetwater** | ~5% | 30d | Impact Radius | Selective — pitch later; pro-audio fit |
| **Thomann** | 4.5% (creator tier) | 14d | Clickfire (direct) | **500 unique visitors/day or 5,000 social followers** |

### Amazon's role

Amazon is the **catalog-gap fallback**, not the primary program:

- Lowest rate (~3%), 24-hour cookie.
- `ascsubtag` works for per-creator attribution (appears in earnings reports).
- 3-sales-in-180-days rule means activating only when click volume exists.
- Search fallback in `affiliateLink.js` covers products without a direct `affiliateUrl`.

## zZounds compliance — creator revenue share

zZounds' affiliate agreement prohibits offering **buyers** consideration or incentives (cashback, rebates, rewards, discounts) for using affiliate links without prior written permission.

**LiveSet's model is compliant in structure:**

- Buyers pay standard retail price — no buyer-side incentive.
- Creators are compensated for content that drives sales, not for clicking links.
- LiveSet holds the single affiliate account; creator splits are internal attribution.

**Action required before first creator payout:**

Email zZounds affiliate support describing the platform model and confirming that internal creator revenue sharing (no buyer incentives) is permitted, or whether prior written approval is needed. Proceed with engineering and product URLs assuming approval; hold actual creator payouts until written confirmation.

**Do not:**

- Offer buyers cashback, points, or discounts tied to Buy links.
- Let creators hold separate zZounds affiliate accounts on the platform.
- Market to creators as "earn zZounds commission" — say "earn when your setups drive gear purchases."

## Traffic milestones — when to apply where

| Milestone | Metric | Action |
|---|---|---|
| **Now / soft launch** | 0 users | Apply to **zZounds** (in-house) + **CJ Affiliate** + **Reverb/Awin**. Seed `affiliateUrl` per product. Email zZounds re: creator split. |
| **Goal 1: "reviewable"** | **~100 unique visitors/day sustained (~3,000/mo)** + creators posting | Apply to **Guitar Center** + **Musician's Friend** inside CJ. Reapply if initially rejected. |
| **Goal 2: "conversion-ready"** | **~100+ outbound affiliate clicks/mo** | Activate **Amazon Associates** (3-sales rule becomes low-risk). |
| **Goal 3: "Thomann bar"** | **500 unique visitors/day (~15,000/mo)** | Apply to **Thomann** (Clickfire). |
| **Goal 4: "Sweetwater pitch"** | Established creator base + gear content | Pitch **Sweetwater** creator affiliate program (Impact). |

Instrument the site with analytics before CJ advertiser applications — reviewers and our own go/no-go decisions both need the numbers.

## Application walkthroughs

### zZounds (do now)
1. Apply at [zzounds.com/info/aff](https://www.zzounds.com/info/aff) — in-house program (low bar) or via CJ after CJ signup.
2. Requirements: active site, original content, disclosure page at `/legal`. LiveSet qualifies.
3. Paste real zZounds product URLs into `affiliateUrl` via Product Manager.
4. Links get `sid={creatorId-setupId}` appended automatically (CJ) or use in-house tracking codes from the dashboard.
5. Email affiliate support re: internal creator revenue share (see compliance section above).

### CJ Affiliate (do now)
1. Sign up at [signup.cj.com/member/signup/publisher/](https://signup.cj.com/member/signup/publisher/) (free).
2. Fill out the **network profile** thoroughly: "platform where DJs/producers showcase gear setups in 3D linked to performance video; purchase intent built into the product." List liveset.io.
3. Complete tax (W-9) + payment info (direct deposit, ~$50 min payout).
4. At Goal 1 traffic: apply to **Guitar Center** and **Musician's Friend** individually. Rejections aren't permanent.
5. Links carry `sid={creatorId-setupId}` for split attribution.
6. ⚠️ Publishers with zero commissions for ~6 months get deactivated — join the network now, but don't stress about advertiser approvals until traffic exists.

### Reverb / Awin (do now)
1. Sign up at [ui.awin.com](https://ui.awin.com) and apply to the Reverb (US) program.
2. 5% commission, 30-day cookie, DJ gear + synths + used/vintage.
3. Links carry `clickref={creatorId-setupId}`.
4. Good fit for creator culture and used-gear angle.

### Amazon Associates (at Goal 2)
1. Apply only after `/legal` is live on liveset.io and click volume exists.
2. Set `REACT_APP_AMAZON_ASSOC_TAG` in `.env` and deploy environment.
3. Search fallback already works; paste Amazon product URLs into `affiliateUrl` for high-intent products.
4. Payout reconciliation: group Amazon earnings report by `ascsubtag` column.

### Thomann (at Goal 3)
1. Register at [thomann.clickfire.de](https://thomann.clickfire.de).
2. Manual review, usually ~24h *if* the 500 uniques/day minimum is met.
3. Creator tier: 4.5%, 14-day cookie. Links carry `subid={creatorId-setupId}`.
4. Contact: affiliate@thomann.de.

### Sweetwater (at Goal 4)
1. Program on Impact Radius — selective, creator-focused.
2. Pitch LiveSet's model: creators showcase exact gear in 3D linked to performance video.
3. Links carry `subId={creatorId-setupId}`.

## Product URL seeding

Priority order when setting `affiliateUrl` per product in Product Manager:

1. **zZounds** — best DJ/producer catalog match for current products.
2. **Reverb** — used/vintage, synths, guitars.
3. **Guitar Center / Musician's Friend** — broad US catalog (once CJ-approved).
4. **Amazon** — fallback for anything not stocked elsewhere.
5. **Thomann** — EU audience (once approved).

Run `npm run dump-products` after bulk URL updates to refresh `PRODUCTS.md`.

## Payout reconciliation (manual phase)

1. **Click ledger** — `affiliateClicks` Firestore collection logs every Buy click with `creatorId`, `setupId`, `retailer`, `productId`.
2. **Commission reports** — pull monthly from each network, grouped by SubID param.
3. **Match** — join report SubIDs to `creatorId` (the prefix before `-` in `creatorId-setupId`).
4. **Pay creators** — 50% of attributed commission via PayPal above $25 threshold. No automated payout rails until manual handling hurts.

## Sources

- zZounds affiliate: zzounds.com/info/aff
- CJ publisher signup: signup.cj.com
- Reverb/Awin: ui.awin.com/merchant-profile/67144
- Thomann: thomann.clickfire.de, affiliate@thomann.de
- Amazon ascsubtag: affiliate-program.amazon.com/help/operating/policies#Associates Program IP License
- Guitar Center: CJ advertiser (search inside CJ dashboard)
- Sweetwater: Impact Radius (selective)
