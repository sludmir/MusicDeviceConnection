# Affiliate Strategy — Research & Application Plan

*Researched 2026-07-03. Owner: Sebastian. Status: pre-launch (no public traffic yet).*

## The model

- **Setups** (3D gear scenes) are open to everyone. Gear in a setup links out through affiliate links.
- Creators earn a **50/50 split** of affiliate commission with LiveSet on sales driven by their setups.
- **No affiliate program splits payments automatically.** All revenue lands in LiveSet's account; we attribute per-creator via SubID tracking and pay out their half ourselves.
- Attribution mechanism: append the creator's Firebase UID as the SubID on every outbound link
  (`sid=` on CJ, `xcust=` on Skimlinks, `cuid=` on Sovrn — all accept short alphanumeric strings; Firebase UIDs are 28-char alphanumeric, so they fit everywhere).
- Existing plumbing: `products.affiliateUrl` (free-form, works with any program), `utils/affiliateLink.js` (link builder — needs SubID support added), `affiliateClicks` Firestore ledger (click side of reconciliation), `/legal` affiliate disclosure page (required by every program — done).

## Program comparison

### Direct programs (higher rates, higher bar)

| Program | Commission | Cookie | Network | Requirements |
|---|---|---|---|---|
| Guitar Center | ~6% | ~14d | CJ Affiliate | CJ membership + per-advertiser approval |
| zZounds | 6% + volume bonuses (up to 80% bonus at $10k/mo) | 45d | In-house or CJ | Application review |
| Thomann | 4.5% (creator tier) | 14d | Own program (Clickfire platform) | **Hard minimum: 500 unique visitors/day or 5,000 social followers** |
| Sweetwater | Reports conflict — up to 8% *or* $0.07/click | 30d | Own program | Verify terms directly when applying |
| Amazon Associates | ~3% (instruments) | **24h** | Direct | **3 qualifying sales within 180 days or account closed** |

### Aggregators (lower rates, zero bar — the "day one" option)

| | Skimlinks | Sovrn Commerce (ex-VigLink) | Amazon Associates |
|---|---|---|---|
| Merchant coverage | ~48,500 merchants across 50+ networks | ~30,000 merchants | Amazon only |
| Your cut | ~75% of commission (they keep ~25%); VIP negotiated rates often *beat* direct rates | Similar rev-share; generally earns less than direct programs | 100% of a low rate (~3% instruments) |
| Cookie | Underlying merchant's cookie (14–45d for gear retailers) | Underlying merchant's cookie | 24 hours |
| Per-creator SubID | ✅ `xcust` (≤50 chars alphanumeric, documented API + reporting) | ✅ `cuid` | ❌ account-level tracking IDs only (capped, clunky per-creator) |
| Approval | Application review, lenient for real content sites | Easiest approval of the three | Easy to join, but the 3-sales/180-day rule effectively requires traffic |
| Payout terms | Slow (~net-90), ~$65 minimum | Slow (~net-60/90) | Net-60, $10 min |
| Integration | JS snippet auto-affiliates links, or Link API for server-side wrapping | JS snippet or API | Manual tagged links |

### Verdict: Amazon vs Sovrn vs Skimlinks

**Skimlinks** is the best fit for LiveSet's bridge period:

1. **Biggest merchant coverage** (~48.5k vs Sovrn's ~30k) — the music-gear retailers we care about (Guitar Center, zZounds, etc.) are reachable through it.
2. **`xcust` SubID is well-documented** with a reporting API — this is the exact mechanism the 50/50 creator split needs, and it maps 1:1 to what we'd later do with CJ's `sid`.
3. **Negotiated "VIP" rates** often exceed what small publishers get applying directly, which partially offsets the ~25% platform cut.

**Sovrn** is the fallback if Skimlinks rejects the application (Sovrn approves almost anyone) — functionally similar, smaller catalog, comparable economics.

**Amazon is the worst of the three right now**: lowest rate, 24-hour cookie, no per-creator SubID (breaks the split model), and the 3-sales/180-day rule means applying pre-traffic risks account closure. Keep the pending signup on ice until traffic exists; revisit for catalog gaps the others don't cover.

**Migration plan:** launch on Skimlinks → once traffic milestones hit (below), apply to CJ + Thomann direct → swap `affiliateUrl`s per product to direct links (higher rates), keep Skimlinks for long-tail merchants.

## Traffic milestones — when to apply where

| Milestone | Metric | Action |
|---|---|---|
| **Now / soft launch** | 0 users | Apply to **Skimlinks** (Sovrn as fallback). Add SubID support to `affiliateLink.js`. Ship public landing page so reviewers see a real site. |
| **Goal 1: “reviewable”** | **~100 unique visitors/day sustained (~3,000/mo)** + creators actively posting | Apply to **CJ Affiliate** → then Guitar Center + zZounds inside CJ. Public browse pages should exist so advertiser reviewers can evaluate without sign-in. |
| **Goal 2: “conversion-ready”** | **~100+ outbound affiliate clicks/mo** | Activate **Amazon Associates** (3 sales in 180 days becomes low-risk). |
| **Goal 3: “Thomann bar”** | **500 unique visitors/day (~15,000/mo)** | Apply to **Thomann** (hard minimum; manual review, ~24h turnaround). |

Instrument the site with analytics *before* the CJ application — reviewers and our own go/no-go decisions both need the numbers.

## Application walkthroughs

### Skimlinks (do now)
1. Apply at skimlinks.com — site URL (liveset.io), description, monetization method.
2. Review is manual but lenient; a real, browsable site with a disclosure page passes. (The public landing page matters here.)
3. Integrate: either the JS snippet (auto-affiliates any merchant link on the page) or — better for us — the **Link API** to wrap `affiliateUrl`s server-side/client-side with `xcust={creatorUid}`.
4. Reporting API returns commissions segmented by `xcust` → that's the payout basis for the creator split.

### CJ Affiliate (at Goal 1)
1. Sign up at signup.cj.com/member/signup/publisher/ (free) — email verification, account details.
2. Fill out the **network profile** thoroughly (this is what advertisers see): describe LiveSet concretely — "platform where DJs/producers showcase gear setups in 3D linked to performance video; purchase intent built into the product." List liveset.io as the property.
3. Complete tax (W-9) + payment info (direct deposit, ~$50 min payout).
4. Advertisers tab → apply to **Guitar Center** and **zZounds** individually. Rejections aren't permanent; reapply as traffic grows.
5. Links carry `sid={creatorUid}` for split attribution.
6. ⚠️ Publishers with zero commissions for ~6 months get deactivated — don't join before there's traffic to convert.

### Thomann (at Goal 3)
1. Register at thomann.clickfire.de (their Clickfire affiliate platform).
2. Manual review, usually activated within 24h *if* the 500 uniques/day minimum is met.
3. Creator tier: 4.5%, 14-day cookie, first-party + server tracking; reporting through Clickfire.
4. Contact: affiliate@thomann.de.

## Sources

- Skimlinks xcust / SubID: support.skimlinks.com (CustomID article), developers.skimlinks.com/link.html
- Skimlinks vs Sovrn coverage: wappalyzer.com/compare/skimlinks-vs-sovrn-commerce, wmtips.com
- CJ publisher signup: signup.cj.com; program overview: smartblogger.com CJ guide
- Thomann: thomannmusic.com affiliate FAQ, thomann.clickfire.de, intercom.help/clickfire policy
- Guitar Center: commissiondex.com/program/guitar-center
- zZounds: zzounds.com/info/aff
