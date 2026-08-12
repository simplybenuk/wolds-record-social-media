# Discovery: Multi-brand campaign packs

- **Change slug:** `multi-brand-campaign-packs`
- **Prepared:** 2026-08-09
- **Depends on:** `wolds-record-campaign-review-slice` (specified, not yet built)
- **Recommended next step:** `bwh-spec` — after the pilot slice is delivered and its brand boundary observed in practice

## Outcome

Ben or Olivia can pick any of the three Wolds brands on the campaign form and receive posts that read and look like that brand — Wolds Canine Massage and Wolds Canine Therapy Academy each with their own audience, tone, prohibited claims, palette and logo — using the same campaign, generation, persistence, review and approval loop already proven for Wolds Record.

## Problem and opportunity

`VISION.md` describes a studio for three brands, but every artefact in the repository is Wolds Record. The palette is a hardcoded constant in the renderer, the only logo is the Record logo, the content pillars are Record product pillars, and the pilot slice deliberately enables one brand. Until a second and third brand exist, the "brand pack" abstraction is untested: it is a folder with one member, and the claim that a new brand is configuration rather than code is unverified.

This slice is the cheapest available test of that claim, and it is also the slice with the highest direct value to Olivia — Wolds Canine Massage is her clinic and the brand with the most frequent posting need.

Acceptance criterion 14 of the pilot spec makes this explicit: a second brand should be addable "without replacing campaign, attempt, post, renderer, or review-state concepts". This change is the proof.

## Actors

- **Olivia:** primary beneficiary. Creates Massage and Academy campaigns from a phone; is the authority on clinical language, prohibited claims, and what is safe to say about her services and courses.
- **Ben:** adds the packs, parameterises the renderer, and administers the installation.
- **Brand audiences:** local dog owners and veterinary contacts (Massage); dog owners and aspiring practitioners (Academy). Neither uses the studio.

## Known facts

- The pilot spec (`plans/specs/wolds-record-campaign-review-slice.md`) requires the pack at `brands/record/` to hold copy identity **and** asset IDs, plus available static template IDs, with no brand editor — pack changes are repository changes.
- The pilot spec names Massage and Academy generation as an explicit non-goal, so this is genuinely new scope, not deferred implementation.
- **Colour is not data.** The static palette is a JavaScript constant in `instagram.html:716-720` (`forest`/`sand`/`navy`/`amber`/`sage`), duplicated as swatches at `instagram.html:623-627`, and duplicated again for Reels in `video/brand/tokens.css:5-10`. A post record carries no colour field.
- The post schema already carries `brand` as a free-text label (`"brand": "wolds-record"` in `posts.example.json`), but nothing validates or branches on it. `scripts/check-posts.mjs` does not reference it.
- Typography is also fixed: `--wr-font-display: "EB Garamond"` and `--wr-font-sans: "Inter"` in `video/brand/tokens.css`, resolved by the renderer.
- `assets/logos/` contains exactly one file — `wolds-record-logo-transparent-small.png`. `assets/logos/wolds-record.png` is referenced as a placeholder in `instagram.html` but does not exist.
- `assets/photos/` holds twelve generic stock dog photos plus `wolds-record-dashboard.png`. The generic photos are plausibly reusable across all three brands; the dashboard screenshot is Record-only.
- The four static templates (`problem`, `feature`, `hook`, `cta`) are layout archetypes, not Record-specific content — they should carry over.
- The pilot's generated contract hardcodes six Record product pillars (`therapist-workflow`, `record-keeping`, `vet-communication`, `product-update`, `founder-journey`, `admin-pain`). These are meaningless for a massage clinic.
- Live brand sources: `woldscaninemassage.co.uk` (clinic) and `woldscanine.com` (Academy courses), both cited in `VISION.md`.
- `automation-plan.md` lists a different brand set (including SourList) and conflicts with `VISION.md`. The pilot spec already resolved this in favour of `VISION.md`.

## Confirmed decisions

1. **Per-brand palette and logo are in scope.** Colours and logo move out of renderer constants into the brand pack. Massage and Academy must not render in Record's green-and-gold.
2. **Brand packs are drafted from the live public sites**, then reviewed by a human before any pack is sent to the API. Nothing is derived from private or client material.

## Assumptions

- Fonts stay shared across all three brands in this slice. Per-brand typography is deferred; it multiplies renderer and font-loading work without changing whether the brand boundary holds. *(Record this as an explicit non-goal in the spec rather than leaving it implied.)*
- The four existing static templates work for all three brands. A clinic post and a product post are both "a headline over a photo with a logo"; if a template turns out to be Record-shaped, that is a template redesign change, not this one.
- Content pillars become per-brand configuration rather than one global enum — the generated contract must accept a brand-supplied pillar allow-list, not a fixed union.
- The generic stock dog photos are shared across brands; only `wolds-record-dashboard.png` is Record-scoped.
- Static images only. Reel token parameterisation (`video/brand/tokens.css`) follows the Reel campaign slice, so a Massage Reel is out of scope here even though the CSS is the same problem.
- Olivia reviews and corrects the Massage and Academy packs before live generation; site-derived drafts are a starting point, never authority.
- No existing `posts.json` records are re-branded or migrated.

## Scope

- Two new packs at `brands/massage/` and `brands/academy/`, structurally identical to `brands/record/`: purpose, audience, tone, preferred wording, confirmed service/course facts, content-pillar allow-list, calls to action, default hashtags, prohibited claims, site links, logo and photo asset IDs, available template IDs.
- **Brand-pack visual fields:** named palette roles and logo asset, versioned with the pack.
- **Renderer parameterisation:** replace the hardcoded palette constant in `instagram.html` with values supplied through the render input, so the existing CLI and the application's render service both pass a brand palette. The legacy CLI contract must keep working — an existing record with no palette falls back to the current Record values.
- Brand selection on the campaign form: three enabled brands instead of one fixed brand.
- Per-brand pillar allow-lists threaded through the generation contract, structured-output schema, and application-side validation.
- Brand-scoped asset allow-listing, so an Academy post cannot select the Record dashboard screenshot.
- Logo assets for Massage and Academy added under `assets/logos/`.
- Pack-review evidence: a human-approved record of the facts and prohibited claims for each new brand before live generation.
- Tests: pack loading and validation for all three brands, palette threading through the renderer, brand-scoped asset and pillar rejection, legacy-render regression proving Record output is byte-comparable or visually unchanged.

## Non-goals

- Per-brand fonts, typography scales, or image treatments.
- Reel generation for any brand, and Reel token parameterisation in `video/brand/tokens.css`.
- Template redesign, new templates, or a fourth brand.
- A brand administration UI or any runtime pack editing.
- Cross-brand campaigns — one campaign targets exactly one brand.
- Calendar, scheduling, publishing, Buffer, Cloudinary, or Meta work.
- Cross-brand views: a combined library or calendar filtered by brand belongs to the calendar slice.
- Migrating or re-branding existing `posts.json` records.
- Resolving the `automation-plan.md` brand-list conflict beyond what completion documentation requires.

## Success signals

- On a phone, Olivia selects Wolds Canine Massage, submits a brief, and receives posts whose copy, hashtags, calls to action and rendered visuals are recognisably the clinic — not Wolds Record with the words swapped.
- A generated Academy post cannot carry a Record pillar, the Record dashboard image, or a Record call to action; validation rejects each.
- Wolds Record campaigns are unchanged: same palette, same output, same passing tests, with no regression in the legacy `scripts/render-post.mjs` CLI.
- Adding the third pack required no change to the campaign, attempt, draft-post, review-state, or renderer-service concepts — only pack files, the palette input, and the pillar allow-list. **This is the acceptance test for the whole slice.**
- Each new pack has human-approved prohibited claims covering clinical and veterinary language for Massage and course-outcome/accreditation claims for the Academy.
- The full existing suite (`npm run check`, `npm test`, `npm run posts:check`) stays green.

## Risks and mitigations

- **Site-derived facts are fabrication risk.** A generated post claiming a service Olivia does not offer, a price, or a course accreditation is a real-world reputational problem. Mitigation: packs list *confirmed* facts only; anything unverified is omitted rather than hedged; human pack review is a gate before any live call; prohibited-claim lists are brand-specific and explicit.
- **Clinical claims are the sharpest version of that.** Massage is a therapy brand aimed at dog owners — "treats", "cures", "diagnoses", and veterinary-adjacent language must be prohibited at the pack level and validated, not left to the model.
- **Renderer parameterisation breaks Record output.** `instagram.html` is a large standalone file whose palette constant is referenced throughout the canvas drawing code. Mitigation: thread a palette object with the current values as defaults, and gate on a pixel or visual regression against a fixed existing record before anything else lands.
- **Palette duplication drifts.** The same five colours exist in three places (canvas constants, swatch markup, Reel tokens). Parameterising only one leaves the others silently stale. Mitigation: name one source per surface in the spec and state explicitly that Reel tokens are knowingly deferred.
- **Pillar enum churn.** Moving pillars from a fixed union to per-brand allow-lists touches the structured-output schema, which Structured Outputs requires to be strict. Mitigation: generate the schema per brand at request time from the pack, and validate the returned pillar against the pack again in application code.
- **The pilot slice may not have shipped as specified.** This discovery reads a spec, not working code. Mitigation: re-verify the brand-pack shape, contract, and renderer boundary against the delivered implementation at spec time; treat anything below as provisional if the pilot changed.
- **Scope drags toward a brand editor.** Three packs is the point at which hand-editing JSON starts to feel tedious. Mitigation: non-goal, stated above; revisit only if a real pack change becomes frequent.

## Dependencies

- **The pilot campaign-review slice must be delivered and human-accepted first.** This change parameterises its brand boundary; running them concurrently would mean specifying against a moving target.
- Human-supplied or human-approved: Massage and Academy logo files, brand colours, confirmed service/course facts, and prohibited-claim lists.
- Public site content from `woldscaninemassage.co.uk` and `woldscanine.com` for drafting.
- No new runtime dependencies expected — this is configuration, schema, and renderer-input work on top of the pilot stack.
- Live generation for the new brands needs `OPENAI_API_KEY` and an explicit human decision to incur spend, per the pilot's output-testing rule.

## Materially different options

### A. Both brands, palette parameterised — recommended

Adds Massage and Academy together, moving colour and logo into the pack. Doing both at once is what actually tests the abstraction: a single second brand can be accommodated by accident, and the third one is where a leaky boundary shows. Cost is the renderer parameterisation and two sets of brand-fact review. This is the option the confirmed decisions describe.

### B. Massage only, palette parameterised

Delivers Olivia's clinic sooner and halves the brand-fact review. But it proves less — the boundary is tested by the *second* brand, not the third — and the Academy pack would follow as near-identical repeat work. Worth choosing only if Olivia needs clinic posting urgently.

### C. Both brands, copy identity only

Cheapest by a wide margin: no renderer changes, no visual regression risk, packs are pure configuration. Rejected by the confirmed decision, and rightly — a massage clinic rendering in Wolds Record's software-product palette is content nobody would post, so the slice would produce no usable output despite technically passing.

### D. Full brand-pack redesign including fonts, templates, and Reel tokens

Treats brand identity as one complete problem: typography, layouts, and Reel compositions all parameterised at once. Coherent in principle, but it merges a configuration change with a template-design change and a Reel change, each with its own risk profile, and it blocks Olivia's first Massage campaign behind all of them. The pieces should land as separate slices.

## Material decisions still needed at spec time

1. **Palette shape:** semantic roles (`paper`, `ink`, `accent`, `deep`) or literal named colours (`forest`, `sand`, …)? Recommendation: semantic roles — the Reel tokens already model it that way (`video/brand/tokens.css`), and it survives a brand whose accent is not gold.
2. **Legacy fallback:** does an existing `posts.json` record with no palette fall back to Record colours implicitly, or must the CLI resolve a pack from the record's `brand` field? Recommendation: resolve from `brand`, defaulting to `record`, so the legacy path and the application share one resolution rule.
3. **Whether `brand` becomes a validated enum in `check-posts.mjs`.** Small, and it closes the gap where the field is a label nothing enforces — but it touches live-data validation, so it is a deliberate decision rather than a drive-by.
4. **Academy vs. Massage pillar overlap** — both are canine-therapy education to a degree. Decide whether pillars are fully independent per pack or share a common subset.
5. **How much site-derived content is enough** to draft a defensible pack, and what the human review artefact looks like (a section in the spec, or a separate reviewed file per brand).
