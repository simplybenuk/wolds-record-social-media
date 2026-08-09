# Human output testing: Wolds Record campaign review slice

- **Status:** NOT EXECUTED
- **Spec:** `plans/specs/wolds-record-campaign-review-slice.md`
- **Prepared:** 2026-08-04
- **Required operator:** Ben or Olivia

## Preconditions

- Work from the `feature/wolds-record-campaign-review-slice` checkout.
- Run `npm install`, `npm run build`, and `npm start`.
- Confirm any selected photo assets are owned or licensed for Wolds Record use before publication outside this slice.
- For the bounded live check only, configure server-only `OPENAI_API_KEY`, `OPENAI_MODEL`, and `GENERATION_MODE=live`. Do not record credentials here.

## Required checks

| Check | Expected result | Human result / notes |
| --- | --- | --- |
| Phone creation | At 390×844, create a 3-post fixture campaign without clipping or horizontal scroll | NOT EXECUTED |
| Brand quality | All three visuals and both channel captions feel suitable for Wolds Record; no invented product, clinical, statistical, or testimonial claim | NOT EXECUTED |
| Durable review | Reload the campaign URL, edit one draft, approve one, reject one, and confirm the states survive another reload | NOT EXECUTED |
| Regeneration | Regenerate one draft; identity/date remain stable, content materially changes, revision increases, and a new preview appears | NOT EXECUTED |
| Live Structured Output | Create one bounded live campaign; generation completes using the configured model and no unsafe or fabricated copy appears | NOT EXECUTED |
| Publication isolation | Confirm the application offers no upload, Buffer, Meta, scheduling, or publish control | NOT EXECUTED |

## Acceptance

- **Verdict:** PENDING HUMAN TESTING
- Record the model identifier used for the live check, but never the API key.
- Any copy or visual-quality concern is a product finding even when automated validation is green.
