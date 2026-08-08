# Independent review: Wolds Record campaign review slice

- **Verdict:** READY FOR HUMAN TESTING
- **Reviewed:** 2026-08-04
- **Specification:** `plans/specs/wolds-record-campaign-review-slice.md`
- **Task record:** `plans/tasks/wolds-record-campaign-review-slice.md`
- **Review mode:** Independent implementation, requirement, regression, security-boundary, and mobile-browser review

## Verdict

The implementation is ready for the specification's human output-testing gate. No unresolved blocker or should-fix finding remains. The local campaign flow is durable and addressable, produces real PNG previews, supports the specified review mutations and failure recovery, and contains no application path to Buffer, Cloudinary, Meta, or `posts.json` mutation.

This verdict does not accept the generated content for publication. A human must still run one live OpenAI generation, judge brand and output quality, and confirm publication rights for the selected photos. The slice remains local-only and performs no publication action.

## Review cycles

### Cycle 1 — not ready

The first independent pass identified material gaps in attempt ownership and safe failure binding, interrupted pending work, regeneration version/cost/lineage behavior, render concurrency and stale completion protection, edit-domain validation, action-local error reporting, dependency provenance, and breadth of mobile-browser evidence. Development returned to those bounded areas.

### Cycle 2 — ready

The follow-up verified durable attempt and retry relationships, prompt hashes and brand-pack versions, explicit interruption handling, application-wide sequential rendering with version checks, optimistic post mutations, safe and local errors, regeneration deduplication, retained previews/briefs across failures, official lockfile metadata, and a full mobile journey. An initial browser fixture used an invalid emphasis/headline combination before reaching its intended stale-write assertion; the fixture was corrected and the entire journey then passed independently.

### Cycle 3 — clean-checkout verification (2026-08-08)

The published commit `c412072` was re-verified from a fresh worktree and a `npm ci` install, because the preceding cycles ran in environments that reconstructed the branch from patches, could not reach the npm registry, or could not launch Chrome. That re-run found one regression the earlier cycles could not have observed.

`scripts/run-ts-tests.mjs` emitted the esbuild bundle into an OS temp directory while marking `playwright-core` external. The bundled tests therefore resolved `playwright-core` by walking up from `/tmp`, never reaching the repository's `node_modules`, so every real render failed as `browser_unavailable`. Two integration tests failed on a clean checkout: the three-post fixture render and the regeneration replacement-preview case. The bundle is now written under `node_modules/.cache/wolds-studio-tests/` and removed after the run. Suite duration moved from 0.6 s to 12.4 s once real renders executed, confirming the earlier run was not exercising the browser at all.

All gates then passed on the clean checkout, including the full 390×844 mobile journey and real 1080×1080 PNG output.

## Findings

### Blockers

None unresolved.

### Should-fix findings

None unresolved.

### Advisories and human-owned decisions

1. No live OpenAI request was made during development or independent review, as required by the approved boundary. Human output testing must perform the one authorized live generation and assess usefulness, factuality, tone, captions, dates, hashtags, and visual quality.
2. Repository photo assets are allow-listed, but publication rights remain a human confirmation before any later publication workflow.
3. The application is deliberately bound to loopback and has no authentication. Making it reachable beyond the trusted local machine would require a separate security and deployment change.
4. Node currently prints an experimental warning for `node:sqlite`; this did not affect migrations, persistence, tests, or build output.
5. Template IDs are preserved as structured metadata while the inherited templates share the existing visual drawing path. A visual-template redesign was explicitly outside this slice.

## Validation evidence

| Gate | Result |
| --- | --- |
| TypeScript | `npm run check` passed |
| Full automated suite | `npm test` passed: 60 legacy tests and 34 campaign/application tests, including real PNG generation and regeneration-preview failure coverage |
| Live-data validator | `npm run posts:check` passed: 0 ready, 0 blocked, 20 sent |
| Production build | `npm run build` passed with the new campaign routes; no unresolved file-tracing warning remained |
| Mobile browser | Independent 390×844 pass: 3 posts and previews; reload persistence; caption-only edit retained preview; visual edit rerendered; regeneration reached revision 2 and retained date; reject/return-to-draft; stale write rejection; render and generation failure recovery; visible keyboard focus; no horizontal overflow; 0 console errors |
| Mobile evidence | Screenshot: `/tmp/wolds-independent-final3-mobile.png` (temporary local review evidence) |
| Data boundary | `posts.json` has no diff from `main` |
| External-side-effect boundary | Source scan found no Buffer, Cloudinary, Meta/Facebook SDK import or client-side OpenAI/key exposure in the application |
| Diff hygiene | `git diff --check` passed |
| Dependency provenance | OpenAI 7.4.0 and Drizzle ORM 1.0.0-rc.4 lockfile registry URLs and integrity values were independently matched to public package locks; the structured-output helper produced a strict root object schema with `additionalProperties: false` |

The local shell could not reach the npm registry under the host's network policy. Development therefore assembled the exact pinned package sources from public upstream package locks; the committed lock now carries official registry integrity metadata so a normal connected environment can reproduce installation. All validations above ran against those exact pinned versions.

## Requirement traceability

| Requirement area | Review evidence |
| --- | --- |
| R1–R2 input, idempotency, durable address | Shared Zod/server validation, opaque campaign IDs, submission keys, pre-generation persistence, direct pending/complete/failed route reads, fixture and browser lifecycle tests |
| R3 brand pack | Versioned repository pack with reviewed facts, allow-listed IDs and paths, tone/CTA/hashtag guidance, and explicit fabrication/clinical-claim prohibitions |
| R4–R6 generation contract and attempts | Interchangeable fixture/live boundary, strict Responses structured output with `store: false` and no tools, application revalidation, exact count, durable pending/complete/failed attempts, safe error classes, usage/response metadata, prompt hashes, and retry lineage |
| R7 partial failure | Atomic campaign result persistence, post-local rendering failure, explicit interrupted-work recovery, campaign retry replay protection, and render retry without an OpenAI call |
| R8 state machine | Durable draft/approved/rejected transitions, explicit return-to-draft, retained rejected content, versioned mutations, and stale-write conflict coverage |
| R9 renderer boundary | Server-only legacy adapter, real PNG integration, global sequential render queue, atomic replacement, relative campaign media paths, render-version checks, and passing legacy behavior suite |
| R10 mobile review UI | Server reads/actions, route states, pending controls, action-local accessible errors, semantic preview alt text, touch-sized controls, and the independent 390×844 browser pass |
| R11 edit/regenerate | Domain-validating partial edits, caption/alt edits without rerender, renderable edits with replacement preview, paid regeneration deduplication, preserved identity/date, incremented revision, prompt variation instruction, and failure recovery |
| R12 security/operations | Server-only credentials, loopback scripts, no auth overclaim, generated/database files ignored, safe messages, no external publication client, no `posts.json` mutation, and setup/recovery documentation |

The CR-01 through CR-10 implementation areas have corresponding code and validation evidence. The development owner can close their task statuses when accepting this independent verdict.

## Human output-testing focus

1. Configure a server-only `OPENAI_API_KEY`, a supported structured-output model, and live generation mode following `README.md`.
2. Create a three-post Wolds Record campaign from a phone-sized viewport and confirm the live content feels specific, useful, factually safe, and faithful to the reviewed brand pack.
3. Inspect all real previews and channel-specific copy, then exercise one edit, one regeneration, approval, rejection, return-to-draft, and reload.
4. Confirm selected photo rights before treating any approved item as publication-ready.
5. Confirm that testing ends at local approval: do not upload, schedule, or publish from this slice.

Record results in `plans/output-testing/wolds-record-campaign-review-slice.md`. If accepted, hand off to `bwh-archive-change`; if a product or implementation defect is found, return the bounded finding to `bwh-development` and repeat independent review after the fix.
