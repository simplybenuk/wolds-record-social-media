import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createDatabase } from "../src/db/index.ts";
import {
  createPendingCampaign,
  createPostRegenerationAttempt,
  getCampaignBundle,
} from "../src/features/campaigns/repository.ts";
import { recordBrandPack } from "../src/lib/brand/record.ts";
import { enabledBrandPacks } from "../src/lib/brand/packs.ts";
import { runCampaignGeneration, runPostRegeneration } from "../src/lib/generation/service.ts";

test("a three-post fixture campaign persists and renders real portrait PNG sets", { timeout: 120_000 }, async () => {
  const database = createDatabase(":memory:");
  const created = createPendingCampaign(database, {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create three practical posts about calmer record keeping for canine therapists.",
    postCount: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    generationMode: "fixture",
    model: "fixture-v1",
    brandPackVersion: recordBrandPack.version,
    formatPreference: "auto",
  });
  const campaignDirectory = resolve("generated", "campaigns", created.campaign.id);
  try {
    const outcome = await runCampaignGeneration(database, created.campaign.id, created.attempt.id);
    assert.equal(outcome.claimed, true);
    assert.equal(outcome.error, undefined);
    const bundle = getCampaignBundle(database, created.campaign.id)!;
    assert.equal(bundle.posts.length, 3);
    assert.deepEqual(bundle.posts.map((post) => post.format), ["image", "carousel", "image"]);
    assert.ok(new Set(bundle.posts.flatMap((post) => post.slides.map((slide) => slide.visualTemplate))).size >= 2);
    for (const post of bundle.posts) {
      assert.equal(post.renderStatus, "ready", post.safeRenderErrorMessage ?? undefined);
      assert.equal(post.slides.length, post.format === "image" ? 1 : 4);
      for (const slide of post.slides) {
        assert.equal(slide.renderStatus, "ready");
        const path = resolve("generated", slide.imagePath!);
        assert.equal(existsSync(path), true);
        const png = readFileSync(path);
        assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(png.readUInt32BE(16), 1080);
        assert.equal(png.readUInt32BE(20), 1350);
      }
    }
  } finally {
    database.close();
    rmSync(campaignDirectory, { recursive: true, force: true });
  }
});

test("each enabled brand renders a real fixture preview", { timeout: 180_000 }, async () => {
  for (const brandPack of enabledBrandPacks()) {
    const database = createDatabase(":memory:");
    const created = createPendingCampaign(database, {
      submissionKey: crypto.randomUUID(),
      requestKey: crypto.randomUUID(),
      brandId: brandPack.id,
      brief: "Create one practical, audience-appropriate post for this brand.",
      postCount: 1,
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      generationMode: "fixture",
      model: "fixture-v1",
      brandPackVersion: brandPack.version,
    });
    const campaignDirectory = resolve("generated", "campaigns", created.campaign.id);
    try {
      const outcome = await runCampaignGeneration(database, created.campaign.id, created.attempt.id);
      assert.equal(outcome.error, undefined);
      const post = getCampaignBundle(database, created.campaign.id)!.posts[0]!;
      assert.equal(post.brandId, brandPack.id);
      assert.equal(post.renderStatus, "ready", post.safeRenderErrorMessage ?? undefined);
      const png = readFileSync(resolve("generated", post.imagePath!));
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(png.readUInt32BE(16), 1080);
      assert.equal(png.readUInt32BE(20), 1350);
    } finally {
      database.close();
      rmSync(campaignDirectory, { recursive: true, force: true });
    }
  }
});

test("a regeneration remains complete when only its replacement preview fails", { timeout: 120_000 }, async () => {
  const database = createDatabase(":memory:");
  const created = createPendingCampaign(database, {
    submissionKey: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    brief: "Create a practical post about calmer canine therapy record keeping.",
    postCount: 1,
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    generationMode: "fixture",
    model: "fixture-v1",
    brandPackVersion: recordBrandPack.version,
  });
  const campaignDirectory = resolve("generated", "campaigns", created.campaign.id);
  const previousChromePath = process.env.PLAYWRIGHT_CHROME_PATH;
  try {
    await runCampaignGeneration(database, created.campaign.id, created.attempt.id);
    const post = getCampaignBundle(database, created.campaign.id)!.posts[0]!;
    const attempt = createPostRegenerationAttempt(
      database,
      created.campaign.id,
      post.id,
      post.version,
      crypto.randomUUID(),
      recordBrandPack.version,
    );
    process.env.PLAYWRIGHT_CHROME_PATH = "/definitely/unavailable/chrome";
    const outcome = await runPostRegeneration(database, created.campaign.id, post.id, attempt.id);
    const bundle = getCampaignBundle(database, created.campaign.id)!;
    assert.equal(outcome.error, undefined);
    assert.equal(bundle.campaign.status, "review");
    assert.equal(bundle.attempts[0]?.status, "complete");
    assert.equal(bundle.posts[0]?.generationRevision, 2);
    assert.equal(bundle.posts[0]?.renderStatus, "failed");
    assert.equal(bundle.posts[0]?.previewOutOfDate, true);
    assert.ok(bundle.posts[0]?.imagePath);
  } finally {
    if (previousChromePath === undefined) delete process.env.PLAYWRIGHT_CHROME_PATH;
    else process.env.PLAYWRIGHT_CHROME_PATH = previousChromePath;
    database.close();
    rmSync(campaignDirectory, { recursive: true, force: true });
  }
});
