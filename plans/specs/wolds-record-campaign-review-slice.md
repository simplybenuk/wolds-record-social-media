# Specification: Wolds Record campaign review slice

- **Status:** READY FOR HUMAN TESTING
- **Change slug:** `wolds-record-campaign-review-slice`
- **Discovery:** `plans/discovery/wolds-record-campaign-review-slice.md`
- **Work type:** Product vertical slice; new local application surface with persistence and one external AI dependency
- **Prepared:** 2026-08-04
- **Approved:** 2026-08-04 by explicit human instruction to begin `bwh-development` for this specification

## 1. Objective and scope

Build the first usable Wolds Social Studio loop: from a phone, Ben or Olivia can submit a Wolds Record campaign brief, generate 1–6 brand-controlled static posts, review real visual and channel-copy previews, edit or regenerate weak posts, and approve or reject each post. Campaigns and decisions survive reload in local SQLite storage.

This slice stops at local approval. It must not upload media, contact Buffer or Meta, schedule jobs, or publish content.

## 2. Problem and desired outcome

The repository already validates, renders, uploads, and sends individual post records to Buffer, but authoring still begins by editing `posts.json` one item at a time. That proves the media pipeline, not the campaign-oriented product described in `VISION.md`.

The desired outcome is a narrow end-to-end application slice that proves:

- campaign creation is materially easier than hand-authoring posts;
- AI output is constrained by a fixed Wolds Record brand pack and strict application schema;
- existing static graphics can be reused behind an application boundary;
- human review state is durable and no external publication can occur;
- later brands and Reels can reuse the campaign, generation, persistence, and review model.

## 3. Actors

- **Ben:** creates and reviews campaigns and configures the local installation.
- **Olivia:** creates and reviews campaigns primarily from a phone.
- **Content audience:** canine and related animal-therapy practitioners who may later see approved Wolds Record posts, but do not access this application.

No roles, public accounts, client users, or third-party approvers exist in this slice.

## 4. Confirmed decisions

1. Wolds Record is the only enabled pilot brand.
2. The slice generates static image posts only; existing Reel support remains intact but outside the new application.
3. Campaign size is 1–6 posts.
4. One live OpenAI generation is required during human output testing; automated tests use a deterministic fake generator.
5. The application uses Next.js App Router, TypeScript, React, Tailwind, SQLite, and Drizzle ORM.
6. The application runs in the Node.js runtime. Edge runtime is prohibited because the slice needs SQLite, filesystem access, Playwright, and server-only credentials.
7. Rendering is sequential behind an internal service boundary in the application process. No separate worker or worker container is introduced.
8. Existing image templates and the current `instagram.html` visual language are reused; template redesign is a separate change.
9. OpenAI requests are stateless (`store: false`) and use Responses API Structured Outputs. The model identifier is runtime configuration, not a product-domain constant.
10. Nothing beyond local files and the OpenAI generation request is an external side effect.

## 5. Non-goals

- Wolds Canine Massage or Wolds Canine Therapy Academy generation.
- Brand administration UI.
- Reel generation, Reel preview, audio, or video rendering in the application.
- Importing or migrating existing `posts.json` records into SQLite.
- Writing generated or approved records back to `posts.json`.
- Cloudinary, Buffer, Facebook, Instagram, or Meta calls.
- Calendar, publishing worker, content library, analytics, system health, backups, Docker, Tailscale, or production deployment.
- Public registration, authentication, roles, organisations, billing, or approval portals.
- General-purpose template design or visual-template editing.
- Voice dictation; a normal mobile text field is sufficient for this slice.

## 6. User journey

### 6.1 Create campaign

1. Open the local application at `/campaigns/new`.
2. See Wolds Record selected as the only enabled brand.
3. Enter a campaign brief, choose 1–6 posts, and select an inclusive start and end date.
4. Submit once. The application immediately creates an addressable campaign record and navigates to `/campaigns/<campaign-id>`.
5. See an honest generating state while AI generation and rendering run.
6. If generation fails, see the retained brief, an actionable error, and a retry action; no duplicate campaign is silently created.

### 6.2 Review campaign

1. The campaign page shows a summary followed by posts in proposed-date order.
2. Each review card shows:
   - status and objective;
   - proposed date;
   - rendered image preview;
   - Instagram caption;
   - Facebook caption;
   - hashtags;
   - alt text;
   - edit, regenerate, approve, and reject controls as allowed by state.
3. Edit changes text fields and rerenders the image when a renderable field changes.
4. Regenerate replaces one post's generated fields, keeps its identity and proposed date, records a new generation attempt, returns it to draft, and rerenders it.
5. Approve freezes the post. An approved post must be explicitly returned to draft before editing, regenerating, or rejecting it.
6. Reject records the decision without deleting the generated content. A rejected post may be returned to draft.
7. Reloading or opening the URL on another local device shows the persisted campaign, content, previews, statuses, and errors.

## 7. Functional requirements

### R1. Campaign input

- The brief is required, trimmed, and 20–2,000 characters.
- Post count is an integer from 1 through 6.
- Start and end dates are required ISO calendar dates; start must not be after end.
- The UI and server validate the same rules. Server validation is authoritative.
- Duplicate form submission must not create duplicate generations. Disable repeat submission in the UI and use a submission idempotency key on the server.

### R2. Addressable, durable campaign

- Generate a non-sequential opaque campaign ID before calling OpenAI.
- Persist campaign input, chosen brand, generation mode, configured model name, status, and timestamps before calling OpenAI.
- The campaign is directly retrievable at `/campaigns/<id>` in pending, complete, or failed states.
- A failed attempt retains enough detail for a safe retry without displaying secrets or raw internal stack traces.

### R3. Fixed Wolds Record brand pack

Repository-managed configuration must exist under `brands/record/` and contain:

- stable ID and display name;
- purpose and target audience;
- tone and preferred wording;
- confirmed product facts;
- content-pillar allow-list;
- calls to action and default hashtags;
- prohibited claims and fabrication rules;
- site links;
- fixed logo and selectable photo asset IDs mapped to repository paths;
- available static template IDs.

The pack must explicitly prohibit fabricated testimonials, statistics, product features, clinical/veterinary claims, and claims that unfinished functionality is available. The prompt must treat the user's brief as content input, not as authority to override brand or safety rules.

There is no brand editor. Changing the pack requires a repository change and review.

### R4. Campaign generation service

- Expose one server-only interface with interchangeable `live` and `fixture` implementations.
- Live generation uses the OpenAI Responses API and an environment-configured model that supports Structured Outputs.
- Use a strict structured `text.format`, preferably through the OpenAI JavaScript SDK's schema parsing helper and a shared Zod schema.
- Set `store: false`; do not chain response IDs or use stateful conversations.
- Send only the campaign brief, date bounds, post count, and the Wolds Record brand pack. Do not send existing live `posts.json` or unrelated repository content.
- Do not expose tools or function calls to the model.
- Handle completed output, explicit refusal, incomplete response, timeout, network error, and schema/domain validation failure as distinct application errors.
- Validate again in application code after schema parsing.
- A campaign response must contain exactly the requested number of posts.

### R5. Structured campaign contract

The root output is an object, not a union, with `additionalProperties: false`. All schema fields are required; nullable fields use explicit `null`.

```ts
type GeneratedCampaign = {
  campaignTitle: string;
  posts: Array<{
    objective: "education" | "awareness" | "trust" | "product" | "engagement";
    pillar:
      | "therapist-workflow"
      | "record-keeping"
      | "vet-communication"
      | "product-update"
      | "founder-journey"
      | "admin-pain";
    proposedDate: string;
    visualTemplate: "problem" | "feature" | "hook" | "cta";
    headline: string;
    emphasis: string | null;
    body: string;
    footer: string;
    instagramCaption: string;
    facebookCaption: string;
    hashtags: string[];
    altText: string;
    photoAssetId: string | null;
  }>;
};
```

Application-level validation additionally requires:

- nonblank title and text fields;
- exactly the requested post count;
- dates inside the inclusive campaign range and nondecreasing in output order;
- valid template, pillar, and photo asset IDs from the pack;
- 3–8 unique normalized hashtags per post;
- emphasis, when present, occurs in the headline using case-insensitive comparison;
- no duplicate headline after case and whitespace normalization;
- captions remain distinct fields and are not collapsed into one generic caption;
- no URL or filesystem path may be supplied by the model.

### R6. Generation-attempt persistence

Every initial generation and one-post regeneration must have an opaque ID created before the API call and a durable row containing:

- campaign ID and optional post ID;
- kind: `campaign` or `post_regeneration`;
- mode: `live` or `fixture`;
- model name;
- sanitized input snapshot or prompt hash plus brand-pack version;
- status: `pending`, `complete`, or `failed`;
- raw structured result on success;
- normalized error code and safe message on failure;
- OpenAI response ID when provided;
- input, output, and total token counts when provided;
- request start and completion timestamps;
- retry relationship to the preceding attempt.

Estimated currency cost is not required because model pricing changes independently. Token usage is required so cost can be calculated later from historical pricing data.

Generation records are operational evidence and must not be deleted when a post is rejected or regenerated.

### R7. Transaction and partial-failure behaviour

- Create the campaign and pending attempt in one transaction before the API call.
- After valid output returns, insert all draft posts and complete the attempt in one transaction.
- Never persist a partially parsed campaign.
- Render posts only after draft rows exist.
- A render failure affects that post's render state, not the other posts or the stored AI output.
- Retry generation reuses the existing failed campaign and creates a new linked attempt.
- Retry rendering does not call OpenAI.
- A server restart may leave an attempt or render marked pending. On the next campaign load, the application must mark work older than a documented timeout as interrupted and offer an explicit retry; it must not silently repeat a paid request.

### R8. Draft-post persistence and state machine

Draft posts store the normalized generated fields plus:

- opaque ID, campaign ID, ordinal, format (`image`), and brand ID (`record`);
- review status: `draft`, `approved`, or `rejected`;
- render status: `pending`, `rendering`, `ready`, or `failed`;
- generated image path and safe render error;
- generation revision and latest generation-attempt ID;
- integer version and timestamps for stale-write protection.

Allowed review transitions:

```text
draft -> approved
draft -> rejected
approved -> draft
rejected -> draft
```

Editing or regeneration is allowed only in `draft`. Every mutation checks the submitted version. A stale version returns a conflict message and does not overwrite a newer edit.

### R9. Legacy renderer compatibility boundary

- Define one adapter from an application draft-post record and brand pack to the existing static post shape.
- The adapter owns fixed legacy fields such as `brand`, `service`, `instagramType`, `aspectRatio`, `kicker`, logo path, image opacity, and safe mode.
- The model and database must not duplicate public-media, Buffer, or publication fields that this slice does not use.
- Extract the reusable render operation from the current CLI or wrap it behind a server-only service while keeping `scripts/render-post.mjs` behaviour compatible.
- Reuse a browser across sequential posts in one campaign where practical; do not launch renders in parallel.
- Render to `generated/campaigns/<campaign-id>/<post-id>.png` using an atomic temporary-file-then-rename write.
- Never overwrite a previously successful image until its replacement render succeeds.
- Generated paths are local and git-ignored. The database stores paths relative to the configured media root, not arbitrary absolute paths.

### R10. Review UI

- Use Server Components for campaign reads and Server Actions for internal mutations.
- Keep OpenAI, database, filesystem, and rendering modules server-only.
- The campaign page includes route-level loading, not-found, and recoverable error states.
- The new-campaign form and review actions show pending states and prevent accidental double submission.
- Errors are placed next to the affected action and also exposed to assistive technology.
- Status is not communicated by colour alone.
- The 390×844 viewport has no horizontal scrolling, clipped action buttons, or unreadably scaled form fields.
- Controls have programmatic labels and touch targets suitable for phone use.
- Rendered previews use the post's alt text; editing alt text updates the preview semantics.
- Desktop remains usable, but no desktop-specific dashboard is required.

### R11. Edit and regenerate

- Editable fields are objective, pillar, proposed date, template, headline, emphasis, body, footer, both captions, hashtags, alt text, and selected photo asset.
- Date, enum, asset, hashtag, emphasis, and nonblank validations match R5.
- Text-only caption or alt-text edits do not rerender; changes to visual fields do.
- A failed replacement render retains and displays the previous successful image with a clear “preview out of date” state.
- Regeneration passes the original campaign context, brand pack, and current post to the generator, requesting a materially different replacement while preserving the post's proposed date.
- A regenerated result creates a new attempt and revision, never erases the preceding attempt, and returns the post to `draft`.

### R12. No publication path

- Application code introduced by this slice must not import or invoke Cloudinary, Buffer, or Meta clients.
- No review action creates a public URL, external draft, schedule, or publication record.
- Approval is only a local database state transition.
- Existing external-write scripts remain available from the command line and unchanged unless a renderer refactor requires behaviour-preserving imports.

## 8. Proposed design

### 8.1 Application structure

Use a root-level Next.js App Router application with a server-focused source layout, for example:

```text
src/
├── app/
│   ├── campaigns/new/page.tsx
│   ├── campaigns/[id]/page.tsx
│   ├── campaigns/[id]/loading.tsx
│   ├── campaigns/[id]/error.tsx
│   └── campaigns/[id]/not-found.tsx
├── components/
├── db/
│   ├── schema.ts
│   └── index.ts
├── features/campaigns/
│   ├── actions.ts
│   ├── queries.ts
│   ├── schemas.ts
│   └── types.ts
├── lib/generation/
│   ├── contract.ts
│   ├── fixture-generator.ts
│   ├── openai-generator.ts
│   └── persistence.ts
└── lib/rendering/
    ├── legacy-post-adapter.ts
    └── static-image-renderer.ts
brands/record/
├── brand.json
└── prompt.md
drizzle/
data/                 # git-ignored local SQLite storage
generated/            # existing git-ignored media output
```

This layout is illustrative; requirements and boundaries are authoritative. Do not add a public REST API. Server Components read directly from the database and Server Actions perform form mutations. Use the default Node.js runtime and explicitly keep native/database/rendering packages out of client bundles.

### 8.2 Pages

- `/` redirects to `/campaigns/new` for this slice.
- `/campaigns/new` provides the creation form and a short recent-campaign list if inexpensive to include.
- `/campaigns/<id>` is the addressable generation and review surface.

No dashboard, settings, brand page, or navigation hierarchy beyond these routes is required.

### 8.3 Data model

Use Drizzle migrations and SQLite foreign keys. Exact SQL names may vary, but the following concepts and constraints are required.

#### `campaigns`

| Field | Notes |
| --- | --- |
| `id` | Opaque text primary key |
| `submission_key` | Unique idempotency key |
| `brand_id` | Required; check/equivalent constraint for `record` |
| `title` | Nullable until generation completes |
| `brief` | Required |
| `post_count` | Required; 1–6 |
| `start_date`, `end_date` | Required ISO date strings |
| `status` | `pending`, `review`, `failed` |
| `generation_mode` | `live`, `fixture` |
| `model` | Configured model used or intended |
| `safe_error_code`, `safe_error_message` | Nullable |
| `created_at`, `updated_at` | Required UTC timestamps |

#### `draft_posts`

Contains R5 normalized fields plus the identity, review, render, revision, relative image path, and version fields in R8. `campaign_id` cascades only if a future explicit campaign-delete feature is introduced; this slice exposes no delete action.

Hashtags are stored as validated JSON text. Enums are enforced both in shared schemas and database checks where practical.

#### `generation_attempts`

Contains the R6 audit fields. Token counts are nullable integers because fixture runs and some failed requests provide no usage. Safe error fields are separate from server logs. The full secret-bearing prompt is never stored; store the user brief snapshot, generation parameters, brand-pack version/hash, and normalized structured output.

### 8.4 Generation lifecycle

```text
validate form
  -> create campaign + pending attempt
  -> redirect to addressable campaign
  -> call configured generator
  -> parse strict structured output
  -> run application domain validation
  -> transactionally save all posts + usage + completed attempt
  -> sequentially render each post
  -> campaign enters review state
```

The fixture generator returns the same contract as the live generator and must exercise multiple templates, distinct Facebook/Instagram captions, null and non-null asset selections, and proposed dates.

### 8.5 OpenAI boundary

Use the official OpenAI JavaScript SDK directly. The current official guidance supports Responses API schema parsing with `responses.parse`, `text.format`, and a Zod helper. Structured output is appropriate because the application needs typed response data rather than model-invoked tools.

The implementation must follow these API-contract rules:

- strict JSON Schema with all fields required and `additionalProperties: false` on every object;
- programmatic handling for refusal and incomplete output;
- application-side domain validation even after schema parsing;
- `store: false` because Responses are otherwise stored by default;
- server-only `OPENAI_API_KEY` and `OPENAI_MODEL` configuration;
- no default model name duplicated across domain records or client code.

Official references used for this contract:

- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Responses API statefulness and `store: false`](https://developers.openai.com/api/docs/guides/migrate-to-responses#4-decide-when-to-use-statefulness)

### 8.6 Rendering lifecycle

Rendering is an internal service, not a UI concern. It accepts a normalized draft, resolves repository-owned assets through the brand pack, adapts it once to the legacy post shape, and produces a local PNG.

The renderer must remain testable without OpenAI. Renderer errors use stable codes such as `browser_unavailable`, `asset_missing`, `render_timeout`, and `write_failed`. Safe details appear in the UI; stack traces remain in server logs.

### 8.7 Caching and freshness

Campaign and post reads must reflect local mutations immediately. Do not use long-lived static generation or ISR for the review routes. After a successful Server Action, revalidate the campaign path or redirect back to it. SQLite remains the source of truth; client state must not become an independent copy of the campaign.

## 9. Security and privacy

- The app remains a trusted local utility with no authentication in this slice. It is not approved for public internet exposure.
- Development binds to loopback by default. LAN/Tailscale deployment is a later, security-reviewed slice.
- `OPENAI_API_KEY` is server-only, stored in an ignored environment file, added only as a placeholder to `.env.example`, and never serialized to the browser, database, generated files, errors, or logs.
- Use `store: false` on every Responses API request. This reduces application-state retention but must not be described as a guarantee of Zero Data Retention for the account.
- The UI should tell users not to include client names, contact details, clinical records, or other personal data in campaign briefs.
- The user brief is delimited as untrusted content beneath developer-owned brand rules. The generator has no tools and its output cannot select arbitrary paths or URLs.
- Server Actions validate all inputs and enforce same-origin application use. Filesystem paths are constructed only from server-owned IDs and allow-lists.
- SQLite and generated-media paths must be git-ignored. No credentials or private live content may enter fixtures.
- No destructive data operation is exposed.

## 10. Reliability, observability, and recovery

- Use stable, user-safe error codes for validation, generation, persistence, and rendering failures.
- Log campaign ID, attempt ID, post ID where applicable, operation, duration, and safe error code. Never log the API key or complete secret-bearing request headers.
- Persist token usage from live responses for later cost analysis.
- Preserve failed attempts and last successful previews.
- Do not automatically replay ambiguous interrupted OpenAI calls; require a human retry to avoid duplicate spend.
- A retry action is idempotent with respect to its own submission key.
- SQLite writes that create or replace a complete campaign result use transactions.
- Atomic image replacement prevents a failed render from corrupting the last good preview.

## 11. Rollout and migration

The change is additive:

1. Add the application, migrations, brand pack, and fixture path.
2. Create a new local SQLite database via committed Drizzle migrations.
3. Leave `posts.json`, existing generated media, Reels, Cloudinary, and Buffer scripts untouched in behaviour.
4. Validate the fixture campaign flow before configuring a live API key.
5. Human output testing performs one bounded live 1–3 post generation after explicitly choosing to incur the API request.

No existing content migration is required. Rollback consists of stopping the application and removing its untracked local database/generated campaign media; existing scripts and live post data continue to work. The implementation must not delete local data automatically during rollback.

## 12. Proposed task outline

This is a readiness outline, not an approved execution plan. Detailed task states belong in `plans/tasks/wolds-record-campaign-review-slice.md` after human spec approval.

1. **Application baseline:** add pinned application dependencies, App Router shell, Tailwind, Node runtime configuration, environment placeholders, and build/test scripts.
2. **Brand and domain contracts:** implement the reviewed Wolds Record pack, shared schemas, validation, IDs, states, and legacy-post adapter with unit tests.
3. **Database:** add Drizzle SQLite schema, migrations, repository layer, transactions, stale-write checks, and temporary-database integration tests.
4. **Durable generation framework:** create campaign and attempt persistence, fixture generator, addressable campaign page, interrupted-work recovery, and usage fields.
5. **Live OpenAI generator:** implement Responses API strict output, stateless requests, refusal/incomplete/error mapping, and mocked contract tests; do not make a live call during automated validation.
6. **Renderer boundary:** extract or wrap the static renderer, reuse a browser sequentially, write atomically, preserve the CLI contract, and prove one fixture campaign renders real PNGs.
7. **Mobile creation and review:** create the form, campaign page, review cards, pending/error states, edit/regenerate/status actions, accessibility behaviour, and optimistic version handling.
8. **Regression and full validation:** legacy static render comparison, existing Reel and payload tests, build, migration, fixture end-to-end flow, and mobile browser verification.
9. **Documentation and handoff:** update runtime/setup docs and `.env.example`, record limitations, and prepare for independent agent review. Do not mark source-of-truth rollout documents complete until human acceptance.

## 13. Dependencies and affected areas

### New dependency categories

- Next.js, React, React DOM, TypeScript, Tailwind tooling.
- Drizzle ORM, migration tooling, and a local Node-compatible SQLite driver.
- Official OpenAI JavaScript SDK and Zod.
- Test tooling sufficient for TypeScript domain/integration tests and mobile browser verification.
- An opaque-ID library, unless the chosen Node runtime's UUID support satisfies the non-sequential ID requirement consistently.

Pin versions through `package-lock.json`. Exact version selection occurs during development after compatibility checks; do not couple the persisted spec or domain schema to a model version.

### Expected affected areas

- `package.json`, `package-lock.json`, `.env.example`, `.gitignore`
- `src/**`, `brands/record/**`, `drizzle/**`
- `scripts/render-post.mjs` and/or a new shared renderer module
- `README.md` for local application development instructions
- tests and test configuration

### Must remain behaviourally stable

- `posts.json` and its existing records
- image and Reel payload shapes
- Cloudinary and Buffer external-write behaviour
- existing Reel compositions and rendering
- legacy `scripts/render-post.mjs` CLI input/output contract

## 14. Validation plan

### Automated

- `npm run check` covers legacy scripts and new server-side source checks appropriate to the selected TypeScript toolchain.
- `npm test` runs all existing tests plus new unit/integration tests.
- `npm run posts:check` confirms live post data remains valid and unchanged.
- `npm run build` succeeds with no client-bundle import of database, filesystem, OpenAI, or renderer modules.
- Drizzle migrations apply to an empty temporary SQLite database and foreign keys are enabled.
- Domain tests cover all R1 and R5 validation boundaries.
- Generator contract tests cover fixture success plus mocked completed, refusal, incomplete, schema-invalid, timeout, and network-failure live responses.
- Persistence tests cover pre-call records, complete and failed attempts, token usage, linked retries, interrupted pending work, transactions, review-state transitions, and stale writes.
- Renderer tests cover adapter output, asset allow-listing, atomic replacement, last-good-preview retention, and error codes.
- One fixture campaign renders at least three real PNGs using at least two templates.
- Existing static render regression evidence shows the legacy CLI still produces the expected image for a fixed existing record; existing Reel and Buffer payload tests remain green.

### Browser verification

- Create a three-post fixture campaign through the UI at 390×844.
- Observe addressable pending and completed states.
- Reload and confirm persistence.
- Edit one visual field and see a replacement preview.
- Edit caption-only content and confirm it does not unnecessarily rerender.
- Regenerate one draft and verify attempt history/revision changes.
- Approve one, reject one, and verify prohibited transitions.
- Simulate generation and rendering failures and verify recovery controls and accessible messages.
- Confirm no horizontal overflow and usable keyboard/focus behaviour.

### Human output testing

- Review and approve the Wolds Record brand pack before sending it to the API.
- With an explicitly configured key and model, create one live campaign of 1–3 posts.
- Confirm the output is recognizably Wolds Record, factually safe, channel-specific, visually usable, editable, and durable after reload.
- Confirm the account/API usage shows only the intended bounded generation and that no Buffer, Cloudinary, or Meta action occurred.

The live call is not authorized merely by approving development. It is a later explicit human output-testing action because it transmits the brief and incurs API usage.

## 15. Acceptance criteria

1. At 390×844, a user can submit a valid Wolds Record brief for 1–6 image posts without JSON editing or shell commands and is redirected to an addressable campaign URL.
2. Campaign and pending attempt records exist before generation starts; refreshing during or after generation never loses the campaign.
3. Fixture generation produces exactly the requested number of schema-valid, date-valid posts with distinct Facebook and Instagram copy.
4. One bounded live Responses API campaign succeeds during human output testing using strict Structured Outputs and `store: false`; refusal/incomplete/failure paths are separately handled in automated tests.
5. Every generation and regeneration attempt persists status, model, timestamps, safe result/error data, and available token usage; prior attempts remain queryable after regeneration.
6. A three-post fixture campaign produces three real PNG previews through the existing visual system, including at least two templates.
7. Editing and regeneration follow R11, survive reload, and never erase the last good preview on replacement-render failure.
8. Draft, approved, and rejected state transitions follow R8; approved content cannot change without an explicit return to draft.
9. A stale edit cannot overwrite a newer edit and instead shows an actionable conflict.
10. No application action uploads media, contacts Buffer or Meta, schedules, publishes, or mutates `posts.json`.
11. The legacy static renderer contract remains compatible; all existing image, Reel, validation, pacing, and Buffer payload tests pass.
12. `npm run check`, `npm test`, `npm run posts:check`, `npm run build`, empty-database migration, fixture end-to-end rendering, and mobile browser verification all pass.
13. The API key never reaches client code, the database, generated media, committed files, or logs; arbitrary model-supplied paths/URLs are rejected.
14. A second brand could be enabled by adding another fixed pack and generated-contract inputs without replacing campaign, attempt, post, renderer, or review-state concepts.

## 16. Stop conditions during development

Stop and return for refinement if any of these becomes true:

- The current static renderer cannot be reused without a visual or CLI regression and replacement would materially expand scope.
- The selected SQLite driver is incompatible with the supported Node/Next.js runtime or self-hosting target.
- Structured Outputs cannot represent the required contract with the configured supported model.
- The Wolds Record pack lacks confirmed product facts sufficient to prevent invented feature claims.
- A production-like LAN deployment, authentication, Buffer/Meta call, live data migration, or destructive database operation becomes necessary to demonstrate this slice.
- Reliable generation requires sending identifiable client or clinical data.

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Application scaffolding swamps the vertical slice | Only two routes and the tables/services directly needed by the user journey are allowed. |
| Existing HTML renderer is tightly coupled | Put one tested adapter/service boundary in front of it; preserve the CLI and defer redesign. |
| Multi-post rendering is slow | Reuse one browser sequentially, show honest status, cap campaigns at six, and measure fixture flow. |
| AI fabricates features or claims | Fixed pack, strict allow-lists, application validation, no tools, safe-copy rules, and mandatory human approval. |
| Paid output is lost or duplicated | Persist IDs before calls, retain attempts, use idempotency keys, and require explicit retry after interruption. |
| Local app is mistaken for internet-safe | Bind to loopback in this slice and document that LAN/Tailscale exposure requires later security work. |
| SQLite/native dependency complicates Next bundling | Node runtime only, server-only imports, externalize native packages if required, and make `npm run build` an acceptance gate. |
| Generated and legacy schemas drift | One explicit adapter; application schema does not copy publication fields. |
| Ben and Olivia overwrite each other | Integer versions and conflict handling on every post mutation. |

## 18. Assumptions and open questions

### Assumptions

- Existing Wolds Record copy and assets are sufficient to draft a brand pack for human review.
- The current square templates are acceptable for the first product slice.
- One application process and one SQLite writer are sufficient at this scale.
- Proposed dates are dates only; times and final scheduling follow in a calendar slice.
- A campaign can contain multiple posts on one date if the generated plan does so; the UI may warn but does not reject it.
- The fixture mode is explicitly labelled and cannot be confused with live AI output.
- No existing `posts.json` import is needed to judge the campaign experience.

### Open questions

No question blocks human approval. The following implementation choices may be made within the requirements and recorded in the task plan:

- exact pinned framework, SQLite-driver, and test-tool versions;
- whether recent campaigns appear on `/campaigns/new` or only through direct returned URLs;
- exact interrupted-work timeout, provided it is documented and tested;
- whether normalized successful AI output is stored as one JSON snapshot in addition to normalized post rows.

## 19. Source-of-truth decisions and conflicts

### Direction authority

The user explicitly confirmed `VISION.md` as the direction on 2026-08-04. For this change it is authoritative on the three-brand product, local-first stack, campaign workflow, human approval, and eventual Meta direction.

### Conflicts found

1. `automation-plan.md` describes Wolds Record, Wolds Canine Massage, SourList, and future projects; `VISION.md` defines Wolds Record, Wolds Canine Massage, and Wolds Canine Therapy Academy. This spec follows `VISION.md`. Only Wolds Record is enabled in this slice.
2. `automation-plan.md` treats Buffer as the final publishing interface; `VISION.md` targets eventual direct Meta publishing while retaining Cloudinary initially. This slice performs neither, preserves the existing Buffer pipeline, and defers the publishing decision.
3. The adapter context map names `README.md` as the vision source and does not yet list `VISION.md`. The user's explicit confirmation makes `VISION.md` authoritative for this change; the adapter should be corrected in a separate or completion documentation update.
4. `VISION.md` suggests a separate target-architecture document before coding. This bounded specification captures the architecture required by the first slice. A broader architecture document is not required to develop this slice and remains optional follow-on documentation.

No executable source conflicts with the proposed local campaign-review slice. Existing scripts remain authoritative for current render and publication behaviour.

## 20. Readiness bundle

- **Requirements:** Sections 6–12
- **Proposed design and data model:** Section 8
- **Security and recovery:** Sections 9–10
- **Rollout:** Section 11
- **Task outline:** Section 12
- **Dependencies and affected areas:** Section 13
- **Validation:** Section 14
- **Acceptance criteria:** Section 15
- **Stop conditions:** Section 16
- **Risks:** Section 17
- **Assumptions/open questions:** Section 18
- **Source decisions/conflicts:** Section 19

The specification crossed the human-only approval gate on 2026-08-04 when the user explicitly instructed development of this exact artifact.
