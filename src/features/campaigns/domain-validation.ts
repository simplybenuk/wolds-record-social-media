import { generatedCampaignSchema } from "./schemas.ts";
import type { BrandPack, FormatPreference, GeneratedCampaign, GeneratedPost } from "./types.ts";

export const DOMAIN_ISSUE_CODES = [
  "invalid_shape", "post_count", "date_out_of_range", "date_order",
  "pillar_not_allowed", "template_not_allowed", "asset_not_allowed",
  "format_not_allowed", "intent_structure_mismatch", "intent_cta_invalid",
  "hashtag_not_normalized", "duplicate_hashtag", "emphasis_missing",
  "duplicate_headline", "duplicate_slide", "captions_not_distinct",
  "url_not_allowed", "path_not_allowed",
] as const;
export type DomainIssueCode = (typeof DOMAIN_ISSUE_CODES)[number];
export type DomainIssue = { code: DomainIssueCode; path: Array<string | number>; message: string };
export type GeneratedCampaignContext = {
  requestedPostCount: number;
  startDate: string;
  endDate: string;
  brandPack: BrandPack;
  formatPreference?: FormatPreference;
  fixedFormat?: GeneratedPost["format"];
  fixedSlideCount?: number;
};

export class CampaignDomainValidationError extends Error {
  constructor(readonly issues: DomainIssue[]) {
    super("Generated campaign failed domain validation.");
    this.name = "CampaignDomainValidationError";
  }
}

export function normalizeHashtag(value: string) {
  return value.trim().replace(/^#+/, "").toLowerCase();
}
export function normalizeHeadline(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateGeneratedCampaign(input: unknown, context: GeneratedCampaignContext): GeneratedCampaign {
  const parsed = generatedCampaignSchema.safeParse(input);
  if (!parsed.success) {
    throw new CampaignDomainValidationError(parsed.error.issues.map((issue) => ({
      code: "invalid_shape", path: issue.path.map(String), message: issue.message,
    })));
  }
  const campaign = parsed.data;
  const issues: DomainIssue[] = [];
  if (campaign.posts.length !== context.requestedPostCount) {
    issues.push({ code: "post_count", path: ["posts"], message: "Generated post count must match the requested post count." });
  }
  validatePosts(campaign.posts, context, issues);
  validateUnsafeText(campaign, issues);
  if (issues.length) throw new CampaignDomainValidationError(issues);
  return campaign;
}

const reusableStructures = new Set(["checklist", "signs", "mistakes", "workflow"]);

function validatePosts(posts: GeneratedPost[], context: GeneratedCampaignContext, issues: DomainIssue[]) {
  const allowedPillars = new Set(context.brandPack.contentPillars);
  const allowedTemplates = new Set(context.brandPack.staticTemplates);
  const allowedAssets = new Set(context.brandPack.photoAssets.map((asset) => asset.id));
  const postHeadlines = new Map<string, number>();
  let precedingDate: string | undefined;

  posts.forEach((post, index) => {
    const base = ["posts", index] as Array<string | number>;
    if (post.proposedDate < context.startDate || post.proposedDate > context.endDate) {
      issues.push({ code: "date_out_of_range", path: [...base, "proposedDate"], message: "Proposed date must be inside the campaign date range." });
    }
    if (precedingDate && post.proposedDate < precedingDate) {
      issues.push({ code: "date_order", path: [...base, "proposedDate"], message: "Posts must be in nondecreasing proposed-date order." });
    }
    precedingDate = post.proposedDate;
    if (!allowedPillars.has(post.pillar)) issues.push({ code: "pillar_not_allowed", path: [...base, "pillar"], message: "Pillar is not allowed by the brand pack." });
    const preference = context.formatPreference;
    if ((preference && preference !== "auto" && post.format !== preference) || (context.fixedFormat && post.format !== context.fixedFormat)) {
      issues.push({ code: "format_not_allowed", path: [...base, "format"], message: "Resolved format does not match the persisted campaign or post format." });
    }
    if (context.fixedSlideCount !== undefined && post.slides.length !== context.fixedSlideCount) {
      issues.push({ code: "format_not_allowed", path: [...base, "slides"], message: "Regeneration must preserve the slide count." });
    }
    if (post.engagementIntent === "save" && !reusableStructures.has(post.contentStructure)) {
      issues.push({ code: "intent_structure_mismatch", path: [...base, "contentStructure"], message: "Save intent requires reusable reference value." });
    }
    if (post.engagementIntent === "comment" && post.contentStructure !== "question") {
      issues.push({ code: "intent_structure_mismatch", path: [...base, "contentStructure"], message: "Comment intent requires a specific safe question." });
    }
    if (post.engagementIntent === "save" && !/(save|bookmark|keep|refer back|return to)/i.test(post.engagementCta)) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "engagementCta"], message: "Save intent must state a concrete reusable save action." });
    }
    if (post.engagementIntent === "follow" && (!/follow/i.test(post.engagementCta) || !/(more|for|updates|tips|guidance|ideas)/i.test(post.engagementCta))) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "engagementCta"], message: "Follow intent must state a follow action and the future value offered." });
    }
    if (post.engagementIntent === "send" && (!/(send|share)/i.test(post.engagementCta) || !/(someone|colleague|owner|practitioner|friend|person|team)/i.test(post.engagementCta))) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "engagementCta"], message: "Send intent must identify a recipient or shared situation." });
    }
    if (post.engagementIntent === "comment" && (!/\?|comment|tell us|share your/i.test(post.engagementCta) || /diagnos|symptom|clinical|medical|condition|injur|your dog|dog's/i.test(post.engagementCta))) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "engagementCta"], message: "Comment CTA must be answerable without personal or clinical disclosure." });
    }
    if (post.engagementIntent === "enquire" && !context.brandPack.callsToAction.includes(post.engagementCta)) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "engagementCta"], message: "Enquiry CTA must be approved by the brand pack." });
    }
    const finalSurface = post.slides.at(-1)?.footer;
    if (finalSurface !== post.engagementCta) {
      issues.push({ code: "intent_cta_invalid", path: [...base, "slides", post.slides.length - 1, "footer"], message: "The final visual surface must present the post CTA exactly." });
    }
    const tags = post.hashtags.map(normalizeHashtag);
    post.hashtags.forEach((tag, tagIndex) => {
      if (tag !== normalizeHashtag(tag)) issues.push({ code: "hashtag_not_normalized", path: [...base, "hashtags", tagIndex], message: "Hashtags must be lowercase, trimmed and omit the leading hash symbol." });
    });
    if (new Set(tags).size !== tags.length) issues.push({ code: "duplicate_hashtag", path: [...base, "hashtags"], message: "Hashtags must be unique after normalization." });
    if (normalizeHeadline(post.instagramCaption) === normalizeHeadline(post.facebookCaption)) issues.push({ code: "captions_not_distinct", path: [...base, "facebookCaption"], message: "Instagram and Facebook captions must be distinct." });

    const cover = normalizeHeadline(post.slides[0]!.headline);
    const earlier = postHeadlines.get(cover);
    if (earlier !== undefined) issues.push({ code: "duplicate_headline", path: [...base, "slides", 0, "headline"], message: `Headline duplicates post ${earlier + 1}.` });
    else postHeadlines.set(cover, index);
    const slideHeadlines = new Set<string>();
    post.slides.forEach((slide, slideIndex) => {
      const path = [...base, "slides", slideIndex] as Array<string | number>;
      if (!allowedTemplates.has(slide.visualTemplate)) issues.push({ code: "template_not_allowed", path: [...path, "visualTemplate"], message: "Template is not allowed by the brand pack." });
      if (slide.photoAssetId && !allowedAssets.has(slide.photoAssetId)) issues.push({ code: "asset_not_allowed", path: [...path, "photoAssetId"], message: "Photo asset is not allowed by the brand pack." });
      if (slide.emphasis && !slide.headline.toLocaleLowerCase("en-GB").includes(slide.emphasis.toLocaleLowerCase("en-GB"))) issues.push({ code: "emphasis_missing", path: [...path, "emphasis"], message: "Emphasis must occur in the headline." });
      const normalized = normalizeHeadline(slide.headline);
      if (slideHeadlines.has(normalized)) issues.push({ code: "duplicate_slide", path: [...path, "headline"], message: "Slides must not restate the cover or one another." });
      slideHeadlines.add(normalized);
    });
  });
}

function validateUnsafeText(campaign: GeneratedCampaign, issues: DomainIssue[]) {
  const values: Array<{ value: string; path: Array<string | number> }> = [{ value: campaign.campaignTitle, path: ["campaignTitle"] }];
  campaign.posts.forEach((post, index) => {
    (["engagementCta", "instagramCaption", "facebookCaption"] as const).forEach((field) => values.push({ value: post[field], path: ["posts", index, field] }));
    post.slides.forEach((slide, slideIndex) => {
      (["headline", "body", "emphasis", "footer", "altText"] as const).forEach((field) => {
        if (slide[field]) values.push({ value: slide[field]!, path: ["posts", index, "slides", slideIndex, field] });
      });
    });
  });
  values.forEach(({ value, path }) => {
    if (/(?:https?:\/\/|www\.)/i.test(value)) issues.push({ code: "url_not_allowed", path, message: "Generated text must not contain a URL." });
    if (/(?:^|[\s("' ])(?:\/|\.{1,2}\/|[a-z]:\\|assets\/|generated\/)[^\s]*/i.test(value)) issues.push({ code: "path_not_allowed", path, message: "Generated text must not contain a filesystem path." });
  });
}
