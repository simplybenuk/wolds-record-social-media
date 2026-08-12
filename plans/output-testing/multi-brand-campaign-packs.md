# Human pack review and output testing: multi-brand campaign packs

- **Status:** READY FOR HUMAN TESTING
- **Spec:** `plans/specs/multi-brand-campaign-packs.md`
- **Prepared:** 2026-08-10
- **Required operators:** Ben or Olivia

## Pack review gate

The two pack inputs were reviewed and approved before development continued, as
reported by the project owner in the instruction to proceed with the next task.
The review uses public-site content as a drafting aid only; the prohibited-claim
lists are the safety boundary sent to the model.

### Wolds Canine Massage Therapy

Sources reviewed on 2026-08-10:

- https://woldscaninemassage.co.uk/about-us
- https://woldscaninemassage.co.uk/services
- https://woldscaninemassage.co.uk/faqs.html
- https://woldscaninemassage.co.uk/canine-massage-for-owners-courses

Confirmed pack facts are limited to the owner/operator, the published service
types and locations, the companion/working/sporting-dog audience, veterinary
communication, and the introductory course. Clinical diagnosis, treatment,
outcomes, named cases, qualifications, prices and availability remain prohibited.

Palette: `paper #F2F5EE`, `ink #263A2E`, `inkSoft #53655A`, `accent #B77B52`,
`deep #385933`. Contrast: ink on paper **11.04:1**; inkSoft on paper **5.65:1**.

Logo source: https://woldscaninemassage.co.uk/assets/images/wolds_canine_massage_logo_stacked.png

**Human approval:** approved to use this pack for bounded development and later
human output testing; publication rights for stock photos still require a
separate confirmation.

### Wolds Canine Therapy Academy

Sources reviewed on 2026-08-10:

- https://woldscanine.com/all-courses/
- https://woldscanine.com/
- https://woldscaninemassage.co.uk/canine-massage-for-owners-courses

Confirmed pack facts are limited to the published audience and course names,
including Intro to Canine Face Massage, Canine Massage at Home, Practitioner in
Canine Massage & Rehabilitation, and the partner Canine First Aid course. The
site uses accreditation language without naming an awarding body, so
accreditation, certification, career, income and qualification claims are
explicitly prohibited in the pack.

Palette: `paper #F5F0E5`, `ink #202D39`, `inkSoft #52606A`, `accent #C18749`,
`deep #234D5E`. Contrast: ink on paper **12.35:1**; inkSoft on paper **5.70:1**.

Logo source: https://woldscanine.com/wp-content/uploads/2025/07/CTA-Logo-only.svg

**Human approval:** approved to use this pack for bounded development and later
human output testing; publication rights for stock photos still require a
separate confirmation.

## Remaining human output checks

| Check | Expected result | Human result / notes |
| --- | --- | --- |
| Massage fixture campaign | 390×844 creation, review, edit, regenerate and reload work with Massage identity | PENDING |
| Academy fixture campaign | 390×844 creation, review, edit, regenerate and reload work with Academy identity | PENDING |
| Massage live generation | 1–3 posts are useful, safe, clinic-appropriate and contain no clinical or veterinary overclaim | PENDING |
| Academy live generation | 1–3 posts are useful, safe, course-appropriate and contain no accreditation or career overclaim | PENDING |
| Publication isolation | No Buffer, Cloudinary, Meta, scheduling or publishing action occurs | PENDING |

Record the model identifier used for live checks, never the API key. Confirm
photo rights before any output leaves the local review surface.
