import { generatedCampaignSchemaForPack } from "@/features/campaigns/schemas";
import { CampaignDomainValidationError, validateGeneratedCampaign } from "@/features/campaigns/domain-validation";
import type { BrandPack, GeneratedCampaign } from "@/features/campaigns/types";
import { GenerationError } from "./errors";
import type {
  CampaignGenerationRequest,
  CampaignGenerator,
  GenerationResult,
  PostRegenerationRequest,
} from "./types";

type ParsedResponse = {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output_parsed?: unknown;
  output?: ReadonlyArray<{ content?: ReadonlyArray<{ type?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
};

export type ResponsesClient = {
  responses: {
    parse(input: Record<string, unknown>): Promise<ParsedResponse>;
  };
};

type FormatFactory = (schema: unknown, name: string) => unknown;

async function defaultClient() {
  const [{ default: OpenAI }, { zodTextFormat }] = await Promise.all([
    import("openai"),
    import("openai/helpers/zod"),
  ]);
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as ResponsesClient,
    formatFactory: zodTextFormat as FormatFactory,
  };
}

function refusalFrom(response: ParsedResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal") return content.refusal ?? "The request was refused.";
    }
  }
}

function promptInput(
  prompt: string,
  brandPack: BrandPack,
  request: CampaignGenerationRequest | PostRegenerationRequest,
) {
  const operation = "campaignBrief" in request
    ? "Generate exactly one materially different replacement post. Preserve the supplied proposed date and respond with a one-post campaign object."
    : "Generate the requested campaign within the supplied date bounds and post count.";
  return [
    { role: "developer", content: prompt + "\n\nBRAND PACK:\n" + JSON.stringify(brandPack) },
    {
      role: "user",
      content:
        operation +
        "\n\n" +
        "<untrusted_campaign_input>\n" +
        JSON.stringify(request) +
        "\n</untrusted_campaign_input>",
    },
  ];
}

export class OpenAICampaignGenerator implements CampaignGenerator {
  readonly mode = "live" as const;

  constructor(
    private readonly model: string,
    private readonly prompt: string,
    private readonly dependencies = defaultClient,
  ) {
    if (!model.trim()) throw new GenerationError("generation_unavailable", "No OpenAI model is configured.");
  }

  async generateCampaign(request: CampaignGenerationRequest): Promise<GenerationResult> {
    const output = await this.request(request.brandPack, request);
    return {
      campaign: this.validate(output.parsed, request, output.usage),
      usage: output.usage,
    };
  }

  async regeneratePost(request: PostRegenerationRequest): Promise<GenerationResult> {
    const output = await this.request(request.brandPack, request);
    const campaign = this.validate(output.parsed, {
      brief: request.campaignBrief,
      postCount: 1,
      startDate: request.post.proposedDate,
      endDate: request.post.proposedDate,
      brandPack: request.brandPack,
    }, output.usage);
    if (campaign.posts[0]!.proposedDate !== request.post.proposedDate) {
      throw new GenerationError(
        "generation_domain_invalid",
        "The replacement changed the proposed date.",
        undefined,
        output.usage,
      );
    }
    return { campaign, usage: output.usage };
  }

  private validate(
    input: unknown,
    request: CampaignGenerationRequest,
    usage?: GenerationResult["usage"],
  ): GeneratedCampaign {
    try {
      return validateGeneratedCampaign(input, {
        requestedPostCount: request.postCount,
        startDate: request.startDate,
        endDate: request.endDate,
        brandPack: request.brandPack,
      });
    } catch (error) {
      if (error instanceof CampaignDomainValidationError) {
        throw new GenerationError(
          "generation_domain_invalid",
          "Generated content did not meet the campaign rules.",
          error,
          usage,
        );
      }
      throw new GenerationError(
        "generation_schema_invalid",
        "Generated content did not match the required format.",
        error,
        usage,
      );
    }
  }

  private async request(brandPack: BrandPack, request: CampaignGenerationRequest | PostRegenerationRequest) {
    try {
      const { client, formatFactory } = await this.dependencies();
      const response = await client.responses.parse({
        model: this.model,
        store: false,
        input: promptInput(this.prompt, brandPack, request),
        text: {
          format: formatFactory(
            generatedCampaignSchemaForPack(brandPack),
            "wolds_record_campaign",
          ),
        },
      });
      const usage = {
        responseId: response.id,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
      };
      const refusal = refusalFrom(response);
      if (refusal) {
        throw new GenerationError(
          "generation_refused",
          "The model declined this campaign request.",
          undefined,
          usage,
        );
      }
      if (response.status && response.status !== "completed") {
        throw new GenerationError(
          "generation_incomplete",
          "The model response was incomplete.",
          undefined,
          usage,
        );
      }
      if (!response.output_parsed) {
        throw new GenerationError(
          "generation_schema_invalid",
          "The model returned no structured campaign.",
          undefined,
          usage,
        );
      }
      return {
        parsed: response.output_parsed,
        usage,
      };
    } catch (error) {
      if (error instanceof GenerationError) throw error;
      const name = error instanceof Error ? error.name : "";
      if (/timeout/i.test(name)) {
        throw new GenerationError("generation_timeout", "OpenAI did not respond in time.", error);
      }
      if (/connection|network|fetch/i.test(name)) {
        throw new GenerationError("generation_network", "OpenAI could not be reached.", error);
      }
      throw new GenerationError("generation_unavailable", "OpenAI generation is unavailable.", error);
    }
  }
}
