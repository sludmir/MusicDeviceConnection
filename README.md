# LiveSet

**LiveSet** is a web app for music makers (DJs, producers, musicians) to design gear setups in 3D, save them, and share **live sets** with the community. Build your rig visually, post full-length sets (5 min–90 min) to your profile, and publish short clips (10 s–1 min) to a discovery feed so others can watch and follow you.

---

## Vision

- **Design your setup** — Interactive 3D scene to place and connect devices (DJ, Producer, or Musician rigs). Save multiple setups and switch between them.
- **Share your performance** — Upload a full-length live set to your profile. Choose 1–3 clips from that set to appear in the feed so people can discover you without watching the whole set.
- **Discover others** — Feed shows clips only from real full-length sets. Follow users, like clips, visit profiles to watch full sets and see their setups.
- **One place for rig + content** — Your profile links your saved setups and your uploaded live sets, so your gear and your music live together.

---

## Features

### Hub (Home)

- **Build my set** — Start a new setup: choose **DJ**, **Producer**, or **Musician**. Opens the 3D setup builder.
- **Recent setups** — Your saved setups (by type). Click to open in the 3D scene; edit and save again.
- **Post my set** — Opens the post flow: upload a full-length set video, optionally add a separate audio track, then pick 1–3 clips for the feed.

### 3D Setup Builder

- **Interactive scene** — Add devices from a catalog, place and rotate them, connect with virtual cables.
- **Setup types** — Different device sets and layout for DJ, Producer, and Musician.
- **Save setup** — Persist your rig to your profile with a name. Reopen from Hub or **My Sets**.

### Feed (Clips)

- **Clips from full sets only** — Every clip in the feed comes from a full-length live set (5 min–90 min) posted to a user’s profile. No standalone clips.
- **Scroll & watch** — Vertical feed; tap/click the video to **play/pause**. Optional separate audio track is synced per clip.
- **Social** — Like, comment/share UI; tap creator to open their profile. Followed users’ clips are prioritized.
- **Delete your clips** — Remove your own clips from the feed (with confirmation). Full set stays on your profile.

### Profile

- **Your profile (when signed in)** — Recently uploaded **live sets** (full-length), **saved setups** by type (DJ/Producer/Musician), and a **fave product** showcase.
- **Remove live sets** — Delete a set from your profile (with confirmation). That set and its feed clips are removed; the video file remains in storage.
- **Other users’ profiles** — View their sets and setups; **Follow** to prioritize their clips in your feed. Follower count shown.

### Post a Live Set

- **Full set** — One video, **5 min–90 min**. Upload from Hub or from the Feed (“Upload Set”).
- **Optional audio track** — Separate audio file (e.g. WAV) for better quality; sync via waveform.
- **Clips for the feed** — Pick **1, 2, or 3** segments of **10 s–1 min** each. They appear in the feed; the full set stays on your profile.
- **Title** — Optional title for the set (e.g. “Live at Club XYZ”).

### Navigation & Account

- **Header** — Logo (back to Hub), theme toggle (light/dark), profile menu when signed in.
- **Profile menu** — Search users, Notifications, Feed, My Profile, My Sets, Settings, Preferences, Product Management, Sign out.
- **My Sets** — List of your saved setups; open any in the 3D builder.
- **Search** — Find users and follow them.
- **Notifications** — Recent activity (e.g. new followers).
- **Settings** — Manage profile (display name, bio, etc.).
- **Preferences** — Budget and app options.
- **Product Management** — Manage products and prices (catalog used in the 3D builder).

### Tech & Data

- **Auth** — Google sign-in (Firebase Auth).
- **Data** — Firebase Firestore (users, setups, sets, clips, likes, follows, notifications) and Firebase Storage (set videos, optional audio).
- **Frontend** — React, Three.js for the 3D scene.

---

## Optimal User Experience (Workflow)

1. **Sign in** with Google.
2. **Build a setup** (Hub → “Build my set” → choose DJ/Producer/Musician). Add devices, connect cables, **Save setup** and name it.
3. **Post a live set** (Hub → “Post my set”, or Feed → “Upload Set”):
   - Upload a **full-length** video (5 min–90 min).
   - Optionally add a separate **audio track** and sync it.
   - Choose **1–3 clips** (10 s–1 min each) for the feed.
   - Add a title and post. The full set goes to **your profile**; the clips appear in the **Feed**.
4. **Discover** — Open **Feed**, scroll clips, tap to play/pause. Tap a creator to open their **profile** and watch the full set or see their setups. **Follow** to see their clips first.
5. **Manage content** — On your profile, **remove** a live set if needed (removes it and its clips from the feed). In the feed, **delete** your own clips with the delete button (confirm). Full sets stay on profile until you remove them.
6. **Reuse setups** — From **My Sets** or your profile, open a saved setup to edit in the 3D builder and save again.

---

## Getting Started

### Prerequisites

- Node.js (e.g. 18+)
- npm
- A Firebase project (Auth, Firestore, Storage, Hosting)

### Install and run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google (configure Firebase Auth and authorized domains as needed).

### Build and deploy

```bash
npm run build
firebase deploy
```

Or use the project script:

```bash
npm run deploy
```

This builds the app and deploys to Firebase (Hosting, Firestore rules, Storage rules, indexes). Configure `firebase.json` and your Firebase project so Hosting points at the `build` folder.

### Other scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm test`         | Run tests                            |
| `npm run lint`     | Run ESLint on `src`                  |
| `npm run emulate`  | Start Firebase emulators             |
| `npm run deploy:full` | Lint, test, then deploy           |

---

## Project structure (high level)

- `src/App.js` — Root layout, auth, routing (views), header and profile menu.
- `src/components/` — Feed, Profile, HubLandingPage, PostSetModal, Upload, UserSearch, Notifications, etc.
- `src/ThreeScene.js` — 3D setup builder (Three.js).
- `src/firebaseConfig.js` — Firebase app, Auth, Firestore, Storage.
- `firestore.rules`, `firestore.indexes.json` — Firestore security and indexes.
- `storage.rules` — Storage security (e.g. sets readable for playback).
- `docs/STORAGE_AND_SCALE.md` — Storage rules, clip audio notes, capacity and scaling.

---

## Live / hosted app

After deploy, the app is served from your Firebase Hosting URLs (e.g. `connectmyset.web.app`, `connectmyset-com.web.app` or your configured sites).

---

## License

Private / not specified in this repo. Confirm usage and licensing for your deployment.
