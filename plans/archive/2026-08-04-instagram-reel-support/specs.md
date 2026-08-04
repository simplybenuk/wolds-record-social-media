# Spec: Instagram Reel support (local content studio)

> **ARCHIVED 2026-08-04.** Bundle: `plans/archive/2026-08-04-instagram-reel-support/`. Manifest: `plans/archive/2026-08-04-instagram-reel-support/manifest.md`.
> Accepted by the human on 2026-08-04 after viewing the rendered reels ("these are nice. good work"), following a full output-testing run against the live Cloudinary and Buffer services.
> Cross-references in this file still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now live beside this one as `<dir>.md`.


- **Status: ARCHIVED** (2026-08-04; was APPROVED FOR DEVELOPMENT, human-approved 2026-08-03)
- Former path: `plans/specs/instagram-reel-support.md`
- Change slug: `instagram-reel-support`
- Date: 2026-08-03
- Discovery: `plans/discovery/instagram-reel-support.md`
- Work type: feature extension (backward-compatible)

## Problem

The repo renders static Instagram images only. Reels cannot be produced without leaving the workflow, and the content backlog is exhausted (all 20 posts in `posts.json` are `sent_to_buffer`; 0 ready, 0 blocked).

## Goals

Extend the existing tool into a local content studio covering both formats through one workflow: choose format → choose template → edit → preview → render PNG or MP4 → upload to Cloudinary → create a Buffer draft. Every current static-image capability is preserved, and nothing publishes automatically.

## Non-goals

Authentication; a database; remote hosting; replacing the JSON workflow; removing existing functionality; automatic publishing; AI-generated video; voiceovers; automatic music selection; a general animation timeline; drag-and-drop editing; a Canva clone.

## Verified facts

Confirmed against the repository and external APIs on 2026-08-03:

- `posts.json` = `{ posts: [...] }`, 20 records, all `sent_to_buffer`. Records already carry `instagramType: "post"`.
- `create-buffer-draft.mjs:113-119` already forwards `metadata.instagram.type = post.instagramType` — **`"reel"` flows through with no change to that path.** Only `assets` (line 125-133, hardcoded `image`) needs extending.
- `upload-cloudinary.mjs` posts to `/v1_1/<cloud>/image/upload` with a hardcoded `image/png` blob type.
- `process-posts.mjs` invokes `prepare-post.mjs` and `create-buffer-draft.mjs` **as subprocesses** — a clean seam for format routing.
- `check-posts.mjs` already reports `ready` / `blocked` / `sent` and flags `missing instagramType`.
- Environment: Node v22.22.1, npm 9.2.0, **FFmpeg 8.1.2 present**, Chromium present in the Playwright cache. Sole dependency: `playwright-core@^1.53.0`. No test framework.
- `hyperframes@0.7.90` (Apache-2.0, Node >=22, requires FFmpeg + Chrome — both satisfied):
  - A composition is an **HTML file** with `data-composition-id`, `data-width`, `data-height`, `data-duration`, `data-fps`, `data-composition-variables`.
  - Timing via per-element `data-start` / `data-duration`; the renderer **seeks**, so animation must be scrub-consistent.
  - Data in via `--variables '<json>'` or `--variables-file <path>`, read as `window.__hyperframes.getVariables()`; `--strict-variables` fails on undeclared/mistyped keys.
  - CLI: `render -c <file> -o <out.mp4>`, `preview` (browser studio, default port 3002), `lint --json` (`errorCount`, `warningCount`, `findings[]`), `doctor`.
- **Buffer video asset shape (verified from Buffer's published example):**
  ```
  assets: [{ video: { url: "https://…/video.mp4",
                      metadata: { thumbnailOffset: 2000 } } }]
  ```
  `thumbnailOffset` is a millisecond offset selecting the thumbnail frame, and applies to Instagram.

## Requirements

**R1 — Schema.** Top-level `format`: `"image"` | `"reel"`. **Absent ⇒ `"image"`.** Reel fields: `template`, `headline`, `kicker`, `points[]`, `photoPath`, `screenshots[]`, `duration`, `audioPath`, `cta`, `caption`, `hashtags[]`, `altText`, `instagramType: "reel"`, `status`. Pipeline write-backs: `videoPath`, `publicVideoUrl`, `cloudinaryVideoPublicId`, `uploadedAt`.

**R2 — Templates.** Exactly three, at 1080×1920: `three-point-tip` (hook → 3 points → branded CTA), `product-feature` (headline → screenshots → benefit → CTA), `photo-story` (opening photo+headline → 2–3 photo/caption scenes → closing slide). All: Wolds Record brand colours, calm restrained motion, generous whitespace, no flashy effects, readable without audio, safe margins for Instagram UI, shared scene/typography components.

**R3 — Renderer.** Accepts one Reel object, validates required fields, renders MP4 to `generated/<id>.mp4`, non-zero exit on failure, concise success/error output.

**R4 — Editor.** `instagram.html` gains an Image/Reel switch, Reel template selection, Reel field editing, a local preview route, and a render affordance; static editing is unchanged.

**R5 — Scripts.** `render-video.mjs` and `prepare-video.mjs`; `format=image` → PNG pipeline, `format=reel` → MP4 pipeline; batch handles both.

**R6 — Buffer.** Reels use `instagramType: "reel"` and `publicVideoUrl`; caption/hashtags preserved; a Reel without `publicVideoUrl` is rejected; `--dry-run` and `--write-back` behaviour unchanged; drafts only.

**R7 — Compatibility.** Existing posts render unchanged; existing commands remain valid; missing `format` defaults to image; invalid templates, missing assets, and bad durations produce clear errors; IDs remain unique; batch skips completed content unless `--force`.

**R8 — Tests + docs.** Automated checks per §8 of the brief; README per §9.

## Design

### Composition layer

```
video/
  compositions/
    three-point-tip.html      data-composition-variables declares the Reel contract
    product-feature.html
    photo-story.html
  components/
    scene.css                 shared scene/typography/motion primitives
  brand/
    tokens.css                Wolds Record colours, fonts, safe-area insets
```

Compositions are static HyperFrames HTML. Each declares `data-width="1080" data-height="1920" data-fps="30"` and reads its content through `window.__hyperframes.getVariables()`. Motion is CSS-only and scrub-consistent — no GSAP adapter needed at this scope, which also satisfies "avoid unnecessary frameworks".

**Decision — HyperFrames CLI as a subprocess, not a library.** `render-video.mjs` writes a variables file to `generated/<id>.variables.json`, then spawns:

```
npx hyperframes render -c video/compositions/<template>.html \
  --variables-file generated/<id>.variables.json \
  --strict-variables -o generated/<id>.mp4
```

This mirrors the existing `process-posts.mjs` subprocess pattern, keeps HyperFrames out of the repo's runtime imports, and makes `--strict-variables` the schema enforcement point. Pin the exact version (`hyperframes@0.7.90`) — it is pre-1.0 with 333 published versions.

### Pipeline routing

Routing happens by `format` at three points, all defaulting to `image` when absent:

| Stage | image | reel |
| --- | --- | --- |
| render | `render-post.mjs` (Playwright → PNG) | `render-video.mjs` (HyperFrames → MP4) |
| prepare | `prepare-post.mjs` | `prepare-video.mjs` |
| upload | Cloudinary `/image/upload` → `publicImageUrl` | Cloudinary `/video/upload` → `publicVideoUrl` |
| Buffer asset | `{ image: { url } }` | `{ video: { url, metadata: { thumbnailOffset } } }` |

`process-posts.mjs` selects the prepare script per record; `create-buffer-draft.mjs` selects the asset shape. Extract a single shared `resolveFormat(post)` helper so the default-to-image rule exists in exactly one place.

**Decision — keep Playwright for PNG.** HyperFrames brings its own Chrome, so two browser stacks coexist. Accepted deliberately: the PNG path works and is carrying 20 published posts, so the regression risk of migrating it outweighs the disk cost.

**Decision — preview (revised during development, 2026-08-03).** Originally: reuse `hyperframes preview` and have `instagram.html` merely launch it. **As built:** `instagram.html` contains a scaled in-page scene player (1080×1920 stage at 0.3 scale, play/pause, scrubber, timeline strip with scene-proportional chips). The two are not mutually exclusive — `hyperframes preview` remains available for full-fidelity motion checking.

Rationale for the change: the brief's §4 asks the operator to "preview the Reel locally" *within the extended interface*, and Olivia should not need a second tool or a terminal to judge pacing. The in-page player stays within scope because it is a fixed-scene player, not a timeline or keyframe editor.

**Consequence to watch:** the editor models pacing with its own `SCENE_WEIGHTS`, which must agree with the scene timings baked into `video/compositions/*`. If they drift, the preview lies about pacing. `SCENE_WEIGHTS` / `buildScenes()` in `instagram.html` is the single reconciliation point, and agent review must verify the two agree.

**Decision — `node:test` for tests.** Built in, zero dependencies, fits local-first. Adds `npm test`.

**Decision — template namespace.** `template` is validated against `format`: image templates (`problem`, …) and reel templates (`three-point-tip`, `product-feature`, `photo-story`) are separate allow-lists. A reel template on an image record is a clear error.

**Decision — duration.** Integer seconds, 3–90 (Instagram Reel limit), default 12. `render-video.mjs` propagates it to the composition, so `data-duration` and the record cannot silently disagree.

## Security and data handling

No new credentials — reuses `CLOUDINARY_*` and `BUFFER_*` from `.env`. No auth, no database, no remote hosting, no new network exposure (the preview studio binds locally). Drafts only; no publish path is added. `posts.json` holds live published records — every task must leave the 20 existing records byte-identical except where explicitly extended.

## Rollout

Additive and reversible. `format` is optional, so an un-migrated `posts.json` behaves exactly as today. Rollback = remove the new scripts, `video/`, and the `hyperframes` dependency; the PNG pipeline is untouched. No migration of existing records is required, and none should be performed.

## Risks

| Risk | Mitigation |
| --- | --- |
| Buffer rejects the video draft despite the documented shape | Task 1 verifies with `--dry-run` and one real draft **before** templates are built |
| Cloudinary video credits / "no extra cloud bill" | Keep Reels ≤30s at 1080×1920; check quota after the first upload; the constraint is explicit in `automation-plan.md` |
| Pre-1.0 HyperFrames API drift | Pin exact version; `hyperframes doctor` in setup docs |
| Regression to the 20 live records | `posts:check` after every task; re-render one existing post and compare bytes |
| Seek-based animation looks wrong | CSS-only, scrub-consistent motion; verify in preview before full render |

## Task outline

1. **Verify external contracts (spike).** Confirm the Buffer video payload via `--dry-run`, and one Cloudinary `/video/upload` round-trip with a throwaway MP4. **Stop and report if either contract differs from this spec.**
2. **Schema + validation.** `resolveFormat()`, reel field validation, template allow-lists per format, duration bounds, unique-ID check, `check-posts.mjs` reporting both formats.
3. **Three-point-tip end to end.** Brand tokens, scene components, the first composition, `render-video.mjs`, and one genuinely rendered MP4 from example content.
4. **Cloudinary + Buffer.** `/video/upload` support, `prepare-video.mjs`, Reel asset shape in `create-buffer-draft.mjs`, rejection without `publicVideoUrl`.
5. **Remaining templates.** `product-feature`, `photo-story`, reusing the shared components.
6. **Batch routing.** `process-posts.mjs` dispatches by format; `--force`/skip semantics preserved.
7. **Editor.** Format switch, template select, Reel fields, preview affordance in `instagram.html`.
8. **Tests.** `node:test` suite covering the eight checks in §8 of the brief.
9. **Docs + example data.** README sections per §9; a `wolds-record-reel-001` example in `posts.example.json`.
10. **Full validation + report.** Run everything; report changes, verification, and limitations.

## Dependencies and affected areas

**New:** `hyperframes@0.7.90` (dev dependency; FFmpeg and Chrome already present). **New files:** `video/**`, `scripts/render-video.mjs`, `scripts/prepare-video.mjs`, `test/**`. **Modified:** `scripts/check-posts.mjs`, `create-buffer-draft.mjs`, `upload-cloudinary.mjs`, `process-posts.mjs`, `instagram.html`, `posts.example.json`, `package.json`, `README.md`. **Must not change:** the 20 existing records in `posts.json`.

## Acceptance criteria

1. `generated/wolds-record-reel-001.mp4` exists, plays, is 1080×1920, and matches its declared duration — a real render, not scaffolding.
2. All 20 existing posts still pass `npm run posts:check` with unchanged status; a re-rendered static PNG is byte-identical to its predecessor.
3. A record with no `format` follows the image pipeline unchanged.
4. `create-buffer-draft.mjs --dry-run` emits `{ image: { url } }` for image records and `{ video: { url, metadata: { thumbnailOffset } } }` for reels, with `metadata.instagram.type: "reel"`.
5. A Reel without `publicVideoUrl` is rejected with a clear message and non-zero exit.
6. Invalid template, missing asset, and out-of-range duration each produce a distinct, actionable error and non-zero exit.
7. `npm run check`, `npm test`, and `npm run posts:check` all pass.
8. `instagram.html` can author both formats; static editing is unchanged.
9. README covers all eleven §9 topics.
10. Nothing publishes — only drafts are created.

## Validation plan

`npm run check` (syntax) · `npm test` (new `node:test` suite) · `npm run posts:check` (data integrity) · `npx hyperframes lint --json video/compositions/*.html` (composition validity) · one end-to-end Reel render · dry-run Buffer payload comparison for both formats · re-render of one existing static post for regression.

## Assumptions

- Cloudinary's free tier absorbs short 1080×1920 MP4s at this volume (single digits per batch).
- Reels are silent this iteration; `audioPath` is carried in the schema but unused.
- `thumbnailOffset` default of 2000 ms is acceptable; the composition should hold a stable frame at ~2 s.
- Brand colours are recoverable from `instagram.html`'s existing CSS rather than needing a new brand definition.

## Open questions

1. **Reel content.** No Reel copy exists yet. Task 3 needs a real `wolds-record-reel-001`; the brief's example (`3 signs your client records are fighting you`) is assumed usable as the first genuine render unless you supply different copy.
2. **`assets/photos/therapy-session.jpg`** referenced in the brief's example does not exist in `assets/photos/`. Photo-story and the example Reel need a real asset or a substitute from the existing photos.
3. **Cloudinary video quota** on your account is unknown; task 1 should report actual credit consumption.

## Conflict with existing source of truth

`automation-plan.md` (§"Proposed local hosting setup", §"Data model v1", §"Mode 3 — Local app") specifies Docker Compose, a **SQLite database**, and a dashboard app. This brief's constraints explicitly forbid adding a database and remote hosting. These are in direct conflict.

This spec follows the brief and adds no database.

**Resolved by human decision, 2026-08-03:** SQLite is permitted. It is **not** part of this change — Reel support does not require a database, and adding one would expand scope well beyond the approved task outline. `automation-plan.md`'s SQLite direction therefore stands as valid future Mode 3 work, and the JSON workflow continues unchanged here.
