# Wolds Record — Initial Instagram Content Plan

## Wolds Social Studio — campaign review slice

The repository now includes a private, local Next.js application for creating and reviewing Instagram-first static campaigns for Wolds Record, Wolds Canine Massage Therapy, and Wolds Canine Therapy Academy. New campaigns can request an automatic mix, portrait images, or 3–7-slide carousels. Every post records an engagement intent and content structure, renders at 1080×1350, and remains one approve/reject unit. Campaigns, generation attempts, ordered slides, complete preview sets, edits, and decisions persist in SQLite. The studio does not upload, schedule, or publish anything.

Requirements: Node.js 22+, npm, and the Chromium installed for Playwright. Install dependencies and copy the environment template:

```bash
npm install
npx playwright-core install chromium
cp .env.example .env
```

Fixture mode is deterministic and makes no OpenAI request. Choose the brand and creative-format preference when creating a campaign; both are fixed for that campaign. The brand controls copy rules, pillars, logo, palette and photo allow-list. Automatic fixture campaigns with at least two posts deliberately include both an image and a carousel so the complete review flow remains testable:

```text
GENERATION_MODE=fixture
```

Start the local app, then open `http://127.0.0.1:3000/campaigns/new`:

```bash
npm run dev
```

For temporary access from a phone on the same trusted Wi-Fi network, build and
start the production server on all network interfaces:

```bash
npm run build
PORT=3011 npm run start:lan
```

Then open `http://<this-computer's-LAN-IP>:3011/campaigns/new` on the phone. Find
the LAN IP with `hostname -I` (currently `192.168.1.188`). Keep this local-only;
do not port-forward it to the public internet.

If something else on the machine already holds port 3000, choose another one and open the matching URL:

```bash
PORT=3101 npm run dev
```

For the bounded human live-generation checks, set `GENERATION_MODE=live`, `OPENAI_API_KEY`, and an `OPENAI_MODEL` that supports Responses API Structured Outputs. The server sends the brief and selected immutable brand pack with `store: false`; never prefix these settings with `NEXT_PUBLIC_`.

Local state lives in `data/social-studio.sqlite`; generated previews live under `generated/campaigns/`. Both are git-ignored. Ordered `draft_post_slides` rows are the canonical visual source; retained pre-slide post columns are immutable migration evidence. Preview sets become ready only after the exact expected files pass complete PNG chunk/CRC/image-data validation at 1080×1350, and approval requires that complete current set. A failed or stale replacement keeps the last complete set visible. Migrated historical square previews remain approvable at their original path only when the preserved 1080×1080 PNG is valid; they are never re-rendered implicitly. A generation or render left in progress for more than ten minutes is marked interrupted on the next campaign load and requires an explicit retry.

Validation:

```bash
npm run check
npm test
npm run posts:check
npm run lint:compositions
npm run build
# With the app already running:
npm run verify:mobile
```

`verify:mobile` drives an existing server rather than starting one; without a running app it fails with a locator timeout. If the app is not on the default port, point it at the right one:

```bash
APP_URL=http://127.0.0.1:3101 npm run verify:mobile
```

The legacy JSON, static-image, Reel, Cloudinary, and Buffer workflows below remain available and separate from this local approval surface.

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

## Automation v1 — Reels

The repo renders both static posts and vertical Reel videos from the same `posts.json`.

### Architecture

```text
posts.json record
↓
format: "image"                     format: "reel"
↓                                   ↓
instagram.html + Playwright         video/compositions/*.html + HyperFrames
↓ PNG                               ↓ MP4 (1080x1920)
↓                                   ↓
Cloudinary /image/upload            Cloudinary /video/upload
↓ publicImageUrl                    ↓ publicVideoUrl
↓                                   ↓
Buffer draft: assets[].image        Buffer draft: assets[].video
↓
Final scheduling and publishing happen inside Buffer. Nothing auto-publishes.
```

`format` is optional. **A record with no `format` is treated as a static image**, so every pre-existing post behaves exactly as before. The rule lives in one place: `resolveFormat()` in `scripts/lib/content.mjs`.

### Dependencies

- Node.js >= 22
- FFmpeg and FFprobe (HyperFrames requires them for encoding)
- Chrome headless shell (fetched by HyperFrames, separate from Playwright's Chromium)
- `hyperframes` (pinned dev dependency), `playwright-core`

### HyperFrames setup

```bash
npm install
npx hyperframes browser ensure   # fetch the Chrome headless shell
npx hyperframes doctor           # verify Node, FFmpeg and Chrome
```

`doctor` also reports optional whisper / TTS / MusicGen components. **These are not needed** — Reels are silent by design in this iteration.

Telemetry is disabled in this repo (`npx hyperframes telemetry disable`). It defaults to on and reports anonymous usage to HeyGen; re-enable with `telemetry enable` if you ever want it.

### Supported templates

| Template | Sequence | Required fields |
| --- | --- | --- |
| `three-point-tip` | hook → point 1 → point 2 → point 3 → branded CTA | exactly 3 `points` |
| `product-feature` | headline → screenshot(s) → benefit → branded CTA | 1+ `screenshots` (benefit uses `points[0]`) |
| `photo-story` | opening photo → 2–3 photo/caption scenes → closing slide | 2–3 `scenes` |

All render at 1080×1920, 30fps, in brand colours, with calm motion, generous whitespace, Instagram-safe margins, and no reliance on audio.

### Reel JSON

```json
{
  "id": "wolds-record-reel-001",
  "format": "reel",
  "service": "instagram",
  "instagramType": "reel",
  "status": "draft",
  "template": "three-point-tip",
  "kicker": "Wolds Record",
  "headline": "3 signs your client records are fighting you",
  "points": [
    "Notes live in several places",
    "Reports take hours",
    "Progress is hard to show"
  ],
  "cta": "Built for canine therapists",
  "photoPath": "assets/photos/dog-image.png",
  "logoPath": "assets/logos/wolds-record-logo-transparent-small.png",
  "duration": 12,
  "caption": "...",
  "hashtags": ["caninemassage"],
  "altText": "..."
}
```

`duration` is whole seconds, 3–90, defaulting to 12. `photo-story` uses `scenes: [{ "photoPath": "...", "caption": "..." }]` instead of `points`.

### Editing and previewing

Open `instagram.html`, load your JSON, and switch the format to **Reel**. You get template selection, Reel field editors, and a scaled preview with a scrubber and timeline showing true relative pacing. The browser cannot encode video — the editor shows the render command to copy.

For full-fidelity motion checking:

```bash
npx hyperframes preview
```

### Render and upload

```bash
node scripts/render-video.mjs posts.json wolds-record-reel-001
node scripts/prepare-video.mjs posts.json wolds-record-reel-001   # render + upload + write-back
```

Output goes to `generated/<id>.mp4`, with the resolved variables alongside it as `generated/<id>.variables.json` (useful when debugging a composition).

Batch processing routes automatically by format:

```bash
node scripts/process-posts.mjs posts.json --prepare --limit=10
node scripts/check-posts.mjs posts.json
```

### Buffer draft flow for Reels

A Reel needs `publicVideoUrl` before it can reach Buffer — Buffer fetches media over the public internet and cannot read `generated/`. The draft payload is:

```json
"assets": [{ "video": { "url": "https://...", "metadata": { "thumbnailOffset": 2000 } } }]
```

`thumbnailOffset` is the millisecond mark used for the Reel thumbnail (default 2000, overridable per post with `"thumbnailOffset"`). All three templates hold a settled opening frame at 2s.

**Feed sharing.** A Reel is also cross-posted to the main Instagram grid by default — this is a deliberate reach-over-curation choice for this account. Set `"shouldShareToFeed": false` on a post to keep that Reel in the Reels tab only. The value must be a real boolean; a string like `"false"` is rejected rather than quietly treated as true. `check-posts` prints the effective value as `shareToFeed=` on every Reel, so a defaulted `true` is never invisible. Instagram ignores the field on static image posts, where it is sent only to keep the pre-Reel payload unchanged.

```bash
node scripts/create-buffer-draft.mjs posts.json wolds-record-reel-001 --dry-run
node scripts/create-buffer-draft.mjs posts.json wolds-record-reel-001 --write-back
```

### Content rules for Reels

A Reel is rejected before rendering unless it has a `headline`, a `cta`, and the content its template needs: exactly 3 `points` for `three-point-tip`; at least one screenshot **and** a benefit statement in `points[0]` for `product-feature`; 2–3 `scenes`, each with both a `photoPath` and a `caption`, for `photo-story`.

This is deliberate. The compositions ship with placeholder copy for authoring, and an empty field used to leave that placeholder in the rendered video — a reel missing a caption would burn text the operator never wrote into a publishable MP4. Compositions now clear empty fields instead of falling back, and validation stops such a record reaching the renderer. If you see a blank slide, the content is missing; fill it in rather than working around it.

### Tests

```bash
npm test                    # schema, routing, filenames, validation, Buffer payloads,
                            # preview/render pacing parity, placeholder-content guards
npm run check               # syntax check of every script
npm run lint:compositions   # lint all three reel compositions
```

`npm run lint:compositions` exists because `hyperframes lint` takes a *project directory* containing an `index.html`. Pointed at this repo it reports "No composition found", scans zero files, and still returns `errorCount: 0` — which reads exactly like a pass. The script builds a proper harness per composition and fails loudly if nothing was scanned.

### Troubleshooting

- **`Cannot find /usr/bin/google-chrome`** when rendering a *static* post — set `PLAYWRIGHT_CHROME_PATH` to your Chrome/Chromium binary. This affects the PNG path only; Reel rendering uses HyperFrames' own Chrome.
- **`Variable "points" expected string, got array`** — the list fields cross into HyperFrames JSON-encoded because it has no array variable type. `reelVariables()` handles this; don't "simplify" it away.
- **Every Reel comes out 12s** — a composition has regained a static `data-duration`. It is read at compile time, before the `duration` variable applies. Remove it.
- **`JavaScript heap out of memory` during render** — raise the heap (`NODE_OPTIONS=--max-old-space-size=8192`) or pass `--workers 1`.
- **Composition not found** — `render-video.mjs` resolves `video/compositions/<template>.html`; the template name must match exactly.
- **Preview pacing disagrees with the MP4** — the weights in `buildScenes()` (`instagram.html`) and `video/compositions/*.html` have drifted apart. `npm test` guards this.

### Known limitations

- No audio, voiceover, or music. `audioPath` exists in the schema but is unused.
- `product-feature` has no real example: the repo contains no product screenshots, only logos and photos.
- Reels are silent-readable by design; there is no caption-burn-in or subtitle support.
- Rendering is local and single-machine: roughly 30s for a 12s Reel.
- Cloudinary video consumes credits far faster than images. Watch quota.
- The editor preview approximates layout; only the rendered MP4 is authoritative.

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
