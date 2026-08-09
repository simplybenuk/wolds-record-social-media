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
| R1 | Independent agent review and fixes | All confirmed findings resolved or answered | `npm test` 50 pass | Done |

## Deferred, with reasons

| Spec task | Why deferred |
| --- | --- |
| T4 Draft the two packs | Blocked on the §9.2 human pack-review gate. The packs carry clinical (Massage) and accreditation (Academy) prohibited-claim rules; the live sites yielded facts that must be confirmed by Olivia before they can back a pack. Notably `woldscanine.com` advertises "Accredited, science-led training" with **no awarding body named** — exactly the claim R7 requires the Academy pack to prohibit. Self-approving this is the one thing the spec's risk table calls the largest risk in the change. |
| T5 Per-brand schema generation | Depends on packs existing to generate from. |
| T6 Brand-scoped validation | Same. The boundary it validates against is delivered; the second/third allow-list is not. |
| T7 UI brand selection | `enabledBrandPacks()` derives the selector from packs on disk, so the form correctly offers one brand today and three when the packs land. No UI change is needed until then. |
| R3 Reel palette (both surfaces) | Deferred by the spec itself (§5, §141) to the Reel slice. Now stated in the code at both sites — `instagram.html:715` and `video/brand/tokens.css`. See the carried-forward note below for what the deferral actually costs. |

### Carried forward to the Reel slice

The Reel deferral is wider than "tokens are not parameterised", and this is the
part no artifact recorded before now:

1. **The editor's Reel preview renders Record colours for any brand.** `activePalette`
   reaches the canvas `draw()` path and `paintSwatches()` only. The Reel preview DOM is
   styled by the page-level `--forest`/`--sand`/`--navy`/`--sage` variables at
   `instagram.html:9-13`, which nothing writes to. A Massage reel would therefore preview
   in Record colours **beside a Massage swatch strip** — the inconsistency is visible
   within one screen, so it will read as a bug rather than as a known limit.
2. **Review finding 6 did not close this.** Moving style resolution above the reel
   early-return fixed a state leak *between posts* (a reel no longer inherits the
   previously loaded post's palette and handle). It did not make the reel preview
   brand-aware, because the resolved palette never reaches that markup.
3. **`tokens.css` is linked statically** by all three compositions, so the render path
   needs either per-brand token files or an injected `:root` override — a design
   decision, not a substitution.
4. **`tokens.css` is not only colour.** It also carries motion, spacing, the type scale
   and the Instagram safe-area insets. The Reel slice must decide which of those are
   brand identity and which are house style; R2's semantic-role vocabulary covers the
   palette alone.

None of this is reachable today: `wolds-record` is the only pack on disk and the only
selectable brand. It becomes reachable the moment T4's packs land, so the Reel slice
should precede or accompany any non-Record reel content.

**Scope context, not a deferral of this change:** the studio app has no reel concept at
all — no match for `reel` anywhere under `src/`. Reels exist only in the legacy path
(`instagram.html` → `video/compositions/` → `scripts/render-video.mjs`), so campaigns are
static-image-only end to end. The Reel slice is therefore a feature slice, not a
parameterisation task, and `VISION.md` ("image or Reel content") is the authority on
whether campaign-generated reels are in scope at all.

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
| `npm test` | 50 pass, 0 fail |
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

## Agent review (2026-08-09)

An independent agent review of commit `d8ac9cb` confirmed the md5 regression, the
palette reset behaviour, and the completeness of the `0001` table recreation by
re-running them. It raised seven findings; all are resolved in the follow-up commit.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | **High.** The FK-disabling migration path ran without a transaction, so an interruption could drop `campaigns` and leave an orphan `campaigns_new`, permanently bricking startup. The justifying comment was wrong: SQLite's procedure is *pragma outside, DDL inside* a transaction. | `src/db/index.ts` now hoists only whole-statement pragmas, wraps the DDL in `BEGIN IMMEDIATE`/`ROLLBACK`, and restores `foreign_keys = ON` in a `finally`. New test asserts an interrupted swap leaves the original rows and journal intact. |
| 2 | **Medium.** `PRAGMA foreign_key_check` in the SQL was inert — it reports violations as rows, never as an error, and `exec` discards rows — so the migration could commit a corrupted reference graph. | Removed from the SQL; the runner reads the pragma back and rolls back on any violation. |
| 3 | The new pillar loop in `superRefine` was unreachable behind the field's `z.enum`. | Removed; replaced with a comment recording where the constraint actually lives, so the deferred R5 work does not mistake it for a safety net. |
| 4 | `brandPackById("toString")` returned a function as a `BrandPack` via the prototype chain. | `Object.hasOwn` guards on both the pack map and the alias table, with a test. |
| 5 | R4's per-post brand resolution was not wired: `campaign-renderer.ts` always used the Record pack, so a `massage` draft post would silently render as Record. | Now resolves via `resolveBrand(post.brandId)`, and the renderer's asset allow-list covers every enabled pack. |
| 6 | The reel early-return in `applyPost` skipped the style block, leaving the previous post's palette and handle active. | Style resolution moved above the reel branch. |
| 7 | `check-posts.mjs` misreported a non-string `brand` as "empty". | Message now names the actual type. |

Finding 5 was a genuine scope gap rather than a deferred item — R4 belonged in this
slice and the task table above did not account for it. It is now delivered.

**Coverage added** for the two defects no test caught (1 and 2), plus the reviewer's
note that the migration case exercised a lone `campaigns` row: there is now a test
inserting `campaigns` + `generation_attempts` + `draft_posts` and asserting both
foreign key chains, row survival and `UNIQUE (campaign_id, ordinal)` after the swap.
