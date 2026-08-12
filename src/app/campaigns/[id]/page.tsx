import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDatabase } from "@/db";
import { GenerationStarter } from "@/components/generation-starter";
import { SubmitButton } from "@/components/submit-button";
import { CarouselViewer } from "@/components/carousel-viewer";
import {
  editPostAction,
  regeneratePostAction,
  retryRenderAction,
  retryCampaignAction,
  transitionPostAction,
} from "@/features/campaigns/actions";
import { canApproveCurrentPreview, getCampaignBundle } from "@/features/campaigns/repository";
import { CAMPAIGN_OBJECTIVES, CONTENT_STRUCTURES, ENGAGEMENT_INTENTS, VISUAL_TEMPLATES } from "@/features/campaigns/types";
import { createSubmissionKey } from "@/features/campaigns/ids";
import { requireBrandPack } from "@/lib/brand/packs";

export const dynamic = "force-dynamic";

function previewData(path: string | null) {
  if (!path || !/^campaigns\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.png|\/set_[a-zA-Z0-9_-]+\/[0-6]\.png)$/.test(path)) return null;
  const absolute = resolve(process.cwd(), "generated", path);
  if (!existsSync(absolute)) return null;
  return "data:image/png;base64," + readFileSync(absolute).toString("base64");
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; post?: string }>;
}) {
  const { id } = await params;
  const { error, post: errorPostId } = await searchParams;
  const bundle = getCampaignBundle(getDatabase(), id);
  if (!bundle) notFound();
  const brandPack = requireBrandPack(bundle.campaign.brandId);
  const pendingAttempt = bundle.attempts.find((attempt) =>
    attempt.kind === "campaign" && (attempt.status === "pending" || attempt.status === "running"));

  return (
    <div className="stack campaign-review">
      <Link className="back-link" href="/campaigns/new">← New campaign</Link>
      <header className="campaign-header">
        <div>
          <p className="eyebrow">{brandPack.displayName} · {bundle.campaign.generationMode} mode</p>
          <h1>{bundle.campaign.title ?? "Campaign in progress"}</h1>
          <p>{bundle.campaign.startDate} to {bundle.campaign.endDate} · {bundle.campaign.postCount} posts</p>
        </div>
        <span className={"status-badge status-" + bundle.campaign.status}>{bundle.campaign.status}</span>
      </header>
      {error && !errorPostId ? <p className="error-message" role="alert">{error}</p> : null}
      {pendingAttempt ? (
        <GenerationStarter campaignId={id} attemptId={pendingAttempt.id} />
      ) : null}
      {bundle.campaign.status === "failed" ? (
        <section className="status-panel error-panel" aria-labelledby="generation-error-title">
          <div>
            <strong id="generation-error-title">Campaign generation needs attention</strong>
            <p>{bundle.campaign.safeErrorMessage ?? "Generation did not complete."}</p>
            <p><strong>Retained brief:</strong> {bundle.campaign.brief}</p>
            <form action={retryCampaignAction}>
              <input type="hidden" name="campaignId" value={id} />
              <input type="hidden" name="requestKey" value={createSubmissionKey()} />
              <SubmitButton>Retry generation</SubmitButton>
            </form>
          </div>
        </section>
      ) : null}
      <div className="post-list">
        {bundle.posts.map((post, index) => {
          const previews = post.slides.map((slide) => ({ src: previewData(slide.imagePath), alt: slide.altText }));
          const tags = JSON.parse(post.hashtags) as string[];
          const isDraft = post.reviewStatus === "draft";
          const canApprove = canApproveCurrentPreview(post) && previews.every((preview) => preview.src);
          const latestRegeneration = bundle.attempts.find((attempt) =>
            attempt.kind === "post_regeneration" &&
            attempt.postId === post.id
          );
          const regenerationFailure = latestRegeneration?.status === "failed" ? latestRegeneration : null;
          return (
            <article className="review-card" key={post.id} aria-labelledby={"post-" + post.id}>
              <header className="review-card-header">
                <div>
                  <p className="eyebrow">Post {index + 1} · {post.format} · {post.objective}</p>
                  <h2 id={"post-" + post.id}>{post.slides[0]?.headline ?? post.headline}</h2>
                  <p>{post.proposedDate} · revision {post.generationRevision}</p>
                  <p className="post-contract"><strong>Intent:</strong> {post.engagementIntent} · <strong>Structure:</strong> {post.contentStructure}</p>
                </div>
                <span className={"status-badge status-" + post.reviewStatus}>{post.reviewStatus}</span>
              </header>
              {error && errorPostId === post.id ? (
                <p className="error-message" role="alert">{error}</p>
              ) : null}
              <div className="review-grid">
                <div>
                  <CarouselViewer slides={previews} portrait={post.slides.every((slide) => !slide.imagePath || slide.imagePath.includes("/set_"))} />
                  {post.previewOutOfDate ? <p className="warning">Preview is out of date; the last good image is shown.</p> : null}
                  {post.safeRenderErrorMessage ? <p className="error-message" role="alert">{post.safeRenderErrorMessage}</p> : null}
                  {post.renderStatus === "failed" ? (
                    <form action={retryRenderAction}>
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="version" value={post.version} />
                      <SubmitButton className="button button-secondary" pendingLabel="Rendering…">Retry preview</SubmitButton>
                    </form>
                  ) : null}
                </div>
                <div className="copy-stack">
                  <section>
                    <h3>Instagram</h3>
                    <p className="caption">{post.instagramCaption}</p>
                  </section>
                  <section>
                    <h3>Facebook</h3>
                    <p className="caption">{post.facebookCaption}</p>
                  </section>
                  <p className="hashtags">{tags.map((tag) => "#" + tag).join(" ")}</p>
                  <p><strong>CTA:</strong> {post.engagementCta}</p>
                  <section><h3>Slide alt text</h3><ol className="alt-text-list">{post.slides.map((slide) => <li key={slide.id}>{slide.altText}</li>)}</ol></section>
                  <p className="rights-note">{brandPack.photoRightsNotice}</p>
                </div>
              </div>
              <div className="action-row">
                {regenerationFailure?.safeErrorMessage ? (
                  <p className="error-message" role="alert">{regenerationFailure.safeErrorMessage}</p>
                ) : null}
                {isDraft ? (
                  <>
                    <form action={transitionPostAction}>
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="version" value={post.version} />
                      <input type="hidden" name="target" value="approved" />
                      <SubmitButton className="button" disabled={!canApprove}>Approve</SubmitButton>
                    </form>
                    {!canApprove ? <p className="warning">Render a complete current preview set before approval.</p> : null}
                    <form action={transitionPostAction}>
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="version" value={post.version} />
                      <input type="hidden" name="target" value="rejected" />
                      <SubmitButton className="button button-secondary">Reject</SubmitButton>
                    </form>
                    <form action={regeneratePostAction}>
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="version" value={post.version} />
                      <input type="hidden" name="requestKey" value={createSubmissionKey()} />
                      <SubmitButton className="button button-secondary">Regenerate</SubmitButton>
                    </form>
                  </>
                ) : (
                  <form action={transitionPostAction}>
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="version" value={post.version} />
                    <input type="hidden" name="format" value={post.format} />
                    <input type="hidden" name="slideCount" value={post.slides.length} />
                    <input type="hidden" name="target" value="draft" />
                    <SubmitButton>Return to draft</SubmitButton>
                  </form>
                )}
              </div>
              {isDraft ? (
                <details className="edit-panel">
                  <summary>Edit post</summary>
                  <form action={editPostAction} className="campaign-form">
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="version" value={post.version} />
                    <input type="hidden" name="format" value={post.format} />
                    <input type="hidden" name="slideCount" value={post.slides.length} />
                    <div className="field-grid">
                      <label><span>Objective</span><select name="objective" defaultValue={post.objective}>{CAMPAIGN_OBJECTIVES.map((v) => <option key={v}>{v}</option>)}</select></label>
                      <label><span>Pillar</span><select name="pillar" defaultValue={post.pillar}>{brandPack.contentPillars.map((v) => <option key={v}>{v}</option>)}</select></label>
                      <label><span>Date</span><input type="date" name="proposedDate" defaultValue={post.proposedDate} required /></label>
                      <label><span>Engagement intent</span><select name="engagementIntent" defaultValue={post.engagementIntent}>{ENGAGEMENT_INTENTS.map((v) => <option key={v}>{v}</option>)}</select></label>
                      <label><span>Content structure</span><select name="contentStructure" defaultValue={post.contentStructure}>{CONTENT_STRUCTURES.map((v) => <option key={v}>{v}</option>)}</select></label>
                    </div>
                    <label><span>Engagement CTA</span><input name="engagementCta" defaultValue={post.engagementCta} required /></label>
                    <label><span>Instagram caption</span><textarea name="instagramCaption" defaultValue={post.instagramCaption} required /></label>
                    <label><span>Facebook caption</span><textarea name="facebookCaption" defaultValue={post.facebookCaption} required /></label>
                    <label><span>Hashtags</span><input name="hashtags" defaultValue={tags.join(" ")} required /></label>
                    <div className="slide-edit-list">{post.slides.map((slide, slideIndex) => (
                      <fieldset className="slide-edit" key={slide.id}>
                        <legend>Slide {slideIndex + 1} · {slide.role}</legend>
                        <input type="hidden" name={`slide.${slideIndex}.role`} value={slide.role} />
                        <label><span>Template</span><select name={`slide.${slideIndex}.visualTemplate`} defaultValue={slide.visualTemplate}>{VISUAL_TEMPLATES.map((v) => <option key={v}>{v}</option>)}</select></label>
                        <label><span>Headline</span><input name={`slide.${slideIndex}.headline`} defaultValue={slide.headline} maxLength={90} required /></label>
                        <label><span>Emphasis</span><input name={`slide.${slideIndex}.emphasis`} defaultValue={slide.emphasis ?? ""} maxLength={50} /></label>
                        <label><span>Body</span><textarea name={`slide.${slideIndex}.body`} defaultValue={slide.body ?? ""} maxLength={280} /></label>
                        <label><span>Footer</span><input name={`slide.${slideIndex}.footer`} defaultValue={slide.footer ?? ""} maxLength={100} /></label>
                        <label><span>Alt text</span><textarea name={`slide.${slideIndex}.altText`} defaultValue={slide.altText} maxLength={500} required /></label>
                        <label><span>Photo</span><select name={`slide.${slideIndex}.photoAssetId`} defaultValue={slide.photoAssetId ?? ""}><option value="">No photo</option>{brandPack.photoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
                      </fieldset>
                    ))}</div>
                    <SubmitButton pendingLabel="Saving and rendering…">Save changes</SubmitButton>
                  </form>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
