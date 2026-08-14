# Specification: Instagram engagement creative system

- **Status:** APPROVED FOR DEVELOPMENT
- **Change slug:** `instagram-engagement-creative-system`
- **Discovery:** `plans/discovery/instagram-engagement-creative-system.md`
- **Work type:** product, generation-contract, persistence, rendering and mobile-review change
- **Prepared:** 2026-08-12
- **Approved:** 2026-08-12 by the project owner

## 1. Objective

Replace the campaign studio's single repeated square-poster treatment with an Instagram-first static creative system. Ben and Olivia must be able to request, generate and review either a portrait image or a coherent carousel for any enabled brand. Each post must have an explicit engagement intent, use a structure suited to that intent, and remain one durable approval unit.

This change deliberately stops before Reels and publication. It must improve the creative choices the studio offers without claiming that generated content will receive a particular level of engagement.

## 2. Problem and evidence

Human testing found that the overall design needs improvement. The latest generated Record and Massage samples are legible and brand-consistent, but repeat the same large-heading/body/faded-photo/footer composition. Photography is reduced to a pale watermark, supporting copy is generic, and calls to action mostly ask for a commercial action rather than giving a cold audience a reason to save, send, comment or follow.

The application reflects that limitation in its model:

- `draft_posts.format` is constrained to `image`;
- a post has one headline, body, footer, photo, alt text and image path;
- brand packs require `aspectRatio: "square"` and `safeMode: "airy"`;
- the generated contract has no engagement intent, content structure or slide concept;
- the review page can preview only one image.

Instagram supports portrait feed images and ordered multi-image posts. A 4:5 canvas uses more of a phone feed than 1:1, while a carousel lets useful material unfold across purpose-specific slides. Reels have a separate 9:16, audio, timing, cover and safe-zone problem and are not part of this change.

## 3. Actors

- **Olivia:** creates Massage and Academy campaigns, judges clinical/course language and visual suitability, and approves complete posts from a phone.
- **Ben:** creates Record campaigns and administers the local application.
- **Audience members:** practitioners, dog owners, veterinary contacts and prospective learners who may save, send, comment, follow or enquire after seeing a post.
- **Future publishing adapter:** will consume one approved post containing either one image or an ordered set of images. It is not implemented here.

There is no new user, role, authentication or tenancy concept.

## 4. Goals

1. Generate new static campaign creative at 1080×1350 (4:5).
2. Support a single portrait image and a 3–7-slide carousel as first-class campaign formats.
3. Make every post declare one intended engagement action and generate an appropriate hook, structure and CTA.
4. Create meaningful visual variety across a campaign without weakening brand or asset controls.
5. Let an operator inspect and edit every slide on a 390×844 viewport, then approve or reject the post as one unit.
6. Preserve durable generation attempts, optimistic edits, safe errors and the last complete rendered preview set.
7. Keep historical square campaigns readable without automatically re-rendering them.

## 5. Non-goals

- Reels, video, animation, audio, timing, covers or multi-brand Reel token parameterisation.
- Stories, live formats, mixed photo/video carousels or arbitrary canvas sizes.
- Buffer, Cloudinary, Meta, scheduling, upload or publication.
- Instagram Insights ingestion, analytics dashboards or automated performance optimisation.
- A claim or acceptance target for increased reach or engagement.
- AI-generated or externally sourced photography.
- A free-form canvas/design editor or runtime brand-pack editor.
- A redesign of unrelated application navigation or administration surfaces.
- Re-rendering or visually changing existing historical campaign previews.

## 6. Confirmed decisions

1. This slice delivers portrait images and carousels; Reels follow as a separate slice.
2. All new output uses 4:5 at 1080×1350. Existing 1:1 output remains readable as historical content.
3. A carousel contains 3–7 ordered image slides and one shared Instagram caption, Facebook caption, hashtag set, proposed date and review decision.
4. Creation offers `Automatic mix`, `Portrait images`, and `Carousels`. The request is persisted. Generation resolves a concrete format for each post; regeneration cannot change it.
5. Engagement intent is one of `save`, `send`, `comment`, `follow`, or `enquire`.
6. Content structure is explicit and validated rather than inferred from arbitrary prose.
7. Single-image and carousel rendering share one slide-oriented domain contract; an image has exactly one slide.
8. Editing one slide re-renders the complete post preview set. Partial carousel replacement is not exposed as ready output.
9. The whole post is approved or rejected. There is no per-slide review status.
10. The application remains publication-isolated and performs no external media or social action.

## 7. User journeys

### 7.1 Create an Instagram-first campaign

1. Open `/campaigns/new` on a phone.
2. Select a brand, enter the brief, count and date range as today.
3. Select `Automatic mix`, `Portrait images`, or `Carousels`.
4. Submit. The campaign and pending attempt are persisted before generation begins.
5. Structured generation returns the exact post count. Each post has a concrete format, engagement intent, content structure, channel copy and valid visual slides.
6. All visual slides render before the post becomes preview-ready.

### 7.2 Review and edit

1. The campaign page identifies each post's format, engagement intent and structure.
2. A portrait image appears at its real 4:5 ratio. A carousel presents every ordered slide with position, accessible navigation and a visible `n of total` indicator.
3. The operator can read channel copy and alt text for the publication and each slide.
4. `Edit post` exposes post-level fields once and slide-level fields in order.
5. Saving a valid edit increments the post version and re-renders the complete preview set.
6. Until the replacement is complete, the last complete set remains visible with an out-of-date warning.
7. Approve or reject applies to the whole publication.

### 7.3 Regenerate

1. Regeneration retains campaign, post ID, brand, proposed date, concrete format, slide count and generation lineage.
2. It may replace the engagement intent, structure, copy and slide contents within the selected brand rules.
3. The replacement becomes current only after validation, persistence and a complete render succeed. A render failure retains the regenerated structured content and the previous complete previews, matching the existing durability rule.

## 8. Functional requirements

### R1. Campaign format preference

Add a required campaign-level `formatPreference` with values:

- `auto` — the generator resolves each post to `image` or `carousel` based on brief, objective and content value;
- `image` — every generated post is a one-slide portrait image;
- `carousel` — every generated post is a 3–7-slide carousel.

The form must label the choices in plain language and explain that Reels are not yet available. Existing campaign rows migrate to `image`. The selected preference is immutable after campaign creation and included in every attempt input snapshot.

Fixture mode is deterministic. For `auto`, a fixture campaign of two or more posts must contain both supported formats so the complete flow stays testable; a one-post fixture may resolve to either format deterministically.

### R2. Post engagement contract

Every new or regenerated post stores:

- `format`: `image` or `carousel`;
- `engagementIntent`: `save`, `send`, `comment`, `follow`, or `enquire`;
- `contentStructure`: `checklist`, `myth-reality`, `signs`, `mistakes`, `workflow`, `point-of-view`, or `question`;
- one specific CTA consistent with the intent.

The generator must favour genuine audience value and prohibit fabricated urgency, misleading engagement bait and claims unsupported by the selected brand pack. A CTA may invite an action but must not condition access, imply false consensus, or ask for indiscriminate tagging.

Intent/structure compatibility is validated in application code. At minimum:

- `save` requires reusable reference value such as checklist, signs, mistakes or workflow;
- `send` requires a clearly identifiable recipient or shared situation, without disclosing private information;
- `comment` requires a specific, safe question answerable without personal or clinical disclosure;
- `follow` requires a concrete expectation about future brand-relevant content;
- `enquire` requires a confirmed service/product/course fact and a pack-approved contact CTA.

### R3. Slide contract

Every post contains an ordered `slides` array:

- `image`: exactly one slide;
- `carousel`: 3–7 slides;
- ordinals are contiguous from zero and unique within the post;
- each slide has `role`, `visualTemplate`, `headline`, optional `body`, optional `emphasis`, optional `footer`, optional allowed `photoAssetId`, and non-blank `altText`;
- paths and URLs never come from the model;
- slide text follows bounded lengths enforced by shared Zod and server validation.

Slide roles are validated by format:

- image: `standalone`;
- carousel first slide: `cover`;
- carousel intermediate slides: `content`;
- carousel final slide: `action`.

The cover states a clear audience-relevant promise or tension. Intermediate slides each have one job and build the promised value. The final slide completes the idea and presents the engagement-intent CTA. Carousel meaning must not depend on caption-only information.

Post-level channel captions, hashtags and proposed date remain outside the slides. Post alt text is replaced by slide-specific alt text; the review UI presents all of it in order.

### R4. Visual system

New slide rendering uses 1080×1350 and introduces purpose-specific portrait templates rather than vertically stretching the square designs:

- `bold-hook` — dominant short hook with controlled brand decoration;
- `photo-led` — an allowed photograph is the primary visual, with readable overlay or adjacent copy;
- `useful-point` — one numbered, checklist or explanatory point;
- `contrast` — myth/reality, before/after-workflow or paired comparison;
- `human-prompt` — a question, point of view or invitation to respond;
- `action` — a restrained final takeaway and CTA.

Templates share brand palette, fonts, logo and asset allow-list but may vary hierarchy, crop, alignment, photo scale and colour-block treatment. The default photo treatment must not reduce every photograph to a low-opacity watermark. Text contrast remains WCAG AA. Logos must be present but subordinate to the hook or subject.

Brand pack `visualStyle` evolves from a square-only declaration to an explicit feed style capable of 4:5 portrait output and template-level photo treatments. Pack schema validation must reject incomplete styles. The same template vocabulary is available to all three packs in this slice; brand-specific allow-lists may be introduced later.

The legacy `posts.json` square renderer must remain behaviourally compatible and must not silently adopt the new portrait defaults.

### R5. Persistence and migration

Use an additive slide table as the canonical visual source for campaign posts after migration. It must include:

- opaque slide ID and parent post ID;
- ordinal and role;
- editable visual fields and allowed asset ID;
- render status, current image path, last safe render error and preview-out-of-date state;
- slide version/timestamps sufficient for stale-write protection.

Add post-level format, engagement-intent, content-structure and CTA fields. Add campaign-level format preference.

Migration requirements:

1. Existing campaigns receive `formatPreference = image`.
2. Each existing draft post remains `format = image` and receives one `standalone` slide populated from its current visual fields and render state.
3. Existing image files are referenced, not regenerated or modified.
4. Existing post rows and attempt lineage remain addressable by their current IDs.
5. Legacy visual columns may remain temporarily for rollback compatibility but become read-only after migration; no dual-write source of truth is allowed.
6. Foreign keys, unique `(post_id, ordinal)` and format/count CHECK constraints enforce structural integrity.

Repository reads and actions must assemble the post with its ordered slides transactionally. A failed migration must roll back without leaving partially migrated posts.

### R6. Structured generation and validation

The Responses API continues using strict Structured Outputs with `store: false` and no tools. The request includes the persisted format preference, brand pack, brief, dates and exact count.

Validation must enforce:

- exact requested post count and valid proposed dates;
- selected brand pillars, templates, facts, claims and photo allow-list;
- resolved format permitted by the campaign preference;
- exact slide counts, order, roles and bounded copy;
- engagement-intent/structure/CTA compatibility;
- no duplicate post concepts within a campaign and no duplicate slides that merely restate the cover;
- one coherent topic and audience per post.

Invalid output fails safely and incurs no partial campaign post insertion. Attempt snapshots, structured results, model/usage metadata, hashes, retry relationships and safe errors retain the existing semantics.

### R7. Rendering and atomicity

Extend the typed campaign renderer to accept one ordered post render request and return one ordered result set. Rendering remains application-wide sequential unless measured evidence justifies a different concurrency limit.

- Render every slide into a post-scoped temporary directory.
- Validate all expected PNGs before exposing the result.
- Replace the complete current preview set with one filesystem rename/commit boundary where supported; otherwise use an equivalent manifest-backed swap that readers cannot observe partially.
- Update database render state only after the complete set is durable.
- On timeout, browser failure, invalid asset or write failure, keep the last complete set and expose one safe post-level summary plus relevant slide detail.
- Stale completion checks include post version and the complete slide-version set.
- Cleanup must target only validated post-scoped temporary paths.

The renderer session reuse and timeout protections from the current image slice remain. Carousel rendering must not start one browser per slide.

### R8. Mobile review experience

At 390×844:

- no horizontal page overflow;
- the preview preserves 4:5 ratio;
- carousel navigation is keyboard- and touch-operable with at least 44×44 controls;
- current slide and total count are announced and visible;
- all slides can be inspected without entering edit mode;
- image and carousel formats, engagement intent and content structure use text labels, not colour alone;
- captions and slide alt text remain readable;
- editing exposes ordered slide sections and does not lose unsaved fields due solely to moving the preview;
- approval controls remain post-level and clearly separated from slide navigation.

Regeneration, edit, approve/reject, reload, interrupted attempts and action-local error behaviour carry over from the existing campaign slice.

### R9. Brand and safety boundaries

- Every slide resolves its logo and optional photo through the selected immutable campaign brand pack.
- A slide cannot reference another brand's asset.
- All copy, including cover hooks, questions and CTAs, remains subject to confirmed facts, prohibited claims and fabrication rules.
- Massage prompts must not solicit or expose personal dog/clinical details in comments.
- Academy prompts must not imply accreditation, qualifications, employment or career outcomes.
- Record prompts must not invent product availability or features.
- Photo-rights notices remain visible to the operator; this change grants no new publication rights.

### R10. Publication isolation

No application route, action, component, renderer or generator added by this change may invoke Buffer, Cloudinary, Meta or another upload/publication service. No new external credential is introduced. Approval remains a local review state only.

## 9. Proposed design

### 9.1 Domain shape

```text
campaign
├── formatPreference: auto | image | carousel
└── draft post (one publication/review unit)
    ├── format: image | carousel
    ├── engagementIntent
    ├── contentStructure
    ├── engagementCta
    ├── channel captions / hashtags / date / review state
    └── ordered slides
        ├── role and template
        ├── bounded visual copy
        ├── allowed photo ID and alt text
        └── render state and image path
```

The post is the consistency and approval boundary. Slides are ordered visual children, not independent social posts.

### 9.2 Storage

Add a migration containing campaign/post columns and `draft_post_slides`. Backfill current post visuals into one slide before application code switches reads to the new relation. Keep old columns only as rollback evidence during this change; new actions read and write slides exclusively.

### 9.3 Rendering

Introduce a portrait slide adapter rather than changing the semantics of legacy square records. The existing browser-backed renderer may continue to use `instagram.html` if the canvas/editor surface can host a clean format dispatch; otherwise move shared drawing primitives into a module consumed by both paths. The implementation task must choose based on the smallest design that preserves the legacy regression gate and avoids duplicating brand resolution.

### 9.4 Review

Server Components continue loading durable state. A small client carousel viewer may own only local slide navigation; mutations remain Server Actions with schema parsing, optimistic versions and safe redirects. Do not ship a heavy client-side editor for this bounded need.

## 10. Security and privacy

- The application remains private, local and single-tenant with no new auth model.
- Briefs remain untrusted input beneath developer-owned rules.
- The model receives only brand-approved facts and repository asset IDs, never filesystem paths or secrets.
- Generated filenames remain opaque and validated inside the generated-media root.
- Alt text and comment prompts must not infer sensitive health information from photographs.
- `.env`, credentials and live API keys must never appear in attempts, logs or artifacts.
- Live generation spend remains an explicit human testing action; implementation validation uses fixture mode unless authorised otherwise.

## 11. Rollout, compatibility and recovery

1. Apply the additive migration and verify backfilled historical posts before enabling new format creation.
2. Keep existing square preview files untouched and display them at their native ratio.
3. Enable both new formats for fixture mode across all three brands.
4. Run automated and browser gates, then independent agent review.
5. Human-test bounded fixture and live outputs before considering the change accepted.
6. If the new path fails after migration, disable new creation and read the backfilled one-slide relation; do not delete historical visual columns or previews in this slice.

No automatic publication or data-destructive rollback is permitted.

## 12. Affected areas

Expected areas include:

- `src/db/schema.ts` and a new Drizzle migration;
- campaign types, schemas, domain validation, repository and actions;
- fixture and OpenAI generation contracts/prompts;
- campaign creation and review pages/components/styles;
- campaign renderer, legacy adapter boundary and static renderer;
- `instagram.html` or extracted shared portrait drawing primitives;
- all three `brands/*/brand.json` packs and prompts;
- application, migration, rendering, browser and legacy-regression tests;
- `README.md`, `automation-plan.md` and output-testing documentation at delivery.

`posts.json`, generated media, Reel compositions, Buffer and Cloudinary scripts are not change targets except read-only regression validation.

## 13. Development-readiness task outline

1. **Domain and migration:** add preference, format, engagement fields and ordered slides; backfill historical posts and prove rollback-safe migration.
2. **Generation contract:** add strict format/intent/structure/slide output, pack prompts, domain validation and deterministic fixtures.
3. **Portrait renderer:** implement 1080×1350 purpose-specific templates and multi-slide session reuse while preserving legacy square behaviour.
4. **Atomic preview sets:** add post-scoped temporary rendering, complete-set replacement, stale completion protection and safe errors.
5. **Creation and review UI:** add format preference, labelled format/intent/structure, mobile carousel inspection and ordered slide editing.
6. **Application mutations:** update edit/regenerate/retry flows for transactional slide persistence and whole-post rendering.
7. **Focused verification:** migration, schema, generation, renderer atomicity, accessibility, mobile and legacy regression tests.
8. **Full validation and independent review:** run project gates, inspect representative outputs for all brands and hand off for independent agent review.
9. **Human output testing:** compare bounded old/new samples and record visual quality, usefulness, safety and publication isolation; do not infer acceptance.

No execution task artifact is created by this specification step.

## 14. Validation plan

### Focused automated validation

- Schema tests for format preferences, formats, intents, structures, slide roles/counts/order/copy limits and brand asset isolation.
- Migration test from a pre-change database fixture proving historical IDs, attempts, previews and decisions survive.
- Repository/action tests for transactional slide edits, optimistic conflicts and reload durability.
- Generator tests for exact counts, preference enforcement, coherent slide contracts, invalid-output rejection and retained usage/lineage metadata.
- Renderer tests for 1080×1350 output, template dispatch, ordered results, one-session reuse, timeout/error mapping, stale completion rejection and complete-set atomic replacement.
- Accessibility/component tests for carousel labels, controls and ordered alt text.
- Legacy square md5 regression for representative `posts.json` records.

### Browser and visual validation

- At 390×844, create an automatic fixture campaign, inspect every slide, edit an intermediate slide, reload, regenerate, approve and reject without overflow or inaccessible controls.
- Repeat bounded fixture creation for Record, Massage and Academy and cover both image and carousel.
- Visually inspect at least one example of each portrait template and verify that photographs are not uniformly washed out.
- Confirm a failed replacement render preserves the complete prior preview set.

### Project gates

```text
npm run check
npm test
npm run posts:check
npm run lint:compositions
npm run build
npm run verify:mobile
```

`posts.json` must remain byte-unchanged, `posts:check` must retain its current status totals, and Reel composition lint must pass unchanged.

### Human output gate

Ben or Olivia must judge fixture and one bounded live campaign per brand for:

- first-frame stopping power;
- useful, specific and non-generic content;
- coherent carousel progression;
- intent-consistent CTA;
- visual variety and brand fit;
- safe claims and appropriate privacy boundaries;
- clear improvement over the current square sample set.

Record the live model identifier, never the key. This is qualitative acceptance, not proof of an engagement uplift.

## 15. Acceptance criteria

1. A campaign persists `auto`, `image` or `carousel`, and fixture/live generation honours it.
2. Every new post persists a concrete supported format, valid engagement intent, valid content structure and specific CTA.
3. Every image contains exactly one standalone slide; every carousel contains 3–7 ordered slides with cover/content/action roles.
4. All new slides render to valid 1080×1350 PNGs using the selected brand's palette, fonts, logo and allowed assets.
5. Representative output demonstrates materially different photo-led, typographic, useful-point, contrast and action treatments rather than one repeated poster layout.
6. The mobile review page exposes every slide, position, format, intent, structure, captions and alt text without horizontal overflow.
7. Operators can edit any slide and regenerate a post; changes survive reload and retain optimistic concurrency protection.
8. A post becomes preview-ready only when its complete slide set is durable. Failure or stale completion never exposes a partial replacement.
9. Approve/reject remains one decision for the complete post and survives reload.
10. Existing campaigns, attempt lineage, decisions and square previews remain readable without re-rendering or file mutation.
11. Legacy static and Reel workflows remain behaviourally compatible; `posts.json` is unchanged.
12. No new application path uploads, schedules or publishes content.
13. Automated, build, browser and independent-review gates pass.
14. Human output testing records a verdict; only the human may advance the change beyond `READY FOR HUMAN TESTING`.

## 16. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Structured output becomes too large or costly | Cap posts at six and carousels at seven slides; retain token metadata; use bounded copy fields. |
| Carousel render takes too long | Reuse one browser session, render sequentially, measure duration and retain the last complete set on timeout. |
| Partial previews create false approval confidence | Whole-post temp set plus atomic/manifest-backed replacement; one preview-ready boundary. |
| Portrait work just stretches the old design | Purpose-specific template acceptance and representative visual inspection. |
| Engagement prompts become bait | Intent compatibility rules, brand prompt constraints and human content judgement. |
| Existing local testing data is damaged | Additive/backfilled migration, no automatic re-render, migration fixture and rollback-safe transaction. |
| Generic stock photos constrain quality | Stronger crop/treatment options, explicit human finding when an asset is unsuitable, no fabricated imagery. |
| Scope expands into video or publishing | Explicit non-goals and stop conditions below. |

## 17. Assumptions and open questions

### Assumptions adopted for this specification

- 4:5 is the initial portrait ratio; 3:4 support can be evaluated later without changing the post/slide model.
- Three to seven slides provide enough narrative range for these brands.
- Existing approved/rejected testing campaigns are worth preserving even though the application is local.
- The existing allowed photo library is sufficient to validate mechanics, but human testing may identify a separate asset-acquisition need.
- Engagement performance measurement is a later source-of-truth/analytics slice; this change optimises creative intent and reviewability only.

### Non-blocking open questions for human approval

1. Does the proposed `save`, `send`, `comment`, `follow`, `enquire` intent set match how Ben and Olivia want to use Instagram, or should `visit` be a distinct intent rather than part of `enquire`?
2. Is 3–7 the preferred carousel range, or should human operators be able to request an exact slide count within that range?
3. Should the eventual Reel slice follow immediately after this change, or should approved-post-to-Buffer integration take priority?

These questions can refine the specification but do not block the proposed architecture. Development must not begin until the human approves the spec or resolves them through refinement.

## 18. Stop conditions

Stop development and return for human direction if:

- Reels, audio/video, publishing, external upload or analytics ingestion becomes necessary for acceptance;
- migration cannot preserve historical campaign decisions and preview access without destructive conversion;
- the existing renderer cannot support portrait slides without changing legacy square output and no isolated adapter is viable;
- a new external asset source, licence or credential is required;
- human review changes the format boundary, aspect ratio or approval unit.

## 19. Source-of-truth decisions and conflicts

- Executable schema and renderer evidence overrides older planning prose: the campaign studio is image-only even though the repository has a separate legacy Reel workflow.
- `VISION.md` describes future image/Reel generation, scheduling and publishing; this spec implements only a bounded static creative step toward that vision.
- `automation-plan.md` says the current application slice is static-only and stops before publication, consistent with this boundary.
- Current brand packs declare square/airy visual styles. This spec intentionally changes that source for new campaign output while requiring historical and legacy compatibility.
- No ADR exists for the post/slide storage model. This spec records the decision pending human approval.

## 20. Context files read

- `VISION.md`
- `automation-plan.md`
- `README.md`
- `adapters/wolds-record-social-media/README.md`
- `adapters/wolds-record-social-media/context-map.md`
- `plans/README.md`
- `plans/discovery/multi-brand-campaign-packs.md`
- `plans/specs/multi-brand-campaign-packs.md`
- `plans/specs/wolds-record-campaign-review-slice.md`
- `src/db/schema.ts`
- `src/features/campaigns/types.ts`
- `src/features/campaigns/schemas.ts`
- `src/lib/generation/types.ts`
- `src/lib/rendering/legacy-post-adapter.ts`
- `src/app/campaigns/[id]/page.tsx`
- `src/app/globals.css`
- `brands/record/brand.json`
- `brands/massage/brand.json`
- `brands/academy/brand.json`
- representative generated Record and Massage PNG previews from local human testing

External platform facts were checked against Instagram Help Centre documentation for image resolution and carousel posts, and Meta's official Reels creative guidance. Those facts inform format boundaries; repository code remains authoritative for current capability.
