import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { CampaignDomainValidationError, validateGeneratedCampaign } from "../src/features/campaigns/domain-validation.ts";
import { createCampaignId, createDraftPostId, createGenerationAttemptId, createSubmissionKey, newOpaqueId } from "../src/features/campaigns/ids.ts";
import { brandPackSchema, campaignInputSchema, generatedCampaignSchema, generatedSlideSchema } from "../src/features/campaigns/schemas.ts";
import { SLIDE_COPY_LIMITS, type BrandPack, type GeneratedCampaign } from "../src/features/campaigns/types.ts";

const rawPack = JSON.parse(await readFile(resolve("brands/record/brand.json"), "utf8"));
const brandPack: BrandPack = brandPackSchema.parse(rawPack);
const massagePack: BrandPack = brandPackSchema.parse(JSON.parse(await readFile(resolve("brands/massage/brand.json"), "utf8")));
const slide = (ordinal: number, role: "standalone" | "cover" | "content" | "action", headline: string, footer: string | null = null) => ({ ordinal, role, visualTemplate: role === "action" ? "action" as const : "useful-point" as const, headline, body: role === "cover" ? null : "One useful detail for a calmer working week.", emphasis: null, footer, photoAssetId: ordinal === 1 ? "dog-portrait-one" : null, altText: `Wolds Record slide: ${headline}` });
function validCampaign(): GeneratedCampaign {
  return { campaignTitle: "A calmer working week", posts: [
    { format: "image", objective: "awareness", pillar: "record-keeping", proposedDate: "2026-09-10", engagementIntent: "save", contentStructure: "checklist", engagementCta: "Save this for the next working week", instagramCaption: "Three useful details to keep close when planning the week.", facebookCaption: "A practical checklist for canine therapy record keeping.", hashtags: ["caninemassage", "caninetherapy", "woldsrecord"], slides: [slide(0, "standalone", "Three details worth keeping close", "Save this for the next working week")] },
    { format: "carousel", objective: "engagement", pillar: "therapist-workflow", proposedDate: "2026-09-12", engagementIntent: "comment", contentStructure: "question", engagementCta: "What would you make simpler first?", instagramCaption: "A four-slide prompt about calmer practitioner admin.", facebookCaption: "Which record-keeping task would you simplify first in your workflow?", hashtags: ["caninemassage", "caninetherapy", "woldsrecord"], slides: [slide(0, "cover", "Which admin task takes too much time?"), slide(1, "content", "1. Notice the repeated step"), slide(2, "content", "2. Choose one useful change"), slide(3, "action", "What would you simplify first?", "What would you make simpler first?")] },
  ] };
}

test("the portrait brand pack parses and references existing assets", async () => {
  assert.equal(brandPack.visualStyle.aspectRatio, "portrait");
  assert.deepEqual(brandPack.visualStyle.canvas, { width: 1080, height: 1350 });
  assert.deepEqual(brandPack.staticTemplates, ["bold-hook", "photo-led", "useful-point", "contrast", "human-prompt", "action"]);
  for (const asset of [brandPack.logo, ...brandPack.photoAssets]) await assert.doesNotReject(readFile(resolve(asset.path)));
  assert.equal(brandPackSchema.safeParse({ ...rawPack, photoAssets: [{ id: "unsafe-photo", path: "../private.png", label: "Unsafe" }] }).success, false);
});

test("campaign input requires format preference and validates date order", () => {
  const parsed = campaignInputSchema.parse({ submissionKey: "9b3f5433-e352-4bda-9436-b7b1f2c98477", brandId: "record", formatPreference: "auto", brief: "  Create two calm posts about clearer record keeping.  ", postCount: "2", startDate: "2026-09-10", endDate: "2026-09-12" });
  assert.equal(parsed.formatPreference, "auto");
  assert.equal(campaignInputSchema.safeParse({ ...parsed, endDate: "2026-09-09" }).success, false);
  const missing = { ...parsed } as Record<string, unknown>; delete missing.formatPreference;
  assert.equal(campaignInputSchema.safeParse(missing).success, false);
});

test("portrait copy limits accept their readable boundary and reject overflow", () => {
  const boundary = {
    ...slide(0, "standalone", "h".repeat(SLIDE_COPY_LIMITS.headline), "f".repeat(SLIDE_COPY_LIMITS.footer)),
    body: "b".repeat(SLIDE_COPY_LIMITS.body),
  };
  assert.equal(generatedSlideSchema.safeParse(boundary).success, true);
  for (const field of ["headline", "body", "footer"] as const) {
    const limit = SLIDE_COPY_LIMITS[field];
    assert.equal(generatedSlideSchema.safeParse({ ...boundary, [field]: "x".repeat(limit + 1) }).success, false);
  }
});

test("domain IDs remain opaque and namespaced", () => {
  assert.match(createCampaignId(), /^cmp_[0-9a-f-]{36}$/); assert.match(createDraftPostId(), /^post_[0-9a-f-]{36}$/); assert.match(createGenerationAttemptId(), /^att_[0-9a-f-]{36}$/); assert.match(createSubmissionKey(), /^[0-9a-f-]{36}$/); assert.match(newOpaqueId("slide"), /^slide_[0-9a-f-]{36}$/);
});

test("generated schema enforces strict ordered format-specific slides", () => {
  const campaign = validCampaign(); assert.equal(generatedCampaignSchema.safeParse(campaign).success, true);
  const broken = structuredClone(campaign); broken.posts[1]!.slides[1]!.ordinal = 4;
  assert.equal(generatedCampaignSchema.safeParse(broken).success, false);
  assert.equal(generatedCampaignSchema.safeParse({ ...campaign, unexpected: true }).success, false);
});

test("domain validation accepts a preference-compatible campaign", () => {
  const campaign = validCampaign(); assert.deepEqual(validateGeneratedCampaign(campaign, { requestedPostCount: 2, startDate: "2026-09-10", endDate: "2026-09-12", brandPack, formatPreference: "auto" }), campaign);
});

test("all five intent CTAs are semantic and the final visual carries the exact CTA", () => {
  const cases = [
    ["save", "checklist", "Save this checklist for later"],
    ["send", "workflow", "Send this to a colleague planning the same workflow"],
    ["comment", "question", "What would you simplify first?"],
    ["follow", "point-of-view", "Follow for more practical record ideas"],
    ["enquire", "point-of-view", brandPack.callsToAction[0]!],
  ] as const;
  for (const [intent, structure, cta] of cases) {
    const post = structuredClone(validCampaign().posts[0]!);
    post.engagementIntent = intent;
    post.contentStructure = structure;
    post.engagementCta = cta;
    post.slides[0]!.footer = cta;
    assert.doesNotThrow(() => validateGeneratedCampaign({ campaignTitle: "Intent", posts: [post] }, { requestedPostCount: 1, startDate: post.proposedDate, endDate: post.proposedDate, brandPack, formatPreference: "image" }), intent);
    post.engagementCta = "Learn more";
    post.slides[0]!.footer = "Learn more";
    assert.throws(() => validateGeneratedCampaign({ campaignTitle: "Intent", posts: [post] }, { requestedPostCount: 1, startDate: post.proposedDate, endDate: post.proposedDate, brandPack, formatPreference: "image" }), CampaignDomainValidationError);
  }
  const mismatch = structuredClone(validCampaign());
  mismatch.posts[0]!.slides[0]!.footer = "Save a different thing";
  assert.throws(() => validateGeneratedCampaign(mismatch, { requestedPostCount: 2, startDate: "2026-09-10", endDate: "2026-09-12", brandPack, formatPreference: "auto" }), CampaignDomainValidationError);

  const massage = structuredClone(validCampaign().posts[0]!);
  massage.pillar = massagePack.contentPillars[0]!;
  massage.engagementIntent = "comment";
  massage.contentStructure = "question";
  massage.engagementCta = "Tell us about your dog's condition?";
  massage.slides[0]!.footer = massage.engagementCta;
  assert.throws(() => validateGeneratedCampaign({ campaignTitle: "Privacy", posts: [massage] }, { requestedPostCount: 1, startDate: massage.proposedDate, endDate: massage.proposedDate, brandPack: massagePack, formatPreference: "image" }), CampaignDomainValidationError);
});

test("domain validation rejects wrong formats, assets, duplicate slides, unsafe copy and incompatible intent", () => {
  const campaign = validCampaign();
  campaign.posts[0]!.slides[0]!.photoAssetId = "unreviewed-photo";
  campaign.posts[0]!.instagramCaption = campaign.posts[0]!.facebookCaption;
  campaign.posts[1]!.slides[1]!.headline = campaign.posts[1]!.slides[0]!.headline;
  campaign.posts[1]!.contentStructure = "workflow";
  campaign.posts[1]!.engagementCta = "Tell us your dog's diagnosis?";
  campaign.posts[1]!.slides[2]!.body = "Use assets/photos/unreviewed.png";
  assert.throws(() => validateGeneratedCampaign(campaign, { requestedPostCount: 2, startDate: "2026-09-10", endDate: "2026-09-12", brandPack, formatPreference: "image" }), (error: unknown) => {
    assert.ok(error instanceof CampaignDomainValidationError); const codes = new Set(error.issues.map((issue) => issue.code));
    for (const code of ["asset_not_allowed", "captions_not_distinct", "duplicate_slide", "intent_structure_mismatch", "intent_cta_invalid", "path_not_allowed", "format_not_allowed"]) assert.equal(codes.has(code as never), true, String(code));
    return true;
  });
});
