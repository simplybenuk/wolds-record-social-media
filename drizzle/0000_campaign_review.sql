PRAGMA foreign_keys = ON;

CREATE TABLE campaigns (
  id text PRIMARY KEY NOT NULL,
  submission_key text NOT NULL,
  brand_id text NOT NULL CHECK (brand_id = 'record'),
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

CREATE UNIQUE INDEX campaigns_submission_key_unique ON campaigns (submission_key);

CREATE TABLE generation_attempts (
  id text PRIMARY KEY NOT NULL,
  request_key text NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  post_id text,
  kind text NOT NULL CHECK (kind IN ('campaign', 'post_regeneration')),
  mode text NOT NULL CHECK (mode IN ('live', 'fixture')),
  model text NOT NULL,
  input_snapshot text NOT NULL,
  brand_pack_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  structured_result text,
  safe_error_code text,
  safe_error_message text,
  openai_response_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  retry_of_attempt_id text,
  request_started_at text NOT NULL,
  completed_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  FOREIGN KEY (retry_of_attempt_id) REFERENCES generation_attempts(id)
);

CREATE UNIQUE INDEX generation_attempts_request_key_unique ON generation_attempts (request_key);
CREATE INDEX generation_attempts_campaign_idx ON generation_attempts (campaign_id);

CREATE TABLE draft_posts (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  ordinal integer NOT NULL,
  format text NOT NULL CHECK (format = 'image'),
  brand_id text NOT NULL CHECK (brand_id = 'record'),
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

CREATE INDEX draft_posts_campaign_idx ON draft_posts (campaign_id);
