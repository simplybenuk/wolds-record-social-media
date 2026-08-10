"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDatabase } from "@/db";
import { campaignInputSchema, generatedPostSchema } from "./schemas";
import type { BrandPack } from "./types";
import {
  createPendingCampaign,
  createPostRegenerationAttempt,
  createRetryAttempt,
  getCampaignBundle,
  StalePostVersionError,
  transitionReviewStatus,
  updateDraftPost,
} from "./repository";
import { requireBrandPack } from "@/lib/brand/packs";
import { CampaignDomainValidationError, validateGeneratedCampaign } from "./domain-validation";
import { renderPostPreview, createCampaignRenderer } from "@/lib/rendering/campaign-renderer";
import { runCampaignGeneration, runPostRegeneration } from "@/lib/generation/service";
import { GenerationError } from "@/lib/generation/errors";
import { StaticImageRenderError } from "@/lib/rendering/static-image-renderer";

const expectedActionErrors: Record<string, string> = {
  campaign_not_found: "The campaign could not be found.",
  post_not_found: "The post could not be found.",
  post_not_draft: "Return the post to draft before changing it.",
  retry_not_allowed: "This generation cannot be retried from its current state.",
  review_transition_not_allowed: "That review change is not allowed from the current state.",
  render_retry_not_allowed: "This preview is not waiting for a retry.",
  request_key_conflict: "That action submission conflicts with an earlier request. Reload and try again.",
};

class ActionValidationError extends Error {}

const message = (value: unknown) => {
  let safe = "The action could not be completed. Reload and try again.";
  if (
    value instanceof StalePostVersionError ||
    value instanceof GenerationError ||
    value instanceof StaticImageRenderError ||
    value instanceof ActionValidationError
  ) {
    safe = value.message;
  } else if (value instanceof Error && expectedActionErrors[value.message]) {
    safe = expectedActionErrors[value.message]!;
  }
  return encodeURIComponent(safe);
};

const postErrorLocation = (campaignId: string, postId: string, error: unknown) =>
  "/campaigns/" + campaignId +
  "?post=" + encodeURIComponent(postId) +
  "&error=" + message(error) +
  "#post-" + encodeURIComponent(postId);

export async function createCampaignAction(formData: FormData) {
  const parsed = campaignInputSchema.safeParse({
    submissionKey: formData.get("submissionKey"),
    brandId: formData.get("brandId"),
    brief: formData.get("brief"),
    postCount: formData.get("postCount"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    redirect("/campaigns/new?error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form."));
  }
  const mode = process.env.GENERATION_MODE === "live" ? "live" : "fixture";
  const model = mode === "live" ? process.env.OPENAI_MODEL?.trim() : "fixture-v1";
  if (!model) redirect("/campaigns/new?error=" + encodeURIComponent("Configure OPENAI_MODEL before using live mode."));
  let brandPack: BrandPack;
  try {
    brandPack = requireBrandPack(parsed.data.brandId);
  } catch {
    redirect("/campaigns/new?error=" + encodeURIComponent("That brand is not enabled."));
  }

  const result = createPendingCampaign(getDatabase(), {
    ...parsed.data,
    requestKey: parsed.data.submissionKey + ":initial",
    generationMode: mode,
    model,
    brandPackVersion: brandPack.version,
  });
  redirect("/campaigns/" + result.campaign.id);
}

export async function runGenerationAction(campaignId: string, attemptId: string) {
  await runCampaignGeneration(getDatabase(), campaignId, attemptId);
  revalidatePath("/campaigns/" + campaignId);
}

export async function retryCampaignAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const requestKey = String(formData.get("requestKey") ?? "");
  try {
    const attempt = createRetryAttempt(getDatabase(), campaignId, requestKey, "campaign");
    await runCampaignGeneration(getDatabase(), campaignId, attempt.id);
  } catch (error) {
    redirect("/campaigns/" + campaignId + "?error=" + message(error));
  }
  revalidatePath("/campaigns/" + campaignId);
  redirect("/campaigns/" + campaignId);
}

export async function transitionPostAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  try {
    transitionReviewStatus(
      getDatabase(),
      campaignId,
      postId,
      Number(formData.get("version")),
      String(formData.get("target")) as "draft" | "approved" | "rejected",
    );
  } catch (error) {
    redirect(postErrorLocation(campaignId, postId, error));
  }
  revalidatePath("/campaigns/" + campaignId);
  redirect("/campaigns/" + campaignId);
}

export async function editPostAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const expectedVersion = Number(formData.get("version"));
  const raw = {
    objective: formData.get("objective"),
    pillar: formData.get("pillar"),
    proposedDate: formData.get("proposedDate"),
    visualTemplate: formData.get("visualTemplate"),
    headline: formData.get("headline"),
    emphasis: String(formData.get("emphasis") ?? "").trim() || null,
    body: formData.get("body"),
    footer: formData.get("footer"),
    instagramCaption: formData.get("instagramCaption"),
    facebookCaption: formData.get("facebookCaption"),
    hashtags: String(formData.get("hashtags") ?? "").split(/[\s,]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
    altText: formData.get("altText"),
    photoAssetId: String(formData.get("photoAssetId") ?? "").trim() || null,
  };
  const parsed = generatedPostSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(postErrorLocation(
      campaignId,
      postId,
      new ActionValidationError(parsed.error.issues[0]?.message ?? "Check the post."),
    ));
  }

  try {
    const database = getDatabase();
    const bundle = getCampaignBundle(database, campaignId);
    const before = bundle?.posts.find((post) => post.id === postId);
    if (!before) throw new Error("post_not_found");
    const brandPack = requireBrandPack(bundle!.campaign.brandId);
    try {
      validateGeneratedCampaign(
        { campaignTitle: bundle!.campaign.title ?? "Campaign", posts: [parsed.data] },
        {
          requestedPostCount: 1,
          startDate: bundle!.campaign.startDate,
          endDate: bundle!.campaign.endDate,
          brandPack,
        },
      );
    } catch (error) {
      if (error instanceof CampaignDomainValidationError) {
        throw new ActionValidationError(error.issues[0]?.message ?? "The edited post is not valid.");
      }
      throw error;
    }
    const visualChanged = ["visualTemplate", "headline", "emphasis", "body", "footer", "photoAssetId"]
      .some((key) =>
        before[key as keyof typeof before] !== parsed.data[key as keyof typeof parsed.data]
      );
    updateDraftPost(database, postId, expectedVersion, {
      ...parsed.data,
      hashtags: JSON.stringify(parsed.data.hashtags),
      renderStatus: visualChanged ? "pending" : before.renderStatus,
      previewOutOfDate: before.previewOutOfDate || (visualChanged && Boolean(before.imagePath)),
    });
    if (visualChanged) {
      const updated = getCampaignBundle(database, campaignId)!.posts.find((post) => post.id === postId)!;
      const renderer = createCampaignRenderer();
      try {
        await renderPostPreview(database, updated, renderer);
      } finally {
        await renderer.close();
      }
    }
  } catch (error) {
    redirect(postErrorLocation(campaignId, postId, error));
  }
  revalidatePath("/campaigns/" + campaignId);
  redirect("/campaigns/" + campaignId);
}

export async function regeneratePostAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  try {
    const attempt = createPostRegenerationAttempt(
      getDatabase(),
      campaignId,
      postId,
      Number(formData.get("version")),
      String(formData.get("requestKey") ?? ""),
      requireBrandPack(getCampaignBundle(getDatabase(), campaignId)?.campaign.brandId ?? "record").version,
    );
    const outcome = await runPostRegeneration(getDatabase(), campaignId, postId, attempt.id);
    if (outcome.error) throw outcome.error;
  } catch (error) {
    redirect(postErrorLocation(campaignId, postId, error));
  }
  revalidatePath("/campaigns/" + campaignId);
  redirect("/campaigns/" + campaignId);
}

export async function retryRenderAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const expectedVersion = Number(formData.get("version"));
  const database = getDatabase();
  try {
    const post = getCampaignBundle(database, campaignId)?.posts.find((candidate) => candidate.id === postId);
    if (!post || post.renderStatus !== "failed") throw new Error("render_retry_not_allowed");
    if (post.version !== expectedVersion) throw new StalePostVersionError();
    const renderer = createCampaignRenderer();
    try {
      await renderPostPreview(database, post, renderer);
    } finally {
      await renderer.close();
    }
  } catch (error) {
    redirect(postErrorLocation(campaignId, postId, error));
  }
  revalidatePath("/campaigns/" + campaignId);
  redirect("/campaigns/" + campaignId);
}
