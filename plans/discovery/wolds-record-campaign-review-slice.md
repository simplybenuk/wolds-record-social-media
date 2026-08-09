# Discovery: Wolds Record campaign review slice

## Outcome

Prove the Wolds Social Studio direction with one usable, mobile-first loop: Ben or Olivia describes a Wolds Record campaign, receives a small set of on-brand AI-generated image posts, reviews and edits them, and approves or rejects them locally without publishing anything.

## Problem and opportunity

The repository can already edit, validate, render, upload, and send individual image and Reel records to Buffer, but the operator still has to author and manage `posts.json` one post at a time. That is the “admin wearing an AI hat” problem identified in `VISION.md`.

The next slice should prove the product's distinctive value—the campaign workflow and controlled AI—while reusing the rendering capability already built. It should also establish the smallest credible application seam for later brands, formats, scheduling, and publishing.

## Actors

- **Ben:** creates campaigns, reviews content, and administers the local installation.
- **Olivia:** creates and reviews content from a phone; needs clear previews and low-friction editing.
- **Wolds Record audience:** canine and related animal-therapy practitioners who receive the eventual content, but do not use the studio.

## Known facts

- The target is a private, local-first, mobile-first Next.js application for two users and three fixed brands.
- The target persistence layer is SQLite with Drizzle ORM.
- Campaign generation should use the OpenAI Responses API with structured output and brand context on every request.
- Human approval is required before anything is sent to a social platform.
- Existing image and Reel records share the `posts.json` pipeline.
- Static image rendering already works through `instagram.html` and `scripts/render-post.mjs`; Reel rendering works through HyperFrames.
- Wolds Record already has content, a logo, photos, four static templates, three Reel templates, validation, and automated tests.
- No Next.js application, database, campaign entity, OpenAI integration, or three-brand configuration exists yet.
- Buffer and Cloudinary integrations already exist and can remain unchanged outside this slice.

## Assumptions

- Wolds Record is the lowest-risk pilot brand because its assets, examples, and rendering rules already exist.
- Image posts are enough to validate the first campaign loop; Reel generation can follow after the application boundary is proven.
- A fixed repository-managed Wolds Record brand pack is preferable to a brand administration screen.
- The application can require an OpenAI API key while also retaining a committed fixture or fake generator for deterministic development and tests.
- The existing visual language is acceptable for the pilot; redesigning templates is separate work.
- Local approval state should be persisted in SQLite, while compatibility with the existing post shape provides the bridge to current rendering and later publishing.

## Recommended vertical slice

### Brief to approved local campaign

Build a thin mobile-first application flow with these steps:

1. Choose the fixed **Wolds Record** brand.
2. Enter a campaign brief, post count, and date range.
3. Generate a structured campaign of static image posts using the Wolds Record brand pack.
4. Persist the campaign and posts locally in SQLite.
5. Show each post as a review card with its rendered visual, Instagram and Facebook copy, hashtags, alt text, objective, and proposed date.
6. Allow copy edits, one-post regeneration, approval, rejection, and return after a page refresh.
7. Keep approved posts locally and represent their renderable fields through a compatibility boundary with the current post schema.

Nothing in this slice uploads media, contacts Buffer or Meta, schedules a job, or publishes externally.

## Scope

- Minimal Next.js, TypeScript, React, and Tailwind application shell.
- Mobile-first campaign creation and review screens; desktop only needs to remain usable.
- Repository configuration for one Wolds Record brand pack: audience, tone, content pillars, preferred language, prohibited claims, calls to action, hashtags, links, and existing visual assets.
- Typed campaign-generation schema and OpenAI Responses API integration.
- Deterministic fixture/fake generation path for tests and local work without API spend.
- SQLite/Drizzle tables for campaigns and draft posts, including review status and proposed dates.
- An adapter from stored draft posts to the existing static renderer's input shape.
- Rendered static preview generation using the existing visual templates.
- Edit, regenerate, approve, and reject actions with clear error states.
- Focused automated tests for schema validation, brand-context inclusion, persistence, status transitions, and renderer adaptation.

## Non-goals

- Wolds Canine Massage or Wolds Canine Therapy Academy content generation.
- Brand administration UI.
- Reel generation or preview inside the new application.
- Facebook or Instagram API integration.
- Buffer or Cloudinary calls from the application.
- Scheduling worker, calendar UI, Docker deployment, backups, authentication, Tailscale setup, analytics, or system-health dashboards.
- Migrating all existing `posts.json` records into SQLite.
- Replacing or redesigning the existing static and Reel templates.

## Success signals

- On a phone-sized viewport, Ben or Olivia can create a three-post campaign from one brief and reach the review queue without editing JSON or running a shell command.
- Generated output passes a strict schema and contains the Wolds Record brand context, channel-specific copy, a proposed date, and accessible alt text.
- Each generated post produces a recognizable static visual through the existing renderer.
- A user can edit, regenerate, approve, or reject a post; those decisions survive reload and cannot accidentally trigger an external write.
- Automated tests can exercise the complete flow with the deterministic generator and a temporary SQLite database.
- The resulting application boundaries allow a second brand or Reels to be added without replacing the campaign, persistence, or review model.

## Dependencies

- Current Node runtime and existing Playwright renderer.
- New Next.js, React, TypeScript, Tailwind, Drizzle, SQLite driver, and OpenAI SDK dependencies.
- An `OPENAI_API_KEY` for live generation; no key is needed for the deterministic test path.
- A reviewed Wolds Record brand pack derived from existing repository copy and product facts.
- A decision about whether the renderer is invoked synchronously for this small slice or wrapped behind an internal asynchronous job boundary from the start.

## Risks and mitigations

- **Existing renderer coupling:** `render-post.mjs` drives the large standalone `instagram.html`. Put it behind a small adapter/service rather than importing UI internals into React.
- **Slow request path:** Playwright startup can make multi-post generation feel stalled. Expose per-post progress and keep the rendering boundary replaceable; an in-process queue is enough if synchronous rendering proves poor.
- **Unreliable or unsafe copy:** validate structured output, constrain it with a reviewed brand pack, prohibit clinical claims, and keep human approval mandatory.
- **Scope creep from platform foundations:** implement only tables and application structure required by this loop; defer deployment, jobs, auth, and publishing.
- **Schema divergence:** define one application draft model and one explicit compatibility adapter instead of duplicating the legacy post shape across the application.
- **API cost and test nondeterminism:** use a fake generator in automated tests and require an explicit configured live mode.

## Material decisions still needed

1. Confirm Wolds Record as the pilot brand rather than Wolds Canine Massage.
2. Confirm the first slice is static-image-only, with Reels intentionally following later.
3. Decide whether live AI generation is required for acceptance or whether the deterministic path may demonstrate the flow until credentials are configured. Recommendation: require one human-tested live generation before acceptance, while all automated tests use the fake.
4. Choose the initial campaign size limit. Recommendation: 1–6 posts to bound latency and cost.
5. Choose rendering execution for the slice. Recommendation: start with an internal job/service boundary and sequential rendering, without introducing a separate worker container yet.

## Materially different options

### A. Campaign-to-review vertical slice — recommended

Proves the differentiating workflow, exercises AI, persistence, rendering, and human approval end to end, and leaves all external publication risk out of scope. It introduces more foundation than a wrapper UI, but every piece directly supports a user-visible loop.

### B. Put a web UI over `posts.json`

Fastest route to a nicer editor and could reuse nearly everything. It does not prove campaign generation, controlled AI, or a durable application model, and risks spending another iteration polishing individual-post administration.

### C. Build the architecture baseline and application shell first

Reduces some implementation ambiguity but provides no usable outcome and encourages horizontal work across database, Docker, auth boundaries, jobs, and deployment before validating the campaign experience. Architecture decisions needed by option A should instead be captured in its specification.

### D. Integrate Meta publishing next

Removes Buffer sooner but does not address content creation effort, adds tokens, permissions, hosting, retry, and recovery risks, and offers little benefit until approved campaigns exist locally. This belongs after campaign review, scheduling, and operational visibility.

## Recommended follow-on slices

1. Add Wolds Canine Massage and Academy brand packs using the proven campaign loop.
2. Add Reel campaign items and asynchronous render progress.
3. Add the combined calendar and explicit scheduling decisions.
4. Replace or complement Buffer with Meta publishing plus a local worker and publication records.
5. Package the proven application and worker for the home server with backups and health reporting.
