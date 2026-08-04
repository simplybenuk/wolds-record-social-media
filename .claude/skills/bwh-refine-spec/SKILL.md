---
name: bwh-refine-spec
description: Iteratively refine a draft specification and its development-readiness artifacts from human feedback or repository evidence until the spec is approved for agentic development.
---

# Refine Spec

Apply the shared contracts in `../../contracts/autonomy.md`, `../../contracts/collaboration.md`, `../../contracts/completion.md`, `../../contracts/context-loading.md`, `../../contracts/handoff.md`, `../../contracts/model-routing.md`, and `../../contracts/states.md`.

## Goal

Improve an existing spec without silently changing its intent, until the human can approve it and development can begin without inventing scope.

## Workflow

1. Read the current spec, readiness artifacts, and the latest human feedback or requested change.
2. Identify which decisions, requirements, assumptions, acceptance criteria, task boundaries, dependencies, or validation plans are affected.
3. Inspect only the repository evidence needed to validate the change.
4. Update the existing spec artifact in the consuming repository while preserving confirmed decisions, non-goals, and factual claims. Do not publish a revised spec only in chat.
5. Re-check readiness: scope is bounded, requirements are testable, dependencies are sequenced, risks are called out, tasks are independently verifiable, and validation is specified.
6. Set the status to `READY FOR HUMAN APPROVAL` when the draft is coherent; only the human may change it to `APPROVED FOR DEVELOPMENT`.
7. Read the persisted artifact back and verify that the requested changes and readiness status are present. Do not report completion if the file was not updated successfully.

This skill may be used repeatedly. It may produce a task outline, but it does not edit the project's active PRD unless explicitly requested.

The repository file is the authoritative output. The final response is a concise change handoff and must not duplicate the full revised spec.

## Stop conditions

Stop for human input when feedback conflicts with a confirmed decision, a material product or architecture choice is missing, or repository evidence contradicts the intended design. Do not resolve material disagreement by guessing.

## Handoff

Return the changed sections, decisions preserved or changed, remaining questions, readiness status, and the next action: human approval, another refinement pass, or `bwh-development` after the status becomes `APPROVED FOR DEVELOPMENT`.

## Output

Return exactly these headings:

- `artifact_path`
- `status`
- `changed_sections`
- `decisions_preserved`
- `decisions_changed`
- `assumptions`
- `remaining_questions`
- `readiness_check`
- `persistence_validation`
- `recommended_next_action`
- `context_files_read`
- `source_of_truth_decisions`
- `conflicts_found`
