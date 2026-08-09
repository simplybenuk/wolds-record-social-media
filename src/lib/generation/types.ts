import type { BrandPack, GeneratedCampaign, GeneratedPost } from "@/features/campaigns/types";

export type CampaignGenerationRequest = {
  brief: string;
  postCount: number;
  startDate: string;
  endDate: string;
  brandPack: BrandPack;
};

export type PostRegenerationRequest = {
  campaignBrief: string;
  campaignTitle: string;
  post: GeneratedPost;
  brandPack: BrandPack;
};

export type GenerationUsage = {
  responseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GenerationResult = {
  campaign: GeneratedCampaign;
  usage: GenerationUsage;
};

export interface CampaignGenerator {
  readonly mode: "fixture" | "live";
  generateCampaign(request: CampaignGenerationRequest): Promise<GenerationResult>;
  regeneratePost(request: PostRegenerationRequest): Promise<GenerationResult>;
}
