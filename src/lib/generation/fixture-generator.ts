import { validateGeneratedCampaign } from "@/features/campaigns/domain-validation";
import type { GeneratedPost } from "@/features/campaigns/types";
import type {
  CampaignGenerationRequest,
  CampaignGenerator,
  GenerationResult,
  PostRegenerationRequest,
} from "./types";

const templates = ["problem", "feature", "hook", "cta"] as const;
const objectives = ["awareness", "education", "trust", "engagement", "product"] as const;

const fixtureContent: Record<string, {
  title: string;
  headlines: string[];
  body: string;
  instagram: string;
  facebook: string;
  altPrefix: string;
}> = {
  record: {
    title: "Clear records for busy practitioners",
    headlines: [
      "When admin follows you home",
      "Clear records, calmer follow-up",
      "Keep the useful detail close",
      "Make referral notes easier to revisit",
      "Useful before clever",
      "Building around practitioner workflows",
    ],
    body: "Wolds Record is being built to support clear records for canine therapy work.",
    instagram: "A calmer way to think about practitioner records. Wolds Record is being built around the details worth keeping.",
    facebook: "What part of record keeping takes the most energy in your week? Wolds Record is being built with practical canine therapy workflows in mind.",
    altPrefix: "Wolds Record branded graphic with the headline: ",
  },
  massage: {
    title: "Calm, practical support for dogs and owners",
    headlines: [
      "A calmer start for your dog's appointment",
      "Learning what your dog needs",
      "Small details help guide good care",
      "Questions are welcome before booking",
      "Support alongside veterinary advice",
      "Every dog deserves individual attention",
    ],
    body: "Wolds Canine Massage Therapy offers calm, practical support for dogs and their owners.",
    instagram: "Every dog is different. Clear questions and a calm conversation can help owners understand what to expect from canine massage therapy.",
    facebook: "If you are wondering whether canine massage could be appropriate for your dog, start with a conversation. Veterinary advice remains important, and questions are welcome before booking.",
    altPrefix: "Wolds Canine Massage Therapy graphic with the headline: ",
  },
  academy: {
    title: "Practical learning for canine wellbeing",
    headlines: [
      "Learning starts with a curious question",
      "Build your canine massage knowledge step by step",
      "Practical learning for dog guardians",
      "Explore a new direction with care",
      "Skilled, compassionate touch starts with understanding",
      "There is always more to learn about dogs",
    ],
    body: "Wolds Canine Therapy Academy provides flexible learning for dog guardians and people developing canine therapy skills.",
    instagram: "Good learning makes space for questions. Explore practical canine massage education for guardians and people developing their therapy knowledge.",
    facebook: "Whether you are learning for your own dog or exploring a canine therapy journey, the Academy is built around practical, compassionate learning that can grow with you.",
    altPrefix: "Wolds Canine Therapy Academy graphic with the headline: ",
  },
};

function dateAt(start: string, end: string, index: number, count: number) {
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  const step = count <= 1 ? 0 : Math.floor((endMs - startMs) / (count - 1));
  return new Date(startMs + step * index).toISOString().slice(0, 10);
}

function fixturePost(index: number, date: string, request: CampaignGenerationRequest): GeneratedPost {
  const number = index + 1;
  const assets = request.brandPack.photoAssets;
  const content = fixtureContent[request.brandPack.id] ?? fixtureContent.record;
  const headline = content.headlines[index % content.headlines.length]!;
  return {
    objective: objectives[index % objectives.length]!,
    pillar: request.brandPack.contentPillars[index % request.brandPack.contentPillars.length]!,
    proposedDate: date,
    visualTemplate: templates[index % templates.length]!,
    headline,
    emphasis: index % 2 === 0 ? headline.split(" ").slice(-2).join(" ") : null,
    body: content.body,
    footer: request.brandPack.callsToAction[index % request.brandPack.callsToAction.length]!,
    instagramCaption: content.instagram,
    facebookCaption: content.facebook,
    hashtags: request.brandPack.defaultHashtags.slice(0, 5),
    altText: content.altPrefix + headline,
    photoAssetId: number % 3 === 0 ? null : assets[index % assets.length]!.id,
  };
}

export class FixtureCampaignGenerator implements CampaignGenerator {
  readonly mode = "fixture" as const;

  async generateCampaign(request: CampaignGenerationRequest): Promise<GenerationResult> {
    const raw = {
      campaignTitle: (fixtureContent[request.brandPack.id] ?? fixtureContent.record).title,
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
