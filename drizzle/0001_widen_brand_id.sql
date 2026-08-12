-- Widen the brand_id CHECK constraint from the single pilot brand to the
-- three brand pack IDs. SQLite cannot alter a CHECK in place, so each table is
-- recreated and its rows copied.
--
-- Foreign keys are disabled for the swap and re-enabled by the migration
-- runner, which also reads back PRAGMA foreign_key_check and rolls back if the
-- swap orphaned a reference. That check cannot live here: foreign_key_check
-- reports violations as result rows, never as an error, so a bare statement in
-- this file would pass silently. Column lists are explicit so a copy cannot
-- depend on column order.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE campaigns_new (
  id text PRIMARY KEY NOT NULL,
  submission_key text NOT NULL,
  brand_id text NOT NULL CHECK (brand_id IN ('record', 'massage', 'academy')),
  title text,
  brief text NOT NULL,
  post_count integer NOT NULL CHECK (post_count BETWEEN 1 AND 6),
  start_date text NOT NULL,
  end_date text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'review', 'failed')),
  generation_mode text NOT NULL CHECK (generation_mode IN ('live', 'fixture')),
  model text NOT NULL,
  safe_error_code text,
  safe_error_message text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
INSERT INTO campaigns_new (id, submission_key, brand_id, title, brief, post_count, start_date, end_date, status, generation_mode, model, safe_error_code, safe_error_message, created_at, updated_at) SELECT id, submission_key, brand_id, title, brief, post_count, start_date, end_date, status, generation_mode, model, safe_error_code, safe_error_message, created_at, updated_at FROM campaigns;
--> statement-breakpoint
DROP TABLE campaigns;
--> statement-breakpoint
ALTER TABLE campaigns_new RENAME TO campaigns;
--> statement-breakpoint
CREATE UNIQUE INDEX campaigns_submission_key_unique ON campaigns (submission_key);
--> statement-breakpoint
CREATE TABLE draft_posts_new (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  ordinal integer NOT NULL,
  format text NOT NULL CHECK (format = 'image'),
  brand_id text NOT NULL CHECK (brand_id IN ('record', 'massage', 'academy')),
  objective text NOT NULL,
  pillar text NOT NULL,
  proposed_date text NOT NULL,
  visual_template text NOT NULL,
  headline text NOT NULL,
  emphasis text,
  body text NOT NULL,
  footer text NOT NULL,
  instagram_caption text NOT NULL,
  facebook_caption text NOT NULL,
  hashtags text NOT NULL,
  alt_text text NOT NULL,
  photo_asset_id text,
  review_status text NOT NULL CHECK (review_status IN ('draft', 'approved', 'rejected')),
  render_status text NOT NULL CHECK (render_status IN ('pending', 'rendering', 'ready', 'failed')),
  image_path text,
  safe_render_error_code text,
  safe_render_error_message text,
  preview_out_of_date integer NOT NULL DEFAULT 0,
  generation_revision integer NOT NULL DEFAULT 1,
  latest_generation_attempt_id text NOT NULL REFERENCES generation_attempts(id),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE (campaign_id, ordinal)
);
--> statement-breakpoint
INSERT INTO draft_posts_new (id, campaign_id, ordinal, format, brand_id, objective, pillar, proposed_date, visual_template, headline, emphasis, body, footer, instagram_caption, facebook_caption, hashtags, alt_text, photo_asset_id, review_status, render_status, image_path, safe_render_error_code, safe_render_error_message, preview_out_of_date, generation_revision, latest_generation_attempt_id, version, created_at, updated_at) SELECT id, campaign_id, ordinal, format, brand_id, objective, pillar, proposed_date, visual_template, headline, emphasis, body, footer, instagram_caption, facebook_caption, hashtags, alt_text, photo_asset_id, review_status, render_status, image_path, safe_render_error_code, safe_render_error_message, preview_out_of_date, generation_revision, latest_generation_attempt_id, version, created_at, updated_at FROM draft_posts;
--> statement-breakpoint
DROP TABLE draft_posts;
--> statement-breakpoint
ALTER TABLE draft_posts_new RENAME TO draft_posts;
--> statement-breakpoint
CREATE INDEX draft_posts_campaign_idx ON draft_posts (campaign_id);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
