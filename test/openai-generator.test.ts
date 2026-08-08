import assert from "node:assert/strict";
import test from "node:test";

import { FixtureCampaignGenerator } from "../src/lib/generation/fixture-generator.ts";
import { OpenAICampaignGenerator } from "../src/lib/generation/openai-generator.ts";
import { GenerationError } from "../src/lib/generation/errors.ts";
import { recordBrandPack } from "../src/lib/brand/record.ts";

const request = {
  brief: "Create practical posts about calmer canine therapy record keeping.",
  postCount: 1,
  startDate: "2026-09-01",
  endDate: "2026-09-02",
  brandPack: recordBrandPack,
};

async function validOutput() {
  return (await new FixtureCampaignGenerator().generateCampaign(request)).campaign;
}

test("live generation uses stateless strict parsing with no tools and stores usage", async () => {
  const calls: Record<string, unknown>[] = [];
  const generator = new OpenAICampaignGenerator(
    "configured-model",
    "Developer-owned rules",
    async () => ({
      client: {
        responses: {
          async parse(input) {
            calls.push(input);
            return {
              id: "resp_test",
              status: "completed",
              output_parsed: await validOutput(),
              usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
            };
          },
        },
      },
      formatFactory: (_schema, name) => ({ type: "json_schema", name, strict: true }),
    }),
  );
  const result = await generator.generateCampaign(request);
  assert.equal(result.campaign.posts.length, 1);
  assert.deepEqual(result.usage, {
    responseId: "resp_test",
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  });
  assert.equal(calls[0]!.store, false);
  assert.equal("tools" in calls[0]!, false);
  assert.equal((calls[0]!.text as { format: { strict: boolean } }).format.strict, true);
});

test("live regeneration explicitly requests a materially different date-preserving replacement", async () => {
  const calls: Record<string, unknown>[] = [];
  const output = await validOutput();
  const generator = new OpenAICampaignGenerator("configured-model", "rules", async () => ({
    client: {
      responses: {
        async parse(input) {
          calls.push(input);
          return { status: "completed", output_parsed: output };
        },
      },
    },
    formatFactory: () => ({}),
  }));
  await generator.regeneratePost({
    campaignBrief: request.brief,
    campaignTitle: output.campaignTitle,
    post: output.posts[0]!,
    brandPack: recordBrandPack,
  });
  const input = calls[0]!.input as Array<{ role: string; content: string }>;
  const userInstruction = input.find((item) => item.role === "user")!.content;
  assert.match(userInstruction, /materially different replacement/i);
  assert.match(userInstruction, /preserve the supplied proposed date/i);
});

test("refusal, incomplete, schema and transport failures map to stable errors", async (t) => {
  const cases = [
    {
      name: "refusal",
      response: {
        id: "resp_refusal",
        status: "completed",
        output: [{ content: [{ type: "refusal", refusal: "no" }] }],
        usage: { input_tokens: 4, output_tokens: 1, total_tokens: 5 },
      },
      code: "generation_refused",
    },
    {
      name: "incomplete",
      response: {
        id: "resp_incomplete",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      },
      code: "generation_incomplete",
    },
    {
      name: "missing parsed output",
      response: { id: "resp_schema", status: "completed", output_parsed: null },
      code: "generation_schema_invalid",
    },
  ] as const;
  for (const item of cases) {
    await t.test(item.name, async () => {
      const generator = new OpenAICampaignGenerator("configured-model", "rules", async () => ({
        client: { responses: { async parse() { return item.response; } } },
        formatFactory: () => ({}),
      }));
      await assert.rejects(
        generator.generateCampaign(request),
        (error: unknown) => {
          if (!(error instanceof GenerationError) || error.code !== item.code) return false;
          if (item.name === "refusal" || item.name === "incomplete") {
            return error.usage?.responseId === item.response.id && error.usage.totalTokens! > 0;
          }
          return true;
        },
      );
    });
  }

  for (const [name, code] of [["APIConnectionTimeoutError", "generation_timeout"], ["APIConnectionError", "generation_network"]] as const) {
    await t.test(name, async () => {
      const generator = new OpenAICampaignGenerator("configured-model", "rules", async () => ({
        client: { responses: { async parse() { const error = new Error("failed"); error.name = name; throw error; } } },
        formatFactory: () => ({}),
      }));
      await assert.rejects(
        generator.generateCampaign(request),
        (error: unknown) => error instanceof GenerationError && error.code === code,
      );
    });
  }
});
