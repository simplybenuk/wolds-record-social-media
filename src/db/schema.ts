import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    submissionKey: text("submission_key").notNull(),
    brandId: text("brand_id").notNull(),
    title: text("title"),
    brief: text("brief").notNull(),
    postCount: integer("post_count").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    formatPreference: text("format_preference", { enum: ["auto", "image", "carousel"] }).notNull(),
    status: text("status", { enum: ["pending", "review", "failed"] }).notNull(),
    generationMode: text("generation_mode", { enum: ["live", "fixture"] }).notNull(),
    model: text("model").notNull(),
    safeErrorCode: text("safe_error_code"),
    safeErrorMessage: text("safe_error_message"),
    ...timestamps,
  },
  (table: any) => [
    uniqueIndex("campaigns_submission_key_unique").on(table.submissionKey),
    check("campaigns_brand_check", sql`${table.brandId} in ('record','massage','academy')`),
    check("campaigns_post_count_check", sql`${table.postCount} between 1 and 6`),
    check("campaigns_status_check", sql`${table.status} in ('pending','review','failed')`),
    check("campaigns_mode_check", sql`${table.generationMode} in ('live','fixture')`),
  ],
);

export const generationAttempts = sqliteTable(
  "generation_attempts",
  {
    id: text("id").primaryKey(),
    requestKey: text("request_key").notNull(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    postId: text("post_id"),
    kind: text("kind", { enum: ["campaign", "post_regeneration"] }).notNull(),
    mode: text("mode", { enum: ["live", "fixture"] }).notNull(),
    model: text("model").notNull(),
    inputSnapshot: text("input_snapshot").notNull(),
    brandPackVersion: text("brand_pack_version").notNull(),
    status: text("status", { enum: ["pending", "running", "complete", "failed"] }).notNull(),
    structuredResult: text("structured_result"),
    safeErrorCode: text("safe_error_code"),
    safeErrorMessage: text("safe_error_message"),
    openaiResponseId: text("openai_response_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    retryOfAttemptId: text("retry_of_attempt_id"),
    requestStartedAt: text("request_started_at").notNull(),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (table: any) => [
    uniqueIndex("generation_attempts_request_key_unique").on(table.requestKey),
    index("generation_attempts_campaign_idx").on(table.campaignId),
    check(
      "generation_attempts_status_check",
      sql`${table.status} in ('pending','running','complete','failed')`,
    ),
  ],
);

export const draftPosts = sqliteTable(
  "draft_posts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    ordinal: integer("ordinal").notNull(),
    format: text("format").notNull(),
    engagementIntent: text("engagement_intent").notNull(),
    contentStructure: text("content_structure").notNull(),
    engagementCta: text("engagement_cta").notNull(),
    brandId: text("brand_id").notNull(),
    objective: text("objective").notNull(),
    pillar: text("pillar").notNull(),
    proposedDate: text("proposed_date").notNull(),
    // Immutable rollback evidence for rows migrated from the pre-slide model.
    visualTemplate: text("visual_template"),
    headline: text("headline"),
    emphasis: text("emphasis"),
    body: text("body"),
    footer: text("footer"),
    instagramCaption: text("instagram_caption").notNull(),
    facebookCaption: text("facebook_caption").notNull(),
    hashtags: text("hashtags").notNull(),
    altText: text("alt_text"),
    photoAssetId: text("photo_asset_id"),
    reviewStatus: text("review_status", { enum: ["draft", "approved", "rejected"] }).notNull(),
    renderStatus: text("render_status", {
      enum: ["pending", "rendering", "ready", "failed"],
    }).notNull(),
    imagePath: text("image_path"),
    safeRenderErrorCode: text("safe_render_error_code"),
    safeRenderErrorMessage: text("safe_render_error_message"),
    previewOutOfDate: integer("preview_out_of_date", { mode: "boolean" }).notNull(),
    generationRevision: integer("generation_revision").notNull(),
    latestGenerationAttemptId: text("latest_generation_attempt_id")
      .notNull()
      .references(() => generationAttempts.id),
    version: integer("version").notNull(),
    ...timestamps,
  },
  (table: any) => [
    uniqueIndex("draft_posts_campaign_ordinal_unique").on(table.campaignId, table.ordinal),
    index("draft_posts_campaign_idx").on(table.campaignId),
    check("draft_posts_format_check", sql`${table.format} in ('image','carousel')`),
    check("draft_posts_brand_check", sql`${table.brandId} in ('record','massage','academy')`),
    check("draft_posts_review_check", sql`${table.reviewStatus} in ('draft','approved','rejected')`),
    check(
      "draft_posts_render_check",
      sql`${table.renderStatus} in ('pending','rendering','ready','failed')`,
    ),
    check("draft_posts_version_check", sql`${table.version} >= 1`),
  ],
);

export const draftPostSlides = sqliteTable(
  "draft_post_slides",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => draftPosts.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    role: text("role", { enum: ["standalone", "cover", "content", "action"] }).notNull(),
    visualTemplate: text("visual_template").notNull(),
    headline: text("headline").notNull(),
    body: text("body"),
    emphasis: text("emphasis"),
    footer: text("footer"),
    photoAssetId: text("photo_asset_id"),
    altText: text("alt_text").notNull(),
    renderStatus: text("render_status", { enum: ["pending", "rendering", "ready", "failed"] }).notNull(),
    imagePath: text("image_path"),
    safeRenderErrorCode: text("safe_render_error_code"),
    safeRenderErrorMessage: text("safe_render_error_message"),
    previewOutOfDate: integer("preview_out_of_date", { mode: "boolean" }).notNull(),
    version: integer("version").notNull(),
    ...timestamps,
  },
  (table: any) => [
    uniqueIndex("draft_post_slides_post_ordinal_unique").on(table.postId, table.ordinal),
    index("draft_post_slides_post_idx").on(table.postId),
    check("draft_post_slides_ordinal_check", sql`${table.ordinal} between 0 and 6`),
    check("draft_post_slides_role_check", sql`${table.role} in ('standalone','cover','content','action')`),
    check("draft_post_slides_render_check", sql`${table.renderStatus} in ('pending','rendering','ready','failed')`),
    check("draft_post_slides_version_check", sql`${table.version} >= 1`),
  ],
);

export type CampaignRow = typeof campaigns.$inferSelect;
export type DraftPostRow = typeof draftPosts.$inferSelect;
export type GenerationAttemptRow = typeof generationAttempts.$inferSelect;
export type DraftPostSlideRow = typeof draftPostSlides.$inferSelect;
