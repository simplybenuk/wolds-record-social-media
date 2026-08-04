# Review: Instagram Reel support

> **ARCHIVED 2026-08-04.** Bundle: `plans/archive/2026-08-04-instagram-reel-support/`. Manifest: `plans/archive/2026-08-04-instagram-reel-support/manifest.md`.
> Accepted by the human on 2026-08-04 after viewing the rendered reels ("these are nice. good work"), following a full output-testing run against the live Cloudinary and Buffer services.
> Cross-references in this file still use the pre-archive `plans/<dir>/instagram-reel-support.md` paths; those files now live beside this one as `<dir>.md`.
> Former path: `plans/reviews/instagram-reel-support.md`


- **Verdict (round 2, after fixes): READY FOR HUMAN TESTING**
- Dates: round 1 (implementer, incomplete) 2026-08-04 · round 2 (independent) 2026-08-04
- Spec: `plans/specs/instagram-reel-support.md` · PRD: `plans/tasks/instagram-reel-support.md`

> **Round 1 is superseded. It is kept for the record, not as a current statement of quality.**
> Its "no blocking findings" conclusion was wrong: round 2 found two, including one that could
> have published copy the operator never wrote. Its validation table (32 tests) and its
> "composition lint 0 errors" line are both stale — the latter was never actually run.
> **The authoritative section is "Round 2" at the end of this file.**

## Round 1 conduct — read this before trusting the round-1 verdict

An independent reviewer agent was dispatched to audit this work with fresh eyes. **It terminated on a session limit before producing any findings.** The review below was therefore performed by the same party that wrote the code, which is a genuine weakness in assurance: self-review reliably under-detects design-level and assumption-level defects.

Treat this verdict as *"validated, but not independently reviewed."* A fresh-eyes pass — particularly over `scripts/upload-cloudinary.mjs` and `video/` — remains worthwhile.

## Findings

### Blocking (round 1 view — later proven incomplete)

None found *by round 1*. Round 2 found two. Two further blocking-class defects were found and fixed **during** assembly, both recorded in the PRD:

1. `--strict-variables` rejected all array variables, breaking `render-video.mjs` outright.
2. The editor preview misrepresented pacing and omitted `product-feature`'s benefit scene entirely.

### Fixed during this review

| Finding | Evidence | Resolution |
| --- | --- | --- |
| A non-string `format` (e.g. `"format": 1` from a hand-edit) escaped an opaque `TypeError` from `.trim()` instead of a content error | `scripts/lib/content.mjs` `resolveFormat()` | Hardened to type-check and report `Invalid format 1. Expected one of: image, reel.`; `null`/`""`/blank now explicitly fall back to image. Locked by 3 new tests. |
| `test/pacing.test.mjs` searched the whole file for weight literals, so it would have passed with weights attached to the **wrong scenes** — the guard did not actually guard | `test/pacing.test.mjs` (original) | Rewritten to extract the **ordered** weight sequence per template branch and compare. Includes a self-check proving a mutated source fails, so the assertion cannot be vacuous. |

### Should-fix (not blocking, deliberately not done)

- **`scripts/render-post.mjs:8` defaults to `/usr/bin/google-chrome`**, which does not exist on this machine; every static render needs `PLAYWRIGHT_CHROME_PATH`. Pre-existing, outside this change's scope. Documented in README troubleshooting. Falling back to the Playwright cache would make the tool work out of the box.
- **`prepare-video --dry-run` performs a real render** before the upload dry-run. Mirrors `prepare-post.mjs` and is forced by `upload-cloudinary.mjs` checking file existence before its dry-run branch. Documented rather than changed, to avoid altering proven image behaviour.

### Informational

- `reel-002` (photo-story, 15s, 3 photos) produced a **14 MB** MP4 versus 1.2 MB for the text-based `reel-001`. Photo-heavy Reels will consume Cloudinary credits considerably faster. Worth watching against the "no extra cloud bill" principle.
- Passing `--video=` to an image post routes it down the video branch. Explicit-flag intent; not treated as a defect.
- Render cost is ~30s per 12s Reel (360 frames, 2 workers). HyperFrames warns that 2 capture workers may exceed the default V8 heap; `--workers 1` or a raised heap is the documented remedy.

## Validation performed (re-run directly, not taken on trust)

| Check | Result |
| --- | --- |
| `npm run check` | PASS |
| `npm test` | 32/32 pass |
| `posts.json` integrity | unmodified (absent from `git status`); 0 ready, 0 blocked, 20 sent |
| Static PNG regression | md5 `17f2aa4ff9326356eaf434e67a9d6ba3`, identical to pre-change baseline |
| Reel render after all fixes | h264, 1080×1920, exactly 12.000000s |
| Second template | photo-story, 1080×1920, exactly 15.000000s |
| Error paths (6 cases) | unknown template, out-of-range duration, fractional duration, missing asset, too few points, image-post-to-reel-renderer — all exit 1 with distinct, actionable messages |
| Format defaulting | `absent` / `null` / `""` / `"   "` all resolve to image |
| Buffer payloads | image `assets[].image` unchanged; reel `assets[].video` + `thumbnailOffset`, `type: "reel"`; reel without `publicVideoUrl` exits 1 |
| Secret leakage | `generated/*.variables.json` contains only content fields; `generated/` and `node_modules/` are git-ignored |

## Residual risks

1. **The Cloudinary video upload has never executed.** No `.env` exists. The video branch mirrors the proven image branch exactly — same signing, timestamp, `public_id`, `overwrite`, and form fields, differing only in endpoint (`/video/upload`) and MIME (`video/mp4`) — and reads correctly. But *correct by inspection is not correct by execution.* This is the single largest unverified surface.
2. **No independent review**, per the note above.
3. **`product-feature` has never been rendered**, because the repo contains no product screenshots. Its composition lints clean and its validation is tested, but no MP4 has been produced from it.
4. **Buffer Reel drafts are unproven end to end.** The payload matches Buffer's published example, but no draft has been created.

## Human output-testing focus

1. **Watch the two MP4s in `generated/`** — this is the judgement only you can make: is the motion calm enough, is text readable without audio, do the Instagram safe margins hold on a real phone?
2. **Check preview fidelity** — open `instagram.html`, preview `reel-001`, and confirm the pacing you see matches the MP4. That parity was broken once and is now test-guarded, but your eyes are the real check.
3. **With credentials present**, run `prepare-video.mjs` on `reel-001` and confirm the Cloudinary video URL resolves publicly, then `create-buffer-draft.mjs --dry-run` before any real draft. This closes residual risk 1.
4. **Confirm the Buffer draft appears as a Reel** (not a feed video) and that its 2s thumbnail frame looks right.

## Next handoff

Successful human output testing hands the accepted change to `bwh-archive-change`. If testing finds more work, it returns to `bwh-development`.


---

# Round 2 — independent review, and its resolution

A second reviewer ran the `bwh-agent-review` workflow with fresh eyes, explicitly instructed to treat round 1 as evidence to challenge rather than a baseline to confirm. It returned **NOT READY FOR HUMAN TESTING** with 2 blocking and 8 should-fix findings. That verdict was correct and round 1 was wrong on two counts.

## Blocking — both resolved

**B1 — compositions could publish placeholder marketing copy.** `setText()` returned early on an empty value, leaving the composition's own authoring copy in the DOM, and `reelIssues()` validated scene *count* but never scene *content*. A photo-story reel with captions omitted rendered "Every session, written once and filed where you expect it." over the operator's photo, exit 0. The reviewer proved this by rendering the fixture and reading the frame — not by inspection.

Resolved in two layers, because validation alone is insufficient (`hyperframes preview` bypasses the CLI entirely):
- `video/components/scene.js` — `setText` now clears the element and `setImage` drops the placeholder `src`. Blank is recoverable; confidently wrong copy is not.
- `scripts/lib/content.mjs` — per-scene `photoPath`/`caption` validation, scene-object type checking, a required `cta` for every template, and a required benefit statement for `product-feature`.

Guarded by `test/scene.test.mjs` (loads the browser IIFE against a DOM stub) and 4 new content-integrity tests. Note these rules **broke 5 existing tests**, which had asserted the weaker contract; the fixtures were corrected rather than the rules weakened.

**B2 — round 1 recorded lint evidence that never ran.** `hyperframes lint` takes a project directory containing `index.html`; pointed at this repo it scans **zero files** and still returns `errorCount: 0`, which reads exactly like a pass. Round 1 recorded "composition lint: 0 errors" from a subagent's report without reproducing it. This is a reporting failure, not a code defect, and it is the more instructive of the two.

Resolved by `scripts/lint-compositions.mjs` (`npm run lint:compositions`), which builds a real harness per composition and **fails loudly when `filesScanned` is 0**. Genuine result: 3 ok, 0 failed, 1 file scanned each.

## Should-fix — resolved

| ID | Finding | Resolution |
| --- | --- | --- |
| S1 | Cloudinary re-upload nested the folder (`wolds-record/wolds-record/...`), so `overwrite` silently failed, a duplicate ~14 MB asset was billed, and Buffer kept serving the stale video | Folder prefix stripped before reuse, in both video and image branches |
| S2 | A second, weaker `resolveFormat` in the editor threw `TypeError` on `"format": 1` | Rewritten as a deliberate mirror of the lib, with graceful degradation so a bad record still loads and is fixable |
| S3 | One bad `format` aborted the entire batch | Bad records are skipped and reported; the run continues and exits non-zero at the end |
| S4 | Dead `SCENE_WEIGHTS` map still held the known-wrong pacing numbers | Removed; a missing weight now throws instead of silently resurrecting the old pacing |
| S5 | `format` and `instagramType` were never cross-validated | Cross-validated in both the draft creator and the checker. Also fixed: a reel with no `instagramType` defaulted to `"post"`, pairing a video asset with a post type |
| S6 | `hyperframes` was `^0.7.90`, against an explicit spec instruction to pin | Pinned to exact `0.7.90` |
| S7 | No test covered Buffer payloads, `check-posts`, or routing; the image-regression guard was manual | `test/payloads.test.mjs` — 10 integration tests driving the real CLI via `--dry-run`, including a guard on live `posts.json` |
| S8 | `response.json()` before the `ok` check turned a 413/502 into `Unexpected token '<'` | Body read as text first; errors now carry HTTP status, reason, and a truncated body |
| I2 | Editor silently coerced an unknown template and rewrote the record | Preserved verbatim and surfaced in the validation panel |

## Product decision — resolved 2026-08-04

`create-buffer-draft.mjs` set `shouldShareToFeed: post.shouldShareToFeed ?? true`, so **every Reel also cross-posts to the main feed by default**. This was a distribution choice absent from the approved spec, inherited from the image path rather than chosen.

**Decision (human): keep the cross-post.** Reach on a growing account outweighs grid curation. The default `true` is now deliberate rather than inherited:

- `resolveShareToFeed` in `scripts/lib/content.mjs` is the single source of the rule, so the draft creator and the checker cannot diverge (the S2 failure mode).
- A non-boolean is rejected. `"shouldShareToFeed": "false"` is truthy in JS and would have silently inverted the author's intent.
- `check-posts` prints `shareToFeed=<value>` on every Reel, so a defaulted `true` is visible before publishing.
- Documented in README under "Buffer draft flow for Reels", including how to opt a Reel out.

The field is still sent on **image** posts, where Instagram ignores it. Scoping it to Reels was considered and rejected: the pre-Reel image payload carries it, and byte-identical image payloads are an acceptance criterion of this change. Verified after the edit — the payload for `wolds-record-006-paper-notes` is identical to `git show HEAD:scripts/create-buffer-draft.mjs` output.

Covered by 3 new tests (default on, opt-out, non-boolean rejected); the live-`posts.json` guard now asserts the whole `metadata.instagram` object rather than just `type`.

## Validation after all fixes

`npm run check` PASS · `npm test` **52/52** · `npm run lint:compositions` 3 ok / 0 failed (genuinely scanning) · `posts.json` unmodified, 0 ready / 0 blocked / 20 sent · static PNG md5 `17f2aa4ff9326356eaf434e67a9d6ba3` unchanged · both reels re-rendered h264 1080x1920 at exactly 12.000000s and 15.000000s · image Buffer payload byte-identical to `git show HEAD:` output.

## Residual risks carried into human testing

1. **The Cloudinary video upload has still never executed.** S1 and S8 were fixed by reasoning about a code path that has never run. First real use remains the proof.
2. **Buffer Reel drafts are unproven end to end.**
3. **`product-feature` has never been rendered** — the repo contains no product screenshots.
4. Round 2's own findings were verified by the implementer; there has been no third-party pass over the round-2 fixes.
