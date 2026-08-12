# Independent review: Instagram engagement creative system

> Review round 3 (2026-08-12): independent re-review verified B6 and S3 closed, repeated every project gate and the isolated mobile flow, and found no remaining blocking or should-fix defect. The change is `READY FOR HUMAN TESTING`.

> Review round 2 (2026-08-12): the remediation closes B1-B5 and S1-S2 for new portrait/carousel posts, but independent review found a blocking migrated-square approval regression. The current verdict remains `NOT READY FOR HUMAN TESTING`.

- **Status:** READY FOR HUMAN TESTING
- **Change slug:** `instagram-engagement-creative-system`
- **Reviewed:** 2026-08-12
- **Approved specification:** `plans/specs/instagram-engagement-creative-system.md`
- **Development artifact:** `plans/tasks/instagram-engagement-creative-system.md`

## Round 3 verdict

No blocking or should-fix findings remain. The migrated-square review path and complete PNG validation now satisfy the approved historical-compatibility and durable-preview boundaries, without weakening the new portrait-set contract.

### B6/S3 closure evidence

- **B6 closed:** `isMigratedLegacySquare` limits the square exception to a one-slide image carrying immutable legacy rollback evidence at the original `campaigns/<campaign>/<post>.png` path. The shared `canApproveCurrentPreview` predicate is called by both the UI and the repository transition; it validates that artifact as a real 1080x1080 PNG, while every other post continues through exact-set 1080x1350 validation. The migration regression performs approved → draft → approved against the migrated row, retains the same post/slide path and byte-identical square file, and the transition source contains no rendering call.
- **S3 closed:** PNG validation parses the complete chunk stream, verifies per-chunk CRCs and IHDR rules, requires non-empty IDAT plus terminal IEND with no trailing bytes, inflates within the expected image-size bound, and validates decoded scanline length/filter bytes. Focused tests reject a synthetic 24-byte header, truncation, CRC corruption, wrong dimensions, missing/duplicate/extra set members, and accept real renderer output. Independent probes additionally rejected trailing bytes and a CRC-valid but invalid decoded filter while accepting valid portrait and legacy-square fixtures in only their intended validators.
- **Regression inspection:** new campaign rows keep legacy visual evidence null; the immutable trigger prevents later fabrication or mutation of migrated evidence; canonical edits/regeneration remain slide-only; a rendered replacement leaves the historical predicate by adopting its portrait set path. The approval repository re-check remains authoritative even if a client bypasses the disabled UI button. Publication-isolation inspection found no new Buffer, Cloudinary, Meta, upload, scheduling or publishing invocation.

### Round 3 validation

- Independently passed `npm run check`, `npm test` (63 legacy and 58 TypeScript tests), `npm run posts:check` (0 ready, 0 blocked, 20 sent), `npm run lint:compositions` (3 ok), `npm run build`, and `git diff --check`.
- Independently passed `npm run verify:mobile` at 390x844 against the rebuilt application and an isolated SQLite database: all slides reachable, intermediate edit durable over reload, regeneration, reject/draft, stale-write rejection, render/generation retry, keyboard focus, no overflow and zero console errors.
- `posts.json` remains byte-unchanged at SHA-256 `7c3be88d874d1cedf41bf12f8af95e25a336e84405e3336c392d4f4f058fa0dc` with an empty diff.

### Residual risk and handoff

Automated review cannot judge whether the six portrait templates deliver the desired creative quality across representative Record, Massage and Academy content. Human testing should compare representative image/carousel output, inspect all slides on a phone, confirm CTA/intent tone and approved photo treatment, and exercise a migrated square post's draft/re-approval flow. Successful human output testing hands the accepted change to `bwh-archive-change`; any product or output defect returns it to `bwh-development`.

## Round 2 verdict

The remediation is materially stronger and all seven original findings are closed in the new-format path. The change is still not ready for human output testing because the portrait-only approval validator breaks the carried-over review transition for migrated square posts.

### Original finding closure

| Finding | Round 2 evidence | Result |
| --- | --- | --- |
| B1 approval readiness | Repository and UI gate approval on a complete current set; repository revalidates the exact files; focused pending/failed/stale/missing/corrupt/wrong-size tests pass | Closed for portrait/carousel posts |
| B2 canonical slides | New posts leave legacy visual columns null; visual edits/regeneration update slide rows only; an immutable trigger preserves migrated rollback evidence | Closed |
| B3 structural integrity | Review-time structure trigger validates counts, contiguous ordinals and roles; reviewed slide insert/update/delete and format mutation are blocked; valid staged creation remains possible | Closed within the approved repository lifecycle |
| B4 preview-set validation | Temporary and final sets are checked for exact ordinals, file presence, PNG signature and 1080x1350 dimensions before database readiness; failure/stale paths retain the previous set | Closed, subject to S3 below |
| B5 intent/final CTA | All five intent CTA minima and exact final-surface CTA equality are application-validated, including Massage comment privacy coverage | Closed |
| S1 attempt snapshots | Campaign preference plus regeneration format, slide count and slide identity/version are persisted and tested | Closed |
| S2 render ownership | Post and all slide claims occur in one checked immediate transaction; injected slide failure rolls back the complete claim | Closed |

### B6. Migrated square posts cannot be re-approved after return to draft

Migration deliberately preserves a historical square preview at its existing path (for example `campaigns/<campaign>/<post>.png`) and backfills that path onto the standalone slide. `hasCompleteCurrentPreview` accepts this canonical migrated state, so the UI enables `Approve`. The repository then unconditionally calls `assertCompletePortraitSet`, which requires an ordinal filename ending in `/0.png`, an exact ordinal-only directory, and 1080x1350 dimensions. A preserved 1080x1080 legacy path therefore always fails server-side approval.

Evidence:

- `drizzle/0002_instagram_engagement_creative_system.sql:90-99` preserves the historical image path.
- `src/features/campaigns/repository.ts:41-48` and `src/app/campaigns/[id]/page.tsx:76-80,135-142` treat the migrated ready state as approvable.
- `src/features/campaigns/repository.ts:449-469` applies portrait-set validation to every approval.
- `src/lib/rendering/png-validation.ts:15-30` requires portrait dimensions and ordinal set paths.
- Existing migration coverage proves square paths survive, but no test covers approved/rejected → draft → approved for a migrated square post.

Impact: an operator can return a historical approved or rejected square post to draft through the supported UI, but cannot restore approval without making a visual edit that re-renders and changes the historical preview. This conflicts with the carried-over review transitions, historical-preview preservation, and legacy compatibility requirements.

Required correction: distinguish immutable migrated square previews from new portrait sets at the approval boundary. Validate a migrated legacy file as the preserved square artifact while retaining strict exact-set portrait validation for new/re-rendered posts. Keep the UI and repository decision identical, and add a migration fixture test covering return-to-draft and successful re-approval without file mutation or re-render.

### S3. PNG validation accepts a truncated synthetic header as a complete image

`assertPortraitPng` checks only the eight-byte signature, total length of 24 bytes, and width/height offsets. The focused test explicitly treats a 24-byte synthetic header with no complete IHDR CRC, image data, or IEND chunk as valid.

Evidence:

- `src/lib/rendering/png-validation.ts:13-17`
- `test/png-validation.test.ts:9-16,28-29`

Recommended correction: validate the IHDR chunk type/length and the complete PNG structure (preferably decode the image, or at minimum verify chunks through a valid IEND and CRCs) so truncated/corrupt output cannot become ready.

### Round 2 validation

- Independently passed `npm run check`, `npm test` (63 legacy and 58 TypeScript tests), `npm run posts:check` (0 ready, 0 blocked, 20 sent), `npm run lint:compositions` (3 ok), `npm run build`, and `git diff --check`.
- Independently passed `npm run verify:mobile` at 390x844 against a built local app and isolated SQLite database: carousel navigation, intermediate edit/reload, regeneration, reject/draft, stale-write rejection, approval, render retry and generation retry all passed with no overflow or console errors.
- `posts.json` remains byte-unchanged at SHA-256 `7c3be88d874d1cedf41bf12f8af95e25a336e84405e3336c392d4f4f058fa0dc`.
- Publication-isolation inspection found no new Buffer, Cloudinary, Meta, upload, schedule or publish invocation in the application path.

### Round 2 handoff

Return B6 and S3 to `bwh-development`, rerun focused legacy-transition/PNG tests and every project gate, then repeat independent review. Human output testing must not begin yet.

## Round 1 verdict (superseded evidence)

The portrait/carousel implementation passes its reported automated suite, but it is not ready for human output testing because approval readiness, canonical slide ownership, database structural integrity, runtime preview validation, and intent/CTA enforcement do not yet meet the approved contract.

## Blocking findings

### B1. A post can be approved without a complete current preview set

`transitionReviewStatus` checks campaign binding, post version, and the review-state transition, but it does not require the post and every slide to be `ready`, current, and backed by an image path. The review page exposes `Approve` for every draft regardless of render state. The existing persistence test positively approves a post returned by `completedCampaign()`, which persists posts as `pending` and never renders them before the transition.

Evidence:

- `src/features/campaigns/repository.ts:448-471`
- `src/app/campaigns/[id]/page.tsx:132-154`
- `test/campaign-persistence.test.ts:116-125`

Impact: a failed, interrupted, pending, or out-of-date replacement can become the locally approved publication unit while the operator is seeing no preview or a preview for older content. This breaks the complete-post approval boundary and makes a future publisher unsafe.

Required correction: gate approval in the repository on a `ready`, non-stale post and a complete ordered set of `ready`, non-stale slides with durable image paths; keep rejection available if desired; mirror the gate in the UI and add pending/failed/stale/missing-slide approval rejection tests.

### B2. The additive slide relation is not the sole canonical visual source

The migration retains required legacy visual columns on `draft_posts`, and new generation, edits, and regeneration continue copying the first slide into those columns. That is an ongoing dual write, despite the approved decision that legacy visual columns become read-only after migration and that no dual-write source of truth is allowed.

Evidence:

- `drizzle/0002_instagram_engagement_creative_system.sql:17-26`
- `src/features/campaigns/repository.ts:185-228`
- `src/features/campaigns/repository.ts:412-444`
- `src/features/campaigns/repository.ts:613-659`

Impact: the same visual has two mutable representations that can diverge. The current regeneration path already demonstrates partial divergence risk because it updates several first-slide legacy fields but omits legacy `alt_text` and `photo_asset_id`.

Required correction: make `draft_post_slides` authoritative in both schema and writes. Preserve migrated legacy values only as rollback evidence, or move rollback evidence to an explicitly immutable representation; do not update those columns during edit/regeneration. Add a test proving visual mutations touch only slide rows.

### B3. SQLite does not enforce the promised post/slide structure

The database enforces slide ordinal range, role vocabulary, and unique `(post_id, ordinal)`, but not the relationship between post format, count, contiguous ordinals, and role positions. The single trigger runs only when `review_status` is updated. After that transition, inserts, deletes, ordinal changes, role changes, and format changes can leave an approved post structurally invalid without being rejected.

Evidence:

- `drizzle/0002_instagram_engagement_creative_system.sql:65-113`
- `src/db/schema.ts:130-169`

Impact: repository reads can assemble zero-slide images or malformed carousels, and the review component assumes `slides[0]` exists. This is a data-integrity and recovery gap against R5's explicit format/count constraint requirement.

Required correction: add database triggers/constraints covering relevant post and slide insert/update/delete operations, including role position and contiguous ordinals, while allowing the repository's transactionally staged creation/update sequence. Add direct-SQL tests for invalid image/carousel count, gaps, wrong first/intermediate/final roles, mutations after approval, and valid transactional writes.

### B4. The complete preview set is exposed without validating every expected PNG

`renderPostPreview` trusts renderer return values. If the temporary directory does not exist, it skips the rename and still calls `setRenderReady` with temporary paths. It does not check that every expected file exists, has a PNG signature, or is 1080x1350 before the database becomes `ready`. The lower-level renderer checks only a PNG data-URL prefix before decoding and writing.

Evidence:

- `src/lib/rendering/campaign-renderer.ts:24-50`
- `scripts/lib/static-image-renderer.mjs:132-143`
- `src/features/campaigns/repository.ts:689-718`

Impact: a renderer contract error, truncated file, or missing output can be recorded as a current complete preview set. The real-render integration verifies its happy-path files after the fact, but there is no production guard or failure-path test proving invalid/missing output preserves the previous set.

Required correction: before the rename/commit boundary, require the exact ordinal file set and validate PNG signature and 1080x1350 IHDR dimensions; treat any mismatch as a safe render failure and retain the prior set. Add missing, corrupt, wrong-dimension, and partial-carousel tests.

### B5. Intent-consistent CTA and final-slide completion are not fully enforced

Domain validation restricts save structures but does not require a save-oriented CTA. Follow validation requires only the word `follow`; send checks a broad keyword set; and no rule requires an image footer or carousel action slide to carry the post's specific CTA. Therefore schema-valid content can declare one intent while displaying an unrelated action, or finish a carousel with copy different from the stored CTA.

Evidence:

- `src/features/campaigns/domain-validation.ts:82-99`
- `src/features/campaigns/domain-validation.ts:107-120`
- `test/campaign-domain.test.ts:45-63`

Impact: generated or edited output can pass application validation while violating R2/R3 and acceptance criterion 2's engagement contract.

Required correction: enforce each intent's minimum CTA semantics and require the publication's final visual surface (standalone image or carousel action slide) to present the specific stored CTA. Expand tests across all five intents, including Massage privacy wording and unrelated/mismatched final-slide CTAs.

## Should-fix findings

### S1. Attempt snapshots do not explicitly retain the complete format input

The initial attempt snapshot stores dates/count plus a hash whose input contains `formatPreference`, but not the selected preference itself. A regeneration snapshot serializes the post row without its canonical slides or slide count. This weakens the explicit attempt-input traceability required by R1/R6.

Evidence:

- `src/features/campaigns/repository.ts:65-86`
- `src/features/campaigns/repository.ts:585-593`

Recommended correction: persist `formatPreference` explicitly for campaign attempts and format, slide count, and canonical slide-version/input identity for regeneration attempts; test snapshot readback and retries.

### S2. Starting a render is not a single checked database transition

`setRenderStarted` advances the post first, then updates each slide outside a transaction and ignores each slide update result. A crash or unexpected failed slide update can leave mixed render ownership until interruption recovery.

Evidence:

- `src/features/campaigns/repository.ts:673-686`

Recommended correction: perform the post/complete-slide ownership transition in one immediate transaction and require every expected update to affect exactly one row.

## Validation independently performed

- `npm run check` — passed.
- `npm test` — passed: 63 legacy tests and 52 TypeScript tests.
- `npm run posts:check` — passed: 0 ready, 0 blocked, 20 sent.
- `npm run lint:compositions` — passed: 3 ok, 0 failed.
- `npm run build` — passed with Next.js 16.3.0.
- `git diff --check` — passed.
- `posts.json` SHA-256 remains `7c3be88d874d1cedf41bf12f8af95e25a336e84405e3336c392d4f4f058fa0dc`; its git diff is empty.
- Publication isolation inspection found no Buffer, Cloudinary, Meta, upload, schedule, or publish invocation in the changed application path.
- The reported 390x844 browser run and six-template visual inspection were reviewed as development evidence but not repeated after the blocking source findings were established.

## Residual risk and handoff

The change remains `IN DEVELOPMENT`. Return B1-B5 and S1-S2 to `bwh-development`, add focused regression coverage, rerun every project gate including `npm run verify:mobile`, and repeat independent review. Human output testing must not begin until the next review returns `READY FOR HUMAN TESTING`.

## Context inspected

The review used the project agent instructions, adapter and context map; all shared workflow contracts named by `bwh-agent-review`; the approved specification and task artifact; migration/schema, domain, generation, repository/action, rendering, brand-pack, UI and test diffs; source-of-truth documentation; and reported validation evidence.
