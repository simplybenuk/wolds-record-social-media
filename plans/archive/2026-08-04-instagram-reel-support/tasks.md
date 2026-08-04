# PRD: Instagram Reel support

> **ARCHIVED 2026-08-04.** Bundle: `plans/archive/2026-08-04-instagram-reel-support/`. Manifest: `plans/archive/2026-08-04-instagram-reel-support/manifest.md`.
> Accepted by the human on 2026-08-04 after viewing the rendered reels ("these are nice. good work"), following a full output-testing run against the live Cloudinary and Buffer services.
> Cross-references in this file still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now live beside this one as `<dir>.md`.


- **Status: ARCHIVED** (2026-08-04; was READY FOR HUMAN TESTING)
- Former path: `plans/tasks/instagram-reel-support.md`
- Spec: `plans/specs/instagram-reel-support.md` (APPROVED FOR DEVELOPMENT, 2026-08-03)
- Discovery: `plans/discovery/instagram-reel-support.md`
- Change slug: `instagram-reel-support`

## Duplicate check

No active, backlog, or completed change covers Reel support. `plans/archive/` is empty; `automation-plan.md` describes image-only work through Mode 2 (complete) and a future Mode 3 local app. No duplication.

## Environment findings (2026-08-03)

- `.env` is **absent** — no live Buffer or Cloudinary credentials in this environment.
  **Consequence:** Task 1's live contract verification (a real Cloudinary video upload, a real Buffer draft) cannot run here, and would require explicit human authorisation as an external write regardless. It is deferred to the human checkpoint. Payload shapes are verified locally via `--dry-run`.
- FFmpeg 8.1.2, Chromium, Node v22.22.1 all present — local MP4 rendering is fully achievable.

## Tasks

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Verify external contracts (local dry-run only) | Done | Live verification deferred — no credentials |
| 2 | Schema, format resolution, validation | Done | Shared `resolveFormat()` seam |
| 3 | Three-point-tip composition + `render-video.mjs` + genuine MP4 | Done | Acceptance criterion 1 met — real 12.000s MP4 |
| 4 | Cloudinary video upload + `prepare-video.mjs` + Buffer reel asset | Done | Payload verified by dry-run; upload unexercised |
| 5 | Remaining templates (`product-feature`, `photo-story`) | Done | photo-story rendered; product-feature lacks example assets |
| 6 | Batch routing in `process-posts.mjs` | Done | |
| 7 | Editor: format switch, reel fields, preview affordance | Done | PNG output byte-identical |
| 8 | `node:test` suite | Done | 32 checks |
| 9 | README + example data | Done | |
| 10 | Full validation and report | Done | See final validation |

## Final validation (2026-08-04, after review fixes)

| Check | Result |
| --- | --- |
| `npm run check` | PASS |
| `npm test` | 52/52 pass |
| `posts.json` integrity | unmodified; 0 ready, 0 blocked, 20 sent |
| Static PNG regression | md5 `17f2aa4ff9326356eaf434e67a9d6ba3` — identical pre- and post-change |
| Reel render (three-point-tip) | h264 1080×1920 30fps, 12.000000s |
| Reel render (photo-story) | 1080×1920, 15.000000s |
| Composition lint | 3 ok, 0 failed — genuinely scanning, via `npm run lint:compositions` (the earlier "0 errors" line was a zero-file run) |
| Buffer image payload | unchanged `assets[].image`, `type: "post"` |
| Buffer reel payload | `assets[].video` + `thumbnailOffset`, `type: "reel"` |
| Reel without `publicVideoUrl` | rejected, exit 1 |

**Not exercised:** any real network call to Cloudinary or Buffer. No `.env`, and both are external writes requiring explicit authorisation.

## Progress log

| Date | Task | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-03 | Setup | PRD created; spec approved and status advanced | — |
| 2026-08-03 | 1 | Contracts verified locally. Buffer video shape confirmed from vendor docs; Cloudinary `/video/upload` path confirmed. **Live verification deferred — no credentials, and it is an external write requiring human authorisation.** | — |
| 2026-08-03 | Env | `hyperframes@0.7.90` installed (dev dep). Telemetry **disabled** — it defaults to on and this is a private local-first workspace. Chrome headless shell fetched. `doctor` green for Node/FFmpeg/Chrome. | `doctor` |
| 2026-08-03 | 2 | `scripts/lib/content.mjs` added — single home for the default-to-image rule, template allow-lists per format, duration bounds, reel validation, variables contract, duplicate-ID check | — |
| 2026-08-03 | 9a | Example reels added to `posts.example.json`: `wolds-record-reel-001` (three-point-tip) and `wolds-record-reel-002` (photo-story), both using real assets | `posts:check` |
| 2026-08-03 | — | `posts.json` verified unmodified: 0 ready, 0 blocked, 20 sent | `posts:check` |
| 2026-08-03 | 8a | `test/content.test.mjs` — 17 checks on the shared lib; `npm test` wired to `node --test` | 17/17 pass |
| 2026-08-03 | 4, 6 | Pipeline delivered: `render-video.mjs`, `prepare-video.mjs`, Cloudinary `/video/upload`, Buffer reel asset, format-aware `check-posts`, format routing in `process-posts` | Independently re-verified, see below |

### Verification of the pipeline work (re-run directly, not taken on trust)

- `npm run check` passes; `npm test` 17/17.
- `posts.json` unmodified and still `0 ready, 0 blocked, 20 sent`.
- Image payload byte-identical: `assets: [{ image: { url } }]`, `instagram.type: "post"`.
- Reel payload matches Buffer's documented schema exactly: `assets: [{ video: { url, metadata: { thumbnailOffset: 2000 } } }]`, `instagram.type: "reel"`.
- Reel without `publicVideoUrl` exits 1 with an actionable message.

| 2026-08-03 | 7 | Editor extended (943 → 1840 lines): format switch, per-template reel fields, in-page scaled preview player with scrubber and timeline, render-command copy affordance, full reel round-trip | See below |

### Verification of the editor work (re-run directly, not taken on trust)

Rendered `wolds-record-006-paper-notes` twice — once with the current editor, once with `git show HEAD:instagram.html` — and compared: **both `17f2aa4ff9326356eaf434e67a9d6ba3`, byte-identical.** This satisfies acceptance criterion 2 with hard evidence rather than inspection.

### Pre-existing issue found (not a regression, not fixed)

`scripts/render-post.mjs:8` defaults to `/usr/bin/google-chrome`, which does not exist on this machine. Every static render requires `PLAYWRIGHT_CHROME_PATH` to be set. This predates the change and is out of scope, but it should be documented in the README troubleshooting section and is worth fixing separately — falling back to the Playwright cache would make the tool work out of the box.

| 2026-08-03 | 3, 5 | Compositions delivered: brand tokens, shared scene CSS + timing engine, all three templates. Lint clean. | `hyperframes lint` 0 errors ×3 |
| 2026-08-03 | 3 | **Genuine MP4 rendered.** `wolds-record-reel-001` — h264, 1080×1920, 30fps, exactly 12.000000s, 1.2MB, 360 frames in ~30s | `ffprobe` |
| 2026-08-03 | 5 | Second template rendered: `wolds-record-reel-002` photo-story, 1080×1920, exactly 15.000000s — proves per-record duration is honoured | `ffprobe` |
| 2026-08-03 | 8 | `test/pacing.test.mjs` added — pins editor preview weights to composition weights | pass |
| 2026-08-03 | 9 | README "Automation v1 — Reels" section: architecture, dependencies, HyperFrames setup, templates, JSON, preview, render, Cloudinary, Buffer, tests, troubleshooting, limitations | — |
| 2026-08-03 | 10 | Full suite green; `posts.json` still unmodified | See below |

### Two integration defects found and fixed during assembly

**1. `--strict-variables` rejected every array variable — this broke `render-video.mjs` outright.**
HyperFrames 0.7.90 has no array variable type (only `string | number | color | boolean | enum | font | image`), so `points`, `scenes`, and `screenshots` failed validation and aborted the render. Fixed in `reelVariables()` by JSON-encoding those three keys, which the compositions decode at runtime. **`--strict-variables` was kept on** rather than dropped — a malformed variables file should fail the render, not silently produce a wrong video. Locked with tests.

**2. The editor preview misrepresented pacing, and omitted a whole scene.**
The editor used flat weights (opening 1.4, point 1, cta 1.3) while the compositions use per-template weights (hook 3, points 2.25, CTA 2.25). At 12s the CTA started at 9.26s in preview versus 9.75s in the real render. Worse, the editor's `product-feature` preview had **no benefit scene at all**, while the composition renders one — the preview showed 3 of 4 scenes. Both fixed by mirroring the authoritative weights and adding the benefit scene; `test/pacing.test.mjs` now fails if either copy drifts.

This is exactly the risk logged when the preview decision was revised, and it was real in both directions.

### Composition-layer constraints discovered (do not regress)

- Compositions must **not** declare a static `data-duration` — it is read at compile time before the `duration` variable applies, silently pinning every reel to that length. Guarded by test.
- Composition metadata sits on the `.wr-stage` element (lint resolves the root composition to the first body element); `data-composition-variables` stays on `<html>`.
- Asset paths are root-absolute (`/assets/...`) because lint rejects `../` traversal.
- `hyperframes lint` takes a project directory, not a file path.

### Accepted implementation judgement calls

- `prepare-video --dry-run` performs a **real render** before the upload dry-run, mirroring `prepare-post.mjs` (which also always renders) and required because `upload-cloudinary.mjs` checks file existence before its dry-run branch. Documented rather than changed, to avoid altering existing image behaviour.
- `render-video.mjs` has a `--write-back` flag (records `videoPath`) that `render-post.mjs` lacks — accepted, since `videoPath` is an R1 write-back field.
- An unknown `format` is reported as a `blocked` issue rather than crashing the whole run, so one bad record cannot hide the other 20.

## Blockers

None blocking local delivery.

**Deferred to human checkpoint:**
1. Live external-service verification (real Cloudinary video upload, real Buffer draft) — requires credentials and is an external write needing explicit authorisation.
2. `product-feature` has **no genuine example**: `assets/` contains only `logos/` and `photos/`, no product screenshots. The template and its validation are built and tested, but a real example Reel for it needs app imagery from you. Not fabricated.

### Review phase (2026-08-04)

| Date | Task | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-04 | Review | Independent reviewer agent **failed on a session limit before producing findings**. Review performed by the implementer instead — recorded as an assurance gap. | — |
| 2026-08-04 | Review fix | `resolveFormat()` hardened: a non-string `format` raised an opaque `TypeError` instead of a content error. `null`/`""`/blank now explicitly fall back to image. | 3 new tests |
| 2026-08-04 | Review fix | `test/pacing.test.mjs` rewritten — the original searched the whole file for weight literals and would have passed with weights on the **wrong scenes**. Now compares ordered per-branch sequences, with a self-check proving the assertion is not vacuous. | pass |
| 2026-08-04 | Review | Six error paths exercised end to end (unknown template, out-of-range duration, fractional duration, missing asset, too few points, image-post-to-reel-renderer) — all exit 1 with distinct messages | manual |
| 2026-08-04 | Review | Full suite re-run after fixes; reel re-rendered to confirm the lib change did not break the pipeline | 32/32, 12.000000s |

Review artifact: `plans/reviews/instagram-reel-support.md`

### Round 2 independent review (2026-08-04)

An independent reviewer returned **NOT READY FOR HUMAN TESTING**: 2 blocking, 8 should-fix. The verdict was correct.

| Date | Item | Outcome |
| --- | --- | --- |
| 2026-08-04 | B1 | Compositions could render placeholder marketing copy over operator photos, and validation checked scene count but not content. Fixed in two layers (`scene.js` clears instead of falling back; `reelIssues` validates per-scene content, cta, and benefit). |
| 2026-08-04 | B2 | The recorded "composition lint 0 errors" evidence **never ran** — lint scanned zero files and still reported errorCount 0. Added `scripts/lint-compositions.mjs`, which fails loudly on a zero-file scan. |
| 2026-08-04 | S1-S8, I2 | Cloudinary folder nesting, editor `resolveFormat` divergence, batch abort on bad format, dead `SCENE_WEIGHTS`, format/instagramType mismatch, unpinned dependency, missing payload tests, non-JSON error handling, silent template coercion — all resolved. |
| 2026-08-04 | Decided | `shouldShareToFeed` — human decision: Reels **do** cross-post to the main feed by default (reach over grid curation). Default `true` retained, but made deliberate: single shared `resolveShareToFeed` in `scripts/lib/content.mjs`, non-boolean values rejected instead of coerced, effective value printed by `check-posts`, documented in README. The field is still sent on image posts so the contract-frozen pre-Reel payload stays byte-identical. |

Full detail: `plans/reviews/instagram-reel-support.md`.

## Next handoff

Agent review complete: `plans/reviews/instagram-reel-support.md` — verdict **READY FOR HUMAN TESTING**.

Note: the independent reviewer agent died on a session limit, so review was performed by the implementer. Recorded as a genuine assurance gap, not papered over.

After successful human output testing: `bwh-archive-change`. If testing finds more work: `bwh-development`.
