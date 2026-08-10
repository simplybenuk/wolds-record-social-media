import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  CampaignDomainValidationError,
  validateGeneratedCampaign,
} from "../src/features/campaigns/domain-validation.ts";
import {
  createCampaignId,
  createDraftPostId,
  createGenerationAttemptId,
  createSubmissionKey,
  newOpaqueId,
} from "../src/features/campaigns/ids.ts";
import {
  brandPackSchema,
  campaignInputSchema,
  generatedCampaignSchema,
} from "../src/features/campaigns/schemas.ts";
import type {
  BrandPack,
  GeneratedCampaign,
} from "../src/features/campaigns/types.ts";

const rawPack = JSON.parse(
  await readFile(resolve("brands/record/brand.json"), "utf8"),
);
const brandPack: BrandPack = brandPackSchema.parse(rawPack);

function validCampaign(): GeneratedCampaign {
  return {
    campaignTitle: "A calmer working week",
    posts: [
      {
        objective: "awareness",
        pillar: "record-keeping",
        proposedDate: "2026-09-10",
        visualTemplate: "problem",
        headline: "Scattered notes make the story harder to follow",
        emphasis: "Scattered",
        body: "Clear records make it easier to return to the useful context.",
        footer: "Follow along as we build Wolds Record",
        instagramCaption:
          "When notes are scattered, returning to the useful context can take longer. Wolds Record is being built for calmer record keeping.",
        facebookCaption:
          "Canine therapy records often connect dogs, owners and sessions. Wolds Record is being built to keep that context clearer.",
        hashtags: [
          "caninemassage",
          "caninetherapy",
          "woldsrecord",
          "dogrehabilitation",
        ],
        altText:
          "Wolds Record graphic about keeping canine therapy notes clear.",
        photoAssetId: "dog-portrait-one",
      },
      {
        objective: "engagement",
        pillar: "therapist-workflow",
        proposedDate: "2026-09-12",
        visualTemplate: "cta",
        headline: "Which admin task would you make calmer?",
        emphasis: "calmer",
        body: "Share the record-keeping task that takes too much of your week.",
        footer: "Tell us what would save you time",
        instagramCaption:
          "Canine therapists: which record-keeping task would you make calmer first? Tell us what would save you time.",
        facebookCaption:
          "We would like to understand which record-keeping tasks create the most friction for canine therapists. What would you simplify first?",
        hashtags: [
          "caninemassage",
          "caninetherapy",
          "woldsrecord",
          "caninebodywork",
        ],
        altText:
          "Wolds Record question graphic asking practitioners about admin.",
        photoAssetId: null,
      },
    ],
  };
}

test("the fixed Wolds Record pack parses and references existing draft assets", async () => {
  assert.equal(brandPack.id, "record");
  assert.deepEqual(brandPack.staticTemplates, [
    "problem",
    "feature",
    "hook",
    "cta",
  ]);
  assert.match(brandPack.photoRightsNotice, /human must confirm/i);
  assert.equal(
    brandPack.photoAssets.some((asset) => asset.path.includes("cp17")),
    false,
  );
  assert.equal(
    brandPack.photoAssets.some((asset) =>
      asset.path.includes("wolds-record-dashboard"),
    ),
    false,
  );

  for (const asset of [brandPack.logo, ...brandPack.photoAssets]) {
    await assert.doesNotReject(readFile(resolve(asset.path)));
  }

  assert.equal(
    brandPackSchema.safeParse({
      ...rawPack,
      photoAssets: [
        { id: "unsafe-photo", path: "../private.png", label: "Unsafe" },
      ],
    }).success,
    false,
  );
});

test("campaign input validates trimming, idempotency key, count and date order", () => {
  const parsed = campaignInputSchema.parse({
    submissionKey: "9b3f5433-e352-4bda-9436-b7b1f2c98477",
    brandId: "record",
    brief:
      "  Create two calm posts about clearer record keeping for therapists.  ",
    postCount: "2",
    startDate: "2026-09-10",
    endDate: "2026-09-12",
  });

  assert.equal(parsed.brief.startsWith("Create"), true);
  assert.equal(parsed.postCount, 2);
  assert.equal(
    campaignInputSchema.safeParse({ ...parsed, endDate: "2026-09-09" })
      .success,
    false,
  );
  assert.equal(
    campaignInputSchema.safeParse({ ...parsed, startDate: "2026-02-30" })
      .success,
    false,
  );
});

test("domain IDs are opaque, namespaced and unique", () => {
  const campaignIds = [createCampaignId(), createCampaignId()];
  assert.match(campaignIds[0], /^cmp_[0-9a-f-]{36}$/);
  assert.notEqual(campaignIds[0], campaignIds[1]);
  assert.match(createDraftPostId(), /^post_[0-9a-f-]{36}$/);
  assert.match(createGenerationAttemptId(), /^att_[0-9a-f-]{36}$/);
  assert.match(createSubmissionKey(), /^[0-9a-f-]{36}$/);
  assert.match(newOpaqueId("att"), /^att_[0-9a-f-]{36}$/);
});

test("generated schema is strict and requires normalized hashtags", () => {
  const campaign = validCampaign();
  assert.equal(generatedCampaignSchema.safeParse(campaign).success, true);
  assert.equal(
    generatedCampaignSchema.safeParse({
      ...campaign,
      unexpected: "not allowed",
    }).success,
    false,
  );

  const withHash = structuredClone(campaign);
  withHash.posts[0].hashtags[0] = "#caninemassage";
  assert.equal(generatedCampaignSchema.safeParse(withHash).success, false);
});

test("domain validation accepts a complete campaign within its bounds", () => {
  const campaign = validCampaign();
  assert.deepEqual(
    validateGeneratedCampaign(campaign, {
      requestedPostCount: 2,
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      brandPack,
    }),
    campaign,
  );
});

test("domain validation reports allow-list, uniqueness and channel-copy failures", () => {
  const campaign = validCampaign();
  campaign.posts[0].photoAssetId = "unreviewed-photo";
  campaign.posts[0].instagramCaption = campaign.posts[0].facebookCaption;
  campaign.posts[1].headline =
    "  SCATTERED   NOTES MAKE THE STORY HARDER TO FOLLOW ";
  campaign.posts[1].emphasis = "missing";
  campaign.posts[1].proposedDate = "2026-09-09";

  assert.throws(
    () =>
      validateGeneratedCampaign(campaign, {
        requestedPostCount: 2,
        startDate: "2026-09-10",
        endDate: "2026-09-12",
        brandPack,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CampaignDomainValidationError);
      const codes = new Set(error.issues.map((issue) => issue.code));
      assert.equal(codes.has("asset_not_allowed"), true);
      assert.equal(codes.has("captions_not_distinct"), true);
      assert.equal(codes.has("duplicate_headline"), true);
      assert.equal(codes.has("emphasis_missing"), true);
      assert.equal(codes.has("date_out_of_range"), true);
      assert.equal(codes.has("date_order"), true);
      return true;
    },
  );
});

test("domain validation rejects URLs and filesystem paths in generated text", () => {
  const campaign = validCampaign();
  campaign.posts[0].footer = "Visit https://example.com";
  campaign.posts[1].body = "Use assets/photos/unreviewed.png";

  assert.throws(
    () =>
      validateGeneratedCampaign(campaign, {
        requestedPostCount: 2,
        startDate: "2026-09-10",
        endDate: "2026-09-12",
        brandPack,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CampaignDomainValidationError);
      const codes = error.issues.map((issue) => issue.code);
      assert.equal(codes.includes("url_not_allowed"), true);
      assert.equal(codes.includes("path_not_allowed"), true);
      return true;
    },
  );
});
