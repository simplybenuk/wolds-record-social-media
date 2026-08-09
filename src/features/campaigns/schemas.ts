import { z } from "zod";

import {
  BRAND_IDS,
  CAMPAIGN_OBJECTIVES,
  CONTENT_PILLARS,
  VISUAL_TEMPLATES,
} from "./types.ts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NORMALIZED_HASHTAG_PATTERN = /^[a-z0-9][a-z0-9_]*$/;
const HEX_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const ASSET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_PATH_PATTERN = /^assets\/photos\/[A-Za-z0-9._-]+$/;
const LOGO_PATH_PATTERN = /^assets\/logos\/[A-Za-z0-9._-]+$/;

export const isoDateSchema = z.string().regex(ISO_DATE_PATTERN).refine(isCalendarDate, {
  message: "Expected a valid ISO calendar date.",
});

export const nonBlankTextSchema = z.string().trim().min(1);

export const normalizedHashtagSchema = z
  .string()
  .min(1)
  .regex(NORMALIZED_HASHTAG_PATTERN, {
    message: "Hashtags must be lowercase and omit the leading hash symbol.",
  });

export const campaignInputSchema = z
  .object({
    submissionKey: z.string().uuid(),
    brandId: z.enum(BRAND_IDS),
    brief: z.string().trim().min(20).max(2_000),
    postCount: z.coerce.number().int().min(1).max(6),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startDate > value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
    }
  });

export const generatedPostSchema = z
  .object({
    objective: z.enum(CAMPAIGN_OBJECTIVES),
    pillar: z.enum(CONTENT_PILLARS),
    proposedDate: isoDateSchema,
    visualTemplate: z.enum(VISUAL_TEMPLATES),
    headline: nonBlankTextSchema,
    emphasis: nonBlankTextSchema.nullable(),
    body: nonBlankTextSchema,
    footer: nonBlankTextSchema,
    instagramCaption: nonBlankTextSchema,
    facebookCaption: nonBlankTextSchema,
    hashtags: z.array(normalizedHashtagSchema).min(3).max(8),
    altText: nonBlankTextSchema,
    photoAssetId: nonBlankTextSchema.nullable(),
  })
  .strict();

export const generatedCampaignSchema = z
  .object({
    campaignTitle: nonBlankTextSchema,
    posts: z.array(generatedPostSchema).min(1).max(6),
  })
  .strict();

export const editablePostSchema = generatedPostSchema
  .extend({
    version: z.coerce.number().int().min(0),
  })
  .strict();

const photoAssetSchema = z
  .object({
    id: z.string().regex(ASSET_ID_PATTERN),
    path: z.string().regex(PHOTO_PATH_PATTERN),
    label: nonBlankTextSchema,
  })
  .strict();

export const brandPackSchema = z
  .object({
    version: nonBlankTextSchema,
    id: z.enum(BRAND_IDS),
    displayName: nonBlankTextSchema,
    purpose: nonBlankTextSchema,
    targetAudience: z.array(nonBlankTextSchema).min(1),
    tone: z.array(nonBlankTextSchema).min(1),
    preferredWording: z.array(nonBlankTextSchema).min(1),
    confirmedProductFacts: z.array(nonBlankTextSchema).min(1),
    contentPillars: z.array(z.enum(CONTENT_PILLARS)).min(1),
    callsToAction: z.array(nonBlankTextSchema).min(1),
    defaultHashtags: z.array(normalizedHashtagSchema).min(3).max(8),
    prohibitedClaims: z.array(nonBlankTextSchema).min(1),
    fabricationRules: z.array(nonBlankTextSchema).min(1),
    links: z
      .array(
        z
          .object({
            id: nonBlankTextSchema,
            label: nonBlankTextSchema,
            url: z.string().url(),
          })
          .strict(),
      )
      .min(1),
    instagramHandle: normalizedHashtagSchema,
    logo: z
      .object({
        id: z.string().regex(ASSET_ID_PATTERN),
        path: z.string().regex(LOGO_PATH_PATTERN),
        altText: nonBlankTextSchema,
      })
      .strict(),
    photoRightsNotice: nonBlankTextSchema,
    photoAssets: z.array(photoAssetSchema).min(1),
    staticTemplates: z.array(z.enum(VISUAL_TEMPLATES)).min(1),
    visualStyle: z
      .object({
        palette: z
          .object({
            paper: z.string().regex(HEX_COLOUR_PATTERN),
            ink: z.string().regex(HEX_COLOUR_PATTERN),
            inkSoft: z.string().regex(HEX_COLOUR_PATTERN),
            accent: z.string().regex(HEX_COLOUR_PATTERN),
            deep: z.string().regex(HEX_COLOUR_PATTERN),
          })
          .strict(),
        headlineFont: nonBlankTextSchema,
        bodyFont: nonBlankTextSchema,
        imageOpacity: z.number().int().min(0).max(100),
        safeMode: z.literal("airy"),
        aspectRatio: z.literal("square"),
      })
      .strict(),
  })
  .strict()
  .superRefine((pack, context) => {
    addDuplicateIssues(pack.photoAssets.map((asset) => asset.id), ["photoAssets"], context);
    addDuplicateIssues(pack.defaultHashtags, ["defaultHashtags"], context);
    addDuplicateIssues(pack.contentPillars, ["contentPillars"], context);
    addDuplicateIssues(pack.staticTemplates, ["staticTemplates"], context);

    /* A pack declares its own pillar allow-list. Membership of the global union
       is enforced by the z.enum(CONTENT_PILLARS) on the field itself; there is
       deliberately no assertion here that a pack allows *every* pillar. */

    if (
      VISUAL_TEMPLATES.some(
        (template) => !pack.staticTemplates.includes(template),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["staticTemplates"],
        message: "Brand pack must allow every static campaign template.",
      });
    }
  });

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDuplicateIssues(
  values: string[],
  path: Array<string | number>,
  context: z.RefinementCtx,
): void {
  const normalized = values.map((value) => value.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({
      code: "custom",
      path,
      message: "Values must be unique.",
    });
  }
}
