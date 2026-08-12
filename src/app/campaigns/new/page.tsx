import type { Metadata } from "next";
import Link from "next/link";

import { createCampaignAction } from "@/features/campaigns/actions";
import { createSubmissionKey } from "@/features/campaigns/ids";
import { listRecentCampaigns } from "@/features/campaigns/repository";
import { getDatabase } from "@/db";
import type { CampaignRow } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";
import { enabledBrandPacks } from "@/lib/brand/packs";

export const metadata: Metadata = {
  title: "New campaign",
};

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const recent = listRecentCampaigns(getDatabase());
  const brands = enabledBrandPacks();
  return (
    <div className="stack">
      <section aria-labelledby="new-campaign-title" className="page-card">
        <p className="eyebrow">Wolds Social Studio</p>
        <h1 id="new-campaign-title">Create a campaign</h1>
        <p className="lede">
          Turn one clear brief into a small set of static posts, then review every
          visual and caption before approving anything.
        </p>
        <p className="privacy-note" role="note">
          Keep personal data out of campaign briefs. Do not include client names,
          contact details, or clinical records.
        </p>
        {error ? <p className="error-message" role="alert">{error}</p> : null}
        <form action={createCampaignAction} className="campaign-form">
          <input name="submissionKey" type="hidden" value={createSubmissionKey()} />
          <label>
            <span>Brand</span>
            <select aria-describedby="brand-note" defaultValue="" name="brandId" required>
              <option disabled value="">Choose a brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.displayName}</option>
              ))}
            </select>
          </label>
          <small id="brand-note">The selected brand is fixed when the campaign is created.</small>
          <fieldset className="format-preference">
            <legend>Creative format</legend>
            <label><input defaultChecked name="formatPreference" type="radio" value="auto" /><span><strong>Automatic mix</strong><small>Choose portrait images and carousels to suit the content.</small></span></label>
            <label><input name="formatPreference" type="radio" value="image" /><span><strong>Portrait images</strong><small>One 4:5 image per post.</small></span></label>
            <label><input name="formatPreference" type="radio" value="carousel" /><span><strong>Carousels</strong><small>Three to seven ordered 4:5 slides per post.</small></span></label>
          </fieldset>
          <small>Reels are not available in the campaign studio yet.</small>
          <label>
            <span>Campaign brief</span>
            <textarea
              name="brief"
              minLength={20}
              maxLength={2000}
              required
              rows={7}
              placeholder="Create three posts about calmer record keeping for busy canine therapists…"
            />
          </label>
          <div className="field-grid">
            <label>
              <span>Number of posts</span>
              <input defaultValue={3} max={6} min={1} name="postCount" required type="number" />
            </label>
            <label>
              <span>Start date</span>
              <input name="startDate" required type="date" />
            </label>
            <label>
              <span>End date</span>
              <input name="endDate" required type="date" />
            </label>
          </div>
          <SubmitButton pendingLabel="Saving campaign…">Create campaign</SubmitButton>
        </form>
      </section>
      {recent.length ? (
        <section className="recent" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent campaigns</h2>
          <ul>
            {recent.map((campaign: CampaignRow) => (
              <li key={campaign.id}>
                <Link href={"/campaigns/" + campaign.id}>
                  <span>{campaign.title ?? "Campaign in progress"}</span>
                  <small>{campaign.status} · {campaign.createdAt.slice(0, 10)}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
