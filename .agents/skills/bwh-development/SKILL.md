---
name: bwh-development
description: Execute bounded PRD tasks in a project repository with focused changes, required validation, planning traceability, and a handoff to independent agent review.
---

# Development

Apply the shared contracts in `../../contracts/autonomy.md`, `../../contracts/collaboration.md`, `../../contracts/completion.md`, `../../contracts/context-loading.md`, `../../contracts/handoff.md`, `../../contracts/model-routing.md`, and `../../contracts/states.md`, plus the consuming project's adapter.

## Goal

Implement the requested task or authorised run count while preserving the approved spec, project scope, security, and source-of-truth rules.

## Workflow

1. Confirm the referenced spec is human-approved with status `APPROVED FOR DEVELOPMENT`. Stop if approval or required readiness artifacts are missing.
2. Finalize or update the consuming project's PRD from the approved task outline, checking active, backlog, and completed work for duplicates.
3. Select the next eligible task using the project's planning rules.
4. Inspect only relevant context and confirm the task is still consistent with the approved spec.
5. Implement the smallest complete change and add or update focused tests.
6. Run the project's required validation suite and resolve failures that are in scope.
7. Update the repository's planning or progress artifact with the task status, material changes, validation results, commit status, blockers, and next handoff. Keep detailed traceability there. Commit only when the project workflow authorises commits.
8. Hand the completed work to `bwh-agent-review` before human output testing.

Use stronger reasoning or additional review when the task crosses architecture, tenancy, permissions, security, migration, rollout, or recovery boundaries, or when validation repeatedly fails.

## Stop conditions

Stop on a material blocker, failed required validation that cannot be safely resolved in scope, missing authority for an external or destructive action, or scope expansion. Record the blocker and do not start another task.

## Handoff

Return a compact outcome summary that links the authoritative planning or progress artifact. Include the completed task, material changes, validation result, commit status when relevant, blockers or assumptions only when material, and the next priority. Explicitly state that the next handoff is `bwh-agent-review`.

Do not repeat approval evidence already recorded in the spec, enumerate every changed or inspected file, reproduce test logs, or restate the planning artifact. Mention paths only when they help the user navigate or act.

## Output

Use one outcome sentence followed by at most five short bullets covering:

- completed task and planning artifact
- material changes
- validation result
- material blocker, assumption, or commit status when relevant
- next priority and `bwh-agent-review` handoff
