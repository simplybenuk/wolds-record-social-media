import { z } from "zod";

import {
  BRAND_IDS,
  CAMPAIGN_OBJECTIVES,
  CONTENT_STRUCTURES,
  CONTENT_PILLARS,
  ENGAGEMENT_INTENTS,
  FORMAT_PREFERENCES,
  POST_FORMATS,
  SLIDE_ROLES,
  VISUAL_TEMPLATES,
  SLIDE_COPY_LIMITS,
  type BrandPack,
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
    formatPreference: z.enum(FORMAT_PREFERENCES),
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

export const generatedSlideSchema = z
  .object({
    ordinal: z.number().int().min(0).max(6),
    role: z.enum(SLIDE_ROLES),
    visualTemplate: z.enum(VISUAL_TEMPLATES),
    headline: z.string().trim().min(1).max(SLIDE_COPY_LIMITS.headline),
    body: z.string().trim().min(1).max(SLIDE_COPY_LIMITS.body).nullable(),
    emphasis: z.string().trim().min(1).max(50).nullable(),
    footer: z.string().trim().min(1).max(SLIDE_COPY_LIMITS.footer).nullable(),
    photoAssetId: nonBlankTextSchema.nullable(),
    altText: z.string().trim().min(1).max(500),
  })
  .strict();

function validatePostStructure(post: { format: "image" | "carousel"; slides: Array<{ ordinal: number; role: string }> }, context: z.RefinementCtx) {
    if (post.format === "image" && post.slides.length !== 1) {
      context.addIssue({ code: "custom", path: ["slides"], message: "An image must contain exactly one slide." });
    }
    if (post.format === "carousel" && (post.slides.length < 3 || post.slides.length > 7)) {
      context.addIssue({ code: "custom", path: ["slides"], message: "A carousel must contain three to seven slides." });
    }
    post.slides.forEach((slide, index) => {
      const expected = post.format === "image" ? "standalone" : index === 0 ? "cover" : index === post.slides.length - 1 ? "action" : "content";
      if (slide.ordinal !== index) context.addIssue({ code: "custom", path: ["slides", index, "ordinal"], message: "Slide ordinals must be contiguous from zero." });
      if (slide.role !== expected) context.addIssue({ code: "custom", path: ["slides", index, "role"], message: `Expected ${expected} slide role.` });
    });
}

const generatedPostBaseSchema = z
  .object({
    format: z.enum(POST_FORMATS),
    objective: z.enum(CAMPAIGN_OBJECTIVES),
    pillar: z.enum(CONTENT_PILLARS),
    proposedDate: isoDateSchema,
    engagementIntent: z.enum(ENGAGEMENT_INTENTS),
    contentStructure: z.enum(CONTENT_STRUCTURES),
    engagementCta: z.string().trim().min(1).max(140),
    instagramCaption: nonBlankTextSchema,
    facebookCaption: nonBlankTextSchema,
    hashtags: z.array(normalizedHashtagSchema).min(3).max(8),
    slides: z.array(generatedSlideSchema).min(1).max(7),
  })
  .strict();

export const generatedPostSchema = generatedPostBaseSchema.superRefine(validatePostStructure);

export const generatedCampaignSchema = z
  .object({
    campaignTitle: nonBlankTextSchema,
    posts: z.array(generatedPostSchema).min(1).max(6),
  })
  .strict();

/**
 * Structured Outputs must receive the selected brand's pillar enum rather than
 * the union used for persistence and post-parse validation.
 */
export function generatedCampaignSchemaForPack(
  pack: Pick<BrandPack, "contentPillars" | "staticTemplates" | "photoAssets">,
) {
  const pillars = pack.contentPillars as [string, ...string[]];
  const templates = pack.staticTemplates as [string, ...string[]];
  const assetIds = pack.photoAssets.map((asset) => asset.id) as [string, ...string[]];
  const slideSchema = generatedSlideSchema.extend({
    visualTemplate: z.enum(templates),
    photoAssetId: z.enum(assetIds).nullable(),
  }).strict();
  const postSchema = z.object({
    ...generatedPostBaseSchema.shape,
    pillar: z.enum(pillars),
    slides: z.array(slideSchema).min(1).max(7),
  }).strict().superRefine(validatePostStructure);
  return z.object({
    campaignTitle: nonBlankTextSchema,
    posts: z.array(postSchema).min(1).max(6),
  }).strict();
}

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
        aspectRatio: z.literal("portrait"),
        canvas: z.object({ width: z.literal(1080), height: z.literal(1350) }).strict(),
        photoTreatments: z.array(z.enum(["full-bleed", "split", "framed", "none"])).min(3),
      })
      .strict(),
    legacyVisualStyle: z
      .object({
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
    addDuplicateIssues(pack.visualStyle.photoTreatments, ["visualStyle", "photoTreatments"], context);

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
