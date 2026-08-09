# Task plan: Multi-brand campaign packs

- **Change slug:** `multi-brand-campaign-packs`
- **Spec:** `plans/specs/multi-brand-campaign-packs.md`
- **Branch:** `feature/multi-brand-campaign-packs`
- **Started:** 2026-08-09

## Scope decision (2026-08-09)

The spec's §12 outline has eleven tasks. This branch delivers **tasks 1–3, 8 and 9 —
the brand boundary work** — as one mergeable PR. Tasks 4–7 are deferred, for reasons
recorded under "Deferred" below, not for convenience.

The delivered slice is the proof of spec acceptance criterion 12: brand identity is now
data a pack owns, and no campaign, attempt, draft-post, review-state or renderer-service
concept changed to make that true.

**Approval note.** The human approval gates in the spec (§0 PR #2 output testing, spec
approval) were explicitly waived for this branch by the repository owner on 2026-08-09.
The §9.2 **pack review gate was not waived** and is untouched: no brand pack containing
clinical or accreditation claims is added here.

## Tasks

| ID | Task | Acceptance criteria | Validation | Status |
| --- | --- | --- | --- | --- |
| T1 | Re-verify the §0 baseline against delivered code | Five findings re-checked | Read of shipped source | Done |
| T2 | Palette and font parameterisation, Record unchanged | 11 colour sites + 6 font sites resolve through the active style; no colour constant left in `draw()` | md5 regression, `npm test` | Done |
| T3 | Pack schema rename, loader, alias table | Semantic roles; every-pillar assertion removed; alias table explicit | `npm test`, typecheck | Done |
| T8 | `check-posts.mjs` brand validation as a warning | Unrecognised brand warns, never blocks | `npm run posts:check` unchanged | Done |
| T9 | `brand_id` constraint migration on both tables | Applies to empty and populated databases, no row loss, FKs intact | `npm test` migration cases | Done |
| T10 | Full validation and regression | §14 automated gates pass | See evidence | Done |
| T11 | Documentation and handoff | Task plan, log entry, PR | This file | Done |

## Deferred, with reasons

| Spec task | Why deferred |
| --- | --- |
| T4 Draft the two packs | Blocked on the §9.2 human pack-review gate. The packs carry clinical (Massage) and accreditation (Academy) prohibited-claim rules; the live sites yielded facts that must be confirmed by Olivia before they can back a pack. Notably `woldscanine.com` advertises "Accredited, science-led training" with **no awarding body named** — exactly the claim R7 requires the Academy pack to prohibit. Self-approving this is the one thing the spec's risk table calls the largest risk in the change. |
| T5 Per-brand schema generation | Depends on packs existing to generate from. |
| T6 Brand-scoped validation | Same. The boundary it validates against is delivered; the second/third allow-list is not. |
| T7 UI brand selection | `enabledBrandPacks()` derives the selector from packs on disk, so the form correctly offers one brand today and three when the packs land. No UI change is needed until then. |

Also outstanding, human-supplied: `assets/logos/wolds-canine-massage-logo.png` and
`assets/logos/wolds-canine-academy-logo.png`.

## Deviations from the spec

1. **`BRAND_IDS` is widened to three now, but only one brand is selectable.** Storage and
   the database constraint accept all three pack IDs so the packs are a pure drop-in;
   selectability is derived from packs present on disk rather than from this list. The
   spec did not distinguish the two, and conflating them would have made the form offer
   brands with no pack behind them.
2. **The Instagram handle is parameterised too.** `instagram.html` hardcoded
   `@woldsrecord` in `draw()`. The spec lists eleven colour sites and two font sites but
   not the handle; it is brand identity by the same argument and would have rendered
   Record's handle under a Massage post. Falls back to `@woldsrecord` when absent.
3. **The migration runner was generalised.** `createDatabase` applied only
   `0000_campaign_review` by name. It now walks `drizzle/meta/_journal.json` in order.
   Required by T9; the spec assumed a runner that could apply a second migration.
4. **Record's application-rendered opacity shifts 18 → 17**, as R2 requires. The legacy
   CLI path is unaffected and byte-identical. Flagged in the spec (§19 conflict 5) as
   something PR #2's output testing may have already judged at 18.
5. **`instagram.html:543,597` placeholder logo path left alone** (§19 conflict 4). It is
   pre-existing, cosmetic, and outside the markup this change touched.

## Validation evidence (2026-08-09, local, clean install)

`node_modules` was stale — the pilot's `next`, `react`, `typescript`, `drizzle-orm` and
`openai` were absent, so `npm run check` failed at `tsc: not found` before any change was
made. `npm install` was run first; all results below are post-install.

| Gate | Result |
| --- | --- |
| `npm run check` (syntax + `tsc --noEmit`) | pass |
| `npm test` | 47 pass, 0 fail |
| `npm run posts:check` | 0 ready / 0 blocked / 20 sent — unchanged |
| `git diff -- posts.json` | empty |
| `npm run lint:compositions` | 3 ok, 0 failed |
| `npm run build` | pass, no server-only import in the client bundle |
| **Record render md5 regression** | **PASS — byte-identical** across `problem`, `feature` and `hook` templates |

Render md5s, before and after, for `wolds-record-006-paper-notes`,
`-007-vet-reports`, `-008-canine-only`:
`17f2aa4ff9326356eaf434e67a9d6ba3`, `13022d6c96b2ecf14ea39fe6872eb1b8`,
`4b01a2637698a4da50a4a81cb7c5e4b2`.

**Not run:** `npm run verify:mobile`. No brand-selection UI changed in this slice, and the
mobile flow it exercises is PR #2's. It is required before the UI task (T7) lands.

## Stop conditions

None of the spec's §16 stop conditions were hit. Record output was preserved
byte-identically, and no core concept required a change.
