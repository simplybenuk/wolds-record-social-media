# Independent review: multi-brand campaign packs

- **Verdict:** READY FOR HUMAN TESTING
- **Reviewed:** 2026-08-10
- **Specification:** `plans/specs/multi-brand-campaign-packs.md`
- **Task record:** `plans/tasks/multi-brand-campaign-packs.md`
- **Review mode:** Fresh implementation, requirement, regression, safety-boundary and mobile-flow review

## Verdict

The approved Massage and Academy packs are wired through the campaign creation,
generation, validation, rendering and review loop. The implementation is ready for
human output testing. No live OpenAI, Buffer, Cloudinary or Meta call was made.

## Finding resolved during review

The legacy CLI path did not resolve a non-Record `brand` to pack identity when
palette/logo fields were absent; it would have rendered Record identity for a
Massage or Academy legacy post. `scripts/lib/legacy-brand.mjs` now applies the
selected pack, warns on stderr for unknown brands, and preserves explicit values
on existing Record records. `test/legacy-brand.test.mjs` covers selected-pack,
Record-regression and unknown-brand behavior. The three known Record render md5s
remain byte-identical.

No blocker or unresolved should-fix finding remains.

## Validation evidence

| Gate | Result |
| --- | --- |
| `npm run check` | pass |
| `npm test` | 63 legacy tests and 53 application tests pass |
| `npm run build` | pass; campaign routes and server/client boundary compile |
| `npm run posts:check` | 0 ready / 0 blocked / 20 sent; `posts.json` unchanged |
| `npm run lint:compositions` | 3 ok, 0 failed |
| Brand packs | all three load through one schema; assets readable; WCAG AA contrast passes |
| Fixture rendering | all three brands produce real 1080×1080 PNG previews |
| Mobile browser | Record, Massage and Academy each pass the 390×844 create/reload/edit/regenerate/review/recovery journey with no overflow or console errors |
| Browser smoke | creation page loads with no framework overlay and all three brands are present |

## Residual risks and human focus

- Run one bounded live generation for Massage and Academy and judge usefulness,
  factuality, tone, captions, hashtags, visual identity and safety.
- Confirm Massage output contains no clinical, veterinary, outcome or named-case
  claim; confirm Academy output contains no unconfirmed accreditation, career,
  price, date or qualification claim.
- Confirm selected photo rights before anything leaves the local review surface.
- The application remains loopback-bound and unauthenticated by design.
- Reel brand parameterisation remains deferred and is documented in the task plan.

Successful human output testing hands the accepted change to `bwh-archive-change`.
Any product or content finding returns it to `bwh-development`.
