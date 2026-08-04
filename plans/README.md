# Plans

Workflow artifacts for the BWH AI workflow. Each change moves left to right through these directories.

| Directory | Holds | Produced by | Lifetime |
| --- | --- | --- | --- |
| `discovery/` | Discovery briefs — problem, outcome, actors, constraints, options, open questions | `bwh-ideate` | Temporary |
| `specs/` | Bounded specifications and development-readiness artifacts | `bwh-spec`, `bwh-refine-spec` | Temporary |
| `tasks/` | PRD task breakdowns and progress traceability | `bwh-spec`, `bwh-development` | Temporary |
| `reviews/` | Independent agent review findings against the approved spec | `bwh-agent-review` | Temporary |
| `output-testing/` | Human output-testing evidence and acceptance notes | Human | Temporary |
| `archive/` | Verified, manifest-backed bundles of accepted changes | `bwh-archive-change` | Permanent |

## Naming

- Change slug: kebab-case, stable across every directory for one change — e.g. `buffer-retry-handling`.
- Working files: `<change-slug>.md` in each temporary directory.
- Archive bundles: `archive/<yyyy-mm-dd>-<change-slug>/`, dated by acceptance date, containing every temporary artifact for that change plus a `manifest.md`.

## Classification

- **Temporary** artifacts (`discovery/`, `specs/`, `tasks/`, `reviews/`, `output-testing/`) belong to one in-flight change and are moved into an archive bundle when that change is accepted. They are not source of truth.
- **Permanent** artifacts (`archive/`) are never edited after archival.
- Source-of-truth documents live outside `plans/` — `README.md`, `AGENTS.md`, `CLAUDE.md`, `automation-plan.md`, `posts.json`, `posts.example.json`. `plans/` never overrides them.

## On completion

When a change is accepted:

1. `bwh-archive-change` moves its temporary artifacts into `archive/<yyyy-mm-dd>-<change-slug>/` and writes `manifest.md` listing every file, its origin directory, and the evidence link that justified acceptance.
2. Update the shared indexes that the change affected — `README.md` and `automation-plan.md` both track post and automation status.
3. Append the completion entry to `agents_log.txt`.
