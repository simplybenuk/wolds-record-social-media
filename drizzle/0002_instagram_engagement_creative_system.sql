PRAGMA foreign_keys = OFF;
--> statement-breakpoint
ALTER TABLE campaigns ADD COLUMN format_preference text NOT NULL DEFAULT 'image' CHECK (format_preference IN ('auto', 'image', 'carousel'));
--> statement-breakpoint
CREATE TABLE draft_posts_new (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  ordinal integer NOT NULL,
  format text NOT NULL CHECK (format IN ('image', 'carousel')),
  brand_id text NOT NULL CHECK (brand_id IN ('record', 'massage', 'academy')),
  objective text NOT NULL,
  pillar text NOT NULL,
  proposed_date text NOT NULL,
  engagement_intent text NOT NULL CHECK (engagement_intent IN ('save','send','comment','follow','enquire')),
  content_structure text NOT NULL CHECK (content_structure IN ('checklist','myth-reality','signs','mistakes','workflow','point-of-view','question')),
  engagement_cta text NOT NULL,
  visual_template text,
  headline text,
  emphasis text,
  body text,
  footer text,
  instagram_caption text NOT NULL,
  facebook_caption text NOT NULL,
  hashtags text NOT NULL,
  alt_text text,
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
INSERT INTO draft_posts_new (
  id, campaign_id, ordinal, format, brand_id, objective, pillar, proposed_date,
  engagement_intent, content_structure, engagement_cta,
  visual_template, headline, emphasis, body, footer, instagram_caption,
  facebook_caption, hashtags, alt_text, photo_asset_id, review_status,
  render_status, image_path, safe_render_error_code, safe_render_error_message,
  preview_out_of_date, generation_revision, latest_generation_attempt_id,
  version, created_at, updated_at
) SELECT
  id, campaign_id, ordinal, 'image', brand_id, objective, pillar, proposed_date,
  'enquire', 'point-of-view', footer,
  visual_template, headline, emphasis, body, footer, instagram_caption,
  facebook_caption, hashtags, alt_text, photo_asset_id, review_status,
  render_status, image_path, safe_render_error_code, safe_render_error_message,
  preview_out_of_date, generation_revision, latest_generation_attempt_id,
  version, created_at, updated_at
FROM draft_posts;
--> statement-breakpoint
DROP TABLE draft_posts;
--> statement-breakpoint
ALTER TABLE draft_posts_new RENAME TO draft_posts;
--> statement-breakpoint
CREATE INDEX draft_posts_campaign_idx ON draft_posts (campaign_id);
--> statement-breakpoint
CREATE TABLE draft_post_slides (
  id text PRIMARY KEY NOT NULL,
  post_id text NOT NULL REFERENCES draft_posts(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 6),
  role text NOT NULL CHECK (role IN ('standalone','cover','content','action')),
  visual_template text NOT NULL,
  headline text NOT NULL,
  body text,
  emphasis text,
  footer text,
  photo_asset_id text,
  alt_text text NOT NULL,
  render_status text NOT NULL CHECK (render_status IN ('pending','rendering','ready','failed')),
  image_path text,
  safe_render_error_code text,
  safe_render_error_message text,
  preview_out_of_date integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE (post_id, ordinal)
);
--> statement-breakpoint
CREATE INDEX draft_post_slides_post_idx ON draft_post_slides (post_id);
--> statement-breakpoint
INSERT INTO draft_post_slides (
  id, post_id, ordinal, role, visual_template, headline, body, emphasis, footer,
  photo_asset_id, alt_text, render_status, image_path, safe_render_error_code,
  safe_render_error_message, preview_out_of_date, version, created_at, updated_at
) SELECT
  'slide_' || lower(hex(randomblob(16))), id, 0, 'standalone', visual_template,
  headline, body, emphasis, footer, photo_asset_id, alt_text, render_status,
  image_path, safe_render_error_code, safe_render_error_message,
  preview_out_of_date, version, created_at, updated_at
FROM draft_posts;
--> statement-breakpoint
CREATE TRIGGER draft_posts_structure_before_review
BEFORE UPDATE OF review_status ON draft_posts
WHEN NEW.review_status IN ('approved','rejected')
BEGIN
  SELECT CASE
    WHEN NEW.format = 'image' AND (
      SELECT count(*) FROM draft_post_slides WHERE post_id = NEW.id
    ) != 1 THEN RAISE(ABORT, 'image_requires_one_slide')
    WHEN NEW.format = 'image' AND EXISTS (
      SELECT 1 FROM draft_post_slides WHERE post_id = NEW.id AND (ordinal != 0 OR role != 'standalone')
    ) THEN RAISE(ABORT, 'image_requires_standalone_slide')
    WHEN NEW.format = 'carousel' AND (
      SELECT count(*) FROM draft_post_slides WHERE post_id = NEW.id
    ) NOT BETWEEN 3 AND 7 THEN RAISE(ABORT, 'carousel_requires_three_to_seven_slides')
    WHEN NEW.format = 'carousel' AND EXISTS (
      SELECT 1 FROM draft_post_slides s WHERE s.post_id = NEW.id AND (
        (s.ordinal = 0 AND s.role != 'cover') OR
        (s.ordinal = (SELECT count(*) - 1 FROM draft_post_slides WHERE post_id = NEW.id) AND s.role != 'action') OR
        (s.ordinal > 0 AND s.ordinal < (SELECT count(*) - 1 FROM draft_post_slides WHERE post_id = NEW.id) AND s.role != 'content')
      )
    ) THEN RAISE(ABORT, 'carousel_roles_invalid')
    WHEN NEW.format = 'carousel' AND (
      SELECT coalesce(min(ordinal), -1) != 0 OR max(ordinal) != count(*) - 1
      FROM draft_post_slides WHERE post_id = NEW.id
    ) THEN RAISE(ABORT, 'carousel_ordinals_not_contiguous')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER draft_posts_format_immutable_after_review
BEFORE UPDATE OF format ON draft_posts
WHEN OLD.review_status != 'draft' AND NEW.format != OLD.format
BEGIN SELECT RAISE(ABORT, 'reviewed_post_structure_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER draft_posts_legacy_visuals_read_only
BEFORE UPDATE OF visual_template, headline, emphasis, body, footer, alt_text, photo_asset_id ON draft_posts
WHEN NEW.visual_template IS NOT OLD.visual_template OR NEW.headline IS NOT OLD.headline OR
  NEW.emphasis IS NOT OLD.emphasis OR NEW.body IS NOT OLD.body OR NEW.footer IS NOT OLD.footer OR
  NEW.alt_text IS NOT OLD.alt_text OR NEW.photo_asset_id IS NOT OLD.photo_asset_id
BEGIN SELECT RAISE(ABORT, 'legacy_visuals_read_only'); END;
--> statement-breakpoint
CREATE TRIGGER draft_post_slides_insert_immutable_after_review
BEFORE INSERT ON draft_post_slides
WHEN (SELECT review_status FROM draft_posts WHERE id = NEW.post_id) != 'draft'
BEGIN SELECT RAISE(ABORT, 'reviewed_post_slides_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER draft_post_slides_update_immutable_after_review
BEFORE UPDATE ON draft_post_slides
WHEN (SELECT review_status FROM draft_posts WHERE id = OLD.post_id) != 'draft'
BEGIN SELECT RAISE(ABORT, 'reviewed_post_slides_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER draft_post_slides_delete_immutable_after_review
BEFORE DELETE ON draft_post_slides
WHEN (SELECT review_status FROM draft_posts WHERE id = OLD.post_id) != 'draft'
BEGIN SELECT RAISE(ABORT, 'reviewed_post_slides_immutable'); END;
--> statement-breakpoint
PRAGMA foreign_keys = ON;
