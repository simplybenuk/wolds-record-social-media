import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { and, asc, desc, eq, lt } from "drizzle-orm";

import type { AppDatabase } from "@/db";
import { campaigns, draftPosts, draftPostSlides, generationAttempts } from "@/db/schema";
import type { CampaignRow, DraftPostRow, DraftPostSlideRow, GenerationAttemptRow } from "@/db/schema";
import { newOpaqueId } from "./ids";
import type { BrandId, FormatPreference, GeneratedCampaign, GeneratedPost } from "./types";
import { assertCompletePortraitSet, assertLegacySquarePng } from "@/lib/rendering/png-validation";

export const INTERRUPTED_AFTER_MS = 10 * 60 * 1000;

type NewCampaign = {
  submissionKey: string;
  requestKey: string;
  brief: string;
  postCount: number;
  startDate: string;
  endDate: string;
  generationMode: "fixture" | "live";
  model: string;
  brandPackVersion: string;
  brandId?: BrandId;
  formatPreference?: FormatPreference;
};

type Usage = {
  responseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type CampaignBundle = {
  campaign: CampaignRow;
  posts: Array<DraftPostRow & { slides: DraftPostSlideRow[] }>;
  attempts: GenerationAttemptRow[];
};

export function hasCompleteCurrentPreview(post: DraftPostRow & { slides: DraftPostSlideRow[] }) {
  const expectedCount = post.format === "image" ? 1 : post.slides.length;
  if (post.renderStatus !== "ready" || post.previewOutOfDate || expectedCount !== post.slides.length || !post.imagePath || post.imagePath !== post.slides[0]?.imagePath) return false;
  if (post.format === "carousel" && (expectedCount < 3 || expectedCount > 7)) return false;
  return post.slides.every((slide, index) => {
    const expectedRole = post.format === "image" ? "standalone" : index === 0 ? "cover" : index === expectedCount - 1 ? "action" : "content";
    return slide.ordinal === index && slide.role === expectedRole && slide.renderStatus === "ready" && !slide.previewOutOfDate && Boolean(slide.imagePath);
  });
}

export function isMigratedLegacySquare(post: DraftPostRow & { slides: DraftPostSlideRow[] }) {
  const expectedPath = `campaigns/${post.campaignId}/${post.id}.png`;
  return post.format === "image" && post.headline !== null && post.slides.length === 1 &&
    post.imagePath === expectedPath && post.slides[0]?.imagePath === expectedPath;
}

export function canApproveCurrentPreview(
  post: DraftPostRow & { slides: DraftPostSlideRow[] },
  mediaRoot = resolve(process.cwd(), "generated"),
) {
  if (!hasCompleteCurrentPreview(post)) return false;
  try {
    if (isMigratedLegacySquare(post)) assertLegacySquarePng(mediaRoot, post.imagePath!);
    else assertCompletePortraitSet(mediaRoot, post.slides.map((slide) => slide.imagePath!), post.slides.map((slide) => slide.ordinal));
    return true;
  } catch {
    return false;
  }
}

const now = () => new Date().toISOString();

function inTransaction<T>(database: AppDatabase, operation: () => T): T {
  database.client.exec("BEGIN IMMEDIATE");
  try {
    const value = operation();
    database.client.exec("COMMIT");
    return value;
  } catch (error) {
    database.client.exec("ROLLBACK");
    throw error;
  }
}

export function createPendingCampaign(database: AppDatabase, input: NewCampaign) {
  const existing = database.orm
    .select()
    .from(campaigns)
    .where(eq(campaigns.submissionKey, input.submissionKey))
    .get();
  if (existing) {
    const attempt = database.orm
      .select()
      .from(generationAttempts)
      .where(eq(generationAttempts.campaignId, existing.id))
      .orderBy(desc(generationAttempts.createdAt))
      .get();
    if (!attempt) throw new Error("campaign_attempt_missing");
    return { campaign: existing, attempt, duplicate: true as const };
  }

  const timestamp = now();
  const campaignId = newOpaqueId("cmp");
  const attemptId = newOpaqueId("att");
  return inTransaction(database, () => {
    database.orm.insert(campaigns).values({
      id: campaignId,
      submissionKey: input.submissionKey,
      brandId: input.brandId ?? "record",
      title: null,
      brief: input.brief,
      postCount: input.postCount,
      startDate: input.startDate,
      endDate: input.endDate,
      formatPreference: input.formatPreference ?? "image",
      status: "pending",
      generationMode: input.generationMode,
      model: input.model,
      safeErrorCode: null,
      safeErrorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run();
    database.orm.insert(generationAttempts).values({
      id: attemptId,
      requestKey: input.requestKey,
      campaignId,
      postId: null,
      kind: "campaign",
      mode: input.generationMode,
      model: input.model,
      inputSnapshot: JSON.stringify({
        promptHash: createHash("sha256").update(JSON.stringify({
          brandId: input.brandId ?? "record",
          brief: input.brief,
          postCount: input.postCount,
          startDate: input.startDate,
          endDate: input.endDate,
          formatPreference: input.formatPreference ?? "image",
        })).digest("hex"),
        postCount: input.postCount,
        startDate: input.startDate,
        endDate: input.endDate,
        formatPreference: input.formatPreference ?? "image",
      }),
      brandPackVersion: input.brandPackVersion,
      status: "pending",
      structuredResult: null,
      safeErrorCode: null,
      safeErrorMessage: null,
      openaiResponseId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      retryOfAttemptId: null,
      requestStartedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run();
    return {
      campaign: database.orm.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()!,
      attempt: database.orm.select().from(generationAttempts).where(eq(generationAttempts.id, attemptId)).get()!,
      duplicate: false as const,
    };
  });
}

export function claimGenerationAttempt(
  database: AppDatabase,
  attemptId: string,
  expected: { campaignId: string; kind: "campaign" | "post_regeneration"; postId: string | null },
) {
  const bound = database.orm.select().from(generationAttempts).where(and(
    eq(generationAttempts.id, attemptId),
    eq(generationAttempts.campaignId, expected.campaignId),
    eq(generationAttempts.kind, expected.kind),
  )).get();
  if (!bound || bound.postId !== expected.postId) return false;
  const timestamp = now();
  const result = database.orm
    .update(generationAttempts)
    .set({ status: "running", requestStartedAt: timestamp, updatedAt: timestamp })
    .where(and(
      eq(generationAttempts.id, attemptId),
      eq(generationAttempts.campaignId, expected.campaignId),
      eq(generationAttempts.kind, expected.kind),
      eq(generationAttempts.status, "pending"),
    ))
    .run();
  return result.changes === 1;
}

export function completeCampaignGeneration(
  database: AppDatabase,
  campaignId: string,
  attemptId: string,
  generated: GeneratedCampaign,
  usage: Usage = {},
) {
  const timestamp = now();
  inTransaction(database, () => {
    const campaign = database.orm.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
    if (!campaign) throw new Error("campaign_not_found");
    const attempt = database.orm
      .select()
      .from(generationAttempts)
      .where(and(
        eq(generationAttempts.id, attemptId),
        eq(generationAttempts.campaignId, campaignId),
        eq(generationAttempts.kind, "campaign"),
      ))
      .get();
    if (!attempt || attempt.postId !== null || attempt.status !== "running") {
      throw new Error("generation_attempt_not_running");
    }

    generated.posts.forEach((post, ordinal) => {
      const postId = newOpaqueId("post");
      database.orm.insert(draftPosts).values({
        id: postId,
        campaignId,
        ordinal,
        format: post.format,
        brandId: campaign.brandId,
        objective: post.objective,
        pillar: post.pillar,
        proposedDate: post.proposedDate,
        engagementIntent: post.engagementIntent,
        contentStructure: post.contentStructure,
        engagementCta: post.engagementCta,
        instagramCaption: post.instagramCaption,
        facebookCaption: post.facebookCaption,
        hashtags: JSON.stringify(post.hashtags),
        reviewStatus: "draft",
        renderStatus: "pending",
        imagePath: null,
        safeRenderErrorCode: null,
        safeRenderErrorMessage: null,
        previewOutOfDate: false,
        generationRevision: 1,
        latestGenerationAttemptId: attemptId,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).run();
      post.slides.forEach((slide) => database.orm.insert(draftPostSlides).values({
        id: newOpaqueId("slide"), postId, ...slide,
        renderStatus: "pending", imagePath: null,
        safeRenderErrorCode: null, safeRenderErrorMessage: null,
        previewOutOfDate: false, version: 1,
        createdAt: timestamp, updatedAt: timestamp,
      }).run());
    });

    database.orm.update(generationAttempts).set({
      status: "complete",
      structuredResult: JSON.stringify(generated),
      openaiResponseId: usage.responseId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      completedAt: timestamp,
      updatedAt: timestamp,
    }).where(eq(generationAttempts.id, attemptId)).run();
    database.orm.update(campaigns).set({
      title: generated.campaignTitle,
      status: "review",
      safeErrorCode: null,
      safeErrorMessage: null,
      updatedAt: timestamp,
    }).where(eq(campaigns.id, campaignId)).run();
  });
}

export function failGenerationAttempt(
  database: AppDatabase,
  campaignId: string,
  attemptId: string,
  error: { code: string; message: string },
  usage: Usage = {},
) {
  const timestamp = now();
  inTransaction(database, () => {
    const result = database.orm.update(generationAttempts).set({
      status: "failed",
      safeErrorCode: error.code,
      safeErrorMessage: error.message,
      openaiResponseId: usage.responseId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      completedAt: timestamp,
      updatedAt: timestamp,
    }).where(and(
      eq(generationAttempts.id, attemptId),
      eq(generationAttempts.campaignId, campaignId),
      eq(generationAttempts.kind, "campaign"),
      eq(generationAttempts.status, "running"),
    )).run();
    if (result.changes !== 1) throw new Error("generation_attempt_not_running");
    database.orm.update(campaigns).set({
      status: "failed",
      safeErrorCode: error.code,
      safeErrorMessage: error.message,
      updatedAt: timestamp,
    }).where(eq(campaigns.id, campaignId)).run();
  });
}

export function failPostRegenerationAttempt(
  database: AppDatabase,
  campaignId: string,
  postId: string,
  attemptId: string,
  error: { code: string; message: string },
  usage: Usage = {},
) {
  const timestamp = now();
  const result = database.orm.update(generationAttempts).set({
    status: "failed",
    safeErrorCode: error.code,
    safeErrorMessage: error.message,
    openaiResponseId: usage.responseId ?? null,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    completedAt: timestamp,
    updatedAt: timestamp,
  }).where(and(
    eq(generationAttempts.id, attemptId),
    eq(generationAttempts.campaignId, campaignId),
    eq(generationAttempts.postId, postId),
    eq(generationAttempts.kind, "post_regeneration"),
    eq(generationAttempts.status, "running"),
  )).run();
  if (result.changes !== 1) throw new Error("generation_attempt_not_running");
}

export function markInterruptedWork(database: AppDatabase, campaignId: string, at = new Date()) {
  const cutoff = new Date(at.getTime() - INTERRUPTED_AFTER_MS).toISOString();
  const timestamp = at.toISOString();
  const stale = database.orm.select().from(generationAttempts)
    .where(and(eq(generationAttempts.campaignId, campaignId), lt(generationAttempts.requestStartedAt, cutoff)))
    .all()
    .filter((attempt: GenerationAttemptRow) => attempt.status === "pending" || attempt.status === "running");
  const staleRenders = database.orm.select().from(draftPosts)
    .where(and(
      eq(draftPosts.campaignId, campaignId),
      lt(draftPosts.updatedAt, cutoff),
    ))
    .all()
    .filter((post: DraftPostRow) => post.renderStatus === "pending" || post.renderStatus === "rendering");
  if (stale.length === 0 && staleRenders.length === 0) return 0;
  inTransaction(database, () => {
    for (const attempt of stale) {
      database.orm.update(generationAttempts).set({
        status: "failed",
        safeErrorCode: "generation_interrupted",
        safeErrorMessage: "Generation was interrupted. Review the campaign and retry explicitly.",
        completedAt: timestamp,
        updatedAt: timestamp,
      }).where(eq(generationAttempts.id, attempt.id)).run();
    }
    if (stale.some((attempt: GenerationAttemptRow) => attempt.kind === "campaign")) {
      database.orm.update(campaigns).set({
        status: "failed",
        safeErrorCode: "generation_interrupted",
        safeErrorMessage: "Generation was interrupted. Retry when you are ready.",
        updatedAt: timestamp,
      }).where(eq(campaigns.id, campaignId)).run();
    }
    for (const post of staleRenders as DraftPostRow[]) {
      database.orm.update(draftPosts).set({
        renderStatus: "failed",
        previewOutOfDate: Boolean(post.imagePath),
        safeRenderErrorCode: "render_interrupted",
        safeRenderErrorMessage: "Preview rendering was interrupted. Retry rendering when you are ready.",
        updatedAt: timestamp,
      }).where(eq(draftPosts.id, post.id)).run();
      database.orm.update(draftPostSlides).set({
        renderStatus: "failed",
        previewOutOfDate: true,
        safeRenderErrorCode: "render_interrupted",
        safeRenderErrorMessage: "Preview rendering was interrupted. Retry rendering when you are ready.",
        updatedAt: timestamp,
      }).where(eq(draftPostSlides.postId, post.id)).run();
    }
  });
  return stale.length + staleRenders.length;
}

export function getCampaignBundle(database: AppDatabase, campaignId: string): CampaignBundle | null {
  markInterruptedWork(database, campaignId);
  const campaign = database.orm.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) return null;
  return {
    campaign,
    posts: database.orm.select().from(draftPosts)
      .where(eq(draftPosts.campaignId, campaignId))
      .orderBy(asc(draftPosts.proposedDate), asc(draftPosts.ordinal)).all()
      .map((post) => ({ ...post, slides: database.orm.select().from(draftPostSlides)
        .where(eq(draftPostSlides.postId, post.id)).orderBy(asc(draftPostSlides.ordinal)).all() })),
    attempts: database.orm.select().from(generationAttempts)
      .where(eq(generationAttempts.campaignId, campaignId))
      .orderBy(desc(generationAttempts.createdAt)).all(),
  };
}

export function listRecentCampaigns(database: AppDatabase, limit = 5) {
  return database.orm.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(limit).all();
}

export class StalePostVersionError extends Error {
  constructor() {
    super("This post changed since you opened it. Reload and try again.");
    this.name = "StalePostVersionError";
  }
}

export function updateDraftPost(
  database: AppDatabase,
  postId: string,
  expectedVersion: number,
  changes: Partial<Pick<DraftPostRow, "objective" | "pillar" | "proposedDate" | "engagementIntent" | "contentStructure" | "engagementCta" | "instagramCaption" | "facebookCaption" | "hashtags" | "renderStatus" | "previewOutOfDate" | "safeRenderErrorCode" | "safeRenderErrorMessage">>,
) {
  const result = database.orm.update(draftPosts)
    .set({ ...changes, version: expectedVersion + 1, updatedAt: now() })
    .where(and(
      eq(draftPosts.id, postId),
      eq(draftPosts.version, expectedVersion),
      eq(draftPosts.reviewStatus, "draft"),
    )).run();
  if (result.changes !== 1) throw new StalePostVersionError();
}

export function updateDraftPostContent(
  database: AppDatabase,
  postId: string,
  expectedVersion: number,
  post: GeneratedPost,
) {
  inTransaction(database, () => {
    const current = database.orm.select().from(draftPosts).where(eq(draftPosts.id, postId)).get();
    if (!current || current.version !== expectedVersion || current.reviewStatus !== "draft") throw new StalePostVersionError();
    const currentSlides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
    if (current.format !== post.format || currentSlides.length !== post.slides.length) throw new Error("post_structure_immutable");
    const timestamp = now();
    database.orm.update(draftPosts).set({
      objective: post.objective, pillar: post.pillar, proposedDate: post.proposedDate,
      engagementIntent: post.engagementIntent, contentStructure: post.contentStructure,
      engagementCta: post.engagementCta, instagramCaption: post.instagramCaption,
      facebookCaption: post.facebookCaption, hashtags: JSON.stringify(post.hashtags),
      renderStatus: "pending", previewOutOfDate: currentSlides.some((slide) => Boolean(slide.imagePath)),
      safeRenderErrorCode: null, safeRenderErrorMessage: null,
      version: expectedVersion + 1, updatedAt: timestamp,
    }).where(and(eq(draftPosts.id, postId), eq(draftPosts.version, expectedVersion))).run();
    post.slides.forEach((slide, index) => {
      const before = currentSlides[index]!;
      database.orm.update(draftPostSlides).set({
        ...slide, renderStatus: "pending", previewOutOfDate: Boolean(before.imagePath),
        safeRenderErrorCode: null, safeRenderErrorMessage: null,
        version: before.version + 1, updatedAt: timestamp,
      }).where(and(eq(draftPostSlides.id, before.id), eq(draftPostSlides.version, before.version))).run();
    });
  });
}

export function transitionReviewStatus(
  database: AppDatabase,
  campaignId: string,
  postId: string,
  expectedVersion: number,
  target: "draft" | "approved" | "rejected",
  mediaRoot = resolve(process.cwd(), "generated"),
) {
  const post = database.orm.select().from(draftPosts).where(and(
    eq(draftPosts.id, postId),
    eq(draftPosts.campaignId, campaignId),
  )).get();
  if (!post || post.version !== expectedVersion) throw new StalePostVersionError();
  if (target === "approved") {
    const slides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
    const candidate = { ...post, slides };
    if (!canApproveCurrentPreview(candidate, mediaRoot)) throw new Error("post_preview_not_ready");
  }
  const allowed =
    (post.reviewStatus === "draft" && (target === "approved" || target === "rejected")) ||
    ((post.reviewStatus === "approved" || post.reviewStatus === "rejected") && target === "draft");
  if (!allowed) throw new Error("review_transition_not_allowed");
  const result = database.orm.update(draftPosts)
    .set({ reviewStatus: target, version: expectedVersion + 1, updatedAt: now() })
    .where(and(
      eq(draftPosts.id, postId),
      eq(draftPosts.campaignId, campaignId),
      eq(draftPosts.version, expectedVersion),
    )).run();
  if (result.changes !== 1) throw new StalePostVersionError();
}

export function createRetryAttempt(
  database: AppDatabase,
  campaignId: string,
  requestKey: string,
  kind: "campaign" | "post_regeneration",
  postId: string | null = null,
) {
  const campaign = database.orm.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) throw new Error("campaign_not_found");
  const existing = database.orm.select().from(generationAttempts)
    .where(eq(generationAttempts.requestKey, requestKey)).get();
  if (existing) {
    if (existing.campaignId !== campaignId || existing.kind !== kind || existing.postId !== postId) {
      throw new Error("request_key_conflict");
    }
    return existing;
  }
  const previous = database.orm.select().from(generationAttempts)
    .where(and(
      eq(generationAttempts.campaignId, campaignId),
      eq(generationAttempts.kind, kind),
    ))
    .orderBy(desc(generationAttempts.createdAt)).get();
  if (!previous || previous.status !== "failed") throw new Error("retry_not_allowed");
  const timestamp = now();
  const id = newOpaqueId("att");
  database.orm.insert(generationAttempts).values({
    id,
    requestKey,
    campaignId,
    postId,
    kind,
    mode: campaign.generationMode,
    model: campaign.model,
    inputSnapshot: previous.inputSnapshot,
    brandPackVersion: previous.brandPackVersion,
    status: "pending",
    structuredResult: null,
    safeErrorCode: null,
    safeErrorMessage: null,
    openaiResponseId: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    retryOfAttemptId: previous.id,
    requestStartedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  database.orm.update(campaigns).set({
    status: "pending",
    safeErrorCode: null,
    safeErrorMessage: null,
    updatedAt: timestamp,
  }).where(eq(campaigns.id, campaignId)).run();
  return database.orm.select().from(generationAttempts).where(eq(generationAttempts.id, id)).get()!;
}

export function createPostRegenerationAttempt(
  database: AppDatabase,
  campaignId: string,
  postId: string,
  expectedVersion: number,
  requestKey: string,
  brandPackVersion: string,
) {
  return inTransaction(database, () => {
    const existing = database.orm.select().from(generationAttempts)
      .where(eq(generationAttempts.requestKey, requestKey)).get();
    if (existing) {
      if (existing.campaignId !== campaignId || existing.postId !== postId) {
        throw new Error("request_key_conflict");
      }
      return existing;
    }
    const campaign = database.orm.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
    const post = database.orm.select().from(draftPosts).where(eq(draftPosts.id, postId)).get();
    if (!campaign || !post || post.campaignId !== campaignId) throw new Error("post_not_found");
    if (post.version !== expectedVersion) throw new StalePostVersionError();
    if (post.reviewStatus !== "draft") throw new Error("post_not_draft");
    const slides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
    const inFlight = database.orm.select().from(generationAttempts)
      .where(and(
        eq(generationAttempts.campaignId, campaignId),
        eq(generationAttempts.postId, postId),
        eq(generationAttempts.kind, "post_regeneration"),
      ))
      .orderBy(desc(generationAttempts.createdAt)).all()
      .find((attempt: GenerationAttemptRow) => {
        if (attempt.status !== "pending" && attempt.status !== "running") return false;
        const snapshot = JSON.parse(attempt.inputSnapshot) as { version?: number };
        return snapshot.version === expectedVersion;
      });
    if (inFlight) return inFlight;
    const previous = database.orm.select().from(generationAttempts)
      .where(and(
        eq(generationAttempts.campaignId, campaignId),
        eq(generationAttempts.postId, postId),
        eq(generationAttempts.kind, "post_regeneration"),
      ))
      .orderBy(desc(generationAttempts.createdAt)).get();
    const timestamp = now();
    const id = newOpaqueId("att");
    database.orm.insert(generationAttempts).values({
      id,
      requestKey,
      campaignId,
      postId,
      kind: "post_regeneration",
      mode: campaign.generationMode,
      model: campaign.model,
      inputSnapshot: JSON.stringify({
        postId,
        version: post.version,
        format: post.format,
        slideCount: slides.length,
        slideIdentity: slides.map((slide) => ({ id: slide.id, ordinal: slide.ordinal, version: slide.version })),
        promptHash: createHash("sha256").update(JSON.stringify({
          campaignBrief: campaign.brief,
          campaignTitle: campaign.title,
          post,
          slides,
        })).digest("hex"),
      }),
      brandPackVersion,
      status: "pending",
      structuredResult: null,
      safeErrorCode: null,
      safeErrorMessage: null,
      openaiResponseId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      retryOfAttemptId: previous?.id ?? post.latestGenerationAttemptId,
      requestStartedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run();
    return database.orm.select().from(generationAttempts).where(eq(generationAttempts.id, id)).get()!;
  });
}

export function completePostRegeneration(
  database: AppDatabase,
  postId: string,
  attemptId: string,
  post: GeneratedCampaign["posts"][number],
  usage: Usage = {},
) {
  const timestamp = now();
  inTransaction(database, () => {
    const attempt = database.orm.select().from(generationAttempts)
      .where(and(eq(generationAttempts.id, attemptId), eq(generationAttempts.postId, postId)))
      .get();
    if (!attempt || attempt.status !== "running") throw new Error("generation_attempt_not_running");
    const inputSnapshot = JSON.parse(attempt.inputSnapshot) as { version?: number };
    const current = database.orm.select().from(draftPosts).where(eq(draftPosts.id, postId)).get();
    if (!current || current.reviewStatus !== "draft") throw new Error("post_not_draft");
    if (current.version !== inputSnapshot.version) throw new StalePostVersionError();
    if (current.format !== post.format) throw new Error("post_structure_immutable");
    const oldSlides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
    if (oldSlides.length !== post.slides.length) throw new Error("post_structure_immutable");
    database.orm.update(draftPosts).set({
      objective: post.objective, pillar: post.pillar, proposedDate: post.proposedDate,
      engagementIntent: post.engagementIntent, contentStructure: post.contentStructure,
      engagementCta: post.engagementCta,
      instagramCaption: post.instagramCaption, facebookCaption: post.facebookCaption,
      hashtags: JSON.stringify(post.hashtags),
      renderStatus: "pending",
      previewOutOfDate: Boolean(current.imagePath),
      safeRenderErrorCode: null,
      safeRenderErrorMessage: null,
      latestGenerationAttemptId: attemptId,
      generationRevision: current.generationRevision + 1,
      version: current.version + 1,
      updatedAt: timestamp,
    }).where(and(eq(draftPosts.id, postId), eq(draftPosts.version, current.version))).run();
    post.slides.forEach((slide, index) => {
      const previous = oldSlides[index]!;
      database.orm.update(draftPostSlides).set({
        ...slide,
        renderStatus: "pending", previewOutOfDate: Boolean(previous.imagePath),
        safeRenderErrorCode: null, safeRenderErrorMessage: null,
        version: previous.version + 1, updatedAt: timestamp,
      }).where(eq(draftPostSlides.id, previous.id)).run();
    });
    database.orm.update(generationAttempts).set({
      status: "complete",
      structuredResult: JSON.stringify(post),
      openaiResponseId: usage.responseId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      completedAt: timestamp,
      updatedAt: timestamp,
    }).where(eq(generationAttempts.id, attemptId)).run();
  });
}

export function setRenderStarted(database: AppDatabase, postId: string, expectedVersion: number) {
  return inTransaction(database, () => {
    const renderVersion = expectedVersion + 1;
    const timestamp = now();
    const result = database.orm.update(draftPosts).set({ renderStatus: "rendering", version: renderVersion, updatedAt: timestamp })
      .where(and(eq(draftPosts.id, postId), eq(draftPosts.version, expectedVersion), eq(draftPosts.reviewStatus, "draft"))).run();
    if (result.changes !== 1) throw new StalePostVersionError();
    const slides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
    if (slides.length === 0) throw new Error("post_slides_missing");
    const slideVersions = slides.map((slide) => {
      const update = database.orm.update(draftPostSlides).set({ renderStatus: "rendering", version: slide.version + 1, updatedAt: timestamp })
        .where(and(eq(draftPostSlides.id, slide.id), eq(draftPostSlides.version, slide.version))).run();
      if (update.changes !== 1) throw new StalePostVersionError();
      return { id: slide.id, version: slide.version + 1 };
    });
    return { postVersion: renderVersion, slideVersions };
  });
}

export function setRenderReady(
  database: AppDatabase,
  postId: string,
  expected: { postVersion: number; slideVersions: Array<{ id: string; version: number }> },
  relativePaths: string[],
) {
  return inTransaction(database, () => {
  const currentSlides = database.orm.select().from(draftPostSlides).where(eq(draftPostSlides.postId, postId)).orderBy(asc(draftPostSlides.ordinal)).all();
  if (currentSlides.length !== expected.slideVersions.length || relativePaths.length !== currentSlides.length || currentSlides.some((slide, index) => slide.id !== expected.slideVersions[index]!.id || slide.version !== expected.slideVersions[index]!.version || slide.renderStatus !== "rendering")) return false;
  assertCompletePortraitSet(resolve(process.cwd(), "generated"), relativePaths, currentSlides.map((slide) => slide.ordinal));
  const result = database.orm.update(draftPosts).set({
    renderStatus: "ready",
    imagePath: relativePaths[0]!,
    previewOutOfDate: false,
    safeRenderErrorCode: null,
    safeRenderErrorMessage: null,
    version: expected.postVersion + 1,
    updatedAt: now(),
  }).where(and(
    eq(draftPosts.id, postId),
    eq(draftPosts.version, expected.postVersion),
    eq(draftPosts.renderStatus, "rendering"),
  )).run();
  if (result.changes !== 1) return false;
  currentSlides.forEach((slide, index) => {
    const updated = database.orm.update(draftPostSlides).set({
      renderStatus: "ready", imagePath: relativePaths[index]!, previewOutOfDate: false,
      safeRenderErrorCode: null, safeRenderErrorMessage: null,
      version: slide.version + 1, updatedAt: now(),
    }).where(and(eq(draftPostSlides.id, slide.id), eq(draftPostSlides.version, slide.version))).run();
    if (updated.changes !== 1) throw new StalePostVersionError();
  });
  return true;
  });
}

export function setRenderFailed(
  database: AppDatabase,
  postId: string,
  expected: { postVersion: number; slideVersions: Array<{ id: string; version: number }> },
  error: { code: string; message: string },
) {
  const post = database.orm.select().from(draftPosts).where(and(
    eq(draftPosts.id, postId),
    eq(draftPosts.version, expected.postVersion),
  )).get();
  if (!post) return false;
  const result = database.orm.update(draftPosts).set({
    renderStatus: "failed",
    previewOutOfDate: Boolean(post.imagePath),
    safeRenderErrorCode: error.code,
    safeRenderErrorMessage: error.message,
    version: post.version + 1,
    updatedAt: now(),
  }).where(and(
    eq(draftPosts.id, postId),
    eq(draftPosts.version, expected.postVersion),
    eq(draftPosts.renderStatus, "rendering"),
  )).run();
  if (result.changes === 1) {
    for (const expectedSlide of expected.slideVersions) {
      const slide = database.orm.select().from(draftPostSlides).where(and(eq(draftPostSlides.id, expectedSlide.id), eq(draftPostSlides.version, expectedSlide.version))).get();
      if (slide) database.orm.update(draftPostSlides).set({ renderStatus: "failed", previewOutOfDate: Boolean(slide.imagePath), safeRenderErrorCode: error.code, safeRenderErrorMessage: error.message, version: slide.version + 1, updatedAt: now() }).where(eq(draftPostSlides.id, slide.id)).run();
    }
  }
  return result.changes === 1;
}
