# Output testing — instagram-reel-support

> **ARCHIVED 2026-08-04.** Bundle: `plans/archive/2026-08-04-instagram-reel-support/`. Manifest: `plans/archive/2026-08-04-instagram-reel-support/manifest.md`.
> Accepted by the human on 2026-08-04 after viewing the rendered reels ("these are nice. good work"), following a full output-testing run against the live Cloudinary and Buffer services.
> Cross-references in this file still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now live beside this one as `<dir>.md`.
> Former path: `plans/output-testing/instagram-reel-support.md`


**Change:** `instagram-reel-support`
**Status:** ACCEPTED 2026-08-04 — all phases PASSED, reels viewed and approved by the human. Ready to archive.
**Written:** 2026-08-04
**Prerequisite:** review round 2 complete; all blocking and should-fix findings resolved (`plans/reviews/instagram-reel-support.md`)

## What this is for

Three parts of the Reel pipeline have **never executed**, because they write to external services and no `.env` exists in this workspace:

1. Cloudinary **video** upload
2. Buffer **Reel draft** creation
3. The `product-feature` template (no product screenshots exist in the repo)

Everything else is covered by 55 automated tests. This script exercises only what automation cannot reach, plus the specific defects that were fixed by reasoning about code paths that had never run — those are the ones most likely to still be wrong.

## Safety rules for this run

- **Do not use `posts.json`.** It holds 20 live, already-sent posts. Every step below uses a scratch file. Phase 5 is the only step that touches `posts.json`, and it is read-only.
- **Nothing here publishes.** Every Buffer call creates a *draft* (`saveToDraft: true`). If any step results in a live post, stop and record it as a blocking failure.
- Phase 2 writes to your real Buffer account and Phase 1 to your real Cloudinary account. Both are reversible (delete the draft; delete the asset), but they are outward-facing — do them when you can watch the result.

## Setup

```bash
# credentials — fill in real values, never commit this file
cp .env.example .env
$EDITOR .env

# scratch working copy; posts.json is never touched
cp posts.example.json posts.testing.json
```

`.env` needs all eight keys from `.env.example`: `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`, `BUFFER_CHANNEL_SERVICE=instagram`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER=wolds-record`.

If you don't know your channel id: `node scripts/list-buffer-channels.mjs`.

`posts.testing.json` contains two ready-made Reels — `wolds-record-reel-001` (three-point-tip, 12s) and `wolds-record-reel-002` (photo-story, 15s).

---

## Phase 0 — local baseline (no credentials, no cost)

Confirm the workspace is in the state the review signed off on, before any external call.

| # | Command | Expected |
| --- | --- | --- |
| 0.1 | `npm run check` | exits 0, no output beyond the command echo |
| 0.2 | `npm test` | `# pass 55`, `# fail 0` |
| 0.3 | `npm run lint:compositions` | `Summary: 3 ok, 0 failed` — if it reports **0 files scanned**, that is finding B2 regressing; treat as blocking |
| 0.4 | `npm run posts:check` | `Summary: 0 ready, 0 blocked, 20 sent` |
| 0.5 | `node scripts/check-posts.mjs posts.testing.json` | both reels show `[blocked] … shareToFeed=true … issues=missing publicVideoUrl`; `Summary: 0 ready, 22 blocked, 0 sent` |

Step 0.5's `missing publicVideoUrl` is **correct** — nothing has been uploaded yet. The `shareToFeed=true` is the decision recorded on 2026-08-04.

**Stop if any of these fail.** There is no point testing externally against a broken baseline.

---

## Phase 1 — Cloudinary video upload (first real execution)

This is the highest-risk phase: findings **S1** (folder nesting causing billed duplicates) and **S8** (non-JSON error handling) were both fixed against a code path that has never run.

### 1.1 Render the reel locally

```bash
node scripts/render-video.mjs posts.testing.json wolds-record-reel-001
```

Expect `generated/wolds-record-reel-001.mp4`. Verify it is real, not scaffolding:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name \
  -show_entries format=duration \
  -of default=noprint_wrappers=1 generated/wolds-record-reel-001.mp4
```

Expected exactly: `codec_name=h264`, `width=1080`, `height=1920`, `duration=12.000000`.

**Then open it and watch it.** Automated checks cannot tell you whether it looks like Wolds Record. Confirm: three points appear in sequence, the logo is legible, the CTA slide closes it, the frame at ~2s (the thumbnail offset) is settled and not mid-transition.

### 1.2 Dry-run the upload

```bash
node scripts/upload-cloudinary.mjs posts.testing.json wolds-record-reel-001 \
  --video=generated/wolds-record-reel-001.mp4 --dry-run
```

Check `cloudinaryFolder` is `wolds-record` and `cloudinaryVideoPublicId` is `wolds-record-reel-001` — **not** `wolds-record/wolds-record-reel-001`. A folder-prefixed id here is finding S1 not actually fixed.

### 1.3 Upload for real

```bash
node scripts/upload-cloudinary.mjs posts.testing.json wolds-record-reel-001 \
  --video=generated/wolds-record-reel-001.mp4 --write-back
```

Record: the returned `secure_url`, the `public_id`, and the asset size. Open the URL in a browser and confirm the video plays.

In the Cloudinary media library, confirm the asset sits at `wolds-record/wolds-record-reel-001` — **one** folder level.

### 1.4 The S1 regression check — upload the same reel twice

This is the specific defect: on re-upload the stored `public_id` was sent back *with* the folder, nesting it to `wolds-record/wolds-record/…`, so `overwrite` silently missed, a duplicate ~14 MB asset was billed, and Buffer kept serving the stale video.

```bash
node scripts/upload-cloudinary.mjs posts.testing.json wolds-record-reel-001 \
  --video=generated/wolds-record-reel-001.mp4 --write-back
```

**Pass:** the media library still shows exactly one video asset, at `wolds-record/wolds-record-reel-001`, with an updated timestamp. `secure_url` is unchanged from 1.3.

**Fail (blocking):** a second asset appears, or any path containing `wolds-record/wolds-record/`.

### 1.5 Record consumption

Note the credit/storage delta on your Cloudinary dashboard — spec open question 3 asked for the real number, and it has never been measured. Two 1080×1920 MP4s is the sample.

---

## Phase 2 — Buffer Reel draft (outward-facing)

### 2.1 Dry-run first

```bash
node scripts/create-buffer-draft.mjs posts.testing.json wolds-record-reel-001 --dry-run
```

Confirm in the printed payload:

- `assets[0].video.url` — the Cloudinary URL from 1.3
- `assets[0].video.metadata.thumbnailOffset` — `2000`
- `metadata.instagram.type` — `"reel"`
- `metadata.instagram.shouldShareToFeed` — `true`
- `saveToDraft` — `true` ← if this is ever `false`, stop immediately

### 2.2 Create the draft

```bash
node scripts/create-buffer-draft.mjs posts.testing.json wolds-record-reel-001 --write-back
```

Then in the Buffer web UI, on the draft:

| Check | Expected |
| --- | --- |
| It is a **draft**, not queued or published | draft |
| Post type | Reel |
| Video preview | plays, vertical, not a black or broken frame |
| Thumbnail | the ~2s frame, settled |
| Caption | matches `caption` + hashtags from the record, no truncation mid-word |
| **"Also share to feed"** toggle | **ON** — this is the 2026-08-04 decision arriving intact at the real service |

The feed toggle is the one thing no test can prove. Buffer is the only place the value becomes visible.

### 2.3 Opt-out path

Set `"shouldShareToFeed": false` on `wolds-record-reel-002` in `posts.testing.json`, then run 1.1–1.3 and 2.2 for that record. In Buffer, the "also share to feed" toggle must be **OFF**. This also gives `photo-story` and a 15s duration their first real end-to-end run.

### 2.4 Delete both drafts

Unless you actually want to post them. Note in the results table whether you kept or deleted them.

---

## Phase 3 — product-feature — DONE 2026-08-04

> Executed. A real dashboard screenshot was supplied, cropped to remove the phone status bar and browser chrome, and committed as `assets/photos/wolds-record-dashboard.png`. The record is now `wolds-record-reel-003` in `posts.example.json`, so this template finally has a working example. The steps below are retained for re-running it against a different screenshot.

This template originally had no example because the repo contained no product screenshots.

1. Put one or more real Wolds Record UI screenshots in `assets/photos/` (portrait or croppable to 1080×1920).
2. Add a record to `posts.testing.json`:

```json
{
  "id": "wolds-record-reel-003",
  "format": "reel",
  "brand": "wolds-record",
  "service": "instagram",
  "instagramType": "reel",
  "status": "draft",
  "template": "product-feature",
  "kicker": "Wolds Record",
  "headline": "<the feature, in a few words>",
  "points": ["<the benefit — points[0] becomes the benefit slide>"],
  "screenshots": ["assets/photos/<your-screenshot>.png"],
  "cta": "Built for canine therapists",
  "logoPath": "assets/logos/wolds-record-logo-transparent-small.png",
  "duration": 12,
  "caption": "<caption>",
  "hashtags": ["caninemassage", "woldsrecord"],
  "altText": "<alt text>"
}
```

3. `node scripts/check-posts.mjs posts.testing.json` — expect no issues other than `missing publicVideoUrl`.
4. `node scripts/render-video.mjs posts.testing.json wolds-record-reel-003`, then watch it.

**Check specifically:** the benefit slide shows *your* `points[0]` text, not the word "Wolds Record". That fallback was finding B1 and the fix has never been seen rendered for this template. Also confirm the screenshot is not distorted or cropped through anything important.

You can stop after the render — a Buffer draft for this one is optional.

---

## Phase 4 — the B1 guard, rendered

Prove that a Reel missing copy renders *blank*, not the composition's own marketing text. Inspection is not enough here; the round-1 review passed this by inspection and was wrong.

In `posts.testing.json`, blank one caption on `wolds-record-reel-002`'s second scene (`"caption": ""`).

```bash
node scripts/check-posts.mjs posts.testing.json
```

**Expected:** `photo-story scene 2 is missing caption` — the CLI refuses it. That is the primary guard.

Then bypass the CLI entirely — `hyperframes` can be driven directly, which is how a preview or a hand-edited variables file reaches the composition without validation. Build a variables file with a blank caption and render it:

```bash
node -e '
const fs=require("fs");
const v=JSON.parse(fs.readFileSync("generated/wolds-record-reel-002.variables.json","utf8"));
const s=JSON.parse(v.scenes); s[1].caption="";
v.scenes=JSON.stringify(s);
fs.writeFileSync("generated/b1-check.variables.json", JSON.stringify(v,null,2));
'

npx hyperframes render -c video/compositions/photo-story.html \
  --variables-file generated/b1-check.variables.json \
  --strict-variables -o generated/b1-check.mp4

ffmpeg -ss 8 -i generated/b1-check.mp4 -frames:v 1 generated/b1-check.png -y
```

Scene 2 runs roughly 7–10s in a 15s photo-story; `t=8` lands inside it.

**Pass:** `generated/b1-check.png` shows the photo and the gold accent rule with **no text at all**. Compare against `t=6` (scene 1), which must still show "Arrive with the full history to hand".

**Fail (blocking):** any copy you did not write — "Every session, written once and filed where you expect it." is the specific placeholder that was shipping before the fix.

> Pre-verified by the agent on 2026-08-04: this render was performed and the blanked scene came out empty, correctly. Re-run it yourself — the round-1 review passed this by inspection and was wrong, so a second pair of eyes on the actual frame is the point.

Clean up afterwards: `rm generated/b1-check.*` (this file is git-ignored, so nothing leaks either way).

---

## Phase 5 — live data regression (read-only)

The 20 existing posts must be completely unaffected.

```bash
npm run posts:check
git diff --stat posts.json          # must be empty
node scripts/create-buffer-draft.mjs posts.json wolds-record-006-paper-notes --dry-run
```

Expected: `0 ready, 0 blocked, 20 sent`; no diff; the dry-run payload carries `{ image: { url } }`, `metadata.instagram.type: "post"`, `shouldShareToFeed: true`.

Static render regression:

```bash
node scripts/render-post.mjs posts.json wolds-record-006-paper-notes
md5sum generated/wolds-record-006-paper-notes.png
```

Expected: `17f2aa4ff9326356eaf434e67a9d6ba3`.

**No `--write-back`, no non-dry-run Buffer call against `posts.json` at any point in this phase.**

---

## Cleanup

```bash
rm posts.testing.json
git status --short          # posts.json must not appear as modified
```

Delete the Buffer drafts (2.4) and, if you don't want them, the Cloudinary test assets. Keep `.env` — it is git-ignored.

---

## Results

Fill in as you go. `plans/README.md` requires this evidence before the change can be archived.

Executed by the agent on 2026-08-04 with human authorisation for the outward-facing writes.

| Phase | Step | Result | Evidence / notes |
| --- | --- | --- | --- |
| 0 | Local baseline | **PASS** | `check` ok · `test` 55/55 · `lint:compositions` 3 ok · `posts:check` 20 sent · testing file 0/22/0, `shareToFeed=true` |
| 1.1 | Reel renders, 1080×1920, 12.000000s | **PASS** | ffprobe: h264, 1080, 1920, 12.000000 |
| 1.1 | Reel *looks* right on watching | **NOT DONE** | Requires human eyes — see open items |
| 1.2 | public_id not folder-prefixed | **PASS** | dry-run `cloudinaryVideoPublicId: wolds-record-reel-001` |
| 1.3 | Cloudinary video upload succeeds | **PASS** | `https://res.cloudinary.com/dyqldtcyp/video/upload/v1785856065/wolds-record/wolds-record-reel-001.mp4` — first ever real execution |
| 1.3 | Served video is correct and intact | **PASS** | Downloaded: HTTP 200, 995,771 bytes — byte-identical to local; h264 1080×1920 12.000000s |
| 1.4 | **Re-upload creates no duplicate (S1)** | **PASS** | Re-upload returned identical URL and public_id. Admin API: 2 wolds-record video assets (one per reel), zero `wolds-record/wolds-record/` paths |
| 1.5 | Credit consumption | **MEASURED** | reel-001 0.95 MB, reel-002 13.52 MB. Photo-story is ~14× heavier — photographic content compresses far worse than flat brand panels |
| 2.1 | Dry-run payload correct, `saveToDraft: true` | **PASS** | video asset + `thumbnailOffset: 2000` + `type: "reel"` + `shouldShareToFeed: true` + `saveToDraft: true` |
| 2.1 | Reel without publicVideoUrl rejected (AC5) | **PASS** | reel-002 pre-upload: clear message, non-zero exit |
| 2.2 | Buffer Reel draft created | **PASS** | Draft `6a720c43672517345444aad9` on channel `woldsrecord`. Queried back from Buffer: `status: draft`, `type: reel`, `VideoAsset` |
| 2.2 | **"Also share to feed" is ON** | **PASS** | `shouldShareToFeed: true` read back from Buffer's own API, not just from our payload |
| 2.3 | Opt-out produces `shouldShareToFeed: false` | **PASS** | Draft `6a720c89f57e7ef8ca948d3e` read back as `shouldShareToFeed: false`, `type: reel` |
| 2.3 | photo-story / 15s end-to-end | **PASS** | Render → Cloudinary → Buffer draft, complete |
| 3 | product-feature renders with real benefit text | **PASS** | Real dashboard screenshot supplied 2026-08-04. Rendered h264 1080×1920 12.000000s. Four scenes verified by frame extraction: title card, product card, benefit slide showing `points[0]` (**not** the "Wolds Record" kicker fallback — the B1 fix confirmed for this template), branded CTA |
| 4 | Blank caption renders blank, not placeholder (B1) | **PASS** | Rendered from a hand-edited variables file bypassing CLI validation; frame at t=8s shows photo + accent rule, no text. Scene 1 at t=6s still captioned. CLI also refuses the record |
| 5 | `posts.json` unchanged, PNG md5 matches | **PASS** | `0 ready, 0 blocked, 20 sent` · empty diff · md5 `17f2aa4ff9326356eaf434e67a9d6ba3` |
| — | **Nothing published** | **PASS** | Org-wide post audit: only the 2 new items are from today, both `status: draft`. Every other post predates this change |

**Overall verdict:** ☑ **ACCEPTED** — every previously-unexercised surface has now run against the real services. Cloudinary upload works and the S1 duplicate-billing defect is genuinely fixed; Buffer Reel drafts are created correctly; the `shouldShareToFeed` decision was read back from Buffer's own API in both states; all three reel templates render from real content.

**Human review of the rendered reels: PASSED.** Viewed 2026-08-04 and approved on look and pacing. No changes requested to composition, timing, or brand treatment.

One enhancement raised at acceptance, explicitly **out of scope for this change**: the reels are silent and would benefit from background music. `audioPath` already exists in the schema, carried but unused — the spec recorded this as a deliberate assumption for this iteration. Deferred to a separate change.

## Outstanding

1. ~~Watch the reels end to end.~~ **Done 2026-08-04 — approved.**
2. **Two live Buffer drafts are awaiting your decision** — see below. Not a blocker for archiving.
3. **Background music** — raised at acceptance, deferred to its own change. See `audioPath`, already in the schema.

## Live artifacts left in place

**Buffer drafts** (not deleted — they are genuine content you may want to publish):

| Draft id | Record | Template | shouldShareToFeed |
| --- | --- | --- | --- |
| `6a720c43672517345444aad9` | wolds-record-reel-001 | three-point-tip, 12s | `true` |
| `6a720c89f57e7ef8ca948d3e` | wolds-record-reel-002 | photo-story, 15s | `false` |

Both are `status: draft` on the `woldsrecord` Instagram channel. Publish or delete them in the Buffer UI.

**Note on the feed toggle:** reel-002's `false` was set purely to exercise the opt-out path. If you publish it, decide whether that is what you actually want for a photo-story reel.

**Cloudinary assets:** `wolds-record/wolds-record-reel-001` (0.95 MB) and `wolds-record/wolds-record-reel-002` (13.52 MB). Buffer fetches media from these URLs, so they must stay for as long as the drafts exist. Delete them once the drafts are published or discarded.

`posts.testing.json` is left staged in the working tree and is git-ignored.

## If something fails

Record it here rather than fixing it in place — the failure detail is the evidence, and a fix mid-run invalidates the phases already passed. Phases 1.4, 2.2 (feed toggle), and 4 are the three that would send the change back for another development pass.

## On acceptance

Per `plans/README.md`: run `bwh-archive-change` to bundle `discovery/`, `specs/`, `tasks/`, `reviews/`, and this file into `plans/archive/<yyyy-mm-dd>-instagram-reel-support/` with a manifest, update `README.md` and `automation-plan.md`, and append the completion entry to `agents_log.txt`.
