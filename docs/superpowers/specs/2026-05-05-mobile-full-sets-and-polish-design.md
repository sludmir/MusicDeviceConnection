# Mobile App: Full Sets Mode + Visual Polish — Design

**Date:** 2026-05-05
**Scope:** `/mobile/` (Expo SDK 54, React Native 0.81)
**Status:** Approved for implementation planning

---

## Goal

Two parallel objectives for the LiveSet mobile app:

1. **Promote full sets to first-class status.** The app currently only consumes clips. Full sets are the core concept of LiveSet, so they need a dedicated browse, watch, and link-back experience.
2. **Raise visual quality.** Current screens read as functional but generic. A consolidated theme, refined card treatments, and targeted motion bring the app closer to a premium feel without restructuring logic.

The two efforts share a foundation (the new theme/Card system), so they're built together.

---

## Non-Goals

- Building/editing 3D setups on mobile (web-only feature).
- Custom icon set, splash/branding, custom fonts.
- Web-app changes (e.g., the shared Firestore rules fix for non-creator likes — flagged separately).
- Curated shelves / Netflix-style rows for sets (deferred to v2 once content volume justifies it).
- Live streaming or anything beyond playback of pre-uploaded `sets`.
- Push notifications for set publishing (handled in the existing roadmap day 6).

---

## High-Level UX Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where do full sets live? | Two-mode Feed: toggle between **Clips** and **Sets** modes at the top | Keeps tab count lean; sets and clips share the "Following / For You" mental model |
| Sets browse layout | Vertical list of large 16:9 cards | Matches the "core concept" framing — each set deserves real estate; mirrors social-feed muscle memory |
| Set viewer style | Hybrid: YouTube-style detail page by default, fullscreen flip on demand | Detail view exposes setup link, related clips, creator; fullscreen exists for immersive watching |
| Clip → Set linkage | "Full Set" button on clip card → `SetDetail` with `seekTo` | Schema already has `fullSetId`; surfacing it makes the relationship navigable |
| Set → Clips linkage | (a) Clip markers on scrubber (intra-set seek) and (b) "Clips from this set" rail (inter-screen nav) | Visual ties between long-form and short-form content |
| Visual polish targets | Typography + card/surface system + targeted motion (3 specific places) | A+B issues account for the bulk of perceived quality; motion is selective, not pervasive |

---

## Architecture

### Feed mode switching

The Feed screen gains a mode-toggle pill above the existing Following/For You sub-tab. State:

- `feedMode: 'clips' | 'sets'` — persisted to AsyncStorage under key `liveset.feedMode`.
- `feedTab: 'following' | 'foryou'` — unchanged, lives inside each mode.

The two modes render mutually exclusive component trees keyed by `feedMode`. Mode swap unmounts the outgoing tree (releasing its `useVideoPlayer` instances) and mounts the incoming tree fresh, with a 200ms cross-fade.

### Audio safety on mode swap

The hard requirement from kickoff: no audio bleeding across mode swaps or navigation events. Structural rules:

1. **No global player.** Every visible card owns its own `useVideoPlayer` instance.
2. **`MediaCoordinator` (`src/utils/mediaCoordinator.js`)** — a small JS object (not a context) that tracks the currently-playing media id and exposes `register(id, pauseFn)`, `play(id)`, `stopAll()`. Cards register on mount, deregister on unmount. Mode swap calls `stopAll()` synchronously before unmounting.
3. **`useFocusEffect` on Feed screen** pauses-and-mutes-all on blur (tab change or stack push to detail).
4. **Sets/clips with `audioTrackURL`** use a shared hook `useSyncedAudio(player, audioUrl, offset)`. The hook owns its `expo-audio` instance and tears it down in the same cleanup path as the video — no orphan audio possible.
5. **Mode-swap effect** sets `outgoingPlayer.muted = true; outgoingPlayer.pause()` *before* the unmount animation, so even if `expo-video` releases asynchronously, no sound escapes.

### Navigation

`RootStack` gains two new screens:

```
RootStack
├── Tabs (existing)
├── UserProfile (existing)
├── SetDetail        ← new, headerShown: false, params: { setId, seekTo? }
└── SetFullscreen    ← new, headerShown: false, params: { setId, playerHandle }
```

`SetFullscreen` is pushed from `SetDetail`. The `useVideoPlayer` instance is owned by `SetDetail` and passed by reference through navigation params — keeps playback continuous across the flip.

### Data access

All reads use the shared Firebase project `musicdeviceconnection`. No schema changes — existing fields are sufficient:

- `sets` — already has `creatorId`, `title`, `videoURL`, `durationSeconds`, `setupId?`, `audioTrackURL?`, `audioOffsetSeconds?`.
- `clips` — already has `fullSetId`, `clipStart`, `clipEnd`, `videoURL`.
- `users` — already has `following[]` and `followers[]`.

Queries:

- **Sets For You feed:** `query(collection(db, 'sets'), orderBy('createdAt', 'desc'), limit(20))`, paginated with `startAfter`. Client-side rerank: items whose `creatorId ∈ following[]` bumped to top, rest sorted by likes (mirrors existing clip logic in `FeedScreen`).
- **Sets Following feed:** `query(collection(db, 'sets'), where('creatorId', 'in', followingIds[0..9]), orderBy('createdAt', 'desc'))`. If `following.length > 10`, run multiple `in` queries (Firestore caps at 10) and merge client-side.
- **Clip markers in Set Detail:** `query(collection(db, 'clips'), where('fullSetId', '==', setId))`, fetched once on screen mount.
- **More from creator:** `query(collection(db, 'sets'), where('creatorId', '==', creatorId), orderBy('createdAt', 'desc'), limit(6))`, lazy-loaded when the user scrolls within 200px of that section.

### Thumbnail generation

Set cards need 16:9 thumbnails. Strategy: lazy-generate from the video first frame using `expo-video`'s frame extraction (or a `<Video>` invisible-render-to-bitmap fallback if needed), cached under `expo-file-system` cacheDirectory at `sets/thumbs/{setId}.jpg`. While loading, show a gradient placeholder using the setup-type's accent shade. If the `sets` doc later gains a `thumbnailURL` field (out of scope for this work but a likely follow-up), the cached path is bypassed.

---

## Component Inventory

### New components

| File | Purpose |
|------|---------|
| `src/components/Card.js` | Reusable surface: `surface.1` bg, 12px radius, hairline border, press feedback (scale 0.98 + accent-soft glow). All cards in the app route through this. |
| `src/components/SetCard.js` | The vertical-list set card. 16:9 thumbnail, duration pill, setup-type badge, hotness bar, creator row, title. Uses `Card`. |
| `src/components/Scrubber.js` | Custom video scrubber. 4px track, draggable playhead, optional clip-marker segments overlaid as 6px translucent `#00a2ff` bands at `[clipStart, clipEnd]` ranges. Tap-marker → seek + 2s floating chip. |
| `src/components/FeedModeToggle.js` | Pill toggle (Clips / Sets). Animated highlight pill slides between the two states. |
| `src/screens/SetDetailScreen.js` | The hybrid-C detail page. Player at top, scrollable info below. Owns the `useVideoPlayer` instance shared with fullscreen. |
| `src/screens/SetFullscreenScreen.js` | Fullscreen modal route. Locks orientation to landscape via `expo-screen-orientation`, hides status bar, single-tap controls, swipe-down to exit. |
| `src/hooks/useSyncedAudio.js` | Extracted from `ClipCard`. `useSyncedAudio(player, audioUrl, offsetSeconds)` — handles drift correction and lifecycle. Used by both clip card and set player. |
| `src/utils/mediaCoordinator.js` | Singleton coordinator: `register(id, pauseFn)`, `unregister(id)`, `play(id)`, `stopAll()`. |

### Modified components

| File | Change |
|------|--------|
| `src/theme.js` | Add typography scale (display/title/subtitle/body/caption/micro), three-layer surface palette, refined accent variants, hairline color, text.primary/secondary/tertiary. Existing tokens preserved for backward compat. |
| `src/screens/FeedScreen.js` | Add `feedMode` state + AsyncStorage persistence; render `FeedModeToggle`; key the list section on `feedMode` so swap fully unmounts; call `MediaCoordinator.stopAll()` on swap; route to `SetCard` list when in Sets mode. |
| `src/components/ClipCard.js` | Migrate to `useSyncedAudio` hook; add "Full Set" action button (hidden if no `fullSetId`); route through new theme tokens; integrate with `MediaCoordinator`. |
| `src/navigation/RootStack.js` | Register `SetDetail` and `SetFullscreen` routes. |
| `src/screens/UserProfileScreen.js`, `DiscoverScreen.js`, `PostScreen.js`, `AuthScreen.js` | Theme refresh only — no logic changes. Adopt new tokens, replace ad-hoc card styling with `Card`. |

### New dependency

- `expo-screen-orientation` — for landscape lock in fullscreen mode.

---

## Visual System

### Typography scale (added to `theme.js`)

| Token | Size | Weight | Letter-spacing | Use |
|-------|------|--------|----------------|-----|
| `display` | 28 | 700 | -0.5 | Screen-level headers (rare) |
| `title` | 20 | 700 | -0.3 | Set/clip titles, screen titles |
| `subtitle` | 16 | 600 | 0 | Section headers |
| `body` | 15 | 400 | 0 | Default reading text |
| `caption` | 13 | 500 | 0 | Meta lines (creator · date · likes) |
| `micro` | 11 | 600 | 0.5 (uppercase) | Badges (DJ / Producer / Musician) |

Platform default font (San Francisco / Roboto). No custom font load.

### Color additions (existing tokens preserved)

| Token | Value | Use |
|-------|-------|-----|
| `surface.0` | `#0A0B0D` | App background |
| `surface.1` | `#13151A` | Card background |
| `surface.2` | `#1B1E25` | Elevated surfaces (modals, pressed cards) |
| `accent` | `#00a2ff` (existing) | Brand accent |
| `accentSoft` | `rgba(0,162,255,0.12)` | Tinted backgrounds, badge fills |
| `accentGlow` | `rgba(0,162,255,0.35)` | Press glow on cards |
| `text.primary` | `#F5F7FA` | Default text |
| `text.secondary` | `rgba(245,247,250,0.65)` | Meta text |
| `text.tertiary` | `rgba(245,247,250,0.4)` | Disabled / placeholder |
| `hairline` | `rgba(255,255,255,0.06)` | Borders (used instead of shadows on dark UI) |

### Targeted motion

Only three places get motion treatment:

1. **Mode swap cross-fade** — 200ms opacity cross-fade between Clips and Sets modes.
2. **Card press feedback** — scale to 0.98 (160ms spring), `surface.2` background lift, `accentGlow` inner glow fades in. Implemented in the `Card` component, inherited everywhere.
3. **Set card → Set Detail transition** — capture the tapped card's rect via `measureInWindow`, animate the Set Detail player from that rect to its destination (250ms cubic). Falls back to a default stack push if measurement fails.

No other animations. No transitions on text, no parallax, no spring-loaded screens.

---

## Screen-by-Screen Behavior

### Feed (Clips mode)

Behaviorally unchanged. Visually retouched: cards adopt the new theme, action rail gets a "Full Set" button (hidden if no `fullSetId`).

**Full Set tap:** calls `MediaCoordinator.stopAll()`, then `navigation.push('SetDetail', { setId: clip.fullSetId, seekTo: clip.clipStart })`.

### Feed (Sets mode)

Vertical `FlatList` of `SetCard` components.

- Card layout (top→bottom): 16:9 thumbnail with duration pill (bottom-right) and setup-type badge (bottom-left); 3px hotness bar beneath thumbnail edge (subtle visual indicator scaling with normalized like count); creator row (28px avatar + title + meta line `creatorName · relativeTime · likeCount`).
- Tap targets: whole card → `SetDetail`; avatar/name region → `UserProfile` (event propagation stopped).
- Spacing: 16px horizontal margin, 20px vertical gap between cards.
- Pagination: standard FlatList `onEndReached` with `startAfter` cursor.
- Empty state (Following): "Follow some artists to see their sets here" CTA → opens Discover.
- Loading state: 4 shimmer skeleton cards.

### Set Detail

Pushed onto root stack with `{ setId, seekTo? }`.

**Layout:**

1. **Player (16:9, top edge under status bar)** — custom controls overlay: play/pause, current/total time, scrubber with clip markers, mute, fullscreen-flip.
2. **Title & meta row** — title (title token), creator avatar+name (tappable), relative date, duration, setup-type badge.
3. **Action bar** — Like, Share, Save, Follow (hidden on own set).
4. **"View Setup" card** — only renders if `set.setupId` exists. Mini card showing setup name, type, device count. Tap → push existing `SetupViewer` screen.
5. **Description** — collapsible 3-line clamp.
6. **Clips from this set** — horizontal scroll of small clip thumbnails (4:5, 120px wide). Tap → opens clip player with parent-set context. Section hidden if no clips.
7. **More from this creator** — horizontal scroll, lazy-loaded on scroll proximity.

**Scrubber clip markers:** rendered from `clips where fullSetId == setId` query. Each marker is a translucent `#00a2ff` band spanning the clip's `[clipStart, clipEnd]` range relative to set duration. Tap → seek to `clipStart`, show floating chip "From clip: {title}" for 2s.

**`seekTo` param:** if present on first load, player seeks to that time once metadata loads.

**Audio track swap:** `useSyncedAudio` handles `audioTrackURL` + `audioOffsetSeconds` if present on the set doc.

### Set Fullscreen

Pushed from Set Detail. Receives the live player handle by ref through nav params.

- `expo-screen-orientation` locks to landscape on mount, restores on unmount.
- Status bar hidden.
- Single-tap toggles a minimal control overlay (play/pause, scrubber-with-markers, exit).
- Swipe-down gesture exits.
- Player instance is preserved — playback is uninterrupted across the flip.

### Other screens (theme refresh only)

`UserProfileScreen`, `DiscoverScreen`, `PostScreen`, `AuthScreen` — adopt new theme tokens, replace ad-hoc card styling with `Card`. No logic changes.

---

## Edge Cases & Failure Modes

| Case | Handling |
|------|----------|
| Set has no `setupId` | "View Setup" card hidden entirely (no empty state). |
| Set has no clips derived | "Clips from this set" section hidden; scrubber renders without markers. |
| `fullSetId` references a deleted set | "Full Set" button on clip still navigates; SetDetail shows "This set is no longer available" empty state with a back button. |
| User follows >10 creators | Sets Following feed runs multiple `in` queries (chunks of 10), merges and dedupes client-side, sorts by `createdAt desc`. |
| Thumbnail generation fails | Gradient placeholder remains; retry on next mount. No user-visible error. |
| Mode swap during active playback | `MediaCoordinator.stopAll()` runs synchronously; outgoing player muted+paused before unmount. |
| Fullscreen flip on Android with hardware back | Hardware back exits fullscreen (not the screen). |
| Orientation lock fails (older devices) | Fullscreen still works, just stays portrait. Logged as a non-fatal warning. |
| `seekTo` on a player that hasn't loaded metadata | Buffer the seek; apply once `playerStatus === 'readyToPlay'`. |
| Likes write blocked by Firestore rules | Optimistic UI update only (matches existing clip-like behavior, documented in mobile CLAUDE.md). |

---

## Out of Scope (Explicit)

- Custom icon set / splash / branding pass.
- Web-app changes (likes rule fix, etc.).
- New Firestore fields or schema migrations.
- Push notifications for set publishing.
- Live streaming.
- Curated shelves / Netflix-style rows.
- 3D scene editing on mobile.
- Comment threads on sets.

---

## Success Criteria

- A user can flip between Clips and Sets modes in the Feed without any audio artifacts.
- A user can browse a vertical list of full sets, tap one, watch it, see clips derived from it on the scrubber, jump to the linked 3D setup, and flip to fullscreen landscape.
- A user watching a clip can tap "Full Set" and land at the corresponding set, scrubbed to where the clip was cut from.
- All screens read as cohesive — single typography scale, three-layer surface system, consistent card treatment.
- File-size discipline holds (no file in `/mobile/src/` exceeds ~300 lines per the existing mobile codebase smell rule).
