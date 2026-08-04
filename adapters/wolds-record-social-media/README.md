# Wolds Record Social Media adapter

Project-specific layer for the `wolds-record-social-media` repository. Keep project constraints here rather than in the reusable workflow skills.

> This adapter is distinct from the `wolds-record` adapter bundled with the workflow source. That one describes a Supabase application with a `typecheck`/`test`/`lint` suite and organisation scoping. **None of those apply to this repository.** Do not copy its rules here.

## Project

- Name: Wolds Record Social Media
- Repository: `wolds-record-social-media` (local git repo, branch `main`)
- Context map: `adapters/wolds-record-social-media/context-map.md`

## Agent host and install layout

- Agent host(s): Claude Code and Codex (dual install)
- Agent home directory (contains installed `skills/` and `contracts/`): `.claude/` and `.agents/`
- Agent instruction file: `AGENTS.md` and `CLAUDE.md` (repository root). Both carry the same rules and must be kept in sync when either changes.
- Adapter location: `adapters/wolds-record-social-media/` (host-neutral, outside both agent homes)

## Required tools and validation

- Discovery tools: `rg` / `rg --files` for targeted discovery before broader reads; local file inspection for context.
- Source-of-truth inspection: `posts.json` (live content data), `posts.example.json` (redacted reference shape), `README.md`, `automation-plan.md`.
- Focused tests: **Placeholder — no test framework is configured.** `package.json` defines no `test` script and the repo has no test files or runner dependency.
- Full validation:
  - `npm run check` — syntax-checks all eight `scripts/*.mjs` via `node --check`. This is the only repo-wide validation that exists.
  - `npm run posts:check` — validates `posts.json` via `scripts/check-posts.mjs`.
  - Run both after any change to `scripts/` or `posts.json`.
- Browser or smoke checks: `playwright-core` is a dependency and `scripts/render-post.mjs` renders `instagram.html`. **Placeholder:** the exact render smoke-check command is undocumented; confirm before relying on it.

## Local guardrails

- Security and tenancy: single-tenant workspace; no tenancy model. No auth or role system.
- Data handling: secrets live in `.env` (git-ignored) and are enumerated in `.env.example` — Buffer API key/channel, Cloudinary cloud name/key/secret. **Never** write real credential values into `posts.json`, logs, committed files, or workflow artifacts.
- Scope exclusions: `generated/`, `node_modules/`, and `.env` are git-ignored and must not be committed or archived.
- External-write approvals: `create-buffer-draft.mjs`, `process-posts.mjs`, `mark-post-status.mjs`, and `upload-cloudinary.mjs` write to **external services** (Buffer, Cloudinary). Publishing a post is outward-facing and effectively irreversible — require explicit human confirmation before any run that creates, schedules, or publishes a draft, or uploads media.
- Logging duty: per `AGENTS.md`, append a brief dated entry to `agents_log.txt` after meaningful changes — local timestamp, files changed, verification run, manual follow-up. Keep entries concise and factual; no secrets.

## Planning and delivery

All workflow artifacts live under `plans/`. See `plans/README.md` for the full layout and lifecycle.

- Discovery location and format: `plans/discovery/<change-slug>.md`, markdown.
- Spec location and format: `plans/specs/<change-slug>.md`, markdown.
- Dedicated planning/task artifact locations and formats: `plans/tasks/<change-slug>.md`, markdown.
- PRD/task schema: **Placeholder — not yet established.** Define the task record shape (id, description, acceptance criteria, validation, status) on first use of `bwh-spec`.
- Progress log: `agents_log.txt` (existing, required by the agent instruction files).
- Review artifact location and format: `plans/reviews/<change-slug>.md`, markdown.
- Human output-testing evidence location and format: `plans/output-testing/<change-slug>.md`, markdown.
- Completed change archive location and bundle naming: `plans/archive/<yyyy-mm-dd>-<change-slug>/`, dated by acceptance date.
- Temporary change-artifact classification rules: everything in `plans/discovery/`, `plans/specs/`, `plans/tasks/`, `plans/reviews/`, and `plans/output-testing/` is temporary and belongs to one in-flight change. `plans/archive/` is permanent and never edited after archival. Source-of-truth documents live outside `plans/`.
- Shared planning/index completion-update rules: on completion, update `README.md` and `automation-plan.md` — both track post and automation status — then append the completion entry to `agents_log.txt`.
- Archive manifest and index requirements: each bundle contains a `manifest.md` listing every archived file, its origin directory, and the evidence link that justified acceptance.
- Branch and commit policy: **Placeholder.** Repo has a single `main` branch and no documented policy. Default to branching off `main` for changes; commit or push only when asked.
- Review and release policy: **Placeholder — not yet established.** No CI, PR template, or GitHub remote workflow is configured in-repo.

## Open migration actions

1. Define the PRD/task record schema on first use of `bwh-spec`.
2. Confirm whether a test framework should be added, or record that `npm run check` plus `npm run posts:check` is the accepted full validation suite.
3. Document the branch, commit, review, and release policy — currently undefined.
4. Confirm the render smoke-check command for `scripts/render-post.mjs` / `instagram.html`.
5. Keep `AGENTS.md` and `CLAUDE.md` in sync whenever either changes.

## Tool routing

Before an action, resolve required discovery and validation prerequisites. If a read is empty, partial, or suspiciously narrow, try one meaningful fallback before concluding that evidence is absent. External writes (Buffer, Cloudinary), destructive actions, and scope expansion require confirmation.
