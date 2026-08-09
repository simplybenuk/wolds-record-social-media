import { validateGeneratedCampaign } from "@/features/campaigns/domain-validation";
import type { GeneratedPost } from "@/features/campaigns/types";
import type {
  CampaignGenerationRequest,
  CampaignGenerator,
  GenerationResult,
  PostRegenerationRequest,
} from "./types";

const templates = ["problem", "feature", "hook", "cta"] as const;
const pillars = [
  "admin-pain",
  "record-keeping",
  "therapist-workflow",
  "vet-communication",
  "product-update",
  "founder-journey",
] as const;
const objectives = ["awareness", "education", "trust", "engagement", "product"] as const;

function dateAt(start: string, end: string, index: number, count: number) {
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  const step = count <= 1 ? 0 : Math.floor((endMs - startMs) / (count - 1));
  return new Date(startMs + step * index).toISOString().slice(0, 10);
}

function fixturePost(index: number, date: string, request: CampaignGenerationRequest): GeneratedPost {
  const number = index + 1;
  const assets = request.brandPack.photoAssets;
  const headline = [
    "When admin follows you home",
    "Clear records, calmer follow-up",
    "Keep the useful detail close",
    "Make referral notes easier to revisit",
    "Useful before clever",
    "Building around practitioner workflows",
  ][index]!;
  return {
    objective: objectives[index % objectives.length]!,
    pillar: pillars[index % pillars.length]!,
    proposedDate: date,
    visualTemplate: templates[index % templates.length]!,
    headline,
    emphasis: index % 2 === 0 ? headline.split(" ").slice(-2).join(" ") : null,
    body: "Wolds Record is being built to support clear records for canine therapy work.",
    footer: index % 2 === 0 ? "Follow along as we build" : "Tell us what would save you time",
    instagramCaption:
      "A calmer way to think about practitioner records. Wolds Record is being built around the details worth keeping.",
    facebookCaption:
      "What part of record keeping takes the most energy in your week? Wolds Record is being built with practical canine therapy workflows in mind.",
    hashtags: request.brandPack.defaultHashtags.slice(0, 5),
    altText: "Wolds Record branded graphic with the headline: " + headline,
    photoAssetId: number % 3 === 0 ? null : assets[index % assets.length]!.id,
  };
}

export class FixtureCampaignGenerator implements CampaignGenerator {
  readonly mode = "fixture" as const;

  async generateCampaign(request: CampaignGenerationRequest): Promise<GenerationResult> {
    const raw = {
      campaignTitle: "Clear records for busy practitioners",
      posts: Array.from({ length: request.postCount }, (_, index) =>
        fixturePost(index, dateAt(request.startDate, request.endDate, index, request.postCount), request),
      ),
    };
    return {
      campaign: validateGeneratedCampaign(raw, {
        requestedPostCount: request.postCount,
        startDate: request.startDate,
        endDate: request.endDate,
        brandPack: request.brandPack,
      }),
      usage: {},
    };
  }

  async regeneratePost(request: PostRegenerationRequest): Promise<GenerationResult> {
    const replacement = {
      ...request.post,
      headline: request.post.headline + " — another angle",
      emphasis: null,
      instagramCaption: request.post.instagramCaption + " What would make your admin feel lighter?",
      facebookCaption: request.post.facebookCaption + " Share the workflow you would simplify first.",
    };
    return {
      campaign: validateGeneratedCampaign(
        { campaignTitle: request.campaignTitle, posts: [replacement] },
        {
          requestedPostCount: 1,
          startDate: request.post.proposedDate,
          endDate: request.post.proposedDate,
          brandPack: request.brandPack,
        },
      ),
      usage: {},
    };
  }
}
