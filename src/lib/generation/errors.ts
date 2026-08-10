export type GenerationErrorCode =
  | "generation_refused"
  | "generation_incomplete"
  | "generation_schema_invalid"
  | "generation_domain_invalid"
  | "generation_timeout"
  | "generation_network"
  | "generation_conflict"
  | "generation_unavailable";

export class GenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
    readonly cause?: unknown,
    readonly usage?: {
      responseId?: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    },
  ) {
    super(message);
    this.name = "GenerationError";
  }
}
