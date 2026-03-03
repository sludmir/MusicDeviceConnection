# Storage rules and scalability

## Clip audio (2nd/3rd clip silent)

If you uploaded a set **before** the feed audio fix (multiple clips from one set), the **2nd and 3rd** clip documents in Firestore may not have `audioTrackURL` / `audioOffsetSeconds` saved. In that case only the first clip will have audio in the feed. Re-uploading the set (or posting a new set with the current app) will save the same audio metadata on every clip, so all clips will have audio.

## Why you saw `storage/unauthorized`

Videos are stored in Firebase Storage and their URLs are used in `<video src="...">`. The **browser** loads that URL with a plain GET request and does **not** send the Firebase Auth token. So Storage was evaluating **read** with no user → `isSignedIn()` was false → access denied.

**Fix applied:** `sets/` (and everything under it, including `sets/audio/`) now use `allow read: if true` so download URLs work when embedded in the app. **Write** is still restricted to signed-in users and to files that pass `isValidVideo()` (video type, &lt; 5GB).

After changing rules, deploy:

```bash
firebase deploy --only storage
```

---

## How heavy can files be?

- **Firebase Storage limit:** 5GB per file (already enforced in `storage.rules` via `isValidVideo()`).
- **Realistic range for 5–90 min sets:**
  - 720p, moderate bitrate: ~100–400 MB
  - 1080p: ~300 MB–1.2 GB
  - So the current setup can handle typical full-length sets without changing backend.

If you want to avoid very large uploads (e.g. 4K), you can lower the cap in `storage.rules` (e.g. 1.5 GB) by changing the `isValidVideo()` size check.

---

## Do you need to switch to MongoDB?

**No, not for this ecosystem.**

- **Videos** → stay in **Firebase Storage** (or another object store like S3/GCS). MongoDB is not a good fit for large video files or streaming.
- **Metadata** (sets, clips, users, likes, etc.) → **Firestore**. It’s document-based and scales well for this use case.

MongoDB would only replace **Firestore** (the database for metadata), not Storage. Moving to MongoDB makes sense if you need different query patterns, run everything on a different cloud, or have other product reasons to leave Firebase—not because of file size or “scalability” of the current design.

**When scaling might matter:**

- **Storage:** If you get a lot of traffic and cost becomes an issue, you can add a CDN in front of Storage URLs or move large assets to Cloud Storage + CDN, while keeping the same app flow (URLs in Firestore).
- **Firestore:** Handles high read/write rates and is suitable for feed-style apps. You’d only switch to MongoDB (or another DB) for data model or infra reasons, not because of video file size.

Summary: Keep Firebase for this app; the unauthorized error was due to read rules, not ecosystem limits. Deploy the updated `storage.rules` and you should be good.

---

## How much content can the site handle? (5GB sets)

Firebase doesn’t impose a hard “max number of files” or “max total GB.” It scales; the real limits are **cost** and **when** it’s worth changing architecture.

### Rough capacity (order of magnitude)

- **Firestore:** Set/clip metadata is tiny (a few KB per set). Even tens of thousands of sets are fine. Not the bottleneck.
- **Storage:** You pay for **stored GB/month** and **egress** (downloads when people watch).

Approximate **storage cost** (Firebase Storage, US multi-region, 2024-style pricing; check [Firebase pricing](https://firebase.google.com/pricing) for current numbers):

| Total stored (all sets) | Example (# of 5GB sets) | Storage cost/month (ballpark) |
|-------------------------|--------------------------|-------------------------------|
| 50 GB                   | ~10 sets                 | ~\$1–2                        |
| 500 GB                  | ~100 sets                | ~\$13–15                      |
| 2 TB                    | ~400 sets                | ~\$52–60                      |
| 5 TB                    | ~1,000 sets              | ~\$130–150                    |

**Egress (streaming)** is separate: each time someone watches a set or clip, you pay for the bytes downloaded. Heavy viewing can exceed storage cost.

So in terms of “how many 5GB sets”:

- **Tens of sets:** Fine; cost is low.
- **Hundreds of sets:** Still fine on Firebase; watch the bill (storage + egress).
- **Thousands of sets (or heavy streaming):** Cost and single-region delivery become real. That’s when to think about a more scalable backend.

### When to consider a more scalable backend

Consider changes when:

1. **Cost** – Storage + egress bills are too high for your usage/revenue.
2. **Streaming load** – Lots of concurrent viewers; you want a CDN and possibly transcoding (multiple qualities, HLS/DASH).
3. **Global audience** – You want lower latency and cheaper egress in multiple regions (CDN + storage in several regions or behind Cloud CDN).
4. **Compliance / control** – You need different retention, regions, or vendor lock-in reduction.

**Typical next steps (not “replace Firebase” overnight):**

- Put a **CDN** (e.g. Cloud CDN, Cloudflare) in front of Firebase Storage URLs so repeated views are cheaper and faster.
- Move **large video assets** to **Cloud Storage** (same GCP project) and serve via CDN; keep Firebase for auth and Firestore for metadata and URLs.
- Add **transcoding** (e.g. Cloud Video Intelligence / Transcoder API or a third-party) to generate multiple resolutions and/or HLS/DASH for adaptive streaming.

**Bottom line:** The site can “handle” a lot of 5GB sets (hundreds to low thousands) before you *must* change something. The trigger is usually **cost** or **streaming performance**, not a hard Firebase limit. Start with Firebase; add CDN and/or different storage when the numbers justify it.
