export const BRAND_IDS = ["record"] as const;
export const CAMPAIGN_OBJECTIVES = [
  "education",
  "awareness",
  "trust",
  "product",
  "engagement",
] as const;
export const CONTENT_PILLARS = [
  "therapist-workflow",
  "record-keeping",
  "vet-communication",
  "product-update",
  "founder-journey",
  "admin-pain",
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
      forest: string;
      sand: string;
      navy: string;
      amber: string;
      sage: string;
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
