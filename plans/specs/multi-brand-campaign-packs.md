# Specification: Multi-brand campaign packs

- **Status:** READY FOR HUMAN TESTING
- **Change slug:** `multi-brand-campaign-packs`
- **Discovery:** `plans/discovery/multi-brand-campaign-packs.md`
- **Work type:** Configuration and boundary change; extends an existing application slice with per-brand copy and visual identity
- **Prepared:** 2026-08-09

## 0. Baseline and re-verification record

`wolds-record-campaign-review-slice` has been **delivered** on `feature/wolds-record-campaign-review-slice` (PR #2, awaiting human output testing) and merged into this change's branch. This specification was originally drafted against that slice's *specification*; it has since been re-verified against the shipped code on 2026-08-09 and corrected below.

**Precondition completed:** PR #2 is merged and its human output-testing gate was
completed before this implementation continued, as confirmed by the project owner.

### Findings from re-verification

Five assumptions in the original draft were wrong. Each is now corrected in the requirements:

1. **The pack already has a `visualStyle` object** — carrying `palette`, `headlineFont`, `bodyFont`, `imageOpacity`, `safeMode`, and `aspectRatio` (`brands/record/brand.json`). It is validated by `brandPackSchema` (`src/features/campaigns/schemas.ts:126-138`) and **consumed by nothing**. This change is therefore mostly *wiring an existing slot*, not adding one.
2. **The palette ships with literal colour names** (`forest`, `sand`, `navy`, `amber`, `sage`), not semantic roles. R2 renames them.
3. **Pillars are inverted from what this spec assumed.** `brandPackSchema` currently *requires every pack to allow every global pillar* (`src/features/campaigns/schemas.ts:153-158`), with `CONTENT_PILLARS` a module constant in `src/features/campaigns/types.ts:9`. R5 reverses this.
4. **The legacy adapter hardcodes brand identity**: `kicker: "Wolds Record"`, `imageOpacity: 18`, `safeMode: "airy"`, `aspectRatio: "square"` (`src/lib/rendering/legacy-post-adapter.ts`). Note that the hardcoded opacity of 18 already **disagrees with the pack's `visualStyle.imageOpacity` of 17** — a live inconsistency this change resolves in the pack's favour.
5. **The `brand_id` CHECK constraint is in SQL**, on both `campaigns` and `draft_posts` (`drizzle/0000_campaign_review.sql:6,57`; `src/db/schema.ts:36,122`). A migration is required, not optional.

Two scope decisions follow from finding 1 and are recorded in §4: fonts are now **in** scope, and the palette keys are renamed.

## 1. Objective and scope

Add Wolds Canine Massage and Wolds Canine Therapy Academy as fully usable brands in the campaign studio. Each gets its own copy identity (audience, tone, pillars, calls to action, hashtags, prohibited claims, confirmed facts) **and** its own visual identity (palette, fonts, and logo), reusing the campaign, generation, persistence, review, and approval loop unchanged.

The change is complete when Olivia can select any of three brands, generate a campaign, and receive posts that read and look like that brand — and when adding the third pack required no change to the campaign, attempt, draft-post, review-state, or renderer-service concepts.

This slice publishes nothing. It inherits the pilot's prohibition on Cloudinary, Buffer, and Meta calls in application code.

## 2. Problem and desired outcome

`VISION.md` describes a studio for three brands. Every artefact in the repository is Wolds Record: the palette is a hardcoded constant, the only logo is the Record logo, and the content pillars are Record product pillars. The pilot slice deliberately enables one brand, so the "brand pack" abstraction has one member and is untested.

Acceptance criterion 14 of the pilot spec asserts that a second brand should be addable "without replacing campaign, attempt, post, renderer, or review-state concepts". This change is the proof of that assertion, and it is also the slice with the most direct value to Olivia — Wolds Canine Massage is her clinic and the brand with the most frequent posting need.

The desired outcome is that brand identity becomes data the packs own, rather than assumptions distributed across the renderer, the schema, and the prompt.

## 3. Actors

- **Olivia:** primary beneficiary. Creates Massage and Academy campaigns from a phone. Sole authority on clinical language, service descriptions, course facts, and prohibited claims for both new brands.
- **Ben:** adds the packs, parameterises the renderer, administers the installation.
- **Brand audiences:** local dog owners and veterinary contacts (Massage); dog owners and aspiring practitioners (Academy). Neither accesses the application.

No roles, accounts, or permissions exist in this slice. Brand selection is not an authorisation boundary — both users may use all three brands.

## 4. Confirmed decisions

1. Both new brands land together. A single second brand can be accommodated by accident; the third is where a leaky boundary shows.
2. Per-brand palette, fonts, and logo are in scope. The pack already declares all three in `visualStyle`; this change makes the renderer honour them.
3. **Revised 2026-08-09 after re-verification.** Fonts were originally deferred on the assumption the pack had no font slot. It does, validated and ignored. Threading fonts alongside palette is marginal extra work and avoids leaving a validated field permanently inert. The rest of `visualStyle` — `imageOpacity`, `safeMode`, `aspectRatio` — is threaded at the same time, since the adapter's hardcoded values already contradict the pack.
4. Brand packs are drafted from the live public sites (`woldscaninemassage.co.uk`, `woldscanine.com`), then human-reviewed before any pack is sent to the API.
5. Content pillars become per-brand configuration. The generated contract must accept a brand-supplied pillar allow-list rather than a fixed union.
6. One campaign targets exactly one brand. Cross-brand campaigns are out of scope.
7. Palette is expressed as semantic roles, not literal colour names. This renames the delivered pack's keys (see R2), accepted because `forest` and `sand` are meaningless for a brand that is not green-and-cream, and because `video/brand/tokens.css` already uses role names.
8. Existing `posts.json` records are neither migrated nor re-branded.
9. Static images only. Reel token parameterisation is deferred with the Reel slice.

## 5. Non-goals

- Per-brand type scales, spacing, or image treatments. Font *family* is in scope (R2/R3); the size, weight, and aspect-ratio scaling logic in `draw()` is not.
- Reel generation for any brand; parameterising `video/brand/tokens.css`.
- Template redesign, new templates, or any fourth brand.
- A brand administration UI, or any runtime editing of packs.
- Cross-brand campaigns, or cross-brand views (combined library, calendar filtered by brand).
- Migrating, re-branding, or re-rendering existing `posts.json` records.
- Calendar, scheduling, publishing, Buffer, Cloudinary, or Meta work.
- Per-brand OpenAI models, prompts-as-data, or prompt tuning beyond what the pack supplies.
- Resolving the `automation-plan.md` brand-list conflict beyond the completion documentation update in §11.

## 6. User journey

### 6.1 Create a campaign for a new brand

1. Open `/campaigns/new`.
2. See three enabled brands. Selection is required; there is no default that could silently produce Record content.
3. Enter brief, post count, and date range exactly as in the pilot.
4. Submit. The campaign record stores the chosen brand ID before generation, as the pilot already requires.
5. Generation uses that brand's pack: its audience, tone, pillars, prohibited claims, hashtags, calls to action, and asset allow-list.

### 6.2 Review

1. The campaign page shows the brand name and identity.
2. Rendered previews use the brand's palette, fonts, and logo.
3. Edit, regenerate, approve, and reject behave exactly as the pilot defines. Regeneration reuses the campaign's brand; the brand cannot be changed after creation.
4. A post cannot be edited into another brand's pillar or asset; validation rejects it with the same conflict handling as any other invalid edit.

## 7. Functional requirements

### R1. Three brand packs

`brands/massage/` and `brands/academy/` exist with the same structure as `brands/record/`, each containing the fields the pilot's R3 requires, plus the visual fields in R2.

- Pack IDs are `record`, `massage`, `academy` — stable, lowercase, and used as the persisted `brand_id`.
- All three packs load through one loader with one schema. A pack missing a required field is a startup or load-time failure with a named field, not a silent default.
- Each pack carries a version or content hash, already required by the pilot's R6 attempt records.
- There is no brand editor. Pack changes are repository changes.

### R2. Brand-owned visual identity

The pack's existing `visualStyle` object is the single source of a brand's visual identity, and every field in it must be honoured by the renderer.

**Palette keys are renamed to semantic roles**, replacing the delivered literal names:

| Delivered key | New role | Record value | Meaning |
| --- | --- | --- | --- |
| `sand` | `paper` | `#F4F1EC` | page ground |
| `navy` | `ink` | `#142836` | primary text |
| `sage` | `inkSoft` | `#666E6B` | secondary text |
| `amber` | `accent` | `#D6A859` | highlight, rules, emphasis |
| `forest` | `deep` | `#2F5933` | strong fills, emphasis text |

The Record values are unchanged — this is a rename, not a recolour, and §14 requires byte-identical Record output to prove it. The role names match `video/brand/tokens.css:12-17`, so the two surfaces stop disagreeing about vocabulary. `brandPackSchema` and the `BrandPack` type update with the pack; the pack's `version` field increments.

Also pack-owned and now consumed: `headlineFont`, `bodyFont`, `imageOpacity`, `safeMode`, `aspectRatio`, the logo asset, and the photo asset allow-list.

**The pack's `imageOpacity` is authoritative.** The delivered pack says 17 and the adapter hardcodes 18; this change resolves that in the pack's favour, which means Record's *application-rendered* output shifts by one opacity point. That is a deliberate, visible consequence — see the R3 note on what "unchanged" means for each render path.

Massage and Academy visual styles come from the human-reviewed packs (§9.1). Each palette must pass the contrast check in R8.

### R3. Renderer visual parameterisation

The static renderer accepts a visual style rather than owning one.

- Replace the module-level `const C` in `instagram.html` with a resolved active palette that `draw()` reads. All eleven current usages (`instagram.html:1245`, `1262`, `1267`, `1282`, `1289`, `1312` ×2, `1322`, `1338`, `1348`, `1362`) resolve through it.
- Fonts are resolved the same way. `instagram.html:1296` and `:1320` currently hardcode `Montserrat` and `Open Sans`; both take their family from the active style, keeping the existing `Arial, sans-serif` fallback chain. Font weights, sizes, and the size-by-aspect-ratio logic are unchanged — only the family is pack-supplied.
- `applyPost` sets the active style from `post.palette` and `post.fonts` when present.

**Two render paths, two different meanings of "unchanged":**

- The **legacy CLI path** (`scripts/render-post.mjs` against `posts.json`) must produce byte-identical output. Existing records carry no palette or font, so they take the Record fallback, and their `imageOpacity` comes from the record itself as it does today. This is the md5 gate in §14.
- The **application path** changes by one opacity point for Record (18 → the pack's 17), because R2 makes the pack authoritative. This is expected and must be stated in the task plan so it is not mistaken for a regression. If human output testing on PR #2 has already judged Record previews at opacity 18, confirm the shift is acceptable before landing it; if not, correct the pack to 18 rather than special-casing the adapter.
- **When `post.palette` is absent, the palette falls back to the current Record values.** This is what keeps every existing `posts.json` record rendering identically.
- `window.renderPostForExport(post)` needs no signature change: palette rides on the post record it already receives.
- The palette object is validated where it enters the renderer. An unknown role, a missing role, or a non-hex value falls back to the Record default for that role and records an issue rather than drawing `undefined`.
- The decorative swatch markup at `instagram.html:623-627` reflects the active palette or is removed. It must not display stale Record colours while a different brand renders.
- The editor's Reel preview path and `video/brand/tokens.css` are **not** changed. §12 requires a stated comment at both sites recording that Reel colour is knowingly still Record-only.

### R4. Brand resolution in the legacy CLI

`scripts/render-post.mjs` and the application render service must resolve visual style the same way.

- Style is injected by `src/lib/rendering/legacy-post-adapter.ts`, which already owns the fixed legacy fields. Its hardcoded `kicker: "Wolds Record"`, `imageOpacity: 18`, `safeMode: "airy"`, and `aspectRatio: "square"` all become pack-derived; `kicker` comes from the pack's display name or an explicit kicker field.
- The adapter resolves the pack from the record's `brand` field, defaulting to `record` when absent or unrecognised.
- An unrecognised `brand` value renders with the Record palette and reports a warning. It is not a hard failure: existing records use the free-text value `wolds-record`, which must keep working.
- The `wolds-record` legacy value maps to the `record` pack. Pack IDs and legacy `brand` values are related by an explicit alias table, not by string coincidence.
- The CLI's arguments, output paths, exit codes, and stdout contract are unchanged.

### R5. Per-brand pillars in the generated contract

The shipped code fixes six Record pillars as the module constant `CONTENT_PILLARS` (`src/features/campaigns/types.ts:9`) and — critically — `brandPackSchema` currently asserts the **opposite** of what this change needs: `src/features/campaigns/schemas.ts:153-158` rejects any pack that does not allow *every* global pillar. That assertion must be removed and inverted.

- Each pack declares its own pillar allow-list, and packs may legitimately share none. Record keeps its existing six values unchanged.
- `CONTENT_PILLARS` becomes the union of all packs' pillars for typing and storage, not a per-pack requirement. `draft_posts.pillar` must accept any pack's value.
- The structured-output schema is built per request from the selected pack, so `pillar` is a strict enum of that brand's values only. Structured Outputs requires strict schemas; the schema is generated, not hand-maintained per brand.
- Application-side validation re-checks the returned pillar against the pack, as the pilot already requires for templates and assets.
- Massage and Academy pillar sets come from the reviewed packs. They may overlap in subject (both touch canine therapy education) but are independent lists; no shared base set is introduced.

### R6. Brand-scoped assets

- `photoAssetId` validates against the selected brand's allow-list, not a global one.
- `assets/photos/wolds-record-dashboard.png` is Record-only. An Academy or Massage post selecting it is rejected.
- The generic stock dog photographs are listed in all three packs.
- The logo is fixed per brand and not model-selectable, as in the pilot.
- Asset IDs continue to resolve only through the pack. The model still cannot supply a path or URL.

### R7. Brand-specific safety rules

Each pack's prohibited-claims list is brand-specific and enforced as the pilot enforces Record's.

- **Massage** must prohibit clinical and veterinary claims: diagnosing, treating, or curing conditions; claims of veterinary qualification; claims that massage substitutes for veterinary care; specific outcome or recovery-time promises; and any named client, dog, or case detail.
- **Academy** must prohibit unconfirmed accreditation, certification, awarding-body, or career-outcome claims; guaranteed employment or income; and any course price, date, or duration not present in the pack's confirmed facts.
- **All packs** retain the pilot's prohibition on fabricated testimonials, statistics, features, and availability claims.
- Confirmed facts are an allow-list. Anything unverified at pack-review time is omitted from the pack rather than hedged, so the model has nothing to embroider.
- The user brief remains untrusted content beneath developer-owned brand rules. A brief cannot license a prohibited claim.

### R8. Brand selection and identity in the UI

- The creation form presents three brands; selection is required and has no default.
- Brand is fixed at campaign creation and shown on the campaign page.
- Brand is not conveyed by colour alone — a name or label accompanies any colour treatment.
- Rendered previews reflect the brand palette.
- Every brand palette must meet WCAG AA contrast for normal body text at `ink` on `paper` and `inkSoft` on `paper`, verified at pack-review time and asserted in tests. A pack failing contrast is a blocker, not a warning: this is content Olivia will publish.
- Mobile behaviour, touch targets, and the 390×844 no-overflow requirement carry over unchanged from the pilot.

### R9. `posts.json` brand validation

`scripts/check-posts.mjs` validates `brand` against the known pack IDs and legacy aliases.

- An unrecognised value is a **warning**, not a blocking error. All twenty live records use `wolds-record`, which must continue to validate as ready.
- This is the smallest change that closes the gap where `brand` is a label nothing enforces. It touches live-data validation, so §14 requires evidence that `npm run posts:check` output is unchanged (0 ready / 0 blocked / 20 sent).

### R10. No new external surface

- No new external service, credential, endpoint, or runtime dependency.
- Brand packs contain no secrets. Site links are public URLs.
- The pilot's prohibition stands: no application code imports or invokes Cloudinary, Buffer, or Meta clients.
- Live generation for the new brands requires the pilot's explicit human output-testing decision to incur spend.

## 8. Proposed design

Requirements and boundaries above are authoritative; this section is illustrative and subject to §0 re-verification.

### 8.1 Pack layout

```text
brands/
├── record/     brand.json  prompt.md  (existing)
├── massage/    brand.json  prompt.md
└── academy/    brand.json  prompt.md
assets/logos/
├── wolds-record-logo-transparent-small.png   (existing)
├── wolds-canine-massage-logo.png             (new, human-supplied)
└── wolds-canine-academy-logo.png             (new, human-supplied)
```

One loader, one schema, three packs. The loader exposes a resolved pack by ID and a list of enabled brands for the form.

### 8.2 Palette threading

```text
brand pack (semantic roles)
  → legacy-post adapter  (resolves pack from brand ID; injects palette + logo)
      → renderPostForExport(post)
          → applyPost sets active palette (falls back to Record when absent)
              → draw() reads it at all 11 sites
```

The same adapter serves the application's render service and `scripts/render-post.mjs`, so there is one resolution rule rather than two that can drift.

### 8.3 Schema generation

The shared Zod schema becomes a function of the pack: pillar and template enums and the photo-asset allow-list are built from the selected pack at request time, then converted to strict JSON Schema for the Responses API. Everything else in the pilot's `GeneratedCampaign` contract is unchanged. Application-side domain validation re-checks pillar, template, and asset against the pack after parsing, exactly as the pilot requires.

### 8.4 Data model

No column changes. `campaigns.brand_id` and `draft_posts.brand_id` already exist. The `CHECK (brand_id = 'record')` constraint is confirmed present in SQL on **both** tables (`drizzle/0000_campaign_review.sql:6,57`, mirrored at `src/db/schema.ts:36,122`), so a migration **is** required to widen it to the three pack IDs.

SQLite cannot alter a CHECK constraint in place; the migration recreates each table and copies rows, or drops the constraint in favour of application-level validation. The task plan chooses, but must preserve existing campaign data and foreign keys either way, and §14 requires the migration to apply cleanly to both an empty database and one holding a Record campaign.

## 9. Brand-pack sourcing and review

### 9.1 Sourcing procedure

1. Draft each pack from the brand's public site, recording the source URL and retrieval date for every confirmed fact.
2. Extract only what the site states plainly: services or courses offered, audience, tone, existing calls to action, and links. Do not infer prices, outcomes, credentials, or availability.
3. Sample the site's own colours for the palette, then adjust for the contrast requirement in R8.
4. Mark every field that could not be confirmed as absent, not as a placeholder that might be published.

### 9.2 Review gate

Each pack is reviewed and approved by a human before it is sent to the API. This gate is separate from spec approval and from development completion. The review artefact is a section per brand in `plans/output-testing/multi-brand-campaign-packs.md` recording, for each pack: confirmed facts and their sources, prohibited claims, palette values with contrast results, and an explicit human approval line.

Site content is a drafting aid and is never authority. Olivia's correction supersedes anything the site says.

## 10. Security, privacy, and reliability

- No new trust boundary, credential, or external call. The application remains a loopback-bound local utility, not approved for public exposure.
- Brand packs are repository configuration reviewed like code. They are the mechanism by which prohibited-claim rules reach the model, so a pack change is a safety-relevant change.
- The largest risk in this change is reputational, not technical: a fabricated clinical or accreditation claim published under Olivia's clinic name. R7 and §9.2 are the controls; human approval before publishing remains mandatory and unchanged.
- Briefs must continue to exclude client names, contact details, and clinical records. The Massage brand makes this more tempting to violate, so the UI guidance stays visible on the form for all brands.
- Palette resolution failure degrades to Record colours and a recorded issue; it never renders undefined colours or blocks a campaign.
- Existing generation, attempt, transaction, recovery, and stale-write behaviour is inherited unchanged from the pilot.

## 11. Rollout and migration

Additive, with no data migration:

1. Add the two packs, logo assets, and pack schema/loader changes.
2. Parameterise the renderer with Record values as the fallback, and prove Record output is unchanged before anything else lands.
3. Widen the `brand_id` constraint if the pilot implemented it in SQL.
4. Enable three brands on the form.
5. Human pack review (§9.2).
6. One bounded live generation per new brand during output testing, after an explicit decision to incur spend.

Rollback is removing the two pack directories and reverting the form to a single brand; the palette fallback means the renderer keeps working either way. No existing content, generated media, or `posts.json` record changes at any point.

On completion, update `README.md` and `automation-plan.md`, and correct the adapter context map to list `VISION.md` as a direction source — an item the pilot spec raised (§19.3) and left for a documentation update.

## 12. Proposed task outline

A readiness outline, not an approved execution plan. Task states belong in `plans/tasks/multi-brand-campaign-packs.md` after human approval.

1. **Confirm the §0 baseline still holds** after PR #2's human output testing. Re-check the five findings; if output testing changed any of them, refine before proceeding.
2. **Palette and font parameterisation with Record unchanged.** Replace `const C`, thread the active palette and font families, add the absent-style fallback, handle the swatch markup, and comment the deferred Reel-token duplication at both sites. Gate on the md5 regression for the legacy CLI path before any other task starts.
3. **Pack schema rename and loader.** Rename the palette keys to semantic roles, update `brandPackSchema` and `BrandPack`, increment the pack version, remove the every-pillar assertion at `schemas.ts:153-158`, and add the pack-ID/legacy-alias table.
4. **Draft the two packs** from the live sites per §9.1, with sources recorded. Produce the review artefact; do not send any pack to the API yet.
5. **Per-brand schema generation.** Make pillar, template, and asset enums pack-derived; regenerate strict JSON Schema per request; re-check after parsing.
6. **Brand-scoped validation.** Asset allow-listing, pillar rejection, prohibited-claim rules, and edit-path validation.
7. **UI brand selection.** Three brands, required selection, brand shown on the campaign page, no colour-only status, palette-accurate previews.
8. **`check-posts.mjs` brand validation** as a warning, with unchanged `posts:check` output evidence.
9. **`brand_id` constraint migration** on both tables, preserving existing data and foreign keys.
10. **Full validation and regression** per §14.
11. **Documentation and handoff.** `README.md`, `automation-plan.md`, adapter context-map correction, and preparation for independent agent review.

## 13. Dependencies and affected areas

### Dependencies

- **`wolds-record-campaign-review-slice` delivered and accepted** (§0). Hard blocker.
- Human-supplied: Massage and Academy logo files.
- Human-approved: confirmed facts, prohibited claims, and palettes for both new brands (§9.2).
- Public site content from `woldscaninemassage.co.uk` and `woldscanine.com`.
- `OPENAI_API_KEY` and an explicit spend decision for live output testing only.

No new runtime dependencies. This is configuration, schema, and render-input work on top of the pilot stack.

### Expected affected areas

- `brands/massage/**`, `brands/academy/**`, `brands/record/**`
- `assets/logos/` (two new files)
- `instagram.html` — palette constant, `applyPost`, `draw()` usages, swatch markup
- The pilot's pack loader, generated-contract schema, domain validation, legacy-post adapter, and campaign form
- `scripts/check-posts.mjs`
- `drizzle/**` if the `brand_id` constraint is in SQL
- `README.md`, `automation-plan.md`, `adapters/wolds-record-social-media/context-map.md`
- tests

### Must remain behaviourally stable

- Every existing `posts.json` record renders byte-identically.
- `scripts/render-post.mjs` CLI arguments, outputs, and exit codes.
- Reel rendering, compositions, and `video/brand/tokens.css`.
- Cloudinary and Buffer external-write behaviour.
- All existing tests.

## 14. Validation plan

### Automated

- `npm run check` and `npm test` pass, including the pilot's suite plus new tests.
- `npm run posts:check` reports **0 ready / 0 blocked / 20 sent**, identical to today, with `git diff -- posts.json` empty.
- `npm run lint:compositions` passes (3 ok), proving the Reel path is untouched.
- **Record render regression:** an existing record renders to a PNG whose md5 matches the pre-change output. This is the single most important automated gate and must pass before any brand-specific work merges.
- Pack loading: all three packs load under the renamed palette schema; a pack missing a required field fails with that field named; an invalid hex value is rejected; a pack declaring only a subset of global pillars now loads (proving the `schemas.ts:153-158` assertion is gone).
- Style: absent palette or fonts fall back to Record; a partial palette falls back per role and records an issue; all eleven `draw()` colour sites and both font sites resolve through the active style.
- Migration: the widened `brand_id` constraint applies to an empty database and to one already holding a Record campaign, with foreign keys on and no row loss.
- Contrast: `ink` on `paper` and `inkSoft` on `paper` meet WCAG AA for each of the three packs.
- Schema generation: a Massage request's schema contains only Massage pillars; a Record pillar in a Massage response is rejected by post-parse validation.
- Asset scoping: `wolds-record-dashboard.png` is rejected for Massage and Academy and accepted for Record.
- Alias resolution: legacy `wolds-record` resolves to the `record` pack; an unknown brand warns and renders Record colours without failing.
- Fixture campaigns for all three brands produce schema-valid posts and real PNGs in their own palettes.
- `npm run build` succeeds with no client-bundle import of server-only modules.

### Browser verification

- At 390×844, create a fixture campaign for each of the three brands.
- Confirm previews render in the correct palette, fonts, and logo per brand.
- Confirm brand selection is required and cannot be changed after creation.
- Confirm brand identity is legible without relying on colour.
- Confirm no horizontal overflow and usable keyboard/focus behaviour.

### Human output testing

- Review and approve both new packs before any live call (§9.2).
- One bounded live campaign of 1–3 posts per new brand.
- Confirm Massage output reads as a clinic — not Wolds Record with the words swapped — and contains no clinical, veterinary, outcome, or named-client claim.
- Confirm Academy output contains no unconfirmed accreditation, price, date, or career-outcome claim.
- Confirm rendered visuals are ones Olivia would actually post.
- Confirm no Buffer, Cloudinary, or Meta activity occurred.

## 15. Acceptance criteria

1. `brands/massage/` and `brands/academy/` exist with the same structure as `brands/record/`, load through one schema, and fail loudly on a missing required field.
2. Each pack owns its palette (semantic roles) and logo; the Record pack reproduces today's five colours exactly.
3. All eleven palette usages and both font families in `draw()` resolve through the active style; no colour or font constant remains in the static drawing code.
3a. The adapter's hardcoded `kicker`, `imageOpacity`, `safeMode`, and `aspectRatio` are pack-derived, and the pack/adapter opacity disagreement (17 vs 18) is resolved in the pack's favour.
4. An existing `posts.json` record renders to a PNG matching its pre-change md5.
5. A record with no `palette`, and a record with an unrecognised `brand`, both render with Record colours; the CLI contract is unchanged.
6. `pillar`, `template`, and `photoAssetId` are validated against the selected brand's pack, both in the generated strict schema and after parsing; a pack may declare a pillar subset without failing schema validation.
7. `wolds-record-dashboard.png` cannot be selected by a Massage or Academy post.
8. Massage and Academy packs carry human-approved confirmed facts and prohibited claims covering R7, with sources recorded.
9. All three palettes meet WCAG AA for body text, asserted in tests.
10. The creation form requires an explicit brand choice; brand is fixed after creation and shown on the campaign page without relying on colour.
11. `check-posts.mjs` validates `brand` as a warning; `npm run posts:check` output and `posts.json` are unchanged.
12. **Adding the third pack required no change to the campaign, attempt, draft-post, review-state, or renderer-service concepts** — only pack files, the palette input, the pillar/asset allow-lists, and the brand selector. This is the acceptance test for the whole slice; a diff showing otherwise is a failure even if everything else passes.
13. No application code imports Cloudinary, Buffer, or Meta; no external write occurs outside the authorised live generations.
14. `npm run check`, `npm test`, `npm run posts:check`, `npm run lint:compositions`, `npm run build`, the Record render regression, three-brand fixture campaigns, and mobile browser verification all pass.

## 16. Stop conditions during development

Stop and return for refinement if:

- Re-verification (§0) finds the delivered pilot diverges materially from the structures this spec assumes.
- Record output cannot be preserved byte-identically through palette parameterisation.
- Structured Outputs cannot express per-request generated enums against the configured model.
- The public sites do not yield enough confirmed fact to build a defensible pack without inference, for either brand.
- A brand's site colours cannot meet the contrast requirement without a design decision Olivia has not made.
- Criterion 12 cannot be met — i.e. the third brand demands a change to a core concept. That finding is more valuable than the feature; report it rather than working around it.
- Any Reel, template-redesign, or publishing work becomes necessary to demonstrate the slice.

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Fabricated clinical or accreditation claim published under Olivia's brand | Confirmed-facts allow-list, brand-specific prohibited claims, human pack review before any live call, mandatory approval before publishing |
| Palette parameterisation regresses Record output | Record values as fallback; md5 render regression gated before any other task |
| Palette duplication drifts across three sites | One source per surface; Reel tokens explicitly deferred with a stated comment at both sites |
| Site-derived facts are stale or misread | Source URL and date recorded per fact; Olivia's correction supersedes the site |
| Generated per-brand schemas break strict Structured Outputs | Generate from the pack at request time; re-validate after parsing; covered by contract tests |
| Massage palette unreadable on a phone | WCAG AA contrast asserted in tests, blocking rather than advisory |
| Live `posts.json` disturbed by brand validation | Warning not error; unchanged `posts:check` output and empty `posts.json` diff required as evidence |
| Scope drags toward a brand editor | Explicit non-goal; three hand-edited packs is the tested premise |
| Specifying against unbuilt code | §0 precondition and mandatory re-verification before development |

## 18. Assumptions and open questions

### Assumptions

- The four static templates (`problem`, `feature`, `hook`, `cta`) work for all three brands; a template proving Record-shaped is a separate redesign change.
- The generic stock dog photographs are appropriate for all three brands; only the dashboard screenshot is Record-scoped.
- Massage and Academy each need one logo file; no variant set (dark, mono, stacked) is required for these templates.
- Pack-level prompt text (`prompt.md`) is sufficient to convey tone without per-brand code paths.
- One campaign per brand is the natural unit; no user need for mixed-brand campaigns has been observed.
- Olivia is available to review both packs before live output testing.

### Open questions

None blocks human approval. The following may be resolved within these requirements and recorded in the task plan:

- exact palette values for Massage and Academy, pending pack review;
- whether `prompt.md` per brand stays prose or gains light structure;
- whether the brand selector is a segmented control or a list on mobile;
- whether unknown-brand warnings surface in the UI or only in logs;
- whether the alias table lives with the pack loader or the legacy adapter.

## 19. Source-of-truth decisions and conflicts

### Direction authority

`VISION.md` remains authoritative for the three-brand product, confirmed for the pilot on 2026-08-04 and unchanged. It names exactly the three brands this change completes.

### Conflicts found

1. `automation-plan.md` lists a different brand set including SourList; `VISION.md` names Wolds Record, Wolds Canine Massage, and Wolds Canine Therapy Academy. This spec follows `VISION.md`, consistent with the pilot. §11 requires `automation-plan.md` be updated on completion, since this change makes the discrepancy user-visible rather than theoretical.
2. The adapter context map still names `README.md` as the vision source and does not list `VISION.md`. The pilot spec raised this (§19.3) and deferred it to a documentation update; §11 carries it.
3. Palette vocabulary conflicts across three surfaces: `instagram.html` and `brands/record/brand.json` use literal colour names (`forest`, `sand`, `navy`, `amber`, `sage`) while `video/brand/tokens.css` already uses semantic roles (`paper`, `ink`, `accent`, `deep`). R2 resolves this in favour of semantic roles for the pack and the static renderer. The Reel path keeps its own tokens for now, and R3 requires that deferral be stated in the code rather than left implicit.
5. The delivered pack's `visualStyle.imageOpacity` (17) contradicts the hardcoded value in `legacy-post-adapter.ts` (18). R2 resolves this in the pack's favour, which visibly changes Record's application-rendered output by one opacity point. Flagged rather than silently chosen, because PR #2's human output testing may have already judged Record previews at 18.
4. `instagram.html:543,597` reference `assets/logos/wolds-record.png` as a placeholder; the actual file is `wolds-record-logo-transparent-small.png`. Minor and pre-existing. Fix the placeholder text while touching that markup, or leave it — the task plan should decide, not the implementer mid-task.

No executable source conflicts with this change.

## 20. Readiness bundle

- **Development precondition:** Section 0
- **Requirements:** Sections 6–7
- **Proposed design:** Section 8
- **Pack sourcing and review gate:** Section 9
- **Security and reliability:** Section 10
- **Rollout:** Section 11
- **Task outline:** Section 12
- **Dependencies and affected areas:** Section 13
- **Validation:** Section 14
- **Acceptance criteria:** Section 15
- **Stop conditions:** Section 16
- **Risks:** Section 17
- **Assumptions and open questions:** Section 18
- **Source decisions and conflicts:** Section 19

The specification is complete but has not crossed the human-only approval gate, and is additionally blocked from development by Section 0.
