# Mobile Fixes + Setup Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile bugs (blank hub thumbnails, feed clips showing the wrong video section, slow profile loads) and add a setup showcase with real preview screenshots to profiles.

**Architecture:** Thumbnails switch from `<video preload="metadata">` pseudo-thumbnails (which iOS never paints) to real `<img>` tags fed by the already-stored Bunny `thumbnailURL`, signed via the existing `getSignedBunnyUrl` callable. The feed bug is fixed inside `createAudioMasterSync` by verifying that startup video-alignment seeks actually landed and re-issuing them (iOS silently drops seeks on fresh HLS streams). Profile loading parallelizes a 6-deep sequential await chain. The showcase captures a JPEG of the Three.js viewport at save time, stores it in Firebase Storage (`setups/{id}/screenshots/preview.jpg` — storage rules already allow this path), and redesigns Profile's SETUPS tab around preview cards.

**Tech Stack:** React 18 (CRA), Firebase (Firestore/Storage/callables), Three.js, jest with fake timers.

**Root causes (verified against production Firestore data):**
1. **Thumbnails:** sets/clips docs already store `thumbnailURL` (`https://<cdn>/<guid>/thumbnail.jpg`); the UI never uses it and instead mounts `<video preload="metadata">`, which iOS Safari renders blank. Hub also never signs set URLs (token-auth 403s).
2. **Feed clips:** real clips have `clipStart ≈ 1993s`. The feed auto-plays the video from 0:00, then the sync's one-shot alignment seek ~33 min into a freshly-attached iOS HLS stream is silently discarded; recovery (FORCE_SEEK) is throttled to one attempt per 4 s behind buffered-guards, so the video visibly plays the head of the set while the audio (correctly pre-seeked WAV) plays the clip window.
3. **Profile:** `Profile.js` awaits sequentially: user doc → ALL follower docs (just to count) → sets → setups → me doc → ENTIRE products collection, and gates all rendering on the last one.

**Execution order:** Task 1 ∥ Task 2, then Task 3 (touches Profile.js), Task 4 ∥ (Tasks 2/3), then Task 5 (touches Profile.js/css after Tasks 3+4). One commit per task.

**Verification limits:** `npm start`/`npm run build` hang under automation (per CLAUDE.md) — do NOT run them. Verify with targeted jest + eslint on changed files:
- `CI=true npx react-scripts test --watchAll=false <testfile>`
- `npx eslint src/components/<file>.js`

---

### Task 1: Verified startup alignment in createAudioMasterSync (feed clip fix)

**Files:**
- Modify: `src/utils/audioVideoSync.js` (single-video controller only — do NOT touch `createMulticamAudioMasterSync`, it drives LiveSetPlayer which works today)
- Test: `src/utils/audioVideoSync.test.js`

**Behavior to build:** `positionVideo()` currently issues one `currentTime` write and only re-applies it if metadata wasn't loaded. Add an outcome-verification chain: after issuing the alignment seek, re-check shortly after; if the video is still hopelessly off the live target (> `FORCE_SEEK` = 3 s — deliberately the same threshold as the follow loop so bandwidth-starved video, which sits *closer* than 3 s, is never poked), re-issue the seek. Bounded attempts; stops the moment the video is near target.

- [ ] **Step 1: Read the existing file and test harness**

Read `src/utils/audioVideoSync.js` fully and `src/utils/audioVideoSync.test.js` (note `makeVideo`, `makeAudio`, `makeBuffered`, `warmUp`, fake timers).

- [ ] **Step 2: Add a seek-dropping fake video + failing tests**

Append to `src/utils/audioVideoSync.test.js` (fixture next to `makeIOSVideo`, tests in a new describe block at the end):

```js
// iOS-like video whose metadata IS loaded, but which silently drops the
// first N currentTime writes — the observed behavior on a freshly-attached,
// already-playing HLS stream on iPhone: no error, no 'seeked', playback
// just continues from where it was.
function makeSeekDroppingVideo({ drops = 4, buffered = [[0, 5]] } = {}) {
  let _currentTime = 0;
  let dropsLeft = drops;
  const video = {
    buffered: makeBuffered(buffered),
    readyState: 4,
    duration: NaN,
    playbackRate: 1,
    muted: false,
    currentTimeWrites: 0,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
  };
  Object.defineProperty(video, 'currentTime', {
    enumerable: true,
    get() { return _currentTime; },
    set(v) {
      video.currentTimeWrites += 1;
      if (dropsLeft > 0) { dropsLeft -= 1; return; } // silently ignored
      _currentTime = v;
    },
  });
  return video;
}
```

```js
describe('createAudioMasterSync startup alignment verification', () => {
  test('re-issues a startup alignment seek the element silently dropped', () => {
    // Feed clip deep into a set (clipStart ≈ 1993s, offset 0): iOS drops the
    // first several alignment seeks. The controller must notice the video is
    // still at 0:00 and keep re-issuing until it lands — well before the
    // follow loop's one-force-seek-per-4s cooldown would get there.
    const video = makeSeekDroppingVideo({ drops: 4 });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, { audioStart: 1993 });

    sync.play();
    expect(audio.currentTime).toBe(1993); // audio pre-seeked to the clip window

    // Warm-up: audio passes audioStart + 0.2, then accrues 1.2s of progress.
    audio.currentTime = 1993.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 1994.6;
    jest.advanceTimersByTime(100);

    // Both eager seeks (play()-time and warmup-completion) were dropped.
    expect(video.currentTime).toBe(0);

    // Within two verification periods the alignment must have landed.
    jest.advanceTimersByTime(1800);
    expect(video.currentTime).toBeGreaterThan(1990);
  });

  test('verification stops once the alignment landed (no extra writes)', () => {
    const video = makeVideo({ currentTime: 0, buffered: [[0, 3000]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, { audioStart: 1993 });
    sync.play();
    audio.currentTime = 1993.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 1994.6;
    jest.advanceTimersByTime(100);
    // Video accepted the warmup seek; simulate it following naturally.
    audio.currentTime = 1995.4;
    video.currentTime = 1995.4;
    const writes = video.currentTimeWrites;
    jest.advanceTimersByTime(3000);
    expect(video.currentTimeWrites).toBe(writes); // zero-touch steady state holds
  });
});
```

- [ ] **Step 3: Run tests, confirm the first new test FAILS**

Run: `CI=true npx react-scripts test --watchAll=false src/utils/audioVideoSync.test.js`
Expected: `re-issues a startup alignment seek…` FAILS (video stuck at 0 at +1800 ms — current code's next force-seek is ~4 s out); all pre-existing tests PASS. The second new test should already pass (guards against regression).

- [ ] **Step 4: Implement the verification chain**

In `src/utils/audioVideoSync.js`, add constants after `FORCE_SEEK_COOLDOWN_MS`:

```js
// Startup alignment verification: iOS can silently drop a currentTime write
// on a freshly-attached HLS stream even after metadata is in (no error, no
// 'seeked'). After each alignment seek, re-check the OUTCOME and re-issue
// while the video is hopelessly off target (> FORCE_SEEK — same threshold
// as the follow loop so a merely bandwidth-starved video is never poked).
const SEEK_VERIFY_MS = 800;
const SEEK_VERIFY_ATTEMPTS = 6;
```

Inside `createAudioMasterSync`, add state next to `metaCleanup`:

```js
  let verifyId = null;
  let verifyAttempts = 0;

  const clearVerify = () => { if (verifyId) { clearTimeout(verifyId); verifyId = null; } };
```

Replace the whole `positionVideo` function with:

```js
  // Position the video at the current audio target — and verify the write
  // took. Two iOS failure modes are covered:
  //   1. writes before metadata are discarded → re-apply the fresh target on
  //      loadedmetadata (as before);
  //   2. writes on a just-attached, already-playing HLS stream are dropped
  //      with no error and no 'seeked' → re-check shortly after and re-issue,
  //      bounded, until the video sits near the live target.
  function positionVideo() {
    clearVerify();
    verifyAttempts = 0;
    applyAlignmentSeek();
  }

  function applyAlignmentSeek() {
    try { video.currentTime = videoTarget(); } catch (_) {}
    if (video.readyState < 1 && typeof video.addEventListener === 'function' && !metaCleanup) {
      const onMeta = () => {
        if (metaCleanup) metaCleanup();
        if (destroyed) return;
        applyAlignmentSeek();
      };
      video.addEventListener('loadedmetadata', onMeta);
      metaCleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        metaCleanup = null;
      };
      return; // verification restarts once metadata arrives
    }
    if (verifyAttempts >= SEEK_VERIFY_ATTEMPTS) return;
    verifyId = setTimeout(() => {
      verifyId = null;
      if (destroyed || !active) return;
      if (Math.abs(video.currentTime - videoTarget()) <= FORCE_SEEK) return; // landed
      verifyAttempts += 1;
      videoSeeks += 1;
      applyAlignmentSeek();
    }, SEEK_VERIFY_MS);
  }
```

Add `clearVerify();` to both `pause()` and `destroy()` (right after their existing `stopFollow()` calls).

- [ ] **Step 5: Run the full sync test suite**

Run: `CI=true npx react-scripts test --watchAll=false src/utils/audioVideoSync.test.js`
Expected: ALL tests pass, including the starved-guard and zero-touch tests (the verify tolerance `FORCE_SEEK` keeps them untouched).

- [ ] **Step 6: Commit**

```bash
git add src/utils/audioVideoSync.js src/utils/audioVideoSync.test.js
git commit -m "fix: verify and re-issue dropped iOS startup seeks in audio-master sync"
```

---

### Task 2: Real image thumbnails on the Hub

**Files:**
- Modify: `src/components/HubLandingPage.js`
- Modify: `src/components/HubLandingPage.css`

sets/clips docs store `thumbnailURL`; `getSignedBunnyUrls(kind, id)` (already imported in this file) returns it signed as `thumbnailURL`. Legacy docs without it keep the current `<video>` fallback.

- [ ] **Step 1: Sign set thumbnails in the data effect**

In `HubLandingPage.js`, inside the `useEffect` data loader, replace the `recent` block:

```js
        let recent = [];
        try {
          const setsQ = query(collection(db, 'sets'), orderBy('createdAt', 'desc'), limit(8));
          const setsSnap = await getDocs(setsQ);
          setsSnap.forEach((d) => recent.push({ id: d.id, ...d.data() }));
          // Bunny token auth 403s bare URLs — sign both the playable URL and
          // the thumbnail.jpg used for the tile image.
          await Promise.all(recent.map(async (s) => {
            try {
              const signed = await getSignedBunnyUrls('set', s.id);
              if (signed.videoURL) s.videoURL = signed.videoURL;
              if (signed.thumbnailURL) s.thumbnailURL = signed.thumbnailURL;
            } catch { /* keep raw URLs (legacy Firebase Storage sets) */ }
          }));
        } catch {
          recent = [];
        }
```

And in the clips block, after `if (signed.videoURL) c.videoURL = signed.videoURL;` add:

```js
                if (signed.thumbnailURL) c.thumbnailURL = signed.thumbnailURL;
```

- [ ] **Step 2: Render `<img>` thumbnails with `<video>` fallback**

Hero thumb — replace the `{hero.videoURL ? (<video …/>) : null}` block inside `.hub-hero__thumb`:

```jsx
                  {hero.thumbnailURL ? (
                    <img src={hero.thumbnailURL} alt="" loading="lazy" />
                  ) : hero.videoURL ? (
                    <video src={hero.videoURL} muted preload="metadata" playsInline />
                  ) : null}
```

Set tile — same pattern inside `.hub-set-tile__thumb`:

```jsx
                        {set.thumbnailURL ? (
                          <img src={set.thumbnailURL} alt="" loading="lazy" />
                        ) : set.videoURL ? (
                          <video src={set.videoURL} muted preload="metadata" playsInline />
                        ) : null}
```

Clip tile — same pattern inside `.hub-clip-tile__thumb`:

```jsx
                    {clip.thumbnailURL ? (
                      <img src={clip.thumbnailURL} alt="" loading="lazy" />
                    ) : clip.videoURL ? (
                      <video src={clip.videoURL} muted preload="metadata" playsInline />
                    ) : null}
```

- [ ] **Step 3: CSS — style `img` exactly like `video`**

In `HubLandingPage.css`, extend the three selectors (keep every existing declaration; just add the `img` variant):
- `.hub-hero__thumb video` → `.hub-hero__thumb video, .hub-hero__thumb img`
- `.hub-set-tile__thumb video` → `.hub-set-tile__thumb video, .hub-set-tile__thumb img`
- `.hub-clip-tile__thumb video` → `.hub-clip-tile__thumb video, .hub-clip-tile__thumb img`

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/HubLandingPage.js`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/HubLandingPage.js src/components/HubLandingPage.css
git commit -m "fix: hub tiles render signed Bunny thumbnail images (iOS never painted video pseudo-thumbs)"
```

---

### Task 3: Fast profile loads + image thumbnails on Profile sets

**Files:**
- Modify: `src/components/Profile.js`
- Modify: `src/components/Profile.css`

- [ ] **Step 1: Parallelize the load effect**

In `Profile.js`:
- Add `getCountFromServer` to the `firebase/firestore` import list.
- Add `import { getSignedBunnyUrls } from '../utils/bunnyUrl';`.

Replace the body of the main load `useEffect` (keep deps `[userId, currentUserId]`) with:

```js
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Independent reads go out in parallel — this used to be a 6-deep
        // sequential await chain, which is what made profiles slow to open
        // on mobile connections.
        const [userSnap, followersCount, setsSnap, setupsSnap, meSnap] = await Promise.all([
          getDoc(doc(db, 'users', userId)),
          getCountFromServer(collection(db, 'users', userId, 'followers')).catch(() => null),
          getDocs(query(collection(db, 'sets'), where('creatorId', '==', userId), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'setups'), where('ownerId', '==', userId))),
          currentUserId && currentUserId !== userId
            ? getDoc(doc(db, 'users', currentUserId)).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile({ displayName: userId.slice(0, 8), bio: '', createdAt: new Date() });
        }
        setFollowers(followersCount ? followersCount.data().count : 0);

        const setsList = [];
        setsSnap.forEach((d) => setsList.push({ id: d.id, ...d.data() }));
        setSets(setsList);

        const setupsList = [];
        setupsSnap.forEach((d) => setupsList.push({ id: d.id, ...d.data() }));
        setupsList.sort((a, b) => {
          const at = a.updatedAt?.toDate?.()?.getTime() ?? a.createdAt?.toDate?.()?.getTime() ?? 0;
          const bt = b.updatedAt?.toDate?.()?.getTime() ?? b.createdAt?.toDate?.()?.getTime() ?? 0;
          return bt - at;
        });
        setSetups(setupsList);

        if (meSnap && meSnap.exists()) {
          setIsFollowing((meSnap.data().following || []).includes(userId));
        }

        // Thumbnails arrive after first paint: sign in the background and
        // patch state instead of blocking the profile on N callables.
        Promise.all(setsList.map(async (s) => {
          try {
            const signed = await getSignedBunnyUrls('set', s.id);
            return { id: s.id, thumbnailURL: signed.thumbnailURL || null };
          } catch { return { id: s.id, thumbnailURL: null }; }
        })).then((thumbs) => {
          if (cancelled) return;
          const byId = new Map(thumbs.map((t) => [t.id, t.thumbnailURL]));
          setSets((prev) => prev.map((s) => (byId.get(s.id) ? { ...s, thumbnailURL: byId.get(s.id) } : s)));
        });
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
```

- [ ] **Step 2: Move the products fetch off the critical path**

Delete the `if (currentUserId && currentUserId === userId) { …products… }` block from the main effect (it's gone already after Step 1) and add a separate effect below it:

```js
  // Fave-product options are own-profile-only and only feed the picker —
  // load them off the critical path so they never delay first paint.
  useEffect(() => {
    if (!isOwnProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const productsSnap = await getDocs(collection(db, 'products'));
        if (cancelled) return;
        const productsList = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        productsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(productsList);
      } catch { /* picker stays empty; fave viewer falls back to a direct doc read */ }
    })();
    return () => { cancelled = true; };
  }, [isOwnProfile]);
```

- [ ] **Step 3: `refreshFollowerCount` uses the count aggregate**

```js
  const refreshFollowerCount = async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'users', userId, 'followers'));
      setFollowers(snap.data().count);
    } catch (err) {
      console.error('Error refreshing follower count:', err);
    }
  };
```

- [ ] **Step 4: Sets grid renders image thumbnails**

Replace the thumb block inside `.profile-set__thumb`:

```jsx
                      {set.thumbnailURL ? (
                        <img src={set.thumbnailURL} alt="" loading="lazy" />
                      ) : set.videoURL ? (
                        <video src={set.videoURL} muted preload="metadata" playsInline />
                      ) : (
                        <div className="profile-set__placeholder">No preview</div>
                      )}
```

In `Profile.css` extend `.profile-set__thumb video` → `.profile-set__thumb video, .profile-set__thumb img` (keep all declarations).

- [ ] **Step 5: Lint + test sweep**

Run: `npx eslint src/components/Profile.js`
Run: `CI=true npx react-scripts test --watchAll=false src/components`
Expected: no lint errors; existing component tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Profile.js src/components/Profile.css
git commit -m "perf: parallelize profile loads, count followers server-side, image thumbnails for sets"
```

---

### Task 4: Scene preview capture + upload on setup save

**Files:**
- Create: `src/utils/scenePreviewCapture.js`
- Test: `src/utils/scenePreviewCapture.test.js`
- Modify: `src/ThreeScene.js` (registration; renderer init is around line 1441 — anchor on `mountRef.current.appendChild(renderer.domElement);`)
- Modify: `src/components/SaveSetupButton.js`

- [ ] **Step 1: Failing test for the registry**

Create `src/utils/scenePreviewCapture.test.js`:

```js
import { registerScenePreviewCapture, captureScenePreview } from './scenePreviewCapture';

describe('scenePreviewCapture registry', () => {
  test('returns null when no scene is mounted', async () => {
    expect(await captureScenePreview()).toBeNull();
  });

  test('delegates to the registered capture fn and unregisters cleanly', async () => {
    const blob = { fake: 'blob' };
    const fn = jest.fn(() => blob);
    const unregister = registerScenePreviewCapture(fn);
    expect(await captureScenePreview({ maxWidth: 400 })).toBe(blob);
    expect(fn).toHaveBeenCalledWith({ maxWidth: 400 });
    unregister();
    expect(await captureScenePreview()).toBeNull();
  });

  test('a throwing capture fn degrades to null (save must never fail on preview)', async () => {
    const unregister = registerScenePreviewCapture(() => { throw new Error('boom'); });
    expect(await captureScenePreview()).toBeNull();
    unregister();
  });
});
```

Run: `CI=true npx react-scripts test --watchAll=false src/utils/scenePreviewCapture.test.js`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement the registry**

Create `src/utils/scenePreviewCapture.js`:

```js
// Bridge between the 3D builder and non-3D UI: ThreeScene registers a
// capture function while mounted; SaveSetupButton asks for a JPEG snapshot
// of the current viewport at save time. Null when no scene is mounted or
// capture fails — a save must never fail because of its preview.
let captureFn = null;

export function registerScenePreviewCapture(fn) {
  captureFn = fn;
  return () => { if (captureFn === fn) captureFn = null; };
}

export async function captureScenePreview(opts = {}) {
  if (!captureFn) return null;
  try {
    return (await captureFn(opts)) || null;
  } catch {
    return null;
  }
}
```

Run the test again — expected: PASS.

- [ ] **Step 3: Register capture in ThreeScene**

In `src/ThreeScene.js`:
- Add import near the other util imports: `import { registerScenePreviewCapture } from './utils/scenePreviewCapture';`
- In the main init effect, declare `let unregisterPreviewCapture = null;` next to the existing `let isInitialized` / cleanup-scoped locals.
- Immediately after `mountRef.current.appendChild(renderer.domElement);` add:

```js
                // Setup previews: the save flow grabs a JPEG of the viewport.
                // Render-then-copy must happen in the same task — the drawing
                // buffer is not preserved, so a fresh render() right before
                // drawImage guarantees pixels. Downscale to cap file size.
                unregisterPreviewCapture = registerScenePreviewCapture(({ maxWidth = 800, quality = 0.85 } = {}) => {
                    const r = rendererRef.current;
                    const s = sceneRef.current;
                    const cam = cameraRef.current;
                    if (!r || !s || !cam) return null;
                    r.render(s, cam);
                    const src = r.domElement;
                    const scale = Math.min(1, maxWidth / (src.width || 1));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(src.width * scale));
                    canvas.height = Math.max(1, Math.round(src.height * scale));
                    canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
                    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
                });
```

- In the effect's cleanup function (find the `return () => {` of the same effect — it disposes the renderer / removes the canvas), add first:

```js
                if (unregisterPreviewCapture) { unregisterPreviewCapture(); unregisterPreviewCapture = null; }
```

NOTE: `ThreeScene.js` is ~4700 lines. Only add these three snippets; change nothing else.

- [ ] **Step 4: Capture + upload in SaveSetupButton**

In `src/components/SaveSetupButton.js`:
- Extend imports:

```js
import { db, auth, storage } from '../firebaseConfig';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { captureScenePreview } from '../utils/scenePreviewCapture';
```

(keep the existing firestore imports; `doc` and `updateDoc` are already imported)

- Add a module-level helper above the component:

```js
// Best-effort viewport screenshot → Storage → download URL. Returns null on
// any failure: a setup save must never fail because of its preview image.
// Storage rules already allow setups/{setupId}/screenshots/* for signed-in
// users (image/*, <5MB).
async function uploadSetupPreview(setupId) {
  try {
    const blob = await captureScenePreview();
    if (!blob) return null;
    const previewRef = storageRef(storage, `setups/${setupId}/screenshots/preview.jpg`);
    await uploadBytes(previewRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(previewRef);
  } catch (err) {
    console.warn('Setup preview capture failed:', err);
    return null;
  }
}
```

- In `handleSaveSetup`, replace `await addDoc(collection(db, 'setups'), setupData);` with:

```js
      const setupDocRef = await addDoc(collection(db, 'setups'), setupData);
      const previewImageURL = await uploadSetupPreview(setupDocRef.id);
      if (previewImageURL) {
        await updateDoc(doc(db, 'setups', setupDocRef.id), { previewImageURL });
      }
```

- In `handleUpdateSetup`, before the existing `await updateDoc(...)`, add:

```js
      const previewImageURL = await uploadSetupPreview(setupId);
```

and extend that `updateDoc` payload with:

```js
        ...(previewImageURL ? { previewImageURL } : {}),
```

- Verify `src/firebaseConfig.js` exports `storage` (SetEditor.js already imports it — if the export name differs, match SetEditor's import).

- [ ] **Step 5: Lint + tests**

Run: `npx eslint src/components/SaveSetupButton.js src/utils/scenePreviewCapture.js`
Run: `CI=true npx react-scripts test --watchAll=false src/utils/scenePreviewCapture.test.js`
Expected: clean lint, tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/scenePreviewCapture.js src/utils/scenePreviewCapture.test.js src/ThreeScene.js src/components/SaveSetupButton.js
git commit -m "feat: capture 3D viewport screenshot as setup preview on save"
```

---

### Task 5: Profile setups showcase (mobile + desktop)

**Files:**
- Modify: `src/components/Profile.js` (SETUPS tab render only)
- Modify: `src/components/Profile.css` (replace the `.profile__setups-grid` block)
- Modify: `CLAUDE.md` (data model row)

Design: featured setup (main setup, else newest) as a full-width hero card with the preview image and a bottom scrim carrying name/type/device count; remaining setups as a 2-col grid on desktop and a horizontal snap rail on mobile (≤1023px). Setups without `previewImageURL` (all existing ones until re-saved) get a token-based gradient fallback with the setup-type icon. Cards stay clickable → `onSetupSelect(setup)` (opens the builder), unchanged behavior.

- [ ] **Step 1: Imports + derived state in Profile.js**

Extend the react-icons import and add the io5 one:

```js
import { MdDelete, MdPlayArrow, MdVerified, MdLink, MdHeadphones, MdPiano } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
```

Above the `Profile` component add:

```js
const SETUP_TYPE_ICONS = { DJ: MdHeadphones, Producer: MdPiano, Musician: IoMusicalNotes };

// Preview image when the setup has one (captured at save time), otherwise a
// token-colored fallback with the setup-type icon (setups saved before the
// preview feature shipped).
function SetupPreview({ setup }) {
  if (setup.previewImageURL) {
    return <img className="profile-showcase__img" src={setup.previewImageURL} alt="" loading="lazy" />;
  }
  const Icon = SETUP_TYPE_ICONS[setup.setupType] || MdHeadphones;
  return (
    <div className="profile-showcase__img profile-showcase__img--fallback">
      <Icon size={44} aria-hidden="true" />
    </div>
  );
}
```

Inside the component, replace `const setupsList = useMemo(() => setups, [setups]);` with:

```js
  const featuredSetup = useMemo(
    () => setups.find((s) => s.isMainSetup) || setups[0] || null,
    [setups]
  );
  const otherSetups = useMemo(
    () => setups.filter((s) => s !== featuredSetup),
    [setups, featuredSetup]
  );
```

- [ ] **Step 2: Replace the SETUPS tab JSX**

Replace everything from `setupsList.length === 0 ? (` through the closing of `.profile__setups-grid` with:

```jsx
            setups.length === 0 ? (
              <EmptyState
                eyebrow="NO SETUPS"
                title="No saved setups"
                body={isOwnProfile ? "Build a setup from the Hub to see it here." : "This user hasn't saved any setups yet."}
              />
            ) : (
              <div className="profile-showcase">
                {featuredSetup && (
                  <button
                    type="button"
                    className="profile-showcase__hero press-card"
                    onClick={() => onSetupSelect && onSetupSelect(featuredSetup)}
                    aria-label={`Open setup ${featuredSetup.name || 'Untitled Setup'}`}
                  >
                    <SetupPreview setup={featuredSetup} />
                    <div className="profile-showcase__scrim">
                      <div className="profile-showcase__chips">
                        <Chip>{(featuredSetup.setupType || 'DJ').toUpperCase()}</Chip>
                        {featuredSetup.isMainSetup && <Chip>MAIN</Chip>}
                      </div>
                      <h3 className="profile-showcase__name">{featuredSetup.name || 'Untitled Setup'}</h3>
                      <div className="profile-showcase__meta mono-label">
                        {(featuredSetup.devices?.length || 0)} DEVICES
                      </div>
                    </div>
                  </button>
                )}
                {otherSetups.length > 0 && (
                  <div className="profile-showcase__rail">
                    {otherSetups.map((setup) => (
                      <button
                        key={setup.id}
                        type="button"
                        className="profile-showcase__card press-card"
                        onClick={() => onSetupSelect && onSetupSelect(setup)}
                        aria-label={`Open setup ${setup.name || 'Untitled Setup'}`}
                      >
                        <div className="profile-showcase__card-thumb">
                          <SetupPreview setup={setup} />
                        </div>
                        <div className="profile-showcase__card-meta">
                          <Chip>{(setup.setupType || 'DJ').toUpperCase()}</Chip>
                          <div className="profile-showcase__card-name">{setup.name || 'Untitled Setup'}</div>
                          <div className="profile-showcase__card-devices mono-label">
                            {(setup.devices?.length || 0)} DEVICES
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
```

(If `setupsList` has other usages, they're only the two in this block — after this change the identifier is gone; also remove the now-unused `useMemo` import ONLY if nothing else uses it — `featuredSetup`/`otherSetups` still use it, so keep it.)

- [ ] **Step 3: Replace the setups CSS block**

In `Profile.css`, replace the `.profile__setups-grid` rule, `.profile-setup-card*` rules, and the `.profile__setups-grid { grid-template-columns: 1fr; }` line inside the mobile media query with:

```css
/* ---- Setups showcase ---- */
.profile-showcase {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.profile-showcase__hero,
.profile-showcase__card {
  position: relative;
  display: block;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.profile-showcase__hero {
  aspect-ratio: 16 / 9;
  width: 100%;
}

.profile-showcase__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-showcase__img--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background:
    radial-gradient(120% 90% at 18% 0%, var(--primary-softer), transparent 62%),
    var(--surface-2);
}

/* Overlays imagery — fixed dark scrim in both themes (see tokens.css rules
   on chrome overlaying media). */
.profile-showcase__scrim {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
  padding: var(--space-4);
  background: linear-gradient(transparent, rgba(10, 9, 8, 0.85));
  color: #F4EFE6;
}

.profile-showcase__chips {
  display: flex;
  gap: var(--space-2);
}

.profile-showcase__name {
  margin: 0;
  font-size: var(--fs-xl);
  line-height: var(--lh-heading);
}

.profile-showcase__meta {
  color: rgba(244, 239, 230, 0.75);
}

.profile-showcase__rail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.profile-showcase__card-thumb {
  position: relative;
  aspect-ratio: 16 / 10;
}

.profile-showcase__card-thumb .profile-showcase__img {
  position: absolute;
}

.profile-showcase__card-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
  padding: var(--space-3);
}

.profile-showcase__card-name {
  font-size: var(--fs-body);
  font-weight: 600;
}

.profile-showcase__card-devices {
  color: var(--text-muted);
}

@media (max-width: 1023px) {
  /* Horizontal snap rail: 1–4 secondary setups swipe like a carousel. */
  .profile-showcase__rail {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    gap: var(--space-3);
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    scrollbar-width: none;
  }
  .profile-showcase__rail::-webkit-scrollbar { display: none; }
  .profile-showcase__card {
    flex: 0 0 72%;
    scroll-snap-align: start;
  }
}
```

Check the existing mobile media query in Profile.css: if it contains `.profile__setups-grid { grid-template-columns: 1fr; }`, delete that line (the class no longer exists).

- [ ] **Step 4: CLAUDE.md data-model row**

In the Firebase Data Model table, `setups` row, after `mobileDiagram`: add `previewImageURL` so it reads `… devices[] (positions, spotType, placementIndex, model data), mobileDiagram, previewImageURL (viewport screenshot captured on save), cameraAngles, isMainSetup`.

- [ ] **Step 5: Lint + tests**

Run: `npx eslint src/components/Profile.js`
Run: `CI=true npx react-scripts test --watchAll=false src/components`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Profile.js src/components/Profile.css CLAUDE.md
git commit -m "feat: setup showcase on profile — featured hero + preview cards (mobile rail / desktop grid)"
```
