import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright-core";

const baseUrl = process.env.APP_URL || "http://127.0.0.1:3000";
const screenshotPath = process.env.MOBILE_SCREENSHOT || "/tmp/wolds-campaign-review-mobile.png";
const databasePath = process.env.SOCIAL_STUDIO_DB_PATH || "./data/social-studio.sqlite";
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-crash-reporter", "--disable-crashpad", "--disable-gpu", "--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/campaigns/new`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("h1").textContent(), "Create a campaign");
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    const box = active.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
  }), true);

  await page.getByLabel("Campaign brief").fill(
    "Create three practical posts about calmer record keeping for busy canine therapists.",
  );
  await page.getByLabel("Number of posts").fill("3");
  await page.getByLabel("Start date").fill("2026-09-01");
  await page.getByLabel("End date").fill("2026-09-14");
  await Promise.all([
    page.waitForURL(/\/campaigns\/cmp_/),
    page.getByRole("button", { name: "Create campaign" }).click(),
  ]);

  await page.getByText("Post 3", { exact: false }).waitFor({ timeout: 120_000 });
  assert.equal(await page.locator("article.review-card").count(), 3);
  assert.equal(await page.locator("img.preview").count(), 3);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const buttonBoxes = await page.locator("main button:visible").evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { label: button.textContent?.trim(), left: box.left, right: box.right, height: box.height };
    }));
  assert.deepEqual(
    buttonBoxes.filter((box) => box.left < 0 || box.right > 390 || box.height < 44),
    [],
  );

  await page.screenshot({ path: screenshotPath, fullPage: true });
  const campaignUrl = page.url();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(page.url(), campaignUrl);
  assert.equal(await page.locator("article.review-card").count(), 3);

  let firstCard = page.locator("article.review-card").first();
  const originalFirstPreview = await firstCard.locator("img.preview").getAttribute("src");
  const firstEditSummary = firstCard.locator("summary");
  await firstEditSummary.focus();
  await page.keyboard.press("Enter");
  const firstEditForm = firstCard.locator("details form");
  await firstEditForm.getByLabel("Instagram caption").fill(
    "A calmer way to think about practitioner records. Mobile caption-only edit.",
  );
  await firstEditForm.getByLabel("Alt text").fill("Wolds Record graphic checked in the mobile review flow.");
  await firstEditForm.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(() =>
    document.querySelector("article.review-card .caption")?.textContent?.includes("Mobile caption-only edit"),
  );
  firstCard = page.locator("article.review-card").first();
  assert.match(await firstCard.locator(".caption").first().textContent() ?? "", /Mobile caption-only edit/);
  assert.equal(await firstCard.locator("img.preview").getAttribute("src"), originalFirstPreview);

  await firstCard.locator("summary").click();
  const visualEditForm = firstCard.locator("details form");
  await visualEditForm.getByLabel("Headline").fill("A clearer mobile workflow");
  await visualEditForm.getByLabel("Emphasis").fill("mobile workflow");
  await visualEditForm.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: "A clearer mobile workflow" }).waitFor();
  firstCard = page.locator("article.review-card").first();
  assert.notEqual(await firstCard.locator("img.preview").getAttribute("src"), originalFirstPreview);

  let secondCard = page.locator("article.review-card").nth(1);
  const secondBefore = {
    headline: await secondCard.locator("h2").textContent(),
    preview: await secondCard.locator("img.preview").getAttribute("src"),
    date: (await secondCard.locator(".review-card-header p").last().textContent())?.slice(0, 10),
  };
  await secondCard.getByRole("button", { name: "Regenerate" }).click();
  await page.getByText("revision 2", { exact: false }).waitFor();
  secondCard = page.locator("article.review-card").nth(1);
  assert.notEqual(await secondCard.locator("h2").textContent(), secondBefore.headline);
  assert.notEqual(await secondCard.locator("img.preview").getAttribute("src"), secondBefore.preview);
  assert.equal(
    (await secondCard.locator(".review-card-header p").last().textContent())?.slice(0, 10),
    secondBefore.date,
  );

  let thirdCard = page.locator("article.review-card").nth(2);
  await thirdCard.getByRole("button", { name: "Reject" }).click();
  await page.waitForFunction(() =>
    document.querySelectorAll("article.review-card")[2]?.querySelector(".status-badge")?.textContent === "rejected",
  );
  thirdCard = page.locator("article.review-card").nth(2);
  assert.equal(await thirdCard.locator("details").count(), 0);
  assert.equal(await thirdCard.getByRole("button", { name: "Regenerate" }).count(), 0);
  await thirdCard.getByRole("button", { name: "Return to draft" }).click();
  await page.waitForFunction(() =>
    document.querySelectorAll("article.review-card")[2]?.querySelector(".status-badge")?.textContent === "draft",
  );

  thirdCard = page.locator("article.review-card").nth(2);
  const thirdHeadline = await thirdCard.locator("h2").textContent();
  const thirdHeadingId = await thirdCard.locator("h2").getAttribute("id");
  assert.ok(thirdHeadingId);
  const thirdPostId = thirdHeadingId.replace(/^post-/, "");
  await thirdCard.locator("summary").click();
  const staleDatabase = new DatabaseSync(databasePath);
  staleDatabase.prepare("UPDATE draft_posts SET version = version + 1 WHERE id = ?").run(thirdPostId);
  staleDatabase.close();
  await thirdCard.getByLabel("Headline", { exact: true }).fill("This stale edit must not win");
  await thirdCard.getByLabel("Emphasis", { exact: true }).fill("");
  await thirdCard.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL((url) => url.searchParams.has("error"));
  assert.match(decodeURIComponent(new URL(page.url()).searchParams.get("error") ?? ""), /changed since you opened it/i);
  thirdCard = page.locator("article.review-card").nth(2);
  assert.equal(await thirdCard.locator("h2").textContent(), thirdHeadline);
  assert.equal(await thirdCard.locator(".error-message").count(), 1);

  await firstCard.getByRole("button", { name: "Approve" }).click();
  await page.waitForFunction(() =>
    document.querySelector("article.review-card .status-badge")?.textContent === "approved",
  );
  assert.equal(await firstCard.locator(".status-badge").textContent(), "approved");
  assert.equal(await firstCard.locator("details").count(), 0);

  secondCard = page.locator("article.review-card").nth(1);
  const secondHeadingId = await secondCard.locator("h2").getAttribute("id");
  assert.ok(secondHeadingId);
  const secondPostId = secondHeadingId.replace(/^post-/, "");
  const renderFailureDatabase = new DatabaseSync(databasePath);
  renderFailureDatabase.prepare(`
    UPDATE draft_posts
    SET render_status = 'failed', preview_out_of_date = 1,
        safe_render_error_code = 'render_interrupted',
        safe_render_error_message = 'Preview rendering was interrupted. Retry rendering when you are ready.',
        version = version + 1
    WHERE id = ?
  `).run(secondPostId);
  renderFailureDatabase.close();
  await page.reload({ waitUntil: "networkidle" });
  secondCard = page.locator("article.review-card").nth(1);
  await secondCard.getByRole("button", { name: "Retry preview" }).click();
  await page.waitForFunction(() =>
    document.querySelectorAll("article.review-card")[1]?.querySelector("button")?.textContent !== "Retry preview" &&
    !Array.from(document.querySelectorAll("article.review-card")[1]?.querySelectorAll("button") ?? [])
      .some((button) => button.textContent === "Retry preview"),
  );
  assert.equal(await page.locator("article.review-card").nth(1).locator("img.preview").count(), 1);

  const failedCampaignId = "cmp_" + crypto.randomUUID();
  const failedAttemptId = "att_" + crypto.randomUUID();
  const failedBrief = "Create one practical post about calmer record keeping after a recoverable failure.";
  const timestamp = new Date().toISOString();
  const failureDatabase = new DatabaseSync(databasePath);
  failureDatabase.prepare(`
    INSERT INTO campaigns (
      id, submission_key, brand_id, title, brief, post_count, start_date, end_date,
      status, generation_mode, model, safe_error_code, safe_error_message, created_at, updated_at
    ) VALUES (?, ?, 'record', NULL, ?, 1, '2026-10-01', '2026-10-01',
      'failed', 'fixture', 'fixture-v1', 'generation_interrupted',
      'Generation was interrupted. Retry when you are ready.', ?, ?)
  `).run(failedCampaignId, crypto.randomUUID(), failedBrief, timestamp, timestamp);
  failureDatabase.prepare(`
    INSERT INTO generation_attempts (
      id, request_key, campaign_id, post_id, kind, mode, model, input_snapshot,
      brand_pack_version, status, structured_result, safe_error_code, safe_error_message,
      openai_response_id, input_tokens, output_tokens, total_tokens, retry_of_attempt_id,
      request_started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, 'campaign', 'fixture', 'fixture-v1', ?, '2026-08-04',
      'failed', NULL, 'generation_interrupted', 'Generation was interrupted. Retry when you are ready.',
      NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?)
  `).run(
    failedAttemptId,
    crypto.randomUUID(),
    failedCampaignId,
    JSON.stringify({ promptHash: "0".repeat(64), postCount: 1 }),
    timestamp,
    timestamp,
    timestamp,
    timestamp,
  );
  failureDatabase.close();
  await page.goto(`${baseUrl}/campaigns/${failedCampaignId}`, { waitUntil: "networkidle" });
  await page.getByText(failedBrief, { exact: false }).waitFor();
  await page.getByRole("button", { name: "Retry generation" }).click();
  await page.locator("article.review-card").waitFor({ timeout: 120_000 });
  assert.equal(await page.locator("article.review-card").count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({
    campaignUrl,
    posts: 3,
    previews: 3,
    captionOnlyEditKeptPreview: true,
    visualEditRerendered: true,
    regenerationRevision: 2,
    rejectAndReturnToDraft: true,
    staleWriteRejected: true,
    renderRetryRecovered: true,
    generationRetryRecovered: true,
    keyboardFocus: true,
    viewport: "390x844",
    overflow: false,
    consoleErrors: 0,
    screenshotPath,
  }));
} finally {
  await browser.close();
}
