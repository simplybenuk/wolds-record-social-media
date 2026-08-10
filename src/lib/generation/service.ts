import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AppDatabase } from "@/db";
import {
  claimGenerationAttempt,
  completeCampaignGeneration,
  completePostRegeneration,
  failGenerationAttempt,
  failPostRegenerationAttempt,
  getCampaignBundle,
  StalePostVersionError,
} from "@/features/campaigns/repository";
import type { DraftPostRow } from "@/db/schema";
import { generatedPostSchema } from "@/features/campaigns/schemas";
import { recordBrandPack } from "@/lib/brand/record";
import { createCampaignRenderer, renderPostPreview } from "@/lib/rendering/campaign-renderer";
import { GenerationError } from "./errors";
import { FixtureCampaignGenerator } from "./fixture-generator";
import { OpenAICampaignGenerator } from "./openai-generator";
import type { CampaignGenerator } from "./types";

function generatorFor(mode: "fixture" | "live", model: string): CampaignGenerator {
  if (mode === "fixture") return new FixtureCampaignGenerator();
  const prompt = readFileSync(resolve(process.cwd(), "brands/record/prompt.md"), "utf8");
  return new OpenAICampaignGenerator(model, prompt);
}

function generatedPostFromRow(post: DraftPostRow) {
  return generatedPostSchema.parse({
    objective: post.objective,
    pillar: post.pillar,
    proposedDate: post.proposedDate,
    visualTemplate: post.visualTemplate,
    headline: post.headline,
    emphasis: post.emphasis,
    body: post.body,
    footer: post.footer,
    instagramCaption: post.instagramCaption,
    facebookCaption: post.facebookCaption,
    hashtags: JSON.parse(post.hashtags) as string[],
    altText: post.altText,
    photoAssetId: post.photoAssetId,
  });
}

export async function runCampaignGeneration(
  database: AppDatabase,
  campaignId: string,
  attemptId: string,
) {
  if (!claimGenerationAttempt(database, attemptId, {
    campaignId,
    kind: "campaign",
    postId: null,
  })) return { claimed: false as const };
  const bundle = getCampaignBundle(database, campaignId);
  if (!bundle) throw new Error("campaign_not_found");
  try {
    const generator = generatorFor(bundle.campaign.generationMode, bundle.campaign.model);
    const result = await generator.generateCampaign({
      brief: bundle.campaign.brief,
      postCount: bundle.campaign.postCount,
      startDate: bundle.campaign.startDate,
      endDate: bundle.campaign.endDate,
      brandPack: recordBrandPack,
    });
    completeCampaignGeneration(database, campaignId, attemptId, result.campaign, result.usage);
  } catch (error) {
    const safe =
      error instanceof GenerationError
        ? error
        : new GenerationError("generation_unavailable", "Campaign generation failed.", error);
    failGenerationAttempt(database, campaignId, attemptId, {
      code: safe.code,
      message: safe.message,
    }, safe.usage);
    return { claimed: true as const, error: safe };
  }

  const completed = getCampaignBundle(database, campaignId)!;
  const renderer = createCampaignRenderer();
  try {
    for (const post of completed.posts) {
      try {
        await renderPostPreview(database, post, renderer);
      } catch {
        // Rendering is intentionally isolated per post; safe state is persisted.
      }
    }
  } finally {
    try {
      await renderer.close();
    } catch {
      // Browser shutdown cannot invalidate already persisted generation output.
    }
  }
  return { claimed: true as const };
}

export async function runPostRegeneration(
  database: AppDatabase,
  campaignId: string,
  postId: string,
  attemptId: string,
) {
  if (!claimGenerationAttempt(database, attemptId, {
    campaignId,
    kind: "post_regeneration",
    postId,
  })) return { claimed: false as const };
  const bundle = getCampaignBundle(database, campaignId);
  const post = bundle?.posts.find((candidate) => candidate.id === postId);
  if (!bundle || !post) throw new Error("post_not_found");
  try {
    const generator = generatorFor(bundle.campaign.generationMode, bundle.campaign.model);
    const result = await generator.regeneratePost({
      campaignBrief: bundle.campaign.brief,
      campaignTitle: bundle.campaign.title ?? "Wolds Record campaign",
      post: generatedPostFromRow(post),
      brandPack: recordBrandPack,
    });
    completePostRegeneration(database, postId, attemptId, result.campaign.posts[0]!, result.usage);
  } catch (error) {
    const safe =
      error instanceof GenerationError
        ? error
        : error instanceof StalePostVersionError
          ? new GenerationError("generation_conflict", error.message, error)
        : new GenerationError("generation_unavailable", "Post regeneration failed.", error);
    failPostRegenerationAttempt(
      database,
      campaignId,
      postId,
      attemptId,
      { code: safe.code, message: safe.message },
      safe.usage,
    );
    return { claimed: true as const, error: safe };
  }


  const refreshed = getCampaignBundle(database, campaignId)!;
  const replacement = refreshed.posts.find((candidate) => candidate.id === postId)!;
  const renderer = createCampaignRenderer();
  try {
    try {
      await renderPostPreview(database, replacement, renderer);
    } catch {
      // The generated replacement is durable even when its preview fails.
    }
  } finally {
    try {
      await renderer.close();
    } catch {
      // Browser shutdown cannot invalidate already persisted generation output.
    }
  }
  return { claimed: true as const };
}
