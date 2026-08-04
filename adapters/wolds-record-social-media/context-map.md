# Context Map

Paths are relative to the repository root. Entries marked **Placeholder** have no authoritative document yet.

| Area | Authoritative path | Read when |
| --- | --- | --- |
| Vision and goals | `README.md` | Ideation and prioritisation |
| Product requirements | `automation-plan.md` | Spec and refinement |
| Architecture | `automation-plan.md`, `scripts/` | Cross-cutting or architectural work |
| ADRs | **Placeholder — none** | Existing decisions conflict or a new decision is needed |
| Schema and migrations | `posts.example.json` (post record shape), `scripts/check-posts.mjs` (validation rules) | Data or query changes |
| Domain and permissions | `.env.example` (external service surface); no auth/roles model | Business rules or access changes |
| Existing features | `README.md`, `scripts/` | Avoiding duplicate or regressive work |
| Planning and PRD | `automation-plan.md`, `plans/tasks/` | Development |
| Active temporary change artifacts | `plans/discovery/`, `plans/specs/`, `plans/tasks/`, `plans/reviews/`, `plans/output-testing/` | Development, review, and archival |
| Shared multi-change planning | `README.md`, `automation-plan.md` (both track status) | Development and archival reference updates |
| Archived change bundles | `plans/archive/<yyyy-mm-dd>-<change-slug>/` | Historical traceability and duplicate checks |
| Workflow layout and lifecycle | `plans/README.md` | Creating or archiving any workflow artifact |
| Runbooks and release | `README.md`, `package.json` scripts | Operational or release work |
| Change log | `agents_log.txt` | Recording work; required by `AGENTS.md` |

## Authority and freshness

- Source precedence when documents conflict: `posts.json` and `scripts/` (executable truth) > `automation-plan.md` > `README.md`. Code and data win over prose.
- Archive locations: `plans/archive/<yyyy-mm-dd>-<change-slug>/`.
- Temporary change-artifact classification rules: everything under `plans/discovery/`, `plans/specs/`, `plans/tasks/`, `plans/reviews/`, and `plans/output-testing/` is temporary and belongs to one in-flight change. `plans/archive/` is permanent. Nothing in `plans/` overrides a source-of-truth document.
- Shared planning/index completion-update rules: on completion, update `README.md` and `automation-plan.md` (both carry post/automation status), then append the entry to `agents_log.txt`.
- Archive bundle naming and manifest rules: bundles are dated by acceptance date and contain a `manifest.md` listing every archived file, its origin directory, and the evidence link that justified acceptance.
- Permanent source-of-truth documents that must remain in place: `README.md`, `AGENTS.md`, `CLAUDE.md`, `automation-plan.md`, `posts.json`, `posts.example.json`, `.env.example`, `package.json`, `plans/README.md`.
- Documents agents must not modify:
  - `.env` — git-ignored secrets; never read into artifacts or committed.
  - `agents_log.txt` — append-only; never rewrite or delete prior entries.
  - `posts.json` — contains live post content and status. Modify only as the explicit subject of a change, and re-run `npm run posts:check` afterwards.
  - `plans/archive/**` — permanent once written; never edit an archived bundle.
- Freshness or regeneration rules: `generated/` is git-ignored build output and is safe to regenerate. `posts.example.json` is the redacted reference shape and should be kept structurally in step with `posts.json`.
