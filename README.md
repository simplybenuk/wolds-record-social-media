# Wolds Record — Initial Instagram Content Plan

## Automation v0

This repo now supports a lightweight draft pipeline:

```text
posts.json
↓
instagram.html renders the image locally
↓
Ben / Olivia review and download PNG
↓
publicImageUrl is added once the PNG is hosted publicly
↓
scripts/create-buffer-draft.mjs sends the approved post to Buffer as a draft
```

### Local builder

Open `instagram.html` in a browser, choose **Load posts JSON**, and select `posts.example.json` or your own `posts.json`.

The selected post populates the existing canvas controls. You can still edit fields manually before downloading the PNG.

For Chrome-based browsers, use **Open editable JSON** to open `posts.json` with write access. Then you can:

- cycle posts with Previous / Next
- edit headline, body, footer, caption, hashtags, alt text, logo path, and optional image path
- click **Save current post** to update the in-memory JSON
- click **Save posts.json** to write back to disk

If the browser does not support direct file saving, **Save posts.json** downloads an updated JSON file instead.

Store reusable visual assets in:

```text
assets/logos/
assets/photos/
```

Then reference them from a post:

```json
"logoPath": "assets/logos/wolds-record.png",
"photoPath": "assets/photos/therapy-session.jpg"
```

### Buffer draft script

Copy `.env.example` to `.env` and fill in:

```text
BUFFER_API_KEY=...
BUFFER_CHANNEL_ID=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Install the local Node dependency for Playwright rendering:

```bash
npm install
```

The render script uses `/usr/bin/google-chrome` by default. Override it if needed:

```text
PLAYWRIGHT_CHROME_PATH=/path/to/chrome
```

Create your working content file:

```bash
cp posts.example.json posts.json
```

Find your real Buffer channel ID:

```bash
node scripts/list-buffer-channels.mjs
```

Use the `id=...` value for the Instagram channel as `BUFFER_CHANNEL_ID`. This is not the Instagram handle.

Dry-run a post before sending anything to Buffer:

```bash
node scripts/create-buffer-draft.mjs posts.json wolds-record-004-workflow --dry-run
```

Send it to Buffer as a draft:

```bash
node scripts/create-buffer-draft.mjs posts.json wolds-record-004-workflow
```

Send it and record the returned Buffer post ID in `posts.json`:

```bash
node scripts/create-buffer-draft.mjs posts.json wolds-record-004-workflow --write-back
```

Check which posts are ready, blocked, or already sent:

```bash
node scripts/check-posts.mjs posts.json
```

Render, upload to Cloudinary, and update `posts.json` in one step:

```bash
node scripts/prepare-post.mjs posts.json wolds-record-005-dog-profile
```

Dry-run the Cloudinary step without uploading:

```bash
node scripts/prepare-post.mjs posts.json wolds-record-005-dog-profile --dry-run
```

Run the steps separately if needed:

```bash
node scripts/render-post.mjs posts.json wolds-record-005-dog-profile
node scripts/upload-cloudinary.mjs posts.json wolds-record-005-dog-profile --write-back
```

Process multiple posts at once:

```bash
node scripts/process-posts.mjs posts.json --prepare --limit=10
node scripts/process-posts.mjs posts.json --send-buffer --limit=10
```

Prepare and send in one run:

```bash
node scripts/process-posts.mjs posts.json --all --limit=10
```

Dry-run the batch flow first:

```bash
node scripts/process-posts.mjs posts.json --all --limit=10 --dry-run
```

Mark a post manually without sending anything to Buffer:

```bash
node scripts/mark-post-status.mjs posts.json wolds-record-004-workflow sent_to_buffer --buffer-post-id=BUFFER_POST_ID
```

If you do not know the Buffer post ID, you can omit `--buffer-post-id` and still mark the local status.

Buffer cannot fetch local files from `generated/`. For image posts, upload the PNG to a public media host first, then set `publicImageUrl` on the post.

Instagram-specific note: Buffer requires Instagram drafts to include at least one image or video and a post type. Use:

```json
"service": "instagram",
"instagramType": "post",
"publicImageUrl": "https://..."
```

---

Goal:
Make the account feel:
- active
- trustworthy
- niche-specific
- practitioner-built
- modern but calm

---

# Phase 1 — Foundation Posts

These make the profile look legitimate before outreach/following.

- [x] Post 1 — Intro / Hero graphic
  - Simple brand introduction
  - “Record keeping made for dogs. Not horses.”

- [x] Post 2 — Why we built Wolds Record
  - Therapist-focused positioning
  - Explain the niche problem

- [x] Post 3 — The admin chaos therapists deal with
  - Notes
  - PDFs
  - WhatsApp photos
  - spreadsheets
  - scattered records

- [ ] Post 4 — Real canine therapist workflow
  - Explain Olivia’s workflow
  - “Built alongside real practice”

- [ ] Post 5 — Dog profile screenshot
  - Show clean dog record interface
  - Keep UI minimal

- [ ] Post 6 — Session notes screenshot
  - Show progression tracking
  - Highlight simplicity

- [ ] Post 7 — Vet-ready reports
  - Show report preview
  - Focus on professionalism

- [ ] Post 8 — Why canine therapists get overlooked
  - Positioning piece
  - Explain “horse-first” software issue

- [ ] Post 9 — Built in public
  - Explain you're building alongside therapists
  - Invite feedback

---

# Phase 2 — Trust & Education

These build authority and engagement.

- [ ] Common mistakes in canine therapy record keeping
- [ ] Why progress tracking matters
- [ ] What vets actually need in reports
- [ ] Why clean records improve professionalism
- [ ] How therapists currently manage records
- [ ] The problem with paper notes
- [ ] Before vs after organised workflows
- [ ] What should be included in a session note?
- [ ] Why canine-only matters
- [ ] Calm software > complicated software

---

# Phase 3 — Human / Behind-the-scenes

These make the brand feel real.

- [ ] Meet Olivia
- [ ] Behind the scenes building Wolds Record
- [ ] Testing features with real cases
- [ ] Design decisions we're making
- [ ] “What therapists told us”
- [ ] Small wins / progress updates
- [ ] Workspace / dev setup
- [ ] Why we care about this niche

---

# Phase 4 — Engagement Posts

Designed for saves/comments/shares.

- [ ] “What’s your biggest admin frustration?”
- [ ] Poll: paper vs digital notes
- [ ] “How long do your vet reports take?”
- [ ] Therapist confession posts
- [ ] “What feature would save you time?”
- [ ] Myth-busting posts
- [ ] Carousel tips for therapists
- [ ] Mini workflow breakdowns

---

# Phase 5 — Reels (Important)

Instagram heavily pushes reels.

Keep low-production and authentic.

- [ ] Quick walkthrough of Wolds Record
- [ ] Creating a session note in 30 seconds
- [ ] Generating a vet report
- [ ] Before/after workflow comparison
- [ ] Olivia using the app
- [ ] Screen recording + voiceover
- [ ] “Day in the life” therapist clips
- [ ] Build-in-public updates

---

# Posting Notes

## Style
- Minimal
- Calm
- Professional
- Lots of whitespace
- Avoid loud “marketing” energy

## Visual Rules
- Forest green accents
- Warm neutral backgrounds
- Natural dog imagery
- Clean typography
- No overcrowded slides

## Caption Style
- Short paragraphs
- Practitioner-focused
- No corporate jargon
- No fake hustle/startup tone

## Hashtags
Keep to 5–10 relevant tags max.

Examples:
#caninemassage
#caninetherapy
#dogrehabilitation
#dogphysio
#caninebodywork

---

# Initial Target

Before serious outreach:
- 9–12 posts
- 1–2 reels
- complete bio
- story highlights setup

Then:
Begin following and engaging with therapists consistently.
