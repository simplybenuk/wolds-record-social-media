# PRD: Wolds Record campaign review slice

- **Status:** READY FOR HUMAN TESTING
- **Spec:** `plans/specs/wolds-record-campaign-review-slice.md`
- **Branch:** `feature/wolds-record-campaign-review-slice`
- **Working checkout:** isolated local checkout because the host repository's Git metadata is read-only
- **Started:** 2026-08-04
- **Next handoff:** Human output testing in `plans/output-testing/wolds-record-campaign-review-slice.md`

## Objective and scope

Deliver the approved local, mobile-first Wolds Record campaign creation and review loop through durable fixture and mocked-live paths. No live OpenAI request, media upload, Buffer/Meta call, schedule, publication, or `posts.json` mutation is authorized during development.

## Confirmed decisions and assumptions

- The user's instruction to develop this exact spec is the approval evidence; the spec is now `APPROVED FOR DEVELOPMENT`.
- Node.js 22's built-in `node:sqlite` is the preferred SQLite driver because current Drizzle guidance supports it and it avoids a second native dependency. Drizzle ORM remains required.
- Campaign creation persists the campaign and pending attempt before redirect. Generation is claimed idempotently after navigation so reload or concurrent triggers cannot duplicate a paid request.
- The fixed pack uses only repository-evidenced claims and “being built” positioning. Photo rights must be confirmed by a human before publication; that does not block fixture development.
- Existing static templates share one canvas drawing path. Multiple template IDs remain contract metadata in this slice; visual template redesign is out of scope.
- Interrupted pending work is stale after 10 minutes and requires explicit retry; it is never replayed automatically.

## Context and duplicate check

Relevant context: `VISION.md`, `README.md`, `automation-plan.md`, `posts.example.json`, `posts.json`, `instagram.html`, `scripts/render-post.mjs`, `scripts/lib/content.mjs`, existing `test/` suites, the project adapter/context map, and the approved spec. No active or archived campaign-review implementation duplicates this work. Archived Reel support remains behaviorally stable.

## Task records

| ID | Task | Acceptance criteria | Validation | Status |
| --- | --- | --- | --- | --- |
| CR-00 | Approval and PRD bootstrap | Approval is persisted; duplicate/context check and risks recorded | `git diff --check` | complete |
| CR-01 | Application baseline | Pinned Next/React/TS/Tailwind/Drizzle/OpenAI/Zod/test dependencies; App Router shell; Node-only runtime; loopback scripts; ignored local data | Legacy validation, typecheck, minimal build | complete |
| CR-02 | Brand and domain contracts | Fixed reviewed pack, prompt, IDs, input/generated/edit schemas, legacy adapter, boundary tests | Focused unit tests | complete |
| CR-03 | Database foundation | Committed migration, FK-enabled repository, transactions, attempts, idempotency, optimistic versions | Temporary empty-database integration tests | complete |
| CR-04 | Durable fixture lifecycle | Pre-call persistence, claim/retry/interruption behavior, fixture generator, atomic campaign result, addressable reads | Fixture lifecycle integration tests | complete |
| CR-05 | Live generator boundary | Responses API strict structured output, `store:false`, no tools, response/refusal/incomplete/error/usage mapping | Fully mocked contract tests; no live call | complete |
| CR-06 | Renderer boundary | Reusable sequential session, allow-listed assets, atomic replacement, stable errors, compatible legacy CLI, real fixture PNGs | Unit, CLI contract, real PNG integration | complete |
| CR-07 | Review mutations | Edit/regenerate/review transitions, attempt lineage, rerender rules, stale conflict protection | Repository/action integration tests | complete |
| CR-08 | Mobile application UI | Create and review routes, pending/errors/retry, accessible mobile controls and previews | 390×844 browser flow | complete |
| CR-09 | Regression and hardening | Full suite/build/migration/fixture flow passes; app has no publication path; live data unchanged | All required validation | complete |
| CR-10 | Documentation and handoff | Setup/security/limitations documented; adapter/context corrected; evidence logged; independent review complete | Documentation/readback/diff checks | complete |

## Validation requirements

- `npm run check`
- `npm test`
- `npm run posts:check`
- `npm run build`
- TypeScript/type-aware source validation chosen in CR-01
- Empty temporary SQLite migration with foreign keys enabled
- Fixture end-to-end campaign and three real PNG previews across at least two template IDs
- Browser verification at 390×844 including reload, mutations, conflicts, failures, accessibility, and overflow
- Confirm `posts.json` is byte-for-byte unchanged and application code imports no Buffer, Cloudinary, or Meta clients

## Stop conditions

Use the approved spec's stop conditions. Also stop if required dependencies cannot be obtained in a verifiable, lockfile-pinned form, or if real Chrome/Chromium remains unavailable for the mandatory renderer/browser gates.

## Progress log

| Date | Task | Evidence and outcome | Commit status / next handoff |
| --- | --- | --- | --- |
| 2026-08-04 | CR-00 | User authorized development of the exact spec; no duplicate found; sub-agent task, renderer, and brand audits completed | Uncommitted; start CR-01 |
| 2026-08-04 | Environment | Native worktree creation blocked by read-only `.git`; isolated checkout and feature branch created under `/tmp`. npm registry is policy-blocked; GitHub reads work. Chrome default path absent; cached Playwright Chrome may be usable after dependency setup. | Resolve dependencies/browser during CR-01/CR-06 |
| 2026-08-04 | CR-01–CR-10 | Implemented the full local slice; final gates passed: clean production build, 60 legacy + 34 application tests, posts validation, three Reel lint checks, three real fixture PNGs, source/security/data scans, and complete 390×844 browser recovery/mutation flow. | Uncommitted; independent review complete |
| 2026-08-04 | Independent review | Two review cycles resolved all blockers and should-fix findings; verdict `READY FOR HUMAN TESTING`. | Hand off one live OpenAI run and human brand/visual/photo-rights judgment |
