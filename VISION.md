# Product vision

This is not a generic social media manager.

This is a **private AI-assisted content studio for the Wolds family of businesses**.

**Wolds Social Studio** helps Ben and Olivia (family business owners) create, review, schedule and publish consistent Facebook and Instagram content across three related brands, with minimal ongoing effort.

The three brands serve different audiences:

| Brand                        | Audience                                 | Purpose                                                                |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Wolds Canine Massage         | Local dog owners and veterinary contacts | Promote Olivia’s clinical massage services and build trust             |
| Wolds Canine Therapy Academy | Dog owners and aspiring practitioners    | Promote courses, workshops and education                               |
| Wolds Record                 | Canine and animal therapy practitioners  | Promote software for managing clients, animals, treatments and reports |

Wolds Canine Massage is Olivia’s practitioner clinic, focused on canine mobility, health and wellbeing. ([woldscaninemassage.co.uk][1])

The Academy provides science-led training, including courses for dog owners and people developing therapeutic skills. ([woldscanine.com][2])

Wolds Record is the software arm and should be able to target a wider practitioner market, including massage, rehabilitation, hydrotherapy and related animal-therapy disciplines. ([woldsrecord.com[[3])

## User experience

The primary interface is a responsive local web app, mainly used from your phones.

The normal workflow should be:

```text
Choose brand
↓
Describe what you want to promote
↓
Choose number of posts and date range
↓
AI creates campaign
↓
Review visual and caption previews
↓
Edit or regenerate anything weak
↓
Approve
↓
Schedule to Facebook and Instagram
↓
App publishes and reports results
```

A typical brief might be:

> Create six posts for Wolds Canine Massage over the next three weeks. Include one client education post, one Olivia-focused post, one appointment promotion and three evergreen wellbeing tips.

The app then creates:

* post concepts
* captions
* hashtags
* image or Reel content
* channel-specific variants
* suggested dates and times
* calls to action
* alt text

The important word is **campaign**, not individual post. Creating posts one by one is still admin wearing an AI hat.

## Product principles

### Private by default

* Runs on your home server
* Accessible over the home network (potentially using Tailscale for validating user access, and also for accessing remotely)
* No public application login page
* Only you and Olivia use it
* No roles or permissions system

### Local-first

Keep locally:

* application
* database
* uploaded assets
* brand assets
* generated media
* content history
* scheduling worker
* AI prompt configuration

Use external services only where genuinely necessary:

* OpenAI API for content generation
* Meta APIs for Facebook and Instagram publishing
* temporary public media hosting where Meta requires it

### Brand-controlled AI

AI should not invent the brand every time.

Each brand has a fixed internal configuration containing:

* purpose
* audience
* tone
* services and products
* prohibited claims
* preferred wording
* calls to action
* logo
* colours
* fonts
* image treatments
* reusable photographs
* default hashtags
* website links

This can initially be stored in code or configuration files. You do not need a sprawling “brand administration system” just to change the shade of green twice a decade.

### Human approval before publishing

Automation should create and schedule content, but nothing should publish without approval.

Later, you could allow approved recurring evergreen campaigns to run automatically, but that is not the starting point.

## Target stack

### Application

* **Next.js**
* **TypeScript**
* **React**
* **Tailwind**
* responsive mobile-first interface

Next.js is slightly more than the existing static editor needs, but appropriate for the application you now want: UI, server routes, database access, jobs and authentication boundaries in one codebase.

### Database

* **SQLite**
* **Drizzle ORM**

SQLite is enough for:

* two users
* three brands
* hundreds or thousands of posts
* local scheduled jobs
* publication history

There is no reason to introduce hosted Postgres here.

### Media generation

Retain what already works:

* Playwright for static graphics
* HyperFrames for generated Reels
* FFmpeg for video processing
* existing templates and validation

The repo already supports image and Reel generation, public media upload, post validation and Buffer draft creation.

### AI

* OpenAI Responses API
* structured JSON outputs
* one campaign-generation service
* brand context supplied on every generation

The AI output should follow a defined schema rather than returning a charming wall of prose.

Example:

```json
{
  "campaignTitle": "Autumn mobility awareness",
  "posts": [
    {
      "brandId": "massage",
      "objective": "education",
      "format": "image",
      "headline": "Is your dog slowing down?",
      "instagramCaption": "...",
      "facebookCaption": "...",
      "visualTemplate": "educational-tip",
      "scheduledDate": "2026-09-10"
    }
  ]
}
```

### Publishing

* Meta Graph API
* separate Facebook and Instagram publication records
* local background worker
* temporary Cloudinary hosting initially

Cloudinary is already integrated. Keep it at first. Removing Buffer and Cloudinary simultaneously would create needless integration roulette.

Cloudinary could later be replaced with a small public object-storage bucket or signed delivery mechanism, but your home server cannot directly provide Meta with private network files.

### Deployment

* Docker Compose
* app container
* worker container
* SQLite volume
* local media volume
* automatic restart
* nightly backup

```text
Home server
├── social-studio-app
├── social-studio-worker
├── social-studio.sqlite
├── originals/
├── generated/
└── backups/
```

## Core application areas

### Create campaign

* choose brand
* write or dictate brief
* number of posts
* content period
* preferred formats
* generate campaign

### Review queue

Card-based mobile interface:

```text
Wolds Canine Massage
Instagram image

“Three signs your dog may be uncomfortable”

[Preview]

Edit
Regenerate
Approve
Reject
```

### Calendar

* combined view
* filter by brand
* filter by Facebook or Instagram
* drag or edit schedule
* identify gaps and clashes

### Content library

* drafts
* scheduled
* published
* failed
* reusable ideas
* duplicate or adapt previous content

### Brand packs

Initially managed as repository configuration:

```text
brands/
├── massage/
│   ├── brand.json
│   ├── prompt.md
│   └── assets/
├── academy/
└── record/
```

### System health

* Meta account connected
* OpenAI available
* worker running
* publishing failures
* token expiry
* Cloudinary status
* last backup

## What is explicitly out of scope

Do not build:

* public registration
* multiple organisations
* user roles
* billing
* client approval portals
* inbox or comment management
* detailed social analytics
* TikTok, LinkedIn or X
* general-purpose template design
* a Canva clone
* an AI chatbot wandering freely through the server

Those can all be future distractions.

## Potential Next step: architecture baseline

Before more code, create one concise document in the repo:

```text
docs/target-architecture.md
```

It should lock down:

* product vision
* users
* three brands
* core user journey
* scope and non-scope
* chosen stack
* system components
* data model
* publishing workflow
* security model
* delivery phases
* migration from the current scripts

Then the first coding milestone becomes unambiguous:

> Convert the existing Wolds Record post generator into a mobile-first, local Next.js application supporting three fixed brands, while preserving the existing image, Reel and Buffer pipelines.

That is the right next step. Do not start with Meta publishing. First turn the clever collection of scripts into the product you and Olivia will actually use.

[1]: https://woldscaninemassage.co.uk/ "Wolds Canine Massage Therapy"
[2]: https://woldscanine.com/all-courses/?utm_source=chatgpt.com "Courses – Wolds Canine Therapy Academy"
[3]: https://www.woldsrecord.com/ "Wolds Record"
