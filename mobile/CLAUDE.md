# LiveSet Mobile — Codebase Reference

Mobile companion app for LiveSet (the web app at `connectmyset.com`). Lives in `/mobile/` alongside the web app. **The root `/CLAUDE.md` documents the web app and the shared Firebase schema — read that first for anything about `products`, `setups`, `sets`, `clips`, or `users` collections.** This file covers only what's mobile-specific.

---

## Project Brief (as given by the user at kickoff)

> "I want to start a new project that will be a mobile app companion for the webapp (LiveSet/musicdeviceconnection) I've created. The phone app is not going to allow users to build setups in the 3D scene, it will allow them to **view them** though. It will also allow them to see the **feed**, and allow them to **upload sets**, and see **profiles** (their own or others). The feed will have a **Following** and also a **For You** type of feed that will be content tailored to the user's followed profiles."
>
> "I want to eventually post this on the **iPhone app store** and **Google Play store**, allowing users to create accounts and share their live sets with their friends. Posting little clips on the feed while also having the ability to **discover new artists** who've uploaded full sets and clips to the app."

### Scope decisions locked in during kickoff

| Question | Answer |
|----------|--------|
| Dev accounts (Apple $99/yr, Google Play $25) | **Not yet purchased.** Buy only when the app is ship-ready. Target a TestFlight / Play internal-track build, not a published app. |
| Shared Firebase backend with web? | **Yes** — same project `musicdeviceconnection`, same collections. |
| For You algorithm | **Simple v1**: followed creators first, then rest ranked by likes. Iterate later. |
| Upload sources | **All three**: in-app camera record, photo-library pick, file upload (users often have pre-edited sets from YouTube workflows). |
| Clip editing | **Trim** + **swap in external audio track** (e.g. Tascam recording off the mixer for superior audio). Schema already supports this via `audioTrackURL` / `audioOffsetSeconds` on clips/sets. |
| 3D viewer | **Keep simple for v1** — static camera + basic orbit. The user found the web app's mobile 3D buggy; improve later. |
| Notifications | Typical social-media set: follows, likes, new posts from followed creators. |
| Visual style | **Mobile-native look**, dark theme echoing the web app's accent color (`#00a2ff`). |
| Repo layout | **Monorepo folder** — mobile lives in `/mobile/`, web stays at repo root. Each has its own `package.json`. Not a true Yarn/npm workspaces monorepo. |
| Timeline | **7 days** from scaffold to TestFlight-ready. |

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Expo SDK 54 + React Native 0.81 | JavaScript (matches web codebase style — no TS). |
| Navigation | `@react-navigation/native` + `bottom-tabs` + `native-stack` | No Expo Router — manual stack + tabs. |
| Backend | Firebase JS SDK v12 | Same project as web; **not** `@react-native-firebase` (so we stay in Expo Go). |
| Auth | `expo-auth-session` (Google) + `signInAnonymously` (dev guest) | Google sign-in is isolated in its own component (see Gotchas). |
| Video | `expo-video` (SDK 54's replacement for `expo-av`) | `useVideoPlayer` + `VideoView`. |
| Audio | `expo-audio` | For the external-track swap feature. |
| Media pick / record | `expo-image-picker`, `expo-camera`, `expo-file-system` | |
| Storage | `@react-native-async-storage/async-storage` | Auto-detected by Firebase for auth persistence on RN. |

**Node version: 20+ required.** Metro 0.82 uses syntax that Node 18 can't parse.

---

## Project Structure

```
mobile/
├── App.js                        # Root: auth gate + navigation container
├── app.json                      # Expo config (bundle ID: com.connectmyset.liveset)
├── index.js                      # Expo entry point (unchanged)
├── .env                          # EXPO_PUBLIC_FIREBASE_* + EXPO_PUBLIC_GOOGLE_*_CLIENT_ID
├── package.json
│
└── src/
    ├── firebase.js               # Firebase init (auth + firestore + storage)
    ├── theme.js                  # colors, radius, spacing tokens
    │
    ├── hooks/
    │   └── useAuth.js            # Auth state + guest sign-in + ensureUserDoc helper
    │
    ├── navigation/
    │   ├── RootStack.js          # Root: Tabs screen + UserProfile (pushed on top)
    │   └── Tabs.js                # Bottom tab nav (Feed / Post / Profile)
    │
    ├── screens/
    │   ├── AuthScreen.js         # Sign-in gate (Google + "Continue as guest")
    │   ├── FeedScreen.js         # For You + Following tabs, vertical snap
    │   ├── PostScreen.js         # Upload flow (placeholder — built on day 4)
    │   └── UserProfileScreen.js  # Works for own + others (follow button when not own, logout when own)
    │
    └── components/
        ├── ClipCard.js           # Single feed item — video player + like button + tap-creator-to-profile
        └── GoogleSignInButton.js # Isolated Google OAuth button (see Gotchas)
```

---

## Auth Flow

Two sign-in paths:
1. **Google Sign-In** via `expo-auth-session` — mobile OAuth, different from web's popup. Requires iOS + Android + Web OAuth client IDs in `.env`.
2. **Anonymous guest** via `signInAnonymously` — dev bypass so you can see the app without OAuth setup. Requires Anonymous provider enabled in Firebase Console → Authentication → Sign-in method.

`ensureUserDoc(user)` in `hooks/useAuth.js` creates the `users/{uid}` doc on first sign-in (both paths). Anonymous users get `isAnonymous: true` flag and `displayName: 'Guest'`.

---

## Firebase & Environment

`/mobile/.env` holds `EXPO_PUBLIC_FIREBASE_*` vars — same values as web's `REACT_APP_FIREBASE_*`, just prefixed differently (Expo only exposes `EXPO_PUBLIC_*` to the client bundle). Firebase project: `musicdeviceconnection`.

Reads/writes the same Firestore collections as the web app:
- `users` (shared — same displayName, followers, following, preferences)
- `setups` (view-only on mobile)
- `sets`, `clips` (feed + uploads)
- `products` (referenced by setups/clips but not browseable on mobile)

**Firestore rules are shared with web** (`/firestore.rules` at repo root). Any new write patterns on mobile must satisfy those existing rules.

---

## Navigation

Root is a `NativeStackNavigator` (`RootStack.js`) that wraps the bottom tabs:

```
RootStack
├── Tabs (headerShown: false — the tab nav itself)
│   ├── Feed
│   ├── Post
│   └── Profile (renders UserProfileScreen with no route params → own profile)
└── UserProfile (pushed on top of tabs — receives { userId } param)
```

`UserProfileScreen` is used in **both** places. It falls back to `auth.currentUser.uid` when no `userId` route param is present (the Profile tab case), so the same component serves own and other profiles. The follow button and sign-out button conditionally render based on whether the profile being viewed is the current user's.

Navigate to someone else's profile from anywhere:
```js
navigation.navigate('UserProfile', { userId: someUid });
```

---

## Known Gotchas (save future-you from rediscovering these)

### Firebase 12 + React Native persistence
`getReactNativePersistence` is **not exported** from `firebase/auth` in v12. Just call `getAuth(app)` — Firebase auto-detects `@react-native-async-storage/async-storage` when it's installed. Do NOT add `import { initializeAuth, getReactNativePersistence } from 'firebase/auth'` — it will break the bundle.

### `Google.useAuthRequest` crashes on render if client IDs missing
It throws synchronously during render, not lazily. That's why `GoogleSignInButton.js` is a separate component that's **only mounted** when `googleConfigured` (exported from `useAuth.js`) is true. Never import `expo-auth-session/providers/google` into a file that always renders.

### Node 18 breaks Metro
Metro 0.82 uses class field syntax that Node 18 can't parse (`TypeError: Class extends value #<Object> is not a constructor or null`). User is on Node 20 via nvm.

### Parent `node_modules` confusion
The repo root has the web app's `node_modules/`. Metro sometimes walks up and picks up conflicting packages. If weird bundler errors appear, first check whether the parent has a package that's shadowing mobile's copy.

### `--offline` speeds up dev iteration
`npx expo start --offline` skips Expo's update check. Use it by default during local dev — shaves ~10s off each start and avoids sporadic network hangs.

### Expo Go caches are stateful across projects
Stale caches in `~/.expo` and `$TMPDIR/metro-*` cause mysterious hangs. Nuclear reset:
```bash
rm -rf node_modules package-lock.json .expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*
npm install && npx expo start --offline --clear
```

### Firestore rules currently block non-creator likes
`/firestore.rules` restricts clip updates to the creator — so a non-creator calling `updateDoc(clips/{id}, { likes, likedBy })` fails silently. Mobile (and web) optimistically update local state so the UI still feels responsive. To make likes actually persist across sessions, rules need a new `allow update` branch that permits any signed-in user to change **only** `likes` and `likedBy`. This is a shared concern — fix in the web repo.

### OAuth client IDs needed for real auth
Until all three `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values are in `.env`, only guest sign-in works. iOS client ID needs bundle ID `com.connectmyset.liveset`; Android needs package `com.connectmyset.liveset` + SHA-1 fingerprint.

---

## Dev Commands

```bash
# From /mobile/
npx expo start --offline         # Normal dev — scan QR with Expo Go
npx expo start --offline --clear # When caches are suspect
npx expo start --port 8082       # If 8081 is in use

# From repo root (web app, unchanged)
npm start                        # Web dev server
npm run deploy                   # Deploy web to Firebase Hosting
```

---

## Build Roadmap

| Day | Status | Deliverable |
|-----|--------|-------------|
| 1 | **Done** | Scaffold, auth (Google + guest), tab nav, feed skeleton, profile skeleton |
| 2 | **Done** | Root stack nav, UserProfile screen, like button, creator→profile tap, follow/unfollow |
| 3 | pending | Profile polish — follower lists, fave product preview, edit display name |
| 4–5 | pending | Upload flow: camera/library/file, clip trim, audio-track swap (posts to `sets` + `clips`) |
| 6 | pending | 3D setup viewer (read-only, static camera); push notifications (requires EAS dev build) |
| 7 | pending | Icon/splash, EAS build for TestFlight + Play internal track |

---

## Token-Efficient Reading Guide (for future Claude sessions)

**Don't read the whole codebase.** These are the hotspots:

- **Adding a screen** → look at `src/screens/ProfileScreen.js` as a template, then register in `src/navigation/Tabs.js` (or root stack once it exists).
- **Adding a Firestore query** → `FeedScreen.js` has the canonical pattern (collection + orderBy + limit, map docs).
- **Adding an auth-gated write** → `hooks/useAuth.js` shows the user doc pattern; rules at `/firestore.rules` (repo root) govern allowed writes.
- **Styling** → everything uses `src/theme.js` tokens. No global stylesheet — each component owns its `StyleSheet.create`.
- **Firebase config changes** → only `src/firebase.js` imports Firebase init; other files import named exports (`auth`, `db`, `storage`) from there.
- **Shared schema questions** (what fields on `clips`, `sets`, `setups`?) → read `/CLAUDE.md` at repo root. Don't duplicate that knowledge here.

**File sizes worth knowing**: every file in `/mobile/src/` is currently under 200 lines. If one grows past 300, break it up — that's a mobile-codebase smell, not a web-codebase one.

**When editing video/audio playback** → `ClipCard.js` is the one place. Don't sprinkle `useVideoPlayer` calls around; lift them into reusable components.
