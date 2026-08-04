# Discovery: Instagram Reel support (local content studio)

> **ARCHIVED 2026-08-04.** Bundle: `plans/archive/2026-08-04-instagram-reel-support/`. Manifest: `plans/archive/2026-08-04-instagram-reel-support/manifest.md`.
> Accepted by the human on 2026-08-04 after viewing the rendered reels ("these are nice. good work"), following a full output-testing run against the live Cloudinary and Buffer services.
> Cross-references in this file still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now live beside this one as `<dir>.md`.
> Former path: `plans/discovery/instagram-reel-support.md`


- Status: draft for `bwh-spec`
- Date: 2026-08-03
- Change slug: `instagram-reel-support`

## Problem and desired outcome

The repo produces static Instagram images only. Wolds Record cannot publish Reels without leaving the workflow entirely, and Reels are the format Instagram currently favours for reach. The content backlog is also exhausted — all 20 posts in `posts.json` are `sent_to_buffer`, with 0 ready and 0 blocked — so the next content push has no pipeline behind it.

**Outcome:** extend the existing tool into a local content studio that produces both static posts and short Reels through one workflow — choose format → choose template → edit → preview → render PNG or MP4 → upload to Cloudinary → create a Buffer draft — with every current static-image capability preserved and no automatic publishing.

## Actors

- **Ben** — builds and runs the tooling; primary operator of the scripts.
- **Olivia** — reviews and approves content; needs preview fidelity without touching the CLI.
- **Downstream:** Buffer (final scheduling/publishing gate), Cloudinary (public media host), Instagram (destination).

## Known facts (verified in the repo, 2026-08-03)

- Content lives in `posts.json` under a top-level `posts` array; 20 records, all `status: sent_to_buffer`.
- Post records **already carry `instagramType: "post"`** — so `instagramType: "reel"` fits the existing field rather than needing a new one.
- Pipeline scripts (8 total, `scripts/*.mjs`, ESM, `"type": "module"`):
  - `render-post.mjs` — Playwright drives `instagram.html` to produce a PNG.
  - `upload-cloudinary.mjs` — posts to `https://api.cloudinary.com/v1_1/<cloud>/image/upload`, hardcoded `image/png` blob type, writes back `publicImageUrl` / `cloudinaryPublicId` / `uploadedAt`.
  - `create-buffer-draft.mjs` — builds `assets: [{ image: { url: post.publicImageUrl } }]`; refuses Instagram posts without `publicImageUrl`; supports `--dry-run`, `--write-back`, `--require-image`.
  - `prepare-post.mjs` — wraps render + upload + write-back.
  - `process-posts.mjs` — batch orchestration; **shells out to `prepare-post.mjs` and `create-buffer-draft.mjs` as subprocesses**, filtering on status and `bufferPostId`.
  - `check-posts.mjs` — validation; already flags `missing instagramType`.
- Validation available: `npm run check` (syntax only) and `npm run posts:check`. **No test framework or test script exists.**
- Runtime: Node v22.22.1, npm 9.2.0. Sole dependency is `playwright-core@^1.53.0`.
- `generated/` and `.env` are git-ignored. Buffer and Cloudinary credentials are documented in `.env.example`.
- `hyperframes@0.7.90` exists on npm (Apache-2.0, `heygen-com/hyperframes`): "CLI — create, preview, and render HTML video compositions". Requires **Node >=22** (satisfied), ships a `hyperframes` bin, ~24.7 MB unpacked, 17 dependencies including `puppeteer-core`, `sharp`, and `onnxruntime-node`.

## Assumptions (explicit, unverified)

- HyperFrames' HTML-composition model can reuse the existing brand CSS/typography from `instagram.html` rather than requiring a parallel design system.
- Cloudinary's free tier will absorb short 1080×1920 MP4s at the expected volume without triggering a bill — consistent with the plan's "no extra cloud bill" principle.
- Buffer's GraphQL `createPost` accepts a video asset for Reel drafts using the same `saveToDraft: true` flow.
- Reels stay silent-first; `audioPath` is carried in the schema but unused this iteration.
- Batch Reel rendering is low-volume (single digits per run), so render time is not a blocker.

## Decisions still needed

These materially change architecture, cost, or scope, and should be resolved during `bwh-spec`:

1. **Buffer Reel payload shape.** The current `assets: [{ image: { url } }]` cannot carry video. The exact Reel asset structure — video URL, whether a thumbnail/cover image is mandatory, duration limits — is unverified against Buffer's API. This is the single highest-risk unknown: it gates the last step of the pipeline.
2. **Browser engine duplication.** The repo uses `playwright-core`; HyperFrames pulls `puppeteer-core`. Accept both stacks, or migrate PNG rendering onto HyperFrames' engine? Accepting both is simpler but doubles the browser-binary footprint on the OptiPlex.
3. **Preview surface.** HyperFrames ships its own preview server (`hono`-based). Reuse it, or build Reel preview into `instagram.html` as the brief's §4 implies? Reusing it is far cheaper but splits the operator experience across two UIs — which matters for Olivia.
4. **Test runner.** The brief requires automated checks (§8) but the repo has none. Node's built-in `node:test` is the zero-dependency option and fits the local-first constraint.
5. **Template namespace.** `template` currently holds image template names (`problem`, …). Reel templates (`three-point-tip`, …) share the field — namespace them, or validate `template` against `format`?
6. **Cloudinary video path.** Requires `/video/upload`, a different MIME type, and likely different size/timeout handling than the current PNG upload.

## Scope

**In scope:** `format` field (`image` | `reel`, absent defaults to `image`); Reel schema fields; three Reel templates (three-point tip, product feature, photo story) at 1080×1920 with restrained motion and silent-readable text; HyperFrames as the video rendering layer under `video/`; `render-video.mjs` and `prepare-video.mjs`; format routing through the existing batch orchestration; Cloudinary video upload writing `publicVideoUrl`; Buffer Reel drafts; backward-compatibility and error-handling validation; automated checks; README updates.

**Non-goals:** authentication, a database, remote hosting, replacing the JSON workflow, removing existing functionality, automatic publishing, AI-generated video, voiceovers, automatic music selection, a general animation timeline, drag-and-drop editing, a Canva clone.

## Success signals

- One genuinely rendered MP4 exists in `generated/` for a `three-point-tip` Reel — not scaffolding.
- All 20 existing posts still validate and render unchanged; `npm run check` and `npm run posts:check` pass.
- Records without `format` behave exactly as before.
- A Reel reaches Buffer as a **draft**, and a Reel without `publicVideoUrl` is rejected with a clear error.
- Olivia can preview a Reel and judge timing and layout without running a render.

## Risks

- **Buffer Reel API mismatch** — the pipeline could complete through Cloudinary and still fail at the final step. Verify early with a dry run before building the templates.
- **Dependency weight** — HyperFrames adds ~24.7 MB plus native `onnxruntime-node` and `sharp` binaries to a repo whose current footprint is one package. Tension with "avoid unnecessary frameworks".
- **Cloudinary video quota/cost** — video consumes credits far faster than PNGs; directly threatens the "no extra cloud bill" principle.
- **Regression surface** — `posts.json` holds live, already-published content. Schema changes risk corrupting sent records; treat the file as source of truth and re-run `posts:check` after every change.
- **Third-party maturity** — HyperFrames is at 0.7.x with 333 published versions, implying a fast-moving pre-1.0 API. Pin the version.

## Dependencies

`hyperframes` (new, pin exact); existing Cloudinary and Buffer credentials in `.env`; Node >=22; sufficient disk for browser binaries and MP4 output in `generated/`.

## Materially different options

**A — HyperFrames as the video layer (as briefed).** Purpose-built for HTML→MP4; gets motion, timing, and preview without hand-rolling. Cost: heavy pre-1.0 dependency and a second browser engine.

**B — Playwright + ffmpeg frame capture.** Reuses the existing engine and the `instagram.html` renderer; no new JS dependency beyond ffmpeg. Cost: hand-building frame timing and encoding — meaningful work, and the motion quality bar is on you.

**C — HyperFrames for rendering, existing editor for authoring only.** Keeps `instagram.html` as the single editing surface and treats HyperFrames purely as a headless render backend, deferring the preview question. Smallest UI change; preview fidelity is weakest.

Option A matches the brief. Option B is worth a paragraph of comparison in the spec specifically because of the "avoid unnecessary frameworks" and "no extra cloud bill" constraints — if it is rejected, the spec should say why on the record.

## Recommended sequencing note

Verify the Buffer Reel payload (decision 1) and a single end-to-end Cloudinary video upload **before** building all three templates. Both are external contracts outside your control; discovering a mismatch after the templates exist is the expensive failure mode.
