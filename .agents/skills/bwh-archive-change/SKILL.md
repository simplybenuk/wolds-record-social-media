---
name: bwh-archive-change
description: Archive an accepted delivered change and all evidence-linked temporary workflow documentation into a verified, manifest-backed bundle. Use when the human asks to complete, close, or archive a change after successful output testing.
---

# Archive Change

Apply the shared contracts in `../../contracts/autonomy.md`, `../../contracts/collaboration.md`, `../../contracts/completion.md`, `../../contracts/context-loading.md`, `../../contracts/handoff.md`, `../../contracts/model-routing.md`, and `../../contracts/states.md`, plus the consuming project's adapter.

## Goal

Move every relevant standalone temporary change artifact into one verified archive bundle while preserving shared planning records, permanent source-of-truth documents, and human authorization.

## Eligibility

Require both:

- persisted state `READY FOR HUMAN TESTING`; and
- explicit human confirmation that output testing passed or the delivered change is accepted.

Do not infer acceptance from agent review, automated validation, merged code, inactivity, or implementation completion.

## Artifact classification

Archive a file when repository evidence, explicit human direction, or the adapter shows it is standalone and scoped only to this change. Candidates include:

- discovery or ideation briefs;
- the change specification and readiness bundle;
- dedicated PRDs, task plans, or decomposition artifacts;
- implementation progress or execution logs;
- agent-review artifacts;
- repository-persisted human testing evidence;
- change-only rollout, validation, recovery, or supporting documents.

Keep shared multi-change planning, progress, review, and archive indexes in place. Update only this change's entry when the schema and adapter make that safe.

Keep permanent source-of-truth documents in place, including product requirements, architecture, ADRs, schema, domain rules, runbooks, and shipped-feature documentation.

Exclude code, tests, build output, dependencies, unrelated notes, and external records that cannot be archived safely. Stop before moving anything when a required artifact is missing or a material candidate cannot be classified safely.

## Workflow

1. Read the change spec, adapter, context map, and relevant planning, progress, review, and testing evidence. Load only the source-of-truth files needed to establish state, ownership, and paths.
2. Verify eligibility.
3. Build an evidence-backed inventory. For each candidate record its role, current path, standalone or shared ownership, relationship evidence, and proposed disposition.
4. Apply the adapter's artifact classes and archive conventions. Otherwise use the classifications above.
5. Resolve the bundle path from the adapter or established repository conventions. If neither defines one, use `docs/archive/changes/<change-slug>/` when repository guardrails allow it.
6. Preflight the bundle path and every destination file. Stop on any collision unless project rules establish an explicit safe resolution for identical content.
7. Prepare only the directories needed and create `manifest.md` containing:
   - change identifier and title;
   - final state `ARCHIVED`;
   - archival date and explicit human acceptance evidence;
   - each candidate's role, original path, final or kept-in-place path, and disposition;
   - implementation, validation, review, and human-testing references;
   - excluded artifacts and unresolved external references.
8. Set the archived spec status to `ARCHIVED` and add its former path, bundle path, acceptance evidence, and manifest reference.
9. Persist all archive-bound artifacts and the manifest without overwrite.
10. Read and validate the complete bundle before removing any original.
11. Update authoritative shared planning, progress, and index entries that would otherwise show the change as active or point to moved paths. Change only this change's entry, then read it back.
12. Remove original standalone temporary artifacts only after every archive copy and required shared-reference update has been persisted and verified.
13. Read the final bundle, manifest, terminal state, and updated shared references back before reporting success.

If persistence or validation fails, leave all originals in place, withhold `ARCHIVED`, and report any partial destination. If available tools cannot complete the move safely, stop before removing originals and provide the smallest manual action.

## Stop conditions

Stop before moving artifacts when:

- eligibility evidence is absent;
- a required artifact is missing;
- ownership or disposition is materially ambiguous;
- the destination is outside the repository without explicit adapter authority;
- a destination collision exists;
- sensitive-data or retention rules prohibit the archive copy;
- safe persistence, reference updates, or verification cannot be completed.

The explicit archive request authorizes removal only of the verified standalone originals in step 12. Do not delete or overwrite any other artifact, or commit, push, publish, or mutate external systems, without separate authority.

## Handoff

Lead with the verified archive bundle and manifest. Include the previous and final states, moved artifact classes, shared or permanent documents kept in place, validation evidence, partial or excluded references, and any remaining action.

Do not reproduce the manifest, inventory, or full artifact contents in chat.

## Output

Use one outcome sentence followed by at most six short bullets covering:

- bundle and manifest paths;
- previous and final states;
- moved artifact classes;
- shared, permanent, excluded, or external artifacts when material;
- persistence and reference validation;
- remaining action or blocker.
