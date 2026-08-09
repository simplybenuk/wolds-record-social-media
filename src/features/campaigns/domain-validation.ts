import { generatedCampaignSchema } from "./schemas.ts";
import type {
  BrandPack,
  GeneratedCampaign,
  GeneratedPost,
} from "./types.ts";

export const DOMAIN_ISSUE_CODES = [
  "invalid_shape",
  "post_count",
  "date_out_of_range",
  "date_order",
  "pillar_not_allowed",
  "template_not_allowed",
  "asset_not_allowed",
  "hashtag_not_normalized",
  "duplicate_hashtag",
  "emphasis_missing",
  "duplicate_headline",
  "captions_not_distinct",
  "url_not_allowed",
  "path_not_allowed",
] as const;

export type DomainIssueCode = (typeof DOMAIN_ISSUE_CODES)[number];

export type DomainIssue = {
  code: DomainIssueCode;
  path: Array<string | number>;
  message: string;
};

export type GeneratedCampaignContext = {
  requestedPostCount: number;
  startDate: string;
  endDate: string;
  brandPack: BrandPack;
};

export class CampaignDomainValidationError extends Error {
  readonly issues: DomainIssue[];

  constructor(issues: DomainIssue[]) {
    super("Generated campaign failed domain validation.");
    this.name = "CampaignDomainValidationError";
    this.issues = issues;
  }
}

export function validateGeneratedCampaign(
  input: unknown,
  context: GeneratedCampaignContext,
): GeneratedCampaign {
  const parsed = generatedCampaignSchema.safeParse(input);
  if (!parsed.success) {
    throw new CampaignDomainValidationError(
      parsed.error.issues.map((issue) => ({
        code: "invalid_shape",
        path: issue.path.map((part) => String(part)),
        message: issue.message,
      })),
    );
  }

  const campaign = parsed.data;
  const issues: DomainIssue[] = [];

  if (campaign.posts.length !== context.requestedPostCount) {
    issues.push({
      code: "post_count",
      path: ["posts"],
      message: "Generated post count must match the requested post count.",
    });
  }

  validatePosts(campaign.posts, context, issues);
  validateUnsafeText(campaign, issues);

  if (issues.length > 0) {
    throw new CampaignDomainValidationError(issues);
  }

  return campaign;
}

export function normalizeHashtag(value: string): string {
  return value.trim().replace(/^#+/, "").toLowerCase();
}

export function normalizeHeadline(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function validatePosts(
  posts: GeneratedPost[],
  context: GeneratedCampaignContext,
  issues: DomainIssue[],
): void {
  const allowedPillars = new Set(context.brandPack.contentPillars);
  const allowedTemplates = new Set(context.brandPack.staticTemplates);
  const allowedAssets = new Set(
    context.brandPack.photoAssets.map((asset) => asset.id),
  );
  const headlines = new Map<string, number>();
  let precedingDate: string | undefined;

  posts.forEach((post, index) => {
    const basePath = ["posts", index];

    if (
      post.proposedDate < context.startDate ||
      post.proposedDate > context.endDate
    ) {
      issues.push({
        code: "date_out_of_range",
        path: [...basePath, "proposedDate"],
        message: "Proposed date must be inside the campaign date range.",
      });
    }

    if (precedingDate !== undefined && post.proposedDate < precedingDate) {
      issues.push({
        code: "date_order",
        path: [...basePath, "proposedDate"],
        message: "Posts must be in nondecreasing proposed-date order.",
      });
    }
    precedingDate = post.proposedDate;

    if (!allowedPillars.has(post.pillar)) {
      issues.push({
        code: "pillar_not_allowed",
        path: [...basePath, "pillar"],
        message: "Pillar is not allowed by the brand pack.",
      });
    }

    if (!allowedTemplates.has(post.visualTemplate)) {
      issues.push({
        code: "template_not_allowed",
        path: [...basePath, "visualTemplate"],
        message: "Template is not allowed by the brand pack.",
      });
    }

    if (post.photoAssetId !== null && !allowedAssets.has(post.photoAssetId)) {
      issues.push({
        code: "asset_not_allowed",
        path: [...basePath, "photoAssetId"],
        message: "Photo asset is not allowed by the brand pack.",
      });
    }

    const normalizedHashtags = post.hashtags.map(normalizeHashtag);
    post.hashtags.forEach((hashtag, hashtagIndex) => {
      if (hashtag !== normalizeHashtag(hashtag)) {
        issues.push({
          code: "hashtag_not_normalized",
          path: [...basePath, "hashtags", hashtagIndex],
          message:
            "Hashtags must be lowercase, trimmed and omit the leading hash symbol.",
        });
      }
    });

    if (new Set(normalizedHashtags).size !== normalizedHashtags.length) {
      issues.push({
        code: "duplicate_hashtag",
        path: [...basePath, "hashtags"],
        message: "Hashtags must be unique after normalization.",
      });
    }

    if (
      post.emphasis !== null &&
      !post.headline.toLocaleLowerCase("en-GB").includes(
        post.emphasis.toLocaleLowerCase("en-GB"),
      )
    ) {
      issues.push({
        code: "emphasis_missing",
        path: [...basePath, "emphasis"],
        message: "Emphasis must occur in the headline.",
      });
    }

    const headline = normalizeHeadline(post.headline);
    const earlierHeadline = headlines.get(headline);
    if (earlierHeadline !== undefined) {
      issues.push({
        code: "duplicate_headline",
        path: [...basePath, "headline"],
        message:
          "Headline duplicates post " + String(earlierHeadline + 1) + ".",
      });
    } else {
      headlines.set(headline, index);
    }

    if (
      normalizeChannelCopy(post.instagramCaption) ===
      normalizeChannelCopy(post.facebookCaption)
    ) {
      issues.push({
        code: "captions_not_distinct",
        path: [...basePath, "facebookCaption"],
        message: "Instagram and Facebook captions must be distinct.",
      });
    }
  });
}

function normalizeChannelCopy(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function validateUnsafeText(
  campaign: GeneratedCampaign,
  issues: DomainIssue[],
): void {
  const values: Array<{
    value: string;
    path: Array<string | number>;
  }> = [{ value: campaign.campaignTitle, path: ["campaignTitle"] }];

  campaign.posts.forEach((post, index) => {
    const fields = [
      "headline",
      "body",
      "footer",
      "instagramCaption",
      "facebookCaption",
      "altText",
    ] as const;
    fields.forEach((field) => {
      values.push({ value: post[field], path: ["posts", index, field] });
    });
    if (post.emphasis !== null) {
      values.push({
        value: post.emphasis,
        path: ["posts", index, "emphasis"],
      });
    }
  });

  values.forEach(({ value, path }) => {
    if (containsUrl(value)) {
      issues.push({
        code: "url_not_allowed",
        path,
        message: "Generated text must not contain a URL.",
      });
    }
    if (containsFilesystemPath(value)) {
      issues.push({
        code: "path_not_allowed",
        path,
        message: "Generated text must not contain a filesystem path.",
      });
    }
  });
}

function containsUrl(value: string): boolean {
  return /(?:https?:\/\/|www\.)/i.test(value);
}

function containsFilesystemPath(value: string): boolean {
  return /(?:^|[\s("' ])(?:\/|\.{1,2}\/|[a-z]:\\|assets\/|generated\/)[^\s]*/i.test(
    value,
  );
}
