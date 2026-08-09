import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDatabase } from "../src/db/index.ts";
import {
  claimGenerationAttempt,
  completeCampaignGeneration,
  completePostRegeneration,
  createPendingCampaign,
  createPostRegenerationAttempt,
  createRetryAttempt,
  failGenerationAttempt,
  failPostRegenerationAttempt,
  getCampaignBundle,
  markInterruptedWork,
  StalePostVersionError,
  transitionReviewStatus,
  updateDraftPost,
} from "../src/features/campaigns/repository.ts";
import { FixtureCampaignGenerator } from "../src/lib/generation/fixture-generator.ts";
import { generatedPostSchema } from "../src/features/campaigns/schemas.ts";
import { recordBrandPack } from "../src/lib/brand/record.ts";
import { renderPostPreview } from "../src/lib/rendering/campaign-renderer.ts";

async function completedCampaign() {
  const database = createDatabase(":memory:");
  const created = createPendingCampaign(database, {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create practical posts about calmer canine therapy record keeping.",
    postCount: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    generationMode: "fixture",
    model: "fixture-v1",
    brandPackVersion: recordBrandPack.version,
  });
  const binding = { campaignId: created.campaign.id, kind: "campaign" as const, postId: null };
  assert.equal(claimGenerationAttempt(database, created.attempt.id, binding), true);
  const generated = await new FixtureCampaignGenerator().generateCampaign({
    brief: created.campaign.brief,
    postCount: 3,
    startDate: created.campaign.startDate,
    endDate: created.campaign.endDate,
    brandPack: recordBrandPack,
  });
  completeCampaignGeneration(database, created.campaign.id, created.attempt.id, generated.campaign);
  return { database, campaignId: created.campaign.id };
}

test("an empty on-disk database receives the committed migration with foreign keys enabled", () => {
  const directory = mkdtempSync(join(tmpdir(), "wolds-campaign-db-"));
  try {
    const database = createDatabase(join(directory, "campaigns.sqlite"));
    assert.equal(database.client.prepare("PRAGMA foreign_keys").get()!.foreign_keys, 1);
    const tables = database.client.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all().map((row) => row.name);
    assert.deepEqual(tables, ["__drizzle_migrations", "campaigns", "draft_posts", "generation_attempts"]);
    database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("campaign and attempt exist before generation and submission is idempotent", () => {
  const database = createDatabase(":memory:");
  const input = {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create practical posts about calmer canine therapy record keeping.",
    postCount: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    generationMode: "fixture" as const,
    model: "fixture-v1",
    brandPackVersion: recordBrandPack.version,
  };
  const first = createPendingCampaign(database, input);
  const duplicate = createPendingCampaign(database, input);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(first.campaign.id, duplicate.campaign.id);
  assert.equal(first.attempt.status, "pending");
  const snapshot = JSON.parse(first.attempt.inputSnapshot);
  assert.match(snapshot.promptHash, /^[a-f0-9]{64}$/);
  assert.equal("brief" in snapshot, false);
  assert.equal(getCampaignBundle(database, first.campaign.id)?.posts.length, 0);
  const binding = { campaignId: first.campaign.id, kind: "campaign" as const, postId: null };
  assert.equal(claimGenerationAttempt(database, first.attempt.id, binding), true);
  assert.equal(claimGenerationAttempt(database, first.attempt.id, binding), false);
  database.close();
});

test("campaign completion is atomic and persists normalized posts and attempts", async () => {
  const { database, campaignId } = await completedCampaign();
  const bundle = getCampaignBundle(database, campaignId)!;
  assert.equal(bundle.campaign.status, "review");
  assert.equal(bundle.posts.length, 3);
  assert.equal(bundle.attempts[0]?.status, "complete");
  assert.deepEqual(JSON.parse(bundle.posts[0]!.hashtags).slice(0, 3), [
    "caninemassage",
    "caninetherapy",
    "woldsrecord",
  ]);
  assert.equal(
    database.client.prepare("PRAGMA foreign_keys").get()!.foreign_keys,
    1,
  );
  database.close();
});

test("review transitions freeze content and stale versions cannot overwrite", async () => {
  const { database, campaignId } = await completedCampaign();
  const post = getCampaignBundle(database, campaignId)!.posts[0]!;
  assert.throws(
    () => transitionReviewStatus(database, "cmp_wrong", post.id, post.version, "approved"),
    StalePostVersionError,
  );
  transitionReviewStatus(database, campaignId, post.id, post.version, "approved");
  const approved = getCampaignBundle(database, campaignId)!.posts[0]!;
  assert.equal(approved.reviewStatus, "approved");
  assert.throws(
    () => updateDraftPost(database, post.id, approved.version, { headline: "Not allowed" }),
    StalePostVersionError,
  );
  transitionReviewStatus(database, campaignId, post.id, approved.version, "draft");
  const draft = getCampaignBundle(database, campaignId)!.posts[0]!;
  updateDraftPost(database, post.id, draft.version, { headline: "A safe revised headline" });
  assert.throws(
    () => updateDraftPost(database, post.id, draft.version, { headline: "Stale overwrite" }),
    StalePostVersionError,
  );
  database.close();
});

test("old running attempts become interrupted and are never replayed", () => {
  const database = createDatabase(":memory:");
  const created = createPendingCampaign(database, {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create practical posts about calmer canine therapy record keeping.",
    postCount: 1,
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    generationMode: "live",
    model: "configured-model",
    brandPackVersion: recordBrandPack.version,
  });
  database.client
    .prepare("UPDATE generation_attempts SET request_started_at = ? WHERE id = ?")
    .run("2026-08-04T10:00:00.000Z", created.attempt.id);
  assert.equal(markInterruptedWork(database, created.campaign.id, new Date("2026-08-04T10:11:00.000Z")), 1);
  const bundle = getCampaignBundle(database, created.campaign.id)!;
  assert.equal(bundle.campaign.status, "failed");
  assert.equal(bundle.attempts[0]?.safeErrorCode, "generation_interrupted");
  database.close();
});

test("campaign retry replay returns the same attempt for its submission key", () => {
  const database = createDatabase(":memory:");
  const created = createPendingCampaign(database, {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create one practical post about calmer canine therapy record keeping.",
    postCount: 1,
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    generationMode: "fixture",
    model: "fixture-v1",
    brandPackVersion: recordBrandPack.version,
  });
  assert.equal(claimGenerationAttempt(database, created.attempt.id, {
    campaignId: created.campaign.id,
    kind: "campaign",
    postId: null,
  }), true);
  failGenerationAttempt(database, created.campaign.id, created.attempt.id, {
    code: "generation_network",
    message: "Generation could not reach the service.",
  }, {
    responseId: "resp_failed",
    inputTokens: 4,
    outputTokens: 2,
    totalTokens: 6,
  });
  const failed = getCampaignBundle(database, created.campaign.id)!.attempts[0]!;
  assert.equal(failed.openaiResponseId, "resp_failed");
  assert.equal(failed.totalTokens, 6);
  const requestKey = crypto.randomUUID();
  const firstRetry = createRetryAttempt(database, created.campaign.id, requestKey, "campaign");
  const replay = createRetryAttempt(database, created.campaign.id, requestKey, "campaign");
  assert.equal(replay.id, firstRetry.id);
  database.close();
});

test("a failed post regeneration does not fail its reviewable campaign", async () => {
  const { database, campaignId } = await completedCampaign();
  const post = getCampaignBundle(database, campaignId)!.posts[0]!;
  const attempt = createPostRegenerationAttempt(
    database,
    campaignId,
    post.id,
    post.version,
    crypto.randomUUID(),
    recordBrandPack.version,
  );
  assert.equal(claimGenerationAttempt(database, attempt.id, {
    campaignId,
    kind: "post_regeneration",
    postId: post.id,
  }), true);
  failPostRegenerationAttempt(database, campaignId, post.id, attempt.id, {
    code: "generation_network",
    message: "Post regeneration could not reach the generation service.",
  });
  const bundle = getCampaignBundle(database, campaignId)!;
  assert.equal(bundle.campaign.status, "review");
  assert.equal(bundle.posts.length, 3);
  assert.equal(bundle.attempts[0]?.status, "failed");
  assert.equal(bundle.attempts[0]?.kind, "post_regeneration");
  const retry = createPostRegenerationAttempt(
    database,
    campaignId,
    post.id,
    post.version,
    crypto.randomUUID(),
    recordBrandPack.version,
  );
  assert.equal(retry.retryOfAttemptId, attempt.id);
  database.close();
});

test("an old pending render is marked interrupted without failing the campaign", async () => {
  const { database, campaignId } = await completedCampaign();
  const post = getCampaignBundle(database, campaignId)!.posts[0]!;
  database.client
    .prepare("UPDATE draft_posts SET updated_at = ? WHERE id = ?")
    .run("2026-08-04T10:00:00.000Z", post.id);
  assert.equal(markInterruptedWork(database, campaignId, new Date("2026-08-04T10:11:00.000Z")), 1);
  const bundle = getCampaignBundle(database, campaignId)!;
  assert.equal(bundle.campaign.status, "review");
  assert.equal(bundle.posts[0]?.renderStatus, "failed");
  assert.equal(bundle.posts[0]?.safeRenderErrorCode, "render_interrupted");
  database.close();
});

test("concurrent regenerations cannot overwrite a newer post revision", async () => {
  const { database, campaignId } = await completedCampaign();
  const post = getCampaignBundle(database, campaignId)!.posts[0]!;
  const first = createPostRegenerationAttempt(
    database, campaignId, post.id, post.version, crypto.randomUUID(), recordBrandPack.version,
  );
  const second = createPostRegenerationAttempt(
    database, campaignId, post.id, post.version, crypto.randomUUID(), recordBrandPack.version,
  );
  const binding = { campaignId, kind: "post_regeneration" as const, postId: post.id };
  assert.equal(second.id, first.id);
  assert.equal(claimGenerationAttempt(database, first.id, binding), true);
  assert.equal(claimGenerationAttempt(database, second.id, binding), false);
  const generated = await new FixtureCampaignGenerator().regeneratePost({
    campaignBrief: "Create practical posts about calmer canine therapy record keeping.",
    campaignTitle: "Campaign",
    post: generatedPostSchema.parse({
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
      hashtags: JSON.parse(post.hashtags),
      altText: post.altText,
      photoAssetId: post.photoAssetId,
    }),
    brandPack: recordBrandPack,
  });
  completePostRegeneration(database, post.id, first.id, generated.campaign.posts[0]!);
  assert.equal(getCampaignBundle(database, campaignId)!.posts[0]?.generationRevision, 2);
  database.close();
});

test("a delayed render cannot mark newer visual content ready", async () => {
  const { database, campaignId } = await completedCampaign();
  const original = getCampaignBundle(database, campaignId)!.posts[0]!;
  database.client.prepare(`
    UPDATE draft_posts
    SET render_status = 'ready', image_path = ?, preview_out_of_date = 0
    WHERE id = ?
  `).run(`campaigns/${campaignId}/${original.id}.png`, original.id);
  const post = getCampaignBundle(database, campaignId)!.posts[0]!;
  let signalStarted!: () => void;
  let releaseRender!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseRender = resolve; });
  const rendering = renderPostPreview(database, post, {
    async render() {
      signalStarted();
      await release;
      return { relativePath: `campaigns/${campaignId}/${post.id}.png` };
    },
  });
  await started;
  const inProgress = getCampaignBundle(database, campaignId)!.posts[0]!;
  updateDraftPost(database, post.id, inProgress.version, {
    headline: "Newer visual content",
    renderStatus: "pending",
    previewOutOfDate: true,
  });
  releaseRender();
  await rendering;
  const current = getCampaignBundle(database, campaignId)!.posts[0]!;
  assert.equal(current.headline, "Newer visual content");
  assert.equal(current.renderStatus, "pending");
  assert.equal(current.previewOutOfDate, true);
  database.close();
});
