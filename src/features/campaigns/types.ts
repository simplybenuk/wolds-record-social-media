/* Storage/typing vocabulary for brand IDs. A brand is only *selectable* when a
   pack for it exists on disk — see enabledBrandPacks() in src/lib/brand/packs.ts.
   Widening this list does not by itself enable a brand in the UI. */
export const BRAND_IDS = ["record", "massage", "academy"] as const;

/* Legacy posts.json `brand` values mapped to pack IDs. Pack IDs and legacy
   values are related by this explicit table, not by string coincidence. */
export const LEGACY_BRAND_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "wolds-record": "record",
  "wolds-canine-massage": "massage",
  "wolds-canine-therapy-academy": "academy",
});
export const CAMPAIGN_OBJECTIVES = [
  "education",
  "awareness",
  "trust",
  "product",
  "engagement",
] as const;
/* The union of every pack's pillars, used for typing and storage. A pack
   declares its own subset; packs may legitimately share no pillars at all. */
export const CONTENT_PILLARS = [
  "therapist-workflow",
  "record-keeping",
  "vet-communication",
  "product-update",
  "founder-journey",
  "admin-pain",
  "dog-wellbeing",
  "massage-education",
  "appointment-care",
  "veterinary-communication",
  "aftercare",
  "practitioner-story",
  "course-education",
  "learner-support",
  "canine-wellbeing",
  "practitioner-development",
  "owner-learning",
  "academy-story",
] as const;
export const VISUAL_TEMPLATES = ["problem", "feature", "hook", "cta"] as const;
export const GENERATION_MODES = ["live", "fixture"] as const;
export const CAMPAIGN_STATUSES = ["pending", "review", "failed"] as const;
export const REVIEW_STATUSES = ["draft", "approved", "rejected"] as const;
export const RENDER_STATUSES = ["pending", "rendering", "ready", "failed"] as const;
export const ATTEMPT_KINDS = ["campaign", "post_regeneration"] as const;
export const ATTEMPT_STATUSES = [
  "pending",
  "running",
  "complete",
  "failed",
] as const;

export type BrandId = (typeof BRAND_IDS)[number];
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];
export type ContentPillar = (typeof CONTENT_PILLARS)[number];
export type VisualTemplate = (typeof VISUAL_TEMPLATES)[number];
export type GenerationMode = (typeof GENERATION_MODES)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type RenderStatus = (typeof RENDER_STATUSES)[number];
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type CampaignId = string & { readonly __brand: "CampaignId" };
export type DraftPostId = string & { readonly __brand: "DraftPostId" };
export type GenerationAttemptId = string & {
  readonly __brand: "GenerationAttemptId";
};
export type SubmissionKey = string & { readonly __brand: "SubmissionKey" };

export type PhotoAsset = {
  id: string;
  path: string;
  label: string;
};

export type BrandPack = {
  version: string;
  id: BrandId;
  displayName: string;
  purpose: string;
  targetAudience: string[];
  tone: string[];
  preferredWording: string[];
  confirmedProductFacts: string[];
  contentPillars: ContentPillar[];
  callsToAction: string[];
  defaultHashtags: string[];
  prohibitedClaims: string[];
  fabricationRules: string[];
  links: Array<{ id: string; label: string; url: string }>;
  instagramHandle: string;
  logo: { id: string; path: string; altText: string };
  photoRightsNotice: string;
  photoAssets: PhotoAsset[];
  staticTemplates: VisualTemplate[];
  visualStyle: {
    palette: {
      paper: string;
      ink: string;
      inkSoft: string;
      accent: string;
      deep: string;
    };
    headlineFont: string;
    bodyFont: string;
    imageOpacity: number;
    safeMode: "airy";
    aspectRatio: "square";
  };
};

export type GeneratedPost = {
  objective: CampaignObjective;
  pillar: ContentPillar;
  proposedDate: string;
  visualTemplate: VisualTemplate;
  headline: string;
  emphasis: string | null;
  body: string;
  footer: string;
  instagramCaption: string;
  facebookCaption: string;
  hashtags: string[];
  altText: string;
  photoAssetId: string | null;
};

export type GeneratedCampaign = {
  campaignTitle: string;
  posts: GeneratedPost[];
};

export type CampaignInput = {
  submissionKey: SubmissionKey;
  brandId: BrandId;
  brief: string;
  postCount: number;
  startDate: string;
  endDate: string;
};

export type EditablePost = GeneratedPost & {
  version: number;
};
