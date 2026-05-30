# Wolds Record Social Media Automation Plan

## Purpose

Repurpose this repo from a one-off Instagram post builder into a lightweight private content hub for Wolds Record, Wolds Canine Massage Therapy, SourList, and future small projects.

The goal is not full autopilot publishing. The goal is:

```text
AI creates draft content
↓
Tool renders on-brand assets
↓
Ben / Olivia review and approve
↓
Approved posts are sent to Buffer as drafts or queued posts
```

Human approval stays in the loop.

## Core principles

- Local-first, cheap to run, no extra cloud bill.
- Private utility app, not a SaaS product.
- Useful before clever.
- Approval required before anything reaches social media.
- Brand presets keep output consistent.
- Reuse successful old posts as source material over time.

## Proposed local hosting setup

Run on the existing Ubuntu OptiPlex using Docker Compose.

```text
Docker Compose
├─ App: Node / Next.js / lightweight Express app
├─ DB: SQLite to start
├─ Storage: local uploads/generated folder
└─ Optional access: Tailscale only
```

Avoid public internet exposure at first. Use Tailscale so Ben and Olivia can access it from trusted devices.

## Brands supported

Start with:

- Wolds Record
- Wolds Canine Massage Therapy

Later:

- SourList
- Kahootz experiments
- Other side projects

Each brand should define:

- Name
- Logo
- Colours
- Fonts
- Tone of voice
- Instagram handle
- Hashtag sets
- Content pillars
- CTA defaults

## Suggested content pillars

### Wolds Record

- Therapist workflow
- Record keeping
- Vet communication
- Product updates
- Founder/building journey
- Admin pain points

### Wolds Canine Massage Therapy

- Educational dog wellbeing posts
- Behind the scenes
- Client-friendly explanations
- Rehabilitation and aftercare tips
- Success stories, where appropriate and consented
- Common myths or misunderstandings

## Data model v1

Use SQLite initially.

### brands

- id
- name
- handle
- logo_path
- primary_colour
- secondary_colour
- background_colour
- tone_notes
- default_hashtags
- created_at

### draft_posts

- id
- brand_id
- title
- template
- headline
- body
- footer_cta
- caption
- hashtags
- alt_text
- image_path
- status: draft / approved / rejected / sent_to_buffer / published
- scheduled_for
- buffer_update_id
- created_at
- updated_at

### content_ideas

- id
- brand_id
- idea
- pillar
- status: new / drafted / used / rejected
- created_at

### content_library

- id
- brand_id
- original_post_id
- caption
- image_path
- pillar
- notes
- performance_notes
- created_at

## Workflow v1

```text
1. Add or generate ideas
2. Generate draft posts from ideas
3. Render images using existing post builder logic
4. Review in dashboard
5. Approve, edit, or reject
6. Push approved item to Buffer as a draft
7. Final publish/schedule from Buffer
```

## Approval rules

The system should never publish directly in v1.

Allowed actions:

- Save draft locally
- Render image locally
- Send to Buffer as draft

Not allowed in v1:

- Direct publish without review
- Auto-DM users
- Auto-follow users
- Auto-comment on posts

## Buffer integration

Target behaviour:

- Use Buffer API to create draft posts.
- Store Buffer IDs back against the local draft post.
- Keep Buffer as the final scheduling and publishing interface.

This keeps the risk low and gives Ben / Olivia a familiar final approval step.

## UI v1

Pages:

- Dashboard
- Brands
- Ideas
- Draft posts
- Review post
- Content library
- Settings

Review screen should show:

- Generated image
- Caption
- Hashtags
- Alt text
- Scheduled date
- Brand
- Buttons: Approve, Reject, Edit, Send to Buffer Draft

## Image rendering

Reuse the current HTML canvas post builder.

v1 options:

- Keep manual single-post builder.
- Add JSON import.
- Add batch render from `posts.json`.

v2 options:

- Server-side render with Playwright.
- Export all generated images into `/generated`.
- Allow carousel generation.

## Recommended build sequence

### Mode 1 — Repo tidy and docs

- Add `/docs` folder.
- Capture plan and architecture.
- Add README describing purpose.

### Mode 2 — Batch content files

- Define `posts.json` format.
- Update builder to load a JSON file.
- Generate multiple images without manually editing fields each time.

### Mode 3 — Local app

- Add Docker Compose.
- Add SQLite DB.
- Add brands and draft posts.
- Add basic approval dashboard.

### Mode 4 — Buffer draft integration

- Add Buffer credentials via environment variables.
- Send approved posts to Buffer as drafts.
- Store returned Buffer IDs.

### Mode 5 — Content library

- Save approved/published posts.
- Tag by pillar.
- Use previous content to inspire future posts.

## First useful milestone

A locally hosted dashboard where Ben or Olivia can:

1. Select a brand.
2. Generate 5 draft post ideas.
3. Review rendered posts.
4. Approve the good ones.
5. Send approved posts to Buffer drafts.

That is enough. Do not overbuild before this works.
