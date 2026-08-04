# Archive manifest — instagram-reel-support

- **Change:** `instagram-reel-support` — Instagram Reel support (local content studio)
- **Final state:** `ARCHIVED`
- **Previous state:** `READY FOR HUMAN TESTING`
- **Archived:** 2026-08-04
- **Bundle:** `plans/archive/2026-08-04-instagram-reel-support/`

## Human acceptance evidence

Accepted by the human on 2026-08-04, in two explicit steps:

1. **Outward-facing writes authorised** — "happy to authorise the outward facing writes", permitting the live Cloudinary uploads and Buffer draft creation that output testing required.
2. **Delivered change accepted** — after viewing all three rendered reels: "these are nice. good work", followed by an explicit archive request ("please archive this change and commit and push").

Acceptance was not inferred from agent review, automated validation, or implementation completion. The full record is in `output-testing.md` (verdict: **ACCEPTED**).

## Archived artifacts

| Role | Original path | Archived as | Disposition |
| --- | --- | --- | --- |
| Discovery brief | `plans/discovery/instagram-reel-support.md` | `discovery.md` | Moved |
| Specification and readiness bundle | `plans/specs/instagram-reel-support.md` | `specs.md` | Moved; status set to `ARCHIVED` |
| PRD / task breakdown and progress log | `plans/tasks/instagram-reel-support.md` | `tasks.md` | Moved; status set to `ARCHIVED` |
| Independent agent review (2 rounds) | `plans/reviews/instagram-reel-support.md` | `reviews.md` | Moved |
| Human output-testing evidence | `plans/output-testing/instagram-reel-support.md` | `output-testing.md` | Moved |
| Archive manifest | — | `manifest.md` | Created |

Each archived copy carries a header block recording its former path, the bundle path, and the acceptance evidence. Internal cross-references still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now sit beside each other in this bundle as `<dir>.md`. Rewriting them was judged riskier than recording the mapping here.

## Kept in place

**Shared planning records** (multi-change; not owned by this change):

- `plans/README.md` — layout, naming, classification, and lifecycle. Untouched; it carries no per-change index that would show this change as active.

**Permanent source-of-truth documents** (updated by this change, but not archivable):

- `README.md` — Reel authoring, render, upload, Buffer draft flow, content rules, and the `shouldShareToFeed` decision
- `CLAUDE.md` / `AGENTS.md` — agent rules, validation commands, guardrails
- `adapters/wolds-record-social-media/` — adapter and context map
- `posts.example.json` — now carries three worked reel examples, one per template
- `posts.json` — live post data; **unmodified throughout this change**
- `agents_log.txt` — append-only project log

**Excluded** (outside archive scope): all code, tests, and assets delivered by this change — `video/`, `test/`, `scripts/lib/`, `scripts/render-video.mjs`, `scripts/prepare-video.mjs`, `scripts/lint-compositions.mjs`, modifications to four existing scripts and `instagram.html`, and `assets/photos/wolds-record-dashboard.png`.

## Implementation reference

- **Delivered:** `format: "image"|"reel"` routing across render → upload → Buffer draft. A record with no `format` follows the image pipeline unchanged.
- **New:** `video/` HyperFrames composition layer (brand tokens, shared scene CSS/JS, three templates), `scripts/render-video.mjs`, `scripts/prepare-video.mjs`, `scripts/lib/content.mjs`, `scripts/lint-compositions.mjs`, `test/` suite.
- **Modified:** `check-posts.mjs`, `create-buffer-draft.mjs`, `upload-cloudinary.mjs`, `process-posts.mjs`, `instagram.html`, `package.json`, `posts.example.json`, `README.md`.

## Validation reference

Final state at acceptance:

- `npm run check` — PASS
- `npm test` — **55/55**, 0 failures
- `npm run lint:compositions` — 3 ok, 0 failed (genuinely scanning; a zero-file scan now fails loudly)
- `npm run posts:check` — 0 ready, 0 blocked, 20 sent; `posts.json` unmodified
- Static PNG regression — md5 `17f2aa4ff9326356eaf434e67a9d6ba3`, unchanged from before the change
- Image Buffer payload — byte-identical to `git show HEAD:scripts/create-buffer-draft.mjs` output

## Review reference

Two independent review rounds. Round 1 was implementer-performed after the review agent hit a session limit, and **missed two blocking issues**. Round 2 was genuinely independent, returned NOT READY with 2 blocking and 8 should-fix findings, and was correct:

- **B1** — compositions left their own placeholder marketing copy in the DOM when a field was empty, so a reel missing captions rendered text the operator never wrote. Fixed in two layers (composition clears rather than falls back; per-scene content validation).
- **B2** — recorded "composition lint 0 errors" evidence had never actually run; `hyperframes lint` scanned zero files and still reported success. Fixed by `scripts/lint-compositions.mjs`, which fails loudly on a zero-file scan.

All 8 should-fix findings resolved. Full detail in `reviews.md`.

## Human testing reference

Executed 2026-08-04 against live external services, with authorisation. Full record in `output-testing.md`.

- **Cloudinary** — first ever real video upload. Served asset byte-identical to local (995,771 bytes, h264 1080×1920, 12.000000s). Finding **S1** (folder nesting causing billed duplicate assets and a stale video served to Buffer) confirmed genuinely fixed: re-upload produced no duplicate and no `wolds-record/wolds-record/` path, verified via the Cloudinary Admin API.
- **Buffer** — first ever Reel drafts created. `shouldShareToFeed` verified **at the service**, read back from Buffer's own API: `true` on one draft, `false` on the opt-out draft, both `status: draft`, `type: reel`, with a video asset.
- **All three templates** rendered from real content, including `product-feature`, which had never been rendered before a real product screenshot was supplied.
- **Nothing published.** Org-wide audit confirmed only the two new drafts were created; all other posts predate this change.
- **Human review of the rendered reels:** passed on look and pacing.

## Unresolved and external references

1. **Two live Buffer drafts** — `6a720c43672517345444aad9` (`shouldShareToFeed: true`) and `6a720c89f57e7ef8ca948d3e` (`shouldShareToFeed: false`). The human stated an intention to publish them. These are external records and cannot be archived.
2. **Two Cloudinary assets** — `wolds-record/wolds-record-reel-001` (0.95 MB) and `wolds-record/wolds-record-reel-002` (13.52 MB). Buffer fetches media from these URLs, so they must persist for as long as the drafts or published posts reference them.
3. **Background music — deferred to a separate change.** Raised by the human at acceptance. Reels are silent; `audioPath` is already carried in the schema but unused, which the spec recorded as a deliberate assumption for this iteration. `hyperframes` ships a `beats` command, so beat-synced pacing appears feasible. Track licensing is an open human decision. **Not part of this change.**
4. **Adapter placeholders still open** — PRD/task record schema, test-framework decision, and branch/commit/review/release policy remain explicit placeholders in `adapters/wolds-record-social-media/README.md`.
5. **Status-semantics note** — `posts.json` marks all 20 legacy records `sent_to_buffer`, while Buffer shows 12 of that batch as sent and 8 still draft. `sent_to_buffer` means "handed to Buffer", not "published"; the two statuses are not meant to track each other. Observation only, not a defect.
