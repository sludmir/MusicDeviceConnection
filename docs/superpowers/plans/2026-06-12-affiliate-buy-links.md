# Affiliate Buy Links + Creator Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Buy button (Amazon affiliate link) to placed devices in the 3D builder, log every click with creator attribution to Firestore, and ship the public legal page Amazon Associates requires.

**Architecture:** A pure link-builder utility (`src/utils/affiliateLink.js`) turns `(product, attribution)` into a tagged Amazon URL (per-product `affiliateUrl` override, search fallback otherwise). App.js tracks whose setup is loaded (`affiliateAttribution`) and passes it to ThreeScene, which wires Buy buttons in the device hover menu and the mini-profile panel. Clicks are fire-and-forget logged to a new `affiliateClicks` collection. A `/legal` page renders even when logged out.

**Tech Stack:** React 18 (CRA), Firebase Firestore, Jest + React Testing Library (`npm test`, colocated `*.test.js` files).

**Spec:** `docs/superpowers/specs/2026-06-12-affiliate-buy-links-design.md`

**Deviation from spec (recorded):** the link builder exports `buildBuyLink(product, attribution) -> { url, urlKind, isAmazon } | null` instead of a bare string, because callers need `urlKind` for the click ledger and `isAmazon` for the button label.

**Test command pattern:** `CI=true npm test -- --watchAll=false --testPathPattern=<name>` (short single-file runs only; never run the full build).

---

### Task 1: Link builder utility

**Files:**
- Create: `src/utils/affiliateLink.js`
- Test: `src/utils/affiliateLink.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/affiliateLink.test.js
import { buildBuyLink, buildSubtag } from './affiliateLink';

describe('buildSubtag', () => {
  test('joins creatorId and setupId with a hyphen', () => {
    expect(buildSubtag({ creatorId: 'abc123', setupId: 'set456' })).toBe('abc123-set456');
  });

  test('returns empty string with no creator', () => {
    expect(buildSubtag(null)).toBe('');
    expect(buildSubtag({ creatorId: null, setupId: 'set456' })).toBe('');
  });

  test('strips unsafe characters and truncates to 90 chars', () => {
    const sub = buildSubtag({ creatorId: 'a$b c!', setupId: 'x'.repeat(200) });
    expect(sub).toMatch(/^[A-Za-z0-9-]+$/);
    expect(sub.length).toBeLessThanOrEqual(90);
  });
});

describe('buildBuyLink', () => {
  const OLD_ENV = process.env.REACT_APP_AMAZON_ASSOC_TAG;
  beforeEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = 'liveset-20'; });
  afterEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = OLD_ENV; });

  test('builds Amazon search fallback when product has no affiliateUrl', () => {
    const link = buildBuyLink({ name: 'CDJ-3000', brand: 'Pioneer DJ' }, null);
    const url = new URL(link.url);
    expect(url.hostname).toBe('www.amazon.com');
    expect(url.pathname).toBe('/s');
    expect(url.searchParams.get('k')).toBe('Pioneer DJ CDJ-3000');
    expect(url.searchParams.get('tag')).toBe('liveset-20');
    expect(link.urlKind).toBe('search-fallback');
    expect(link.isAmazon).toBe(true);
  });

  test('adds tag and ascsubtag to an Amazon product URL', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.amazon.com/dp/B08F2ND1?th=1' },
      { creatorId: 'creator1', setupId: 'setup9' }
    );
    const url = new URL(link.url);
    expect(url.searchParams.get('tag')).toBe('liveset-20');
    expect(url.searchParams.get('ascsubtag')).toBe('creator1-setup9');
    expect(url.searchParams.get('th')).toBe('1');
    expect(link.urlKind).toBe('product-link');
  });

  test('returns non-Amazon affiliateUrl untouched', () => {
    const raw = 'https://www.thomann.de/intl/pioneer_cdj_3000.htm?partner=xyz';
    const link = buildBuyLink({ name: 'CDJ-3000', affiliateUrl: raw }, { creatorId: 'c', setupId: 's' });
    expect(link.url).toBe(raw);
    expect(link.isAmazon).toBe(false);
    expect(link.urlKind).toBe('product-link');
  });

  test('omits ascsubtag when there is no attribution', () => {
    const link = buildBuyLink({ name: 'CDJ-3000', affiliateUrl: 'https://www.amazon.com/dp/B08F2N' }, null);
    expect(new URL(link.url).searchParams.get('ascsubtag')).toBeNull();
  });

  test('still builds a link without env tag (no tag param)', () => {
    delete process.env.REACT_APP_AMAZON_ASSOC_TAG;
    const link = buildBuyLink({ name: 'CDJ-3000', brand: 'Pioneer DJ' }, null);
    expect(new URL(link.url).searchParams.get('tag')).toBeNull();
  });

  test('returns null when product has no name, brand, or url', () => {
    expect(buildBuyLink({}, null)).toBeNull();
    expect(buildBuyLink(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=affiliateLink`
Expected: FAIL — "Cannot find module './affiliateLink'"

- [ ] **Step 3: Write the implementation**

```js
// src/utils/affiliateLink.js
// Builds outbound purchase links. Amazon links carry the Associates tag plus
// an ascsubtag with creator attribution so sales can be matched to creators
// in the Amazon earnings report.

function getAssocTag() {
  return process.env.REACT_APP_AMAZON_ASSOC_TAG || '';
}

export function buildSubtag(attribution) {
  if (!attribution || !attribution.creatorId) return '';
  const raw = [attribution.creatorId, attribution.setupId].filter(Boolean).join('-');
  return raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, 90);
}

function isAmazonHost(hostname) {
  return /(^|\.)amazon\.[a-z.]{2,}$/i.test(hostname);
}

export function buildBuyLink(product, attribution) {
  if (!product) return null;
  const subtag = buildSubtag(attribution);
  const tag = getAssocTag();
  if (!tag) console.warn('REACT_APP_AMAZON_ASSOC_TAG is not set — affiliate links are untagged');

  if (product.affiliateUrl) {
    let url;
    try {
      url = new URL(product.affiliateUrl);
    } catch (e) {
      return { url: product.affiliateUrl, urlKind: 'product-link', isAmazon: false };
    }
    if (!isAmazonHost(url.hostname)) {
      return { url: product.affiliateUrl, urlKind: 'product-link', isAmazon: false };
    }
    if (tag) url.searchParams.set('tag', tag);
    if (subtag) url.searchParams.set('ascsubtag', subtag);
    return { url: url.toString(), urlKind: 'product-link', isAmazon: true };
  }

  const query = [product.brand, product.name].filter(Boolean).join(' ').trim();
  if (!query) return null;
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (tag) url.searchParams.set('tag', tag);
  if (subtag) url.searchParams.set('ascsubtag', subtag);
  return { url: url.toString(), urlKind: 'search-fallback', isAmazon: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=affiliateLink`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/affiliateLink.js src/utils/affiliateLink.test.js
git commit -m "feat: affiliate link builder with Amazon tag and creator subtag"
```

---

### Task 2: Click ledger utility

**Files:**
- Create: `src/utils/affiliateClicks.js`
- Test: `src/utils/affiliateClicks.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/affiliateClicks.test.js
import { buildClickPayload } from './affiliateClicks';

describe('buildClickPayload', () => {
  test('fills all ledger fields', () => {
    const payload = buildClickPayload({
      product: { id: 'p1', name: 'CDJ-3000' },
      attribution: { creatorId: 'c1', setupId: 's1' },
      clickerUid: 'u1',
      source: 'mini-profile',
      urlKind: 'product-link',
    });
    expect(payload).toEqual({
      productId: 'p1',
      productName: 'CDJ-3000',
      creatorId: 'c1',
      setupId: 's1',
      clickerUid: 'u1',
      source: 'mini-profile',
      urlKind: 'product-link',
    });
  });

  test('nulls attribution fields when absent', () => {
    const payload = buildClickPayload({
      product: { id: 'p1', name: 'CDJ-3000' },
      attribution: null,
      clickerUid: 'u1',
      source: 'hover-menu',
      urlKind: 'search-fallback',
    });
    expect(payload.creatorId).toBeNull();
    expect(payload.setupId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=affiliateClicks`
Expected: FAIL — "Cannot find module './affiliateClicks'"

- [ ] **Step 3: Write the implementation**

```js
// src/utils/affiliateClicks.js
// Fire-and-forget ledger of Buy clicks. This collection plus the ascsubtag
// column in the Amazon earnings report is the source of truth for creator
// payouts (manual in this phase).
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export function buildClickPayload({ product, attribution, clickerUid, source, urlKind }) {
  return {
    productId: product?.id ?? null,
    productName: product?.name ?? '',
    creatorId: attribution?.creatorId ?? null,
    setupId: attribution?.setupId ?? null,
    clickerUid: clickerUid ?? null,
    source,
    urlKind,
  };
}

export function logAffiliateClick(db, payload) {
  if (!db) return Promise.resolve();
  return addDoc(collection(db, 'affiliateClicks'), { ...payload, createdAt: serverTimestamp() })
    .catch((err) => console.warn('Affiliate click log failed:', err));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=affiliateClicks`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/affiliateClicks.js src/utils/affiliateClicks.test.js
git commit -m "feat: affiliate click ledger payload builder and logger"
```

---

### Task 3: Firestore rules for `affiliateClicks`

**Files:**
- Modify: `firestore.rules` (add a match block alongside the existing collections, e.g. after the `products` block)

- [ ] **Step 1: Add the rules block**

Inside `match /databases/{database}/documents { ... }`, after the `products` block:

```
    // Affiliate click ledger: clients append, only admin reads
    match /affiliateClicks/{clickId} {
      allow create: if isSignedIn()
        && request.resource.data.clickerUid == request.auth.uid
        && request.resource.data.productName is string
        && request.resource.data.source in ['hover-menu', 'mini-profile'];
      allow read, update, delete: if isSignedIn() && request.auth.token.admin == true;
    }
```

- [ ] **Step 2: Validate rules compile**

Run: `npx firebase deploy --only firestore:rules --project $(grep -o '"default": *"[^"]*"' .firebaserc | cut -d'"' -f4) 2>&1 | tail -3`
Expected: "Deploy complete!" (rules syntax errors abort before deploy). If the engineer prefers not to deploy mid-feature, defer this command to the final task and just eyeball the syntax here.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore rules for affiliateClicks ledger"
```

---

### Task 4: Attribution state in App.js + env var

**Files:**
- Modify: `src/App.js` (state near line 94, AppRoutes props near lines 243–296, handlers at lines 317–348, ThreeScene render near line 573)
- Modify: `.env` (add `REACT_APP_AMAZON_ASSOC_TAG`)

- [ ] **Step 1: Add state in the outer `App` component**

Next to `const [selectedSetup, setSelectedSetup] = useState(null);` (line ~94):

```js
  // { creatorId, setupId } when the loaded setup belongs to someone else; null otherwise
  const [affiliateAttribution, setAffiliateAttribution] = useState(null);
```

- [ ] **Step 2: Thread through AppRoutes**

Pass `affiliateAttribution={affiliateAttribution}` and `setAffiliateAttribution={setAffiliateAttribution}` in the `<AppRoutes ...>` render (line ~243), and add both to the `AppRoutes` destructured props (line ~272).

- [ ] **Step 3: Set/clear in the three handlers**

In `handleSetupSelectFromLanding` (line ~325), after `setLoadedSetupName(...)`:

```js
    const viewerUid = auth.currentUser?.uid;
    if (setup.ownerId && viewerUid && setup.ownerId !== viewerUid) {
      setAffiliateAttribution({ creatorId: setup.ownerId, setupId: setup.id ?? null });
    } else {
      setAffiliateAttribution(null);
    }
```

In `handleNewSetupFromLanding` (line ~338) and `handleLogoClick` (line ~317), add `setAffiliateAttribution(null);`.

Verify `auth` is imported in App.js (it is used at line ~516: `auth.currentUser?.uid`).

- [ ] **Step 4: Pass to ThreeScene**

In the `/builder` route's `<ThreeScene ...>` (line ~573), add:

```js
                      affiliateAttribution={affiliateAttribution}
```

- [ ] **Step 5: Add env var**

Run: `grep -q REACT_APP_AMAZON_ASSOC_TAG .env 2>/dev/null || printf '\n# Amazon Associates tracking tag (set after Associates signup, then rebuild)\nREACT_APP_AMAZON_ASSOC_TAG=\n' >> .env`
Expected: `.env` contains the new key (empty until the Amazon account exists — links work untagged meanwhile).

- [ ] **Step 6: Sanity check + commit**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=AppShell`
Expected: PASS (existing shell tests unaffected).

```bash
git add src/App.js
git commit -m "feat: track affiliate attribution for setups loaded from other creators"
```

(`.env` is gitignored — do not commit it.)

---

### Task 5: Buy button in ThreeScene mini-profile panel

**Files:**
- Modify: `src/ThreeScene.js` — props (line 50), a `handleBuyClick` helper, and the Purchase block (lines 4745–4752, currently "Link to purchase (coming soon)")

- [ ] **Step 1: Accept the prop**

Line 50, add `affiliateAttribution` to the destructured props:

```js
function ThreeScene({ devices, isInitialized, setupType, setting, onDevicesChange, onCategoryToggle, initialCameraAngles, onCameraAnglesChange, theme, affiliateAttribution }) {
```

- [ ] **Step 2: Add imports and the click handler**

Add to the imports from `./utils/...`:

```js
import { buildBuyLink } from './utils/affiliateLink';
import { buildClickPayload, logAffiliateClick } from './utils/affiliateClicks';
```

Define near the other handlers (e.g. just above the `return`):

```js
    const handleBuyClick = (device, source) => {
        const link = buildBuyLink(device, affiliateAttribution);
        if (!link) return;
        // window.open must run synchronously in the click handler or popup
        // blockers eat it; the ledger write is fire-and-forget afterwards.
        window.open(link.url, '_blank', 'noopener');
        logAffiliateClick(db, buildClickPayload({
            product: device,
            attribution: affiliateAttribution,
            clickerUid: auth?.currentUser?.uid || null,
            source,
            urlKind: link.urlKind,
        }));
    };
```

(`db` and `auth` are already imported at the top of ThreeScene.js.)

- [ ] **Step 3: Replace the placeholder Purchase block**

Replace lines 4745–4752 (the `<span>Purchase</span>` block with the "coming soon" button) with:

```jsx
                                <div>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purchase</span>
                                    <div style={{ marginTop: '6px' }}>
                                        {(() => {
                                            const link = buildBuyLink(miniProfileDevice, affiliateAttribution);
                                            if (!link) return <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No purchase link available</span>;
                                            return (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBuyClick(miniProfileDevice, 'mini-profile')}
                                                        style={{
                                                            display: 'block', width: '100%', padding: '10px 12px',
                                                            background: '#ff9900', border: 'none', borderRadius: '8px',
                                                            color: '#111', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                                                        }}
                                                    >
                                                        {link.isAmazon ? 'Buy on Amazon ↗' : 'Buy ↗'}
                                                    </button>
                                                    <div style={{ marginTop: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                                                        Affiliate link — purchases support LiveSet{affiliateAttribution?.creatorId ? ' and this creator' : ''}.
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
```

- [ ] **Step 4: Manual verification**

ThreeScene has no unit tests (WebGL). Verify via dev server (`npm start`, user-run if it hangs): place a device, click it to open the mini-profile, click Buy — an Amazon tab opens (search fallback since no `affiliateUrl` is set yet) and an `affiliateClicks` doc appears in the Firestore console with `creatorId: null`.

- [ ] **Step 5: Commit**

```bash
git add src/ThreeScene.js
git commit -m "feat: Buy button with affiliate link in device mini-profile panel"
```

---

### Task 6: Buy button in DeviceHoverMenu

**Files:**
- Modify: `src/components/DeviceHoverMenu.js`
- Modify: `src/components/DeviceHoverMenu.css`
- Modify: `src/ThreeScene.js` (the `<DeviceHoverMenu ...>` render at line ~4938)
- Test: `src/components/DeviceHoverMenu.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the existing `describe` in `src/components/DeviceHoverMenu.test.js`:

```js
  test('shows buy button when onBuy provided', () => {
    render(
      <DeviceHoverMenu
        device={{ uniqueId: 'd1', name: 'CDJ-3000' }}
        screenPosition={{ x: 0, y: 0 }}
        onRemove={()=>{}} onSwap={()=>{}} onClose={()=>{}} onBuy={()=>{}}
      />
    );
    expect(screen.getByLabelText(/buy/i)).toBeInTheDocument();
  });

  test('clicking buy calls onBuy with device', () => {
    const onBuy = jest.fn();
    const device = { uniqueId: 'd1', name: 'CDJ-3000' };
    render(
      <DeviceHoverMenu device={device} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={()=>{}} onClose={()=>{}} onBuy={onBuy} />
    );
    fireEvent.click(screen.getByLabelText(/buy/i));
    expect(onBuy).toHaveBeenCalledWith(device);
  });

  test('hides buy button when onBuy not provided', () => {
    render(
      <DeviceHoverMenu device={{ uniqueId: 'd1', name: 'CDJ-3000' }} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={()=>{}} onClose={()=>{}} />
    );
    expect(screen.queryByLabelText(/buy/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=DeviceHoverMenu`
Expected: 4 existing PASS, 3 new FAIL ("Unable to find a label with the text of: /buy/i")

- [ ] **Step 3: Implement**

In `src/components/DeviceHoverMenu.js`, add `onBuy` to the props and insert before the Swap button inside `.dhm-actions`:

```jsx
          {onBuy && (
            <button
              className="dhm-btn dhm-buy"
              aria-label="Buy product"
              title="Buy"
              onClick={() => onBuy(device)}
            >
              🛒
            </button>
          )}
```

In `src/components/DeviceHoverMenu.css`, after the `.dhm-swap` rules:

```css
.dhm-buy { color: #ff9900; font-size: 14px; }
.dhm-buy:hover { background: #3a2d15; border-color: #ff9900; }
```

In `src/ThreeScene.js` at the `<DeviceHoverMenu ...>` render (line ~4938), add:

```jsx
                    onBuy={(d) => {
                        handleBuyClick(d, 'hover-menu');
                        setMenuDevice(null);
                    }}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=DeviceHoverMenu`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/DeviceHoverMenu.js src/components/DeviceHoverMenu.css src/components/DeviceHoverMenu.test.js src/ThreeScene.js
git commit -m "feat: Buy button in device hover menu"
```

---

### Task 7: `affiliateUrl` field in Product Manager

**Files:**
- Modify: `src/productManager.js` (`DEFAULT_PRODUCT_TEMPLATE`)
- Modify: `src/ProductManagerForm.js` (after the price field, line ~388)

- [ ] **Step 1: Add to the template**

In `DEFAULT_PRODUCT_TEMPLATE` in `src/productManager.js`, next to `imageUrl`:

```js
  affiliateUrl: '',
```

- [ ] **Step 2: Add the form field**

In `src/ProductManagerForm.js`, after the price/locationPriority row (line ~392), following the existing form-group markup pattern:

```jsx
              <div className="form-group">
                <label>Affiliate link (optional)</label>
                <input
                  type="url"
                  value={formData.affiliateUrl || ''}
                  onChange={(e) => handleInputChange('affiliateUrl', e.target.value.trim())}
                  placeholder="Paste tagged Amazon product URL (falls back to Amazon search if empty)"
                />
              </div>
```

`handleSubmit` already spreads `...formData` (line ~266), so the field persists with no save-path change. Old products without the field fall back to the search link via `buildBuyLink`.

- [ ] **Step 3: Manual verification**

In the dev server: Admin → Product Dashboard → edit a product → paste an Amazon URL → save → reopen the product and confirm the field round-trips. Then in the builder, that product's Buy button opens the pasted URL (with `tag` appended once the env var is set).

- [ ] **Step 4: Commit**

```bash
git add src/productManager.js src/ProductManagerForm.js
git commit -m "feat: affiliateUrl field on products, editable in Product Manager"
```

---

### Task 8: Public legal page (`/legal`)

**Files:**
- Create: `src/components/LegalPage.js`
- Modify: `src/App.js` — logged-out branch (line ~215) and the routes list (after `/preferences`, line ~540)
- Test: `src/components/LegalPage.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/components/LegalPage.test.js
import { render, screen } from '@testing-library/react';
import LegalPage from './LegalPage';

describe('LegalPage', () => {
  test('shows the Amazon Associates disclosure', () => {
    render(<LegalPage />);
    expect(screen.getByText(/as an amazon associate/i)).toBeInTheDocument();
  });

  test('shows privacy policy and contact email', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/sebasludmir@gmail\.com/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=LegalPage`
Expected: FAIL — "Cannot find module './LegalPage'"

- [ ] **Step 3: Implement the component**

```jsx
// src/components/LegalPage.js
import React from 'react';

const sectionStyle = { marginBottom: '32px', lineHeight: 1.6 };

export default function LegalPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', color: 'inherit' }}>
      <h1>LiveSet — Disclosures &amp; Privacy</h1>

      <section style={sectionStyle}>
        <h2>About LiveSet</h2>
        <p>
          LiveSet (liveset.io) is a platform where DJs, producers, and musicians build
          interactive 3D versions of their gear setups, share video performances, and let
          viewers explore — and shop — the exact equipment used.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Affiliate Disclosure</h2>
        <p>
          As an Amazon Associate, LiveSet earns from qualifying purchases. Product links on
          this site may be affiliate links: if you buy through them, LiveSet (and in some
          cases the creator whose setup you were viewing) receives a commission at no extra
          cost to you. Prices shown are informational and may differ from the retailer's
          current price.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Privacy Policy</h2>
        <p>
          <strong>Account data.</strong> Signing in with Google shares your name, email
          address, and profile photo with us. We store these with your profile, setups,
          videos, and preferences in Google Firebase.
        </p>
        <p>
          <strong>Content you upload.</strong> Videos, audio, and gear setups you post are
          visible to other signed-in users.
        </p>
        <p>
          <strong>Affiliate clicks.</strong> When you click a Buy link we log the product,
          the setup you were viewing, and your account ID so we can credit creators for
          purchases their setups inspire. We do not see what you buy at the retailer.
        </p>
        <p>
          <strong>Your choices.</strong> To delete your account and associated data, email
          us. We do not sell personal data.
        </p>
        <p>Contact: sebasludmir@gmail.com</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=LegalPage`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire routing — logged out and logged in**

The `if (!user)` early return in `App.js` (line ~215) renders before `BrowserRouter` mounts, so use `window.location.pathname` there. Inside that branch, after the `</header>`:

```jsx
        {window.location.pathname === '/legal' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}><LegalPage /></div>
        ) : (
          <footer style={{ marginTop: 'auto', padding: '16px', textAlign: 'center' }}>
            <a href="/legal" style={{ color: 'inherit', opacity: 0.6, fontSize: '13px' }}>
              Affiliate disclosure &amp; privacy
            </a>
          </footer>
        )}
```

Import `LegalPage` at the top of App.js. In `AppRoutes`, add after the `/preferences` route (line ~540):

```jsx
            <Route path="/legal" element={<LegalPage />} />
```

- [ ] **Step 6: Manual verification**

Dev server, logged out: visit `localhost:3000/legal` — page renders without sign-in. Logged in: navigate to `/legal` — same content inside the app shell.

- [ ] **Step 7: Commit**

```bash
git add src/components/LegalPage.js src/components/LegalPage.test.js src/App.js
git commit -m "feat: public /legal page with affiliate disclosure and privacy policy"
```

---

### Task 9: Final verification + deploy checklist

- [ ] **Step 1: Run all new/touched test files**

Run: `CI=true npm test -- --watchAll=false --testPathPattern='(affiliateLink|affiliateClicks|DeviceHoverMenu|LegalPage|AppShell)'`
Expected: all PASS

- [ ] **Step 2: Hand the production build to the user**

Per project convention, Claude does not run `react-scripts build` (it hangs). Ask the user to run `npm run build` and then `npm run deploy`, plus `npx firebase deploy --only firestore:rules` if Task 3's deploy was deferred.

- [ ] **Step 3: Post-deploy user checklist (no code)**

1. Verify https://liveset.io/legal renders logged out.
2. Apply to Amazon Associates (steps in the spec/conversation). Get the tracking tag.
3. Put the tag in `.env` (`REACT_APP_AMAZON_ASSOC_TAG=yourtag-20`) **and** in the deploy environment, rebuild, redeploy.
4. Paste real Amazon product URLs into the `affiliateUrl` field for the ~20 catalog products via Product Manager.
5. After first clicks, confirm `ascsubtag` values appear in the Amazon Associates earnings report; if they don't, fall back to per-creator tracking IDs (Amazon allows 100).
