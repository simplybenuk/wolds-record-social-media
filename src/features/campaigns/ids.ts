import { randomUUID } from "node:crypto";

import type {
  CampaignId,
  DraftPostId,
  GenerationAttemptId,
  SubmissionKey,
} from "./types.ts";

export function createCampaignId(): CampaignId {
  return newOpaqueId("cmp") as CampaignId;
}

export function createDraftPostId(): DraftPostId {
  return newOpaqueId("post") as DraftPostId;
}

export function createGenerationAttemptId(): GenerationAttemptId {
  return newOpaqueId("att") as GenerationAttemptId;
}

export function createSubmissionKey(): SubmissionKey {
  return randomUUID() as SubmissionKey;
}

export function newOpaqueId(prefix: "cmp" | "post" | "att"): string {
  return prefix + "_" + randomUUID();
}
