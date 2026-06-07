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
- buffer_post_id
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

- Use Buffer's GraphQL API to create draft posts.
- Store Buffer IDs back against the local draft post.
- Keep Buffer as the final scheduling and publishing interface.

This keeps the risk low and gives Ben / Olivia a familiar final approval step.

Current API notes:

- Endpoint: `https://api.buffer.com`
- Draft creation: `createPost(input: { ..., saveToDraft: true })`
- Images/videos are not uploaded directly to Buffer.
- Media must be available at a public URL and passed through the current `assets` array format, for example:

```json
{
  "assets": [
    {
      "image": {
        "url": "https://public-host.example.com/post.png"
      }
    }
  ]
}
```

This means local generated images need a publishing step before image posts can be sent to Buffer. Good options are Cloudinary or a public Cloudflare R2 bucket. Tailscale-only hosting is still suitable for the private review app, but Buffer will not be able to fetch media from it.

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

v0 options:

- Keep manual single-post builder.
- Add JSON import.
- Use `posts.example.json` / `posts.json` as the shared draft source.
- Send approved text or image drafts to Buffer from a small Node script.

v1 options:

- Add batch render from `posts.json`.
- Store generated images in `/generated`.
- Add public media upload step before Buffer image drafts.

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

Initial implementation:

- `posts.example.json` defines the draft post format.
- `instagram.html` can load a JSON file and populate the existing canvas controls.
- `scripts/create-buffer-draft.mjs` can send a selected JSON post to Buffer as a draft.
- `scripts/create-buffer-draft.mjs --write-back` can record `bufferPostId`, `sentToBufferAt`, and `sent_to_buffer` status.
- `scripts/check-posts.mjs` reports which posts are ready, blocked, or already sent.
- `scripts/mark-post-status.mjs` can manually update status for posts already handled outside the script.
- `scripts/render-post.mjs` renders a selected post from `posts.json` through Playwright and the existing canvas builder.
- `scripts/upload-cloudinary.mjs` uploads rendered PNGs to Cloudinary and can write `publicImageUrl` back to `posts.json`.
- `scripts/prepare-post.mjs` wraps render + upload + JSON write-back.
- `scripts/process-posts.mjs` batch prepares and/or sends multiple posts, with `--limit` and `--dry-run` support.
- `instagram.html` supports JSON-backed review/edit/save for post copy, captions, hashtags, alt text, `logoPath`, and `photoPath`.
- `.env.example` documents the required Buffer API settings.

Suggested manual v0 workflow:

```text
1. Copy posts.example.json to posts.json
2. Edit captions, hashtags, and post fields
3. Open instagram.html
4. Load posts.json
5. Select a post and download the PNG
6. Upload/rendered PNG to a public media host
7. Add the public URL to publicImageUrl
8. Run scripts/create-buffer-draft.mjs for the approved post
9. Final scheduling/publishing happens inside Buffer
```

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
