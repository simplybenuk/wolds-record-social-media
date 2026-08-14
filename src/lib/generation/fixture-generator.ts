import { validateGeneratedCampaign } from "@/features/campaigns/domain-validation";
import type { GeneratedPost, GeneratedSlide } from "@/features/campaigns/types";
import type { CampaignGenerationRequest, CampaignGenerator, GenerationResult, PostRegenerationRequest } from "./types";

const intents = ["save", "comment", "follow", "send", "enquire"] as const;
const structures = ["checklist", "question", "point-of-view", "workflow", "point-of-view"] as const;
const templates = ["bold-hook", "photo-led", "useful-point", "contrast", "human-prompt", "action"] as const;
const fixtureContent: Record<string, { title: string; headlines: string[]; body: string; instagram: string; facebook: string; altPrefix: string }> = {
  record: { title: "Clear records for busy practitioners", headlines: ["Three details worth keeping close", "Which admin task would you simplify?", "Useful record ideas, week by week", "Send this to a practitioner planning calmer admin", "A clearer starting point for record keeping", "Small workflow choices add up"], body: "Wolds Record is being built around the practical details canine therapy practitioners need to revisit.", instagram: "Clearer records start with deciding what will be useful later. Here is one practical way to make the working week feel calmer.", facebook: "Record keeping connects the details practitioners need to return to. This post offers one practical prompt for a calmer workflow.", altPrefix: "Wolds Record portrait slide: " },
  massage: { title: "Calm, practical support for dogs and owners", headlines: ["Save these questions before an appointment", "What helps your dog settle into a new place?", "Follow for calm canine wellbeing guidance", "Send this to an owner preparing for an appointment", "Questions are welcome before booking", "A calm appointment starts before arrival"], body: "Clear questions and a calm conversation help owners understand what to expect, alongside veterinary advice.", instagram: "Every dog is different. These practical prompts can help owners prepare for a calm conversation about canine massage.", facebook: "Owners can bring questions and observations to an appointment while continuing to follow veterinary advice.", altPrefix: "Wolds Canine Massage Therapy portrait slide: " },
  academy: { title: "Practical learning for you and your dog", headlines: ["Save this simple at-home learning checklist", "What would you like to understand about your dog next?", "Follow for practical learning ideas for dog owners", "Send this to a dog owner learning about canine wellbeing", "Ask which owner learning route fits your goal", "Build your understanding one useful step at a time"], body: "Practical, flexible learning gives dog owners room to understand and support their own dogs step by step.", instagram: "Useful learning makes space for questions. Start with one clear idea and build your understanding of your own dog step by step.", facebook: "Practical canine learning for dog owners can begin with a focused question and develop at a pace that fits life at home.", altPrefix: "Wolds Canine Therapy Academy portrait slide: " },
};

function dateAt(start: string, end: string, index: number, count: number) {
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  const step = count <= 1 ? 0 : Math.floor((endMs - startMs) / (count - 1));
  return new Date(startMs + step * index).toISOString().slice(0, 10);
}

function resolvedFormat(index: number, request: CampaignGenerationRequest): "image" | "carousel" {
  const preference = request.formatPreference ?? "image";
  if (preference !== "auto") return preference;
  return request.postCount >= 2 && index % 2 === 1 ? "carousel" : "image";
}

function cta(index: number, request: CampaignGenerationRequest) {
  const intent = intents[index % intents.length]!;
  if (intent === "save") return "Save this for the next time you plan your week";
  if (intent === "comment") return "What would you make simpler first?";
  if (intent === "follow") return "Follow for more practical, brand-relevant guidance";
  if (intent === "send") return "Send this to someone working through the same situation";
  return request.brandPack.callsToAction[index % request.brandPack.callsToAction.length]!;
}

function slidesFor(index: number, format: "image" | "carousel", request: CampaignGenerationRequest): GeneratedSlide[] {
  const content = fixtureContent[request.brandPack.id] ?? fixtureContent.record!;
  const count = format === "image" ? 1 : 4;
  const headline = content.headlines[index % content.headlines.length]!;
  return Array.from({ length: count }, (_, ordinal) => {
    const role = format === "image" ? "standalone" : ordinal === 0 ? "cover" : ordinal === count - 1 ? "action" : "content";
    const slideHeadline = ordinal === 0 ? headline : ordinal === count - 1 ? cta(index, request) : `${ordinal}. ${ordinal === 1 ? "Notice the useful detail" : "Choose the next practical step"}`;
    return {
      ordinal,
      role,
      visualTemplate: role === "action" ? "action" : templates[(index + ordinal) % (templates.length - 1)]!,
      headline: slideHeadline,
      body: role === "cover" ? null : content.body,
      emphasis: null,
      footer: role === "action" || format === "image" ? cta(index, request) : null,
      photoAssetId: (ordinal + index) % 3 === 0 ? null : request.brandPack.photoAssets[(ordinal + index) % request.brandPack.photoAssets.length]!.id,
      altText: content.altPrefix + slideHeadline,
    };
  });
}

function fixturePost(index: number, date: string, request: CampaignGenerationRequest): GeneratedPost {
  const content = fixtureContent[request.brandPack.id] ?? fixtureContent.record!;
  const format = resolvedFormat(index, request);
  return {
    format,
    objective: ["education", "engagement", "awareness", "trust", "product"][index % 5] as GeneratedPost["objective"],
    pillar: request.brandPack.contentPillars[index % request.brandPack.contentPillars.length]!,
    proposedDate: date,
    engagementIntent: intents[index % intents.length]!,
    contentStructure: structures[index % structures.length]!,
    engagementCta: cta(index, request),
    instagramCaption: `${content.instagram} ${index + 1}.`,
    facebookCaption: `${content.facebook} Topic ${index + 1}.`,
    hashtags: request.brandPack.defaultHashtags.slice(0, 5),
    slides: slidesFor(index, format, request),
  };
}

export class FixtureCampaignGenerator implements CampaignGenerator {
  readonly mode = "fixture" as const;
  async generateCampaign(request: CampaignGenerationRequest): Promise<GenerationResult> {
    const raw = { campaignTitle: (fixtureContent[request.brandPack.id] ?? fixtureContent.record!).title, posts: Array.from({ length: request.postCount }, (_, index) => fixturePost(index, dateAt(request.startDate, request.endDate, index, request.postCount), request)) };
    return { campaign: validateGeneratedCampaign(raw, { requestedPostCount: request.postCount, startDate: request.startDate, endDate: request.endDate, brandPack: request.brandPack, formatPreference: request.formatPreference ?? "image" }), usage: {} };
  }
  async regeneratePost(request: PostRegenerationRequest): Promise<GenerationResult> {
    const slides = request.post.slides.map((slide) => ({ ...slide, headline: slide.headline + " — another angle", emphasis: null, altText: slide.altText + " Alternative treatment." }));
    const replacement = { ...request.post, instagramCaption: request.post.instagramCaption + " A fresh angle for review.", facebookCaption: request.post.facebookCaption + " Here is another practical angle.", slides };
    return { campaign: validateGeneratedCampaign({ campaignTitle: request.campaignTitle, posts: [replacement] }, { requestedPostCount: 1, startDate: request.post.proposedDate, endDate: request.post.proposedDate, brandPack: request.brandPack, fixedFormat: request.post.format, fixedSlideCount: request.post.slides.length }), usage: {} };
  }
}
