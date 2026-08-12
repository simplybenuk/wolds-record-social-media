# Discovery: Instagram engagement creative system

- **Change slug:** `instagram-engagement-creative-system`
- **Prepared:** 2026-08-12
- **Outcome:** define an Instagram-first static creative system that produces more useful, varied and interaction-worthy campaign posts without expanding into Reels or publication.

## Idea and opportunity

The campaign studio produces safe, readable, brand-controlled square images, but human testing found the overall design too restrained. Review of the generated Record and Massage samples supports that judgement: repeated poster-like layouts, heavily faded photography, generic supporting copy and commercially narrow calls to action give people little reason to stop, swipe, save, send or comment.

The opportunity is to preserve the existing brand and safety controls while making each campaign deliverable intentionally earn an Instagram interaction. Portrait feed posts can occupy more of the mobile viewport, while carousels can turn educational material into a short narrative instead of compressing it into one image.

## Actors and desired outcome

- **Ben and Olivia:** create and review campaigns from a phone. They need to judge a complete Instagram post, including every carousel slide, before approval.
- **Brand audiences:** practitioners, dog owners, veterinary contacts and prospective learners. They should receive specific, useful and visually varied content suited to saving, sharing or responding to.
- **Future publishing workflow:** consumes an approved post as one publication unit with one caption and either one image or an ordered image set.

The desired outcome is that the studio can generate, render, edit, regenerate and approve Instagram-first portrait images and coherent carousels for all three brands, with an explicit engagement intent and no loss of safety, durability or publication isolation.

## Known facts

1. The campaign application currently enforces `draft_posts.format = 'image'` and stores one rendered image path per post.
2. Its four visual templates render 1080×1080 graphics through the legacy canvas surface.
3. Current post generation has one headline, body, footer, photo and alt-text set; there is no slide concept or engagement-intent field.
4. The three brand packs own palette, fonts, logo, allowed photos, copy rules, calls to action and prohibited claims.
5. The legacy `posts.json` workflow supports Reels, but Reels are not available in the campaign application and their styling remains Record-specific.
6. Instagram accepts feed photos up to 1080 pixels wide in supported portrait ratios and supports ordered multi-image posts. Meta recommends native 9:16 video with audio and safe-zone-aware messages for Reels; that is a distinct creative and rendering problem.
7. The current application deliberately performs no upload, scheduling or publication action.

## Assumptions

1. The first engagement-focused slice should improve static feed creative before bringing Reels into the campaign application.
2. A 4:5, 1080×1350 canvas is the appropriate default because it fills more feed space than square while retaining broad publishing-tool compatibility.
3. A carousel of 3–7 slides is enough for the intended educational and narrative structures; supporting Instagram's maximum is not necessary initially.
4. Engagement optimisation means designing for a declared intended action and later measuring results. This slice can implement the former without pretending to predict or ingest performance.
5. Existing local campaign records should remain readable through an explicit migration and compatibility path.

## Decisions needed and proposed resolution

| Decision | Material options | Proposed resolution |
| --- | --- | --- |
| First format investment | Reels first; carousels first; both together | Portrait images and carousels first. Reels require video, timing, audio, covers and multi-brand token work and would make this change too broad. |
| Feed aspect ratio | Keep 1:1; move to 4:5; adopt 3:4 | Use 4:5 at 1080×1350 for new output. Preserve historical square previews without re-rendering. |
| Carousel size | Fixed count; unrestricted maximum; bounded range | Allow 3–7 slides so generation, editing and mobile review remain bounded. |
| Format choice | Always model-selected; always operator-selected; guided mix | Let the operator request image, carousel or an automatic mix. The resolved format is persisted and cannot silently change during regeneration. |
| Engagement goal | Infer only from objective; free-text CTA; explicit intent | Persist one intent per post: `save`, `send`, `comment`, `follow`, or `enquire`; generate the hook, structure and CTA around it. |
| Existing renderer | Replace it; stretch existing templates; extend behind a typed render contract | Extend the renderer through a portrait/slide contract, retaining the existing renderer entry point and historical output compatibility where required. |

## Likely scope

- Portrait 4:5 output for new single-image campaign posts.
- Carousel as a first-class campaign post with 3–7 ordered slides.
- Instagram-first content structures: checklist, myth/reality, signs, mistakes, workflow, point of view and question-led posts.
- Explicit engagement intent and intent-appropriate calls to action.
- More varied, less washed-out photo treatments, while retaining brand-owned palette, fonts, logo and asset allow-listing.
- Structured generation, validation, persistence, migration, rendering and atomic replacement for multiple slides.
- Mobile creation, full-carousel review, per-slide editing, post regeneration and one approval decision for the whole post.
- Fixture coverage for every brand and both formats.

## Non-goals

- Reels, video, audio, timing, cover selection or brand-aware Reel tokens.
- Stories, live posts or direct publishing.
- Buffer, Cloudinary, Meta, scheduling or outward-facing actions.
- Importing Instagram Insights or promising an engagement uplift.
- AI-generated photography, asset licensing changes or a public asset library.
- A free-form design editor, arbitrary slide counts, animation or mixed photo/video carousels.
- Redesigning the campaign studio's entire application shell.

## Dependencies

- Existing campaign, generation-attempt, optimistic-edit and review-state boundaries.
- Brand packs and their asset allow-lists.
- The static canvas renderer and Playwright export path.
- SQLite/Drizzle migration support.
- Human judgement from Ben or Olivia on visual quality and brand appropriateness.

## Risks

- More slide content increases generation cost, render time and failure surface.
- A weak first-slide hook makes the rest of a carousel irrelevant.
- Reusing square-template spacing at 4:5 could merely produce taller versions of the same poster.
- Slide-level edits and renders could create partial or stale carousel previews unless replacement is atomic at post level.
- Engagement language can become manipulative or repetitive unless the prompt favours genuine usefulness over bait.
- Generic stock photography limits authenticity; the system must expose this limitation rather than over-process weak assets.

## Success signals

- Operators can intentionally request an image, carousel or automatic mix and review the resolved format before approval.
- New feed output is 1080×1350, readable in the Instagram feed and visibly more varied across a campaign.
- Every post has a declared engagement intent and a specific, intent-consistent hook and CTA.
- A carousel tells one coherent story across 3–7 slides, with a strong cover, one role per slide and an intentional final action.
- Ben or Olivia judge bounded outputs for all three brands as useful, brand-appropriate and more engaging than the current square samples.
- Existing campaigns remain readable; failed multi-slide rendering never replaces the last complete preview set.
- No external upload, scheduling or publication occurs.

## Recommended direction

Specify an additive Instagram-first creative layer around a reviewable post: each post resolves to `image` or `carousel`, owns an engagement intent and content structure, and contains an ordered set of 4:5 visual slides. Treat a single image as one slide at the domain boundary so rendering and review use one coherent model, while migration preserves historical campaign output. Defer Reels to a subsequent specification with its own video, audio, safe-zone and brand-token decisions.
